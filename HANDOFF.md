# HANDOFF — COS Graph Engine

## Recovery point

Phases 01–04 are statically complete. COS remains `SHADOW_ONLY / IMPLEMENTED_UNVERIFIED`.

### Frozen/checkpointed lineage

- Phase 01: `checkpoint/phase-01-reconciled-76dfdc7` → `76dfdc737c231b2637f122125f7acf98b735ff1f` — PR #40
- Phase 02: `checkpoint/phase-02-contracts-06487e7` → `06487e7acbce82c5a54dbb8dd171dceae2bb67ac` — PR #43
- Phase 03: `checkpoint/phase-03-core-ad6a93c` → `ad6a93c0b2986c36efefb5cd59a4d14a9dffceb3` — PR #44
- Phase 04: PR #45; synchronized checkpoint branch created after closure documents

Source #34/#35 remain preserved. W13 #36 remains paused/non-authoritative. PR #37 remains draft/rework. No merge, automatic Action, deployment or production data mutation has occurred.

## Read first

1. `README_FIRST.md`
2. `GOAL.md`
3. `STATE.md`
4. `SCORECARD_20D.md`
5. `TASKS.md`
6. `GRAPH.md`
7. `docs/hardening/PHASE_01_CLOSURE.md`
8. `docs/hardening/PHASE_02_CLOSURE.md`
9. `docs/hardening/PHASE_03_CLOSURE.md`
10. `docs/hardening/PHASE_04_CLOSURE.md`
11. `docs/hardening/ADR_INDEX.md`
12. `docs/hardening/COMPATIBILITY_MATRIX.md`
13. `docs/hardening/ROLLBACK_MAP.md`
14. `docs/hardening/TEST_EVIDENCE_MANIFEST.json`
15. `docs/hardening/DELETION_GOVERNANCE.json`
16. `docs/hardening/AUTHORITY_SURFACE_MANIFEST.json`
17. `AGENTS.md`

## Phase 04 completed-static guarantees

### Durable event contract

- InMemory/Postgres adapters share one logical-event projection/hash;
- equal logical retries converge even when attempt-local IDs differ;
- conflicting reuse of an idempotency key fails closed;
- accepted events and reads are detached;
- cursor/limit/order behavior is aligned;
- fake Postgres fixture covers transaction and conflict paths.

### Canonical persistence wire

- canonical JSON wire version 1 is explicit;
- optional object `undefined` is omitted only at the wire boundary;
- ambiguous JS values, cycles, accessors, sparse arrays and non-finite numbers fail closed;
- NFC normalization and normalized-key collision rejection are enforced;
- SHA-256 hashes exact canonical persisted values.

### Knowledge authority

- AuthorityKnowledgeGateway + append-only stores own the candidate truth path;
- valid time and system time are independent;
- future corrections do not leak into historical knownAt;
- domain closure is a new revision, not historical mutation;
- PropertyGraph is a derived projection;
- projection failure is explicit degraded saga evidence and can be repaired idempotently;
- Postgres candidate uses advisory transaction lock, revision CAS and INSERT-only history.

### Hub recovery

- command/outcome/projection hashes survive JSON/JSONB roundtrip;
- snapshot envelope has schema + serialization version;
- SHA-256 covers the actual wire payload;
- runtime hydration does not change semantic/integrity hash;
- snapshot + tail replay rebuilds an empty projection;
- corruption/schema/serialization/metadata/event-log-behind failures are explicit.

All contracts remain unexecuted. Assurance did not move.

## Next phase — Phase 05 Security / Concurrency / Agent Runtime

Create exactly one descendant branch:

`hardening/phase-05-security-concurrency-runtime`

from the synchronized Phase 04 checkpoint.

### Exact implementation order

1. Durable side-effect ledger
   - define operation identity from principal/project/resource/action/request hash;
   - states: claimed, prepared, executing, succeeded, failed, uncertain, compensating, compensated;
   - append/store attempts and accepted terminal evidence;
   - same key/same request converges, conflict fails closed;
   - crash window after provider mutation becomes uncertain, not automatic success/retry.
2. Resource fencing
   - monotonic token per resource;
   - validate at resource commit boundary;
   - reject stale workers and emit near-miss evidence.
3. Lease lifecycle
   - acquire/renew/release/expire/reacquire;
   - deterministic clock;
   - orphan/crash recovery;
   - bounded TTL, no indefinite locks.
4. Durable goal aggregate
   - immutable goal/plan/step/result history;
   - resume without repeating accepted external effects;
   - compensation/waiver for partial completion.
5. Policy
   - principal/project/sensitivity context;
   - enforce at all execution/destructive boundaries;
   - unknown actions/operators/fields fail closed;
   - durable approvals.
6. Deployment isolation
   - DNS/egress/HTTP and filesystem sandbox contracts;
   - SSRF rebinding, private network, symlink and TOCTOU cases.
7. Near-miss evidence
   - duplicate/stale/lease/policy/uncertain/compensation signals;
   - observer failure cannot change protected outcome.

## Hard safety rules

- do not claim exactly-once provider effects;
- idempotency-key presence is not durable idempotency;
- fencing-token presence is not commit-boundary validation;
- do not auto-retry an operation whose provider outcome is unknown;
- state-machine rollback cannot undo an external side effect;
- no alternate tool/runtime path may bypass the operation ledger;
- no legacy test rewrite without waiver+ADR;
- material deletion requires deletion-governance entry;
- no automatic Actions or CD;
- no Assurance score movement before execution.

## Branch law

```text
Phase01 → Phase02 → Phase03 → Phase04 → Phase05 → Phase06 → Phase07
                                                                  ↓
                                                     exact qualification SHA
                                                                  ↓
                                                               new W13
```

## Cost / verification

- recurring incremental infrastructure cost: `EUR 0/month`;
- Actions manual-only;
- CD/deploy/release OFF;
- Codex optional only for shell-heavy work;
- GitHub/Drive/Todoist remain the cross-plane control system.

## Rollback

- Phase04: use the final `checkpoint/phase-04-*` branch created from the synchronized closure head;
- Phase03: `checkpoint/phase-03-core-ad6a93c`;
- Phase02: `checkpoint/phase-02-contracts-06487e7`;
- Phase01: `checkpoint/phase-01-reconciled-76dfdc7`;
- pre-reconciliation: #33 `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`.