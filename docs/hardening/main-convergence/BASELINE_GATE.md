# COS main convergence — canonical baseline gate

Status: candidate only; not a production certification.

`ci.yml` is the single automatic verification owner for `integration/main-baseline-20260907`.
All inherited diagnostics remain available via `workflow_dispatch` but no longer race or publish.
Deploy and release are explicit failing freeze guards.

The canonical gate runs: auth/HTTP adversarial tests, memory/copy-safety tests, WASM build and independent PageRank oracle, strict typecheck, complete canonical regression, dependency audit, specialized graph/WASM/observability/visualization suites, extended WASM tests, performance benchmark, coverage and Docker build-only. Every mandatory job binds itself to the exact `GITHUB_SHA` and emits a completion receipt; the aggregate fails on missing/skipped/failed/stale evidence.

Coverage is currently a ratchet gate using repository `.c8rc.json`; it is NOT yet 100/100/100/100. The convergence program must not relabel the existing 55/65/63/63 thresholds as full coverage. Next coverage milestone is 100% diff coverage for changed eligible production surfaces, followed by an explicit global ratchet toward 100% with generated/type-only exclusions ledgered rather than hidden.

No workflow in this candidate contains registry login/push, package publication, Git push, kubectl or release action. Main remains unchanged until issue #39 gates are satisfied.
