# Phase 05 — Durable Repair Ledger Checkpoint

Status: `IMPLEMENTED_UNVERIFIED / SHADOW_ONLY`  
Canonical PR: `#46`  
Automatic Actions/CD: `OFF`

## Problem closed at the architecture/code level

A provider operation may already be committed while a secondary responsibility fails afterwards:

- agent-run step evidence append;
- lease release;
- capability signal delivery;
- telemetry delivery.

Treating the whole operation as failed would lie about provider truth. Returning only `pending_repair` without durable work would lose the repair after process restart.

## Selected repair protocol

`AuthorityRepairService` and append-only stores model repair as an independent durable aggregate:

```text
pending
  → leased(fencingToken=N)
      → resolved
      └→ pending(nextAttemptAt)
      └→ abandoned(maxAttempts)
```

Guarantees written:

- deterministic repair identity by project/kind/dedupe key;
- payload-bound enqueue idempotency;
- append-only revisions;
- expected-revision CAS;
- worker lease expiry and reacquisition;
- monotonic repair fencing tokens;
- stale owner/token rejection;
- explicit retry scheduling;
- explicit terminal abandonment;
- detached reads;
- in-memory and Postgres/Supabase-compatible stores;
- no UPDATE/DELETE of historical repair revisions.

## Capability integration

`RepairingAuthorityCapabilityRuntime` wraps the protected capability facade after its result is known:

- `agentEvidence=pending_repair` creates `agent_evidence_append` repair work;
- `leaseRelease=release_failed` creates `lease_release` repair work;
- repair-store failure is retained locally and cannot rewrite a committed provider result or replace the original protected error;
- side-effect agent repair references the durable committed operation instead of duplicating provider result payload;
- read repair stores the result required to finish the originally accepted agent step.

Built-in idempotent handlers:

- `AuthorityAgentEvidenceRepairHandler`;
- `AuthorityLeaseReleaseRepairHandler`.

`AuthorityRepairWorker` claims ready work with repair-level fencing and resolves/fails it through append-only revisions. Scheduling remains an orchestration responsibility.

## Files

- `packages/execution/src/authority-repair-ledger.ts`
- `packages/execution/src/authority-repair-store-postgres.ts`
- `packages/execution/src/authority-capability-repair-runtime.ts`
- `packages/execution/src/authority-phase05-repair.ts`
- `scripts/fixtures/fake-authority-repair-postgres.ts`
- `scripts/test-authority-repair-ledger.ts`
- `scripts/test-authority-repair-postgres.ts`
- `scripts/test-authority-capability-repair-runtime.ts`

## Selected Phase 05 surface

`packages/execution/src/authority-phase05-selected.ts` now names one additive candidate surface spanning:

- capability facade;
- policy;
- side-effect ledger;
- leases/fencing;
- agent-run aggregate;
- provider inspection/retry planning;
- pinned HTTPS transport;
- opaque FileHandle executor V2;
- capability evidence V2;
- in-memory/Postgres signal stores;
- durable repair ledger and handlers.

Strict candidate graph: `tsconfig.phase05.selected.json`.

## Honest limitations

- no repair contract has run;
- the Postgres store is driver-neutral code plus an unexecuted fake fixture;
- a repair worker scheduler is not yet integrated into orchestration;
- capability signal and telemetry delivery are represented as repair kinds, but V2 observation has not yet been wired to enqueue those failures durably;
- actual provider-specific repair handlers remain provider work;
- all repair payloads require the same project/sensitivity policy at query/execution boundaries during later promotion.

No Assurance or Authority score changes are authorized.