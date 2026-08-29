# Phase 05 Progress — Security, Concurrency and Agent Runtime

Status: `ACTIVE / IMPLEMENTED_UNVERIFIED`  
Authority: `SHADOW_ONLY`  
Parent checkpoint: `checkpoint/phase-04-temporal-20260828`  
Branch: `hardening/phase-05-security-concurrency-runtime`  
Draft PR: `#46`

## 1. Problem statement

Before Phase 05, COS could require an idempotency key and fencing number at a tool boundary, but those fields alone did not prove that:

- an accepted external result survived process restart;
- a retry after a crash would not repeat an uncontrolled effect;
- a stale worker could not commit after a newer owner acquired the resource;
- a partial provider effect would be compensated rather than marked successful;
- lease ownership expired deterministically;
- provider reconciliation occurred before re-execution.

The Phase 05 objective is to turn those requirements into append-only authority contracts rather than request-shape checks.

## 2. Implemented authority candidates

### 2.1 Append-only side-effect ledger

`authority-side-effect.ts` defines immutable operation revisions for:

```text
claimed
→ prepared
→ executing
→ reconciliation_required
→ committed
or failed
or compensation_required → compensating → compensated
```

Each revision carries:

- canonical operation and revision identity;
- project, principal, agent run, capability and resource;
- input and content hashes;
- operation and transition idempotency keys/hashes;
- attempt number;
- fencing token;
- provider-native idempotency key;
- accepted result/error/compensation evidence;
- correlation, causation, provenance and explicit timestamps.

The in-memory reference store serializes writes per operation, rejects stale revisions and returns detached values.

### 2.2 Crash-safe authority runtime

`authority-side-effect-runtime.ts` is the authority orchestration facade for interruption recovery.

An interrupted execution is first represented as `reconciliation_required`. A provider/resource reconciler must then classify the effect:

- `applied` → record observed committed result;
- `not_applied` → prepare a new attempt with a higher fencing token and new provider idempotency key;
- `partial` → require an explicit content-addressed compensation plan.

Partial application cannot be represented as success.

### 2.3 Conflict-safe Postgres/Supabase store

`authority-side-effect-store-postgres.ts` provides an append-only driver-neutral Postgres candidate.

It uses:

- one operation-claim table;
- one immutable revision table;
- `UNIQUE(project_id,idempotency_key)`;
- `UNIQUE(project_id,transition_key)`;
- `UNIQUE(operation_id,revision)`;
- transaction advisory locking;
- `ON CONFLICT DO NOTHING` followed by deterministic classification.

The canonical store deliberately avoids catching a uniqueness exception and continuing inside the aborted transaction. An earlier prototype that did so is listed as non-authority in `PHASE_05_EVIDENCE_MANIFEST.json`.

### 2.4 Explicit-time leases and monotonic fencing

`authority-lease.ts` defines append-only resource lease revisions with:

- bounded TTL;
- explicit evaluation time;
- lease and resource revision numbers;
- monotonic fencing token per acquisition;
- renew/release/reacquire lineage;
- payload-bound operation keys;
- clone-safe history;
- explicit active/released/derived-expired distinction.

No authority decision depends on implicit wall-clock `now()`.

### 2.5 Lease-bound live execution

`authority-execution-runtime.ts` binds the side-effect store to the lease authority for live operations.

Prepare, begin and commit each validate lease identity/owner/token at the operation's explicit recorded time. If a newer lease owns the resource, the older worker cannot commit even if it still holds a stale in-memory token.

Crash reconciliation remains separate from live commit because an effect observed after lease expiry needs provider-bound evidence, not a false current-lease assertion.

## 3. Narrow authority surface

`packages/execution/src/authority-phase05.ts` is the current Phase 05 authority barrel.

It intentionally does not export:

- the superseded Postgres prototype;
- the first coordinator draft;
- legacy permissive tool execution paths.

Package-root promotion is deferred to the Phase 07 compatibility/API gate so no flag-day public cutover occurs without typecheck, legacy tests and migration evidence.

## 4. Additive contracts written

- `scripts/test-authority-side-effect-runtime.ts`;
- `scripts/test-authority-side-effect-postgres.ts`;
- `scripts/test-authority-lease.ts`;
- `scripts/test-authority-execution-runtime.ts`;
- `scripts/fixtures/fake-authority-side-effect-store-postgres.ts`;
- `tsconfig.phase05.json`;
- `docs/hardening/PHASE_05_EVIDENCE_MANIFEST.json`.

The contracts cover claim conflicts, restart reconstruction, crash reconciliation, partial compensation, stale fencing, lease renewal/expiry/reacquisition, append-only SQL posture and hash-corruption rejection.

## 5. Current proof boundary

All code and contracts remain `WRITTEN_UNEXECUTED`.

The following have not yet run from a clean qualification checkout:

- `npx tsc -p tsconfig.phase05.json --noEmit`;
- Phase 05 authority scripts;
- actual Postgres/Supabase fixture parity;
- multi-process contention;
- process-kill crash windows;
- provider reconciliation adapters;
- security review;
- mutation/property tests;
- full legacy regression.

No Assurance or Authority score changes are justified.

## 6. Known gaps before Phase 05 closure

1. Promote the narrow Phase 05 surface through the explicit Phase 07 API gate; do not export prototypes.
2. Add a durable Postgres lease store with resource-level lock/fencing semantics.
3. Connect lease/side-effect outcomes to AuthorityTelemetry and near-miss evidence.
4. Bind the real CapabilityRouter/ToolRegistry side-effect path to `AuthorityExecutionRuntime`.
5. Persist durable goal/plan/result aggregates and reconstruct them after restart.
6. Complete principal/project/scope/sensitivity policy enforcement.
7. Add deployment-layer HTTP egress and filesystem sandbox contracts.
8. Define provider adapters for native idempotency and effect reconciliation.
9. Resolve early Phase 05 draft files through deletion/compatibility governance before final qualification.

## 7. Next implementation order

```text
Postgres lease authority
→ side-effect/lease near-miss observation
→ strict CapabilityRouter integration
→ durable goal/plan/result aggregate
→ policy enforcement across runtime surfaces
→ HTTP/FS deployment isolation
→ Phase 05 closure checkpoint
```

## 8. Safety rules

- Do not call a side effect exactly-once from an idempotency field alone.
- Do not retry an `executing` operation until provider/resource reconciliation completes.
- Do not commit under an expired or superseded fencing token.
- Do not erase partial/degraded evidence to make a workflow appear successful.
- Do not use implicit wall-clock time for replay-relevant decisions.
- Do not promote static contracts into Assurance.
- Do not enable automatic Actions, CD or production database mutation.
