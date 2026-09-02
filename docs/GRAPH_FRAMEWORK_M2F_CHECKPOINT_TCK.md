# COS Graph Framework M2F — Checkpoint Driver Technology Compatibility Kit

Status: **candidate until exact compacted-head CI is green**.

M2F applies the same executable-certification principle introduced for graph durability to the second persistence boundary in COS: workflow checkpoints.

## Why this is a separate profile

Graph state persistence and workflow checkpoint persistence solve different consistency problems.

`GraphDurabilityDriver` protects:

- graph events,
- graph head snapshots,
- idempotency authority,
- compaction anchors.

`GraphCheckpointDriver` protects:

- workflow state machine revision,
- executor ownership leases,
- interrupted/HITL state,
- approval decision history,
- completed-step progress used for crash recovery.

A backend can be correct for one port and broken for the other. M2F therefore does not infer checkpoint safety from an M2E graph-durability certification.

## Conformance identity

Schema:

`cos.graph/checkpoint-conformance/v1alpha1`

Profile:

`cos.graph/checkpoint-profile/m2c/v1`

The profile represents the checkpoint semantics established by M2B + M2C.

## Adapter factory

```ts
interface GraphCheckpointConformanceFactory {
  backendId: string;
  open(scope: string): GraphCheckpointDriver | Promise<GraphCheckpointDriver>;
  destroy(scope: string): void | Promise<void>;
}
```

Repeated `open(scope)` calls must point at the same durable authority. The TCK deliberately opens concurrent handles and performs full close/reopen cycles.

## Mandatory laws

### 1. `first-checkpoint-atomicity`

A fresh `runId` has no checkpoint.

CAS from expected revision 0 to checkpoint revision 1 must:

- commit once,
- report revision 1,
- make the exact canonical checkpoint readable,
- preserve its checkpoint hash.

### 2. `stale-checkpoint-cas`

Two independent handles observe an empty run.

The first creation wins. A second creation from the same stale expected revision must return `conflict`, never last-write-wins.

The losing operation must not manufacture a new checkpoint revision or alter the winning checkpoint hash.

### 3. `revision-progression`

A successful update from checkpoint revision `R` must persist revision `R + 1` when the caller supplies expected revision `R`.

The TCK advances a running checkpoint from revision 1 to a lease-bearing revision 2 and verifies the new image is authoritative.

### 4. `conflict-preserves-winner`

After one worker wins revision 2 with a lease, a stale revision-1 writer attempts to install a different lease.

Required result:

- stale writer receives `conflict`,
- winner checkpoint hash remains unchanged,
- winner lease owner/token remain authoritative.

This law targets the class of checkpoint stores that report CAS conflicts correctly but still mutate rows before surfacing them.

### 5. `restart-roundtrip`

A checkpoint with immutable run input is committed, the driver is closed, then a new handle opens the same scope.

The reopened image must preserve:

- checkpoint revision,
- status,
- canonical checkpoint hash,
- canonical run-input content.

### 6. `run-isolation`

Two different `runId` values at the same backend scope each begin at checkpoint revision 1.

They must not share a global CAS counter or overwrite one another. Each run retains its own canonical checkpoint hash.

### 7. `lease-roundtrip`

A running checkpoint containing:

```text
ownerId
opaque lease token
expiresAt
```

must survive durable close/reopen byte-for-semantic-byte.

The checkpoint driver is not allowed to silently regenerate, shorten, coerce or drop lease ownership data.

### 8. `interrupt-roundtrip`

A valid M2C `interrupted` checkpoint is persisted with:

- deterministic interrupt ID,
- pending step ID,
- approval reason,
- immutable payload,
- metadata,
- request timestamp,
- no lease.

The state must round-trip and remain parseable through `GraphCheckpointStore`.

### 9. `decision-roundtrip`

The TCK persists an interrupted checkpoint and then CAS-transitions it to terminal `cancelled` with an append-only rejected human decision.

After restart, the backend must preserve:

- cancelled status,
- cleared active interrupt,
- decision count,
- decision ID,
- decision request hash,
- rejected outcome,
- actor ID.

This law protects the human-control audit trail from storage adapters that serialize only the older M2B checkpoint subset.

## Validation boundary

The TCK deliberately loads persisted rows through `GraphCheckpointStore`, not merely `driver.load()`.

This means a backend only passes when its persisted representation survives the same trust-boundary parser used by the runtime. A driver cannot certify itself by returning an object that has silently lost fields required by checkpoint integrity.

The checkpoint canonical hash remains the content-integrity boundary; the driver owns atomicity and durable byte preservation.

## Deterministic certification report

A successful run returns:

- schema,
- profile,
- backend ID,
- namespace,
- exact ordered law manifest,
- `certified: true`,
- canonical SHA-256 certification hash.

The report certifies the declared compatibility tuple, not the trustworthiness of the machine that executed the tests.

## Anti-ceremonial test

M2F also submits a deliberately broken wrapper around the real SQLite checkpoint backend.

The wrapper delegates the real stale CAS operation, but when SQLite correctly returns `conflict`, it lies and reports `committed`.

The TCK must stop at:

```text
backend: cos.test.checkpoint.sqlite-lying-cas
law: stale-checkpoint-cas
error: CHECKPOINT_CONFORMANCE_LAW_FAILED
```

A TCK that cannot reject this backend is itself insufficient.

## First certification target

`SQLiteGraphCheckpointDriver` is tested using actual SQLite files, independent handles and actual close/reopen cycles.

The same TCK namespace is executed twice over freshly destroyed/rebuilt scopes. The certification hash must be reproducible.

## Future PostgreSQL checkpoint admission

A PostgreSQL checkpoint backend should use one atomic compare-and-swap statement or transaction, for example conceptually:

```sql
UPDATE workflow_checkpoints
SET revision = $new_revision,
    checkpoint_json = $checkpoint
WHERE run_id = $run_id
  AND revision = $expected_revision;
```

Creation must be conditional on absence and race safely with another creator.

A backend that performs read → application compare → unconditional write is not conformant even if single-worker tests appear green.

Future database adapters must pass M2F independently from M2E.

## Deliberate non-goals

M2F does not certify:

- GraphRuntime capability policy,
- graph event persistence,
- lease heartbeating or monotonic fencing,
- authenticated human identity,
- queue/scheduler ownership,
- Postgres/Supabase parity,
- throughput or latency SLOs,
- whole-repository production readiness.

It certifies the checkpoint storage laws on which M2B/M2C depend.

## Promotion gate

M2F may be marked `TARGETED_ACCEPTED` only after:

1. strict framework TypeScript compile,
2. full M1/M2A/M2B/M2C/M2D regression,
3. real SQLite checkpoint TCK pass,
4. anti-ceremonial lying-CAS rejection,
5. adversarial diff review,
6. branch compaction to exactly one commit over #96,
7. exact compacted-head push CI green,
8. exact PR merge-ref CI green.

Global `main` certification remains independently gated by #76/#79 and the stacked framework convergence order.
