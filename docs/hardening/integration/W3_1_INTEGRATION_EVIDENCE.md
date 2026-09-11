# W3.1 Clean-room Integration Evidence

Status: FIRST WHOLE-STACK GREEN — documentation-bound successor must requalify

Date: 2026-09-11

## Objective

Qualify the live recovery lineage as one exact integration candidate without rewriting qualified product branches or authorizing a merge to `main`:

`#103 baseline -> #109 W1B -> #110 W1C -> #111 W1D -> W3.1 integration control`

Parent W3 remains blocked by W2. This ledger is integration evidence only; it is not production certification and it is not a global CGEV11 seal.

## Exact authority lineage

- #103 convergence baseline: `bc9250ccd39663cffc6860c5bbe9f1a24b0281ac`
- #109 W1B durable memory: `08c90d11d850f7c4f0c95702a4d0a541a1cf5e02`
- #110 W1C sandbox: `f85fe66bce8079c0e3ec481bbeb3a88bf2c8184c`
- #111 final live W1D: `5a0b4b2a0b97794ac8cf7feb7ca9ed26bde15c25`
- first fully GREEN integration-control head: `6e1ecc3179d17f791dedf630d578ba2852d4eadc`
- PR #116 synthetic merge checkout: `3ba1ad1cb29c942f639fd2141abfe5496d2f0896`

Verified ancestry before integration was strictly linear: #103→#109 = +12/0 behind; #109→#110 = +27/0; #110→#111 = +21/0. The integration branch was created from exact final W1D and contains no qualified product-code mutation.

## Product-diff discipline

Above final W1D, W3.1 adds only integration control/evidence:

- `.github/workflows/cgev11-stack-integration.yml`
- `scripts/check-cgev11-stack-coverage.mjs`
- `scripts/test-sandbox-security-integration.cjs`
- this evidence ledger

The original #103 `.github/workflows/ci.yml` is not forked or weakened. Because PR #116 targets `main`, the original `COS Main Convergence Gate` runs unchanged on the same PR synthetic merge checkout.

## RED → GREEN trail

### RED 1 — historical W1C module-loader incompatibility

Initial W3.1 candidate `fd0b3edfdc0148fafcca952347310b18a11d108e` passed W1B and then reproduced `TypeError: CodeSandbox is not a constructor` in the historical W1C harness on both Node22 and Node26. The current product was not changed.

Repair: W1C security semantics were carried forward through the already-qualified portable W1D5 sandbox harness plus a dedicated integration supplement. The supplement explicitly checks host global isolation, prototype isolation, console restoration, malformed resource/module configuration, unsupported-language denial, public execution export semantics and ToolRegistry API continuity. Historical W1C default-allow ToolRegistry behavior is intentionally superseded by the qualified W1D default-deny authority model.

### RED 2 — evidence guardrail self-match

After functional recovery, the integration anti-bypass regex matched its own YAML regex literal. Product/security/full-suite behavior remained green.

Repair: code/type/dynamic-code scanning remains strict for JS/TS-family files; workflow safety is independently checked by canonical `scripts/test-workflow-safety.mjs`; fail-open workflow keys are checked explicitly without a self-referential literal. No guardrail was removed.

### RED 3 — coverage-order nondeterminism

Candidate `71ac7f041d6adc03de211b0d9f49c2e3625098c7` passed W1B/W1C/W1D on Node22 and Node26 plus full suite and audit, but the immutable W1D floor rejected coverage:

- statements/lines `79.97%` < `80.05%`
- branches `80.03%` < `80.05%`
- functions `85.80%` = floor

Artifact comparison showed the new sandbox carry-forward improved `sandbox.ts` and `tool-runtime.ts`; the loss came from order-dependent cognition paths, principally `self-improvement.ts` and `evaluation.ts`.

Repair: a deterministic cognition matrix was added to the existing integration carry-forward harness. It exercises EvaluationSystem low-confidence/empty-criteria paths and SelfImprovementSystem declining-trend, repeated-weakness, no-pattern and active-pattern branches. No product code, coverage floor or executable-code inclusion rule was relaxed.

### RED 4 — carry-forward launcher mismatch

The deterministic cognition extension imported TypeScript modules while the harness was launched by plain Node.

Repair: the integration harness now uses the repository-standard `node --import tsx` loader in normal and c8 execution. Product code remained unchanged.

### RED 5 — anti-bypass false positive on equality assertion

Once coverage and audit were green, the strict code regex interpreted `console.log === before` as an assignment to `console.log`.

