# COS Graph Framework M2B — Checkpointed Crash-Safe Execution

Status: **candidate until exact-head CI is green**.

M2B turns the protocol/runtime from one-shot capability execution into a durable ordered workflow executor that can recover after process failure without silently duplicating idempotent side effects.

## North Star

The critical failure window is:

```text
invoke side effect
      |
      v
side effect commits successfully
      |
      X process/checkpoint persistence fails here
      |
      v
completed-step checkpoint never lands
```

A naive workflow engine re-executes the step on restart and can duplicate external or graph mutations.

M2B instead derives a deterministic idempotency key from immutable workflow identity:

```text
runId + planHash + stepId -> gw_<sha256 prefix>
```

The same logical step therefore receives the same key after restart. A conformant idempotent capability converges to its original result even when the workflow checkpoint is stale.

## Architecture

```text
GraphExecutionPlan
       |
       v
GraphCheckpointRuntime
  - validates plan/capabilities
  - owns bounded lease
  - resolves step inputs
  - derives deterministic step idempotency key
  - invokes GraphRuntime
  - checkpoints completed output + receipt by CAS
       |
       +------> GraphRuntime / GraphRegistry / policy
       |                |
       |                +--> durable graph state / adapters / algorithms
       |
       v
GraphCheckpointStore
  - treats persisted bytes as untrusted
  - validates canonical checkpoint hash
       |
       v
GraphCheckpointDriver
       |
       +--> SQLiteGraphCheckpointDriver
```

## Execution plan v1alpha1

Schema: `cos.graph/execution-plan/v1alpha1`.

A plan is an immutable ordered set of capability invocations. Each step declares:

- stable `id`
- `capabilityId`
- execution `mode`
- input binding
- optional graph reference
- optional JSON-like metadata

M2B deliberately starts with an ordered DAG-compatible kernel rather than a general control-flow DSL. Input bindings may read:

- a literal JSON-like value,
- the immutable workflow input,
- a prior completed step output,
- an optional path within either source.

A step may reference only an earlier step. Forward references fail closed during plan normalization.

The normalized plan is hashed. A persisted `runId` cannot later be resumed under another plan or another input payload.

## Checkpoint v1alpha1

Schema: `cos.graph/checkpoint/v1alpha1`.

A checkpoint records:

- run / plan identity and hashes,
- checkpoint revision,
- workflow status,
- next step index,
- canonical immutable run input,
- durable completed-step outputs,
- GraphRuntime execution receipts,
- deterministic step idempotency keys,
- worker lease,
- bounded failure metadata,
- creation/update timestamps,
- canonical checkpoint hash.

`GraphCheckpointDriver.load()` returns `unknown`; the checkpoint store validates persisted data before it can become execution truth.

## Checkpoint CAS law

Every checkpoint mutation advances revision exactly once:

```text
checkpoint.revision == expectedRevision + 1
```

The driver atomically accepts the new image only if the stored revision still equals `expectedRevision`.

M2B never treats last-write-wins checkpoint persistence as conformant.

## Lease semantics

A running checkpoint may carry:

```text
ownerId
lease token
expiresAt
```

Before executing work, a worker acquires/renews ownership through checkpoint CAS.

An unexpired lease owned by another worker rejects execution with `WORKFLOW_LEASE_HELD`. An expired lease may be taken over through another CAS, which is the restart/failover path.

The lease token is propagated into GraphRuntime metadata so downstream authorization/auditing can bind an invocation to workflow ownership.

### Proof boundary

A lease is not yet a full distributed fencing token for an arbitrarily long external operation. If a step runs longer than the lease and the old worker remains alive, M2B relies on the capability's idempotency contract to prevent duplicated durable effects. Explicit monotonic fencing/heartbeat semantics remain a later distributed-runtime slice.

## Side-effect safety law

Before creating a checkpoint or invoking any capability, M2B inspects the registry-owned immutable descriptor.

Any step that is side-effecting because it:

- runs in `mutate` or `write`, or
- declares `sideEffects !== 'none'`

must declare idempotency support. A capability with `idempotency: 'none'` is rejected as `WORKFLOW_UNSAFE_SIDE_EFFECT` before execution.

This is intentionally stricter than ordinary one-shot `GraphRuntime` execution because checkpoint recovery can replay an unfinished logical step.

## Crash-safe convergence

For step `S`:

1. worker owns lease,
2. derive deterministic `gw_*` key,
3. invoke capability through GraphRuntime,
4. normalize output to checkpoint-safe JSON-like data,
5. save completed-step record by checkpoint CAS.

If step 3 succeeds but step 5 fails, the old checkpoint still points at `S`.

After lease expiry and restart:

1. new worker loads the old checkpoint,
2. takes lease by CAS,
3. derives the exact same `gw_*` key,
4. invokes the same logical step,
5. the durable capability's idempotency layer returns the original result,
6. the new worker persists the completed-step checkpoint.

The graph-state integration test proves this with a real SQLite durable graph authority: graph event count stays exactly one across the simulated crash/restart window.

## Generalized state module port

M2B refactors `createGraphStateModule` to consume a structural `GraphStateStorePort` rather than the concrete in-memory class.

The same protocol capabilities can therefore expose either:

- `InMemoryGraphStore` reference semantics, or
- `DurableGraphStore` persistence semantics.

No duplicate `cos.graph.state.commit/snapshot/verify` implementation is introduced.

Defaults preserve the existing M1 memory module API and module identity.

## SQLite checkpoint backend

`SQLiteGraphCheckpointDriver` uses a strict table:

```sql
CREATE TABLE cos_graph_workflow_checkpoints (
  run_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  checkpoint_json TEXT NOT NULL
) STRICT;
```

It uses WAL, `synchronous=FULL`, `busy_timeout`, and `BEGIN IMMEDIATE` around CAS writes. The row revision and checkpoint payload revision are cross-checked on load.

As with M2A, Node 22.12.0 requires the test process to enable `--experimental-sqlite`; no npm SQLite binding is added to the package.

## Adversarial M2B gauntlet

The focused test covers:

- real durable graph state through `GraphRuntime`,
- real SQLite checkpoint persistence,
- simulated checkpoint outage after a committed graph side effect,
- persisted pre-step checkpoint after that outage,
- active-lease rejection of a second worker,
- full close/reopen of graph and checkpoint databases,
- expired-lease takeover by a new worker,
- deterministic step-idempotency convergence,
- graph event count remaining exactly one,
- successful workflow completion after restart,
- completed-run replay barrier (no rerun),
- runId + changed plan rejection,
- runId + changed input rejection,
- checkpoint-hash tamper detection,
- non-idempotent side-effect rejection before execution,
- forward-reference plan rejection,
- full regression of M1 and M2A suites.

## Deliberate non-goals

M2B does not yet claim:

- human approval / interrupt primitives,
- branches, joins, loops, dynamic fan-out or distributed queues,
- long-running lease heartbeats and monotonic fencing,
- exactly-once semantics for capabilities that do not implement idempotency,
- event-history compaction / snapshot anchors,
- Postgres/Supabase checkpoint parity,
- stable public workflow DSL.

The next slice should add durable interrupts/HITL without persisting executable callbacks or weakening the checkpoint/lease/idempotency laws established here.

## Promotion gate

M2B may be marked `TARGETED_ACCEPTED` only after the exact compacted head and PR merge ref both pass:

- targeted strict TypeScript compile,
- all M1 tests,
- M2A durable-state test,
- M2B checkpoint crash/recovery gauntlet.

Whole-repository production certification remains separately blocked on the global #76/#79 convergence train.
