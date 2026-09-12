# W3.2 Promotion Evidence

Date: 2026-09-12
Linear authority: ROT-87
Bounded correctness child: ROT-121
Repository: `rotprods/cos-graph-engine`

## Purpose

This document preserves the post-W2 promotion REDs, the control-plane reconciliation they required, and every bounded mutation discovered by the exact promotion gauntlet. Prior GREEN evidence is never reused after the candidate changes.

## Frozen authorities

- live `main` at W3.2 activation: `3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83`
- W3.1 prequalified head: `04e6222a7541d14ffed66eef16de5bd8f59720e6`
- W2 qualified source head: `3ff1609cf7270e393f9fa0f7e89da97fbf0a6651`
- W2 qualified synthetic candidate: `1a67e2c733510dcec2f9973c37365a5b4c1af330`
- W2 Security Closure run: `34713960872` PASS

The W3.2 successor branch `integration/cgev11-w3-2-promotion-20260912` was created directly from the exact W2 source head `3ff1609c...`. The qualified W2 branch itself is not rewritten.

## RED 1 — unchanged W3.1 promotion harness against post-W2 source

Draft PR #118 promoted the unchanged W2 source head directly to `main` before modifying the W3.1 promotion controls.

Exact PR #118 synthetic merge candidate: `9a81b670744d13940f104410b858d716d0ef78d8`.

Recovery Stack run `34716438806` produced fail-closed evidence:

- Node26 job `103614440419`: PASS through exact ancestry, pinned sandbox TCB, strict TypeScript, W1B, W1C, W1D and full canonical suite.
- Node22 job `103614440520`: the same functional/security/canonical contracts PASS until integrated coverage.
- observed coverage: statements `79.39%`, branches `80.20%`, functions `85.66%`, lines `79.39%`.
- strongest W1D floor: statements `80.05%`, branches `80.05%`, functions `85.8%`, lines `80.05%`.
- Node22 evidence artifact: `10303834859`, digest `sha256:e55f834bb692acc092747267ab98674afd71aefabde3cc7c166046f4885f7ffe`.

Root cause: the unchanged W3.1 coverage corpus predates W2 and therefore omitted the qualified W2 operator/auth and HTTP trust-boundary suites. The unchanged W3.1 scope lock also predates the exact 13-file W2-qualified delta. The already-qualified W2 gate executed those suites and measured `80.73 / 80.11 / 86.15 / 80.73`, above the same strongest floor.

PR #118 is closed unmerged and retained as RED provenance.

## Additive post-W2 promotion-harness reconciliation

The recovery workflow was changed only to:

1. bind `W2_SHA=3ff1609cf7270e393f9fa0f7e89da97fbf0a6651` as mandatory ancestry in both Node22 and Node26 lanes;
2. bind the exact W3.1 base required by the W2 production-security checker;
3. rerun W2 operator/auth rollout, HTTP trust-boundary and production-security AST checks on the exact promotion candidate in both runtimes;
4. add the two W2 executable regression suites to the integrated c8 corpus while leaving `scripts/check-cgev11-stack-coverage.mjs` and its floors unchanged;
5. extend the mutation allowlist only to qualified W2 files and explicit W3.2-owned mutations;
6. preserve workflow-safety, dynamic-code/type bypass detection, high-severity dependency audit, W1B/W1C/W1D contracts, full canonical suite, pinned Docker TCB and exact-SHA aggregate receipts.

No assertion, coverage floor, audit severity, runtime version, sandbox digest or fail-closed control was weakened.

## RED 2 — promotion gauntlet exposes structured-trace timing corruption

After the control-plane reconciliation, PR #119 produced exact synthetic candidate `df70d95b14309b67b901e0d67cf467c66ef8a106`.

Recovery run `34716830968`, Node26 job `103615481314`, passed:

- exact recovery/W2 ancestry;
- Node `26.8.2` binding;
- pinned Docker sandbox TCB;
- strict TypeScript;
- W1B, W1C and W1D authority contracts;
- W2 operator rollout `10/10`;
- W2 HTTP trust boundary `18/18`;
- W2 production-security AST checks.

`npm run test:all` then failed exactly one assertion in `scripts/test-pipeline-l45l6.ts`:

`P7: main latency = 100 (got 101)`

Pipeline result: `61 passed, 1 failed`.

Node26 RED evidence artifact: `10305495229`, digest `sha256:b209c96b503932df4b176e66cb872e7c02606b341d597820f2f5ad9f36ac5c9f`.

### Root cause

`PipelineL4L5L6.traceToCallGraph()` was using `CallGraphBuilder.enterCall()/exitCall()` to construct graph topology. It copied structured `entry.duration` into a node before `exitCall()`, but `exitCall()` subsequently added `Date.now() - span.start`. That value is valid for dynamic profiling, but inside an offline structured-trace converter it is conversion overhead rather than source timing. Usually the conversion completed within the same millisecond and the defect remained hidden; this Node26 run added 1 ms and converted an authoritative `100` into `101`.

The same precedence bug also meant structured entries without a supplied duration could accidentally inherit converter wall-clock time instead of `defaultLatencyMs`.

### Bounded repair — ROT-121

The fix is intentionally scoped to `PipelineL4L5L6`; `CallGraphBuilder` dynamic profiling semantics are unchanged.

- `packages/graph/src/pipeline-l4l5l6.ts` now tracks recorded structured durations separately from converter wall-clock timing.
- after topology bookkeeping calls `exitCall()`, converter elapsed time is discarded for structured entries;
- finite non-negative recorded durations remain authoritative and accumulate by call node;
- `0 ms` is preserved as recorded data rather than replaced by the default latency;
- entries without a recorded duration retain no converter timing and therefore continue to use `defaultLatencyMs` downstream;
- an explicit `ProgramTrace.totalDuration` remains authoritative for graph total time.

Product repair commit: `5d4df4dd5c8eb369f4d1f4a0d40101516a88019e`.

Canonical regression hardening in `scripts/test-pipeline-l45l6.ts`:

- keeps the original strict `100 === 100` P7 assertion;
- monkey-patches `Date.now()` to advance by 17 ms on every call and still requires recorded `100 ms` to remain exactly `100 ms`;
- verifies throughput remains derived from the recorded timing;
- verifies explicit trace `totalDuration=100` stays authoritative;
- verifies a missing duration uses the configured/default latency rather than converter time;
- verifies recorded `0 ms` survives through DataFlow and maps to bounded zero throughput.

Regression commit: `e8a40ca12075f3049c317f7b69c98109dfdb2b40`.

The Recovery workflow now runs this timing suite explicitly on Node22 and Node26 before the full canonical suite and adds exactly `packages/graph/src/pipeline-l4l5l6.ts` plus `scripts/test-pipeline-l45l6.ts` to its mutation allowlist. Workflow qualification commit: `9938d769dee51f685f4994d53cb767cc22629721`.

Because this is a product-code mutation above the W2 authority, **all earlier candidate GREEN results are stale for promotion**. A fresh exact synthetic merge candidate must pass both complete promotion gates from scratch.

## Current W3.2 mutation boundary

Above exact W2 head `3ff1609c...`, W3.2 owns only:

- `.github/workflows/cgev11-stack-integration.yml` — post-W2 exact promotion qualification;
- `docs/hardening/integration/W3_2_PROMOTION_EVIDENCE.md` — provenance and RED/repair evidence;
- `packages/graph/src/pipeline-l4l5l6.ts` — deterministic timing-source precedence repair discovered by the promotion gauntlet;
- `scripts/test-pipeline-l45l6.ts` — deterministic regression for that root cause.

No dependency, sandbox image, coverage checker/floor, W1/W2 security assertion or release authority is modified.

## Promotion contract

A successor promotion candidate is acceptable only if:

1. the automatic `COS Main Convergence Gate` passes, including production Docker runtime/HTTP health and the performance benchmark;
2. the reconciled `CGEV11 Recovery Stack Integration` passes on Node22 and Node26, including W1B/W1C/W1D/W2, the explicit W3.2 timing regression, full canonical suite, integrated coverage, HIGH audit and anti-bypass;
3. both gates are bound to the then-current exact synthetic merge SHA;
4. live `main` is re-read after GREEN and has not moved underneath the evidence;
5. PR reviews/threads and visible repository protection controls contain no unresolved promotion blocker.

Even a fully GREEN W3.2 candidate does not by itself certify deployment or production and does not automatically authorize merge to `main`. Parent W3 acceptance criteria and repository protection controls remain separate authorities.
