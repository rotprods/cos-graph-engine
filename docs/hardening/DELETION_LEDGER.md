# COS Graph Engine — Semantic Deletion Ledger

This ledger is mandatory for every replacement that deletes more than 50 non-generated lines from one file, removes a job/test/export, or changes a public behavioral contract.

Line count is a trigger for review, not a verdict. A deletion is accepted only when semantic preservation or intentional retirement is explicit and evidenced.

## Required entry schema

| Field | Requirement |
|---|---|
| Ledger ID | Stable `DEL-YYYY-NNN` identifier |
| PR / commit | Exact source and replacement SHA |
| File / symbol | Path and affected jobs/functions/classes/tests |
| Previous behavior | What capability or contract existed before deletion |
| Defect / reason | Why removal or replacement is necessary |
| Replacement | Exact new path/symbol or explicit retirement decision |
| Observable delta | What callers/operators will see differently |
| Compatibility | Compatible, deprecated, migration-required, breaking, or retired |
| Evidence | Test/typecheck/replay/security/benchmark links |
| Rollback | Exact branch/SHA and data migration implications |
| Reviewer | Independent reviewer and date |
| Status | `PROPOSED`, `ACCEPTED`, `REJECTED`, `SUPERSEDED` |

## Open ledger entries

### DEL-2026-001 — CI workflow compression

- **Source:** legacy `.github/workflows/ci.yml` on `main`.
- **Candidate replacement:** PR #37.
- **Previous behavior:** separate jobs for CSR, pruning, benchmark tests, WASM tests, observability, visualization, core suites, performance artifacts, coverage and Docker build.
- **Reason proposed:** automatic Actions spend and multiple false-green constructs.
- **Finding:** changing invocation policy is valid; deleting verification breadth is not yet accepted.
- **Required replacement:** manual/reusable full matrix with scoped inputs. Benchmarks, Docker and coverage may default off but remain explicitly runnable.
- **Compatibility:** operational migration required.
- **Evidence required:** workflow coverage-equivalence matrix, forced-failure proof and one manual dry run.
- **Rollback:** restore workflows from `main` while removing automatic triggers separately.
- **Status:** `REJECTED_AS_CURRENTLY_IMPLEMENTED`.

### DEL-2026-002 — L2 StateMachine rewrite

- **Source:** pre-W12.4 `packages/graph/src/level2-state.ts`.
- **Candidate replacement:** #35 transactional implementation.
- **Previous behavior:** mutable context exposure, less strict constructor semantics and legacy transition behavior.
- **Reason proposed:** serialized transitions, rollback, timer fencing, immutable reads and deterministic dispatch.
- **Observable delta:** callers can no longer mutate canonical context directly; invalid/ambiguous definitions fail earlier; callback failures produce a rejected transition after internal rollback.
- **Compatibility:** migration-required.
- **Required replacement evidence:** preserve legacy tests, add authority tests, document `patchData/replaceData`, test external-side-effect boundary and verify serialization.
- **Rollback:** restore prior file from #33; no durable schema migration exists yet.
- **Status:** `PROPOSED_FOR_CANONICAL_RECONCILIATION`.

### DEL-2026-003 — MemoryManager / InMemoryStore rewrite

- **Source:** pre-W12.1 `packages/memory/src/memory-manager.ts`.
- **Candidate replacement:** #31.
- **Previous behavior:** primary entries plus layer/tag indexes, but mutable references and stale-index risks.
- **Reason proposed:** copy-safe access, atomic index updates, TTL cleanup, query correctness and safer consolidation.
- **Finding:** nested content/metadata immutability and access-telemetry semantics remain incomplete.
- **Compatibility:** compatible intent, implementation hardening required.
- **Evidence required:** mutation-adversarial tests, index corruption tests, TTL/lifecycle tests and legacy query parity.
- **Rollback:** restore #30 version; no durable data migration.
- **Status:** `ACCEPT_CORE_WITH_HARDENING`.

### DEL-2026-004 — GraphRAG authority implementations

- **Source:** legacy L11 and sibling W12.4 implementations.
- **Candidate replacement:** one canonical atomic authority projection.
- **Previous behavior:** legacy mutable GraphRAG plus two new competing authority implementations.
- **Reason proposed:** deterministic identity, scope/temporal/provenance filtering and projection version/hash fencing.
- **Observable delta:** canonical mutations occur through one projection owner; incremental APIs become builders/adapters or shadow compatibility only.
- **Compatibility:** deprecation window required.
- **Evidence required:** API diff, gold-query parity, leakage tests, replay hash and migration adapter tests.
- **Rollback:** retain legacy L11 behind explicit non-authority flag until qualification.
- **Status:** `PROPOSED`.

### DEL-2026-005 — W13 test and benchmark rewrites

- **Source:** legacy tests/benchmarks altered in PR #36.
- **Reason proposed:** adapt to stricter APIs and deterministic evidence.
- **Finding:** changing tests alongside implementation can erase the original contract.
- **Required replacement:** preserve legacy suites intact and add authority suites separately; any intentional behavior break requires ADR and migration test.
- **Compatibility:** not yet established.
- **Evidence required:** suite manifest showing legacy + authority coverage and explicit retired assertions.
- **Rollback:** restore original test files from base and move new tests to additive files.
- **Status:** `REWORK_REQUIRED`.

### DEL-2026-006 — Strict tool runtime replacement

- **Source:** `packages/execution/src/tool-runtime.ts` on #33, blob `b04cf0f38b173262c1b6617a6000e9c196a9d5bf`.
- **Replacement source:** PR #35 blob `4edeef55fa9d5c08a472c23c9c732ae32a7a39d9`.
- **Canonical reconciliation commit:** `a4ff4e664e644fc8044db5f633a4f521e62fefbb`.
- **Previous behavior:** filesystem/HTTP/search/code utility plus registry; SearchTool claimed knowledge/memory/all support without adapters and returned `success=true` with embedded error evidence; duplicate registry names silently replaced existing tools; empty file writes were rejected.
- **Reason:** remove false success, validate inputs, make unavailable sources explicit, bound HTTP body/timeout, copy tool definitions and reject accidental duplicate registration.
- **Replacement:** strict #35 tool semantics ported unchanged as the first low-conflict reconciliation slice.
- **Observable delta:** unavailable search sources and execution failures now produce `success=false`; duplicate registration fails unless `replace=true`; empty-string file writes are valid; HTTP protocol/method/body/timeout validation is explicit; `node:vm` is documented as non-security-boundary.
- **Compatibility:** behavior-tightening / migration-required for callers that depended on false-success or silent replacement.
- **Verification:** static source reconciliation complete; compile, legacy tests, authority tests and security cases are pending Phase 07–08. This entry is not accepted solely from the port.
- **Residual risk:** side-effect exactly-once semantics are not solved inside ToolRegistry; durable operation ledger, resource fencing and deployment isolation remain P0/P1 tasks.
- **Rollback:** restore #33 blob `b04cf0f38b173262c1b6617a6000e9c196a9d5bf` or reset the file to base SHA `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`.
- **Status:** `IMPLEMENTED_PENDING_EVIDENCE`.

## Ledger closure rule

An entry becomes `ACCEPTED` only when replacement code, evidence and rollback information all point to the same exact commit SHA. Self-review alone does not close a material deletion entry.