Repair: the identity assertion now uses `Object.is(console.log, before)`. The anti-bypass detector was not weakened.

## First complete GREEN — original #103 convergence gate

Workflow: `COS Main Convergence Gate`

Run: `34642350493`

All six direct domains and the exact-job aggregate passed on the PR candidate:

- contract job `103404878459` — PASS
- quality-core job `103404878510` — PASS
- specialized job `103404878400` — PASS
- performance job `103404878379` — PASS
- coverage job `103404878504` — PASS
- production Docker job `103404878093` — PASS
- aggregate `complete` job `103405490311` — PASS

Production Docker therefore compiled the candidate, passed runtime/package/privilege smoke and passed production HTTP health smoke. The performance benchmark also passed; it was not dropped from the convergence contract.

Coverage artifact from the unchanged convergence workflow:

- artifact `10281006505`
- digest `sha256:9531d9a19550f2ea137ef84054aa2ccaf646638677f1662c3d3834fa83e79c54`

## First complete GREEN — recovery stack gate

Workflow: `CGEV11 Recovery Stack Integration`

Run: `34642350538`

Node 22.12.0:

- job `103404878694` — PASS
- artifact `10280392627`
- digest `sha256:bffbfe4c6f3e58cbec9b6c9dfc96fa2038d1675117b7b8e184f7eab11a717b65`

Node 26.8.2:

- job `103404878369` — PASS
- artifact `10280627253`
- digest `sha256:94078da9bc0f0be5b13bc59ffda5e6b35686d1fd66e33afbbbbfca3266cddeb5`

Aggregate exact-SHA receipt:

- job `103405315263` — PASS
- artifact `10280332931`
- digest `sha256:ebc7d0d597a29bfba1495bd990ef0a7a11190c8d7947ff5b54f18664160e04e6`
- receipt candidate SHA: `3ba1ad1cb29c942f639fd2141abfe5496d2f0896`
- `productionCertified: false`
- `mainMergeAuthorized: false`

Node22 passed exact lineage binding, Node `22.12.0`, pinned W1C Docker TCB, strict TypeScript, W1B durability/regression/adversarial/schema tests, portable W1C security carry-forward, W1D registry/filesystem/HTTP/Search/zero-side-effect contracts, full canonical suite, integrated coverage ratchet, high-severity audit, integration-only scope/anti-bypass and evidence preservation.

Node26 passed the corresponding durability/security/authority compatibility matrix plus strict TypeScript and full canonical suite.

## Integrated coverage

The first fully GREEN Node22 stack artifact reports:

| Metric | Final W1D floor | W3.1 measured | Delta |
| --- | ---: | ---: | ---: |
| statements | 80.05% | 80.23% | +0.18 pp |
| branches | 80.05% | 80.22% | +0.17 pp |
| functions | 85.80% | 85.93% | +0.13 pp |
| lines | 80.05% | 80.23% | +0.18 pp |

Measured counts: 22,376 / 27,887 statements/lines; 4,812 / 5,998 branches; 2,040 / 2,374 functions.

No threshold lowering, source exclusion, compiler relaxation, `continue-on-error`, type bypass or dynamic-code bypass was used to obtain GREEN.

## Candidate properties proven

The same PR synthetic merge checkout has now demonstrated, as one unit:

1. #103 workflow/contract safety;
2. auth/config/memory quality-core;
3. graph/WASM/observability specialized tests;
4. performance benchmark;
5. truthful convergence coverage;
6. production Docker build/runtime/HTTP health;
7. W1B durable-memory restart/fail-closed/adversarial semantics;
8. W1C hostile-code container boundary semantics;
9. W1D default-deny host capability isolation and zero-side-effect denial;
10. exact Node22 minimum-runtime compatibility and Node26 compatibility;
11. high-severity audit and anti-bypass preservation.

PR #116 is mergeable at the Git level, but that fact is not an authorization to merge.

## Evidence-binding rule

This ledger is committed only after the product/control head `6e1ecc31...` passed both workflows. The documentation commit necessarily creates a new branch SHA and therefore is not automatically qualified by the runs above.

The documentation-bound successor must repeat both the unchanged #103 convergence gate and the recovery-stack gate completely. Only after both aggregates are GREEN on that successor may ROT-86 be marked Done as a prequalified integration candidate.

Even after W3.1 qualification, PR #116 remains draft and unmerged while parent W3 is blocked by W2. No `main` merge, production certification or global CGEV11 verification seal is implied.