# W3.2 Promotion Evidence

Date: 2026-09-12
Linear authority: ROT-87
Repository: `rotprods/cos-graph-engine`

## Purpose

This document preserves the post-W2 promotion preflight and the bounded control-plane reconciliation required to qualify a promotion candidate without rewriting any already-qualified product/security authority branch.

## Frozen authorities

- live `main` at W3.2 activation: `3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83`
- W3.1 prequalified head: `04e6222a7541d14ffed66eef16de5bd8f59720e6`
- W2 qualified source head: `3ff1609cf7270e393f9fa0f7e89da97fbf0a6651`
- W2 qualified synthetic candidate: `1a67e2c733510dcec2f9973c37365a5b4c1af330`
- W2 Security Closure run: `34713960872` PASS

The W3.2 successor branch `integration/cgev11-w3-2-promotion-20260912` was created directly from the exact W2 source head `3ff1609c...`. No product file was modified to create the successor.

## Unchanged-gate RED preserved

Draft PR #118 promoted the unchanged W2 source head directly to `main` to test the existing W3.1 promotion controls before modifying them.

Exact PR #118 synthetic merge candidate: `9a81b670744d13940f104410b858d716d0ef78d8`.

Recovery Stack run `34716438806` produced the expected fail-closed evidence:

- Node26 job `103614440419`: PASS through exact ancestry, pinned sandbox TCB, strict TypeScript, W1B, W1C, W1D and full canonical suite.
- Node22 job `103614440520`: the same functional/security/canonical contracts PASS until integrated coverage.
- observed coverage: statements `79.39%`, branches `80.20%`, functions `85.66%`, lines `79.39%`.
- strongest W1D floor: statements `80.05%`, branches `80.05%`, functions `85.8%`, lines `80.05%`.
- Node22 evidence artifact: `10303834859`, digest `sha256:e55f834bb692acc092747267ab98674afd71aefabde3cc7c166046f4885f7ffe`.

The RED is not evidence of a demonstrated product regression. The unchanged W3.1 coverage corpus predates W2 and therefore does not execute the qualified W2 operator/auth and HTTP trust-boundary suites. The new W2 code surfaces consequently dilute the old measured corpus. The already-qualified W2 gate executed those suites and measured `80.73 / 80.11 / 86.15 / 80.73`, above the same strongest floor.

The unchanged W3.1 scope lock is also intentionally narrower than the now-qualified W2 delta. That lock must not be bypassed or deleted; it must be reconciled to the exact qualified W2 file set.

## Additive W3.2 reconciliation

Only `.github/workflows/cgev11-stack-integration.yml` and this evidence document are new W3.2 mutations above the exact W2 authority.

The recovery workflow is changed only to:

1. bind `W2_SHA=3ff1609cf7270e393f9fa0f7e89da97fbf0a6651` as mandatory exact ancestry in both Node22 and Node26 lanes;
2. rerun the qualified W2 operator/auth rollout, HTTP trust-boundary suite and production-security AST checker on the exact promotion candidate in both runtimes;
3. add the two W2 executable regression suites to the integrated c8 corpus while leaving `scripts/check-cgev11-stack-coverage.mjs` and its floors unchanged;
4. extend the mutation allowlist only to the exact 13 files changed by qualified W2 plus this W3.2 evidence document;
5. preserve workflow-safety, dynamic-code/type bypass detection, high-severity dependency audit, W1B/W1C/W1D contracts, full canonical suite, pinned Docker TCB and exact-SHA aggregate receipts.

No `packages/**` source mutation is introduced by W3.2. No test assertion, coverage floor, audit severity, runtime version, sandbox digest or fail-closed control is weakened.

## Promotion contract

A successor promotion candidate is acceptable only if the automatic `COS Main Convergence Gate` and reconciled `CGEV11 Recovery Stack Integration` both pass against the same then-current synthetic merge SHA and live `main` has not moved underneath that evidence.

Even a fully GREEN W3.2 candidate does not by itself certify deployment or production, and does not automatically authorize merge to `main`. Parent W3 acceptance criteria, PR review state and repository protection controls remain separate authorities.
