# COS Graph Framework M2C — Durable Human-in-the-Loop Interrupts

Status: **candidate until exact-head CI is green**.

M2C adds durable human approval gates to the crash-safe M2B workflow runtime without serializing executable callbacks, weakening capability policy, or allowing a human decision to bypass checkpoint CAS.

## North Star

A guarded side effect must have this ordering:

```text
checkpointed workflow owns lease
        |
        v
approval gate reached
        |
        v
persist interrupt by CAS
        |
        v
release executor lease
        |
        v
human decision authorized + persisted by CAS
        |
        v
new executor lease
        |
        v
side effect executes with M2B deterministic idempotency key
```

There is no execution path in which `approved = true` is merely held in process memory.

## Checkpoint schema evolution

M2C advances the checkpoint schema from:

- `cos.graph/checkpoint/v1alpha1` (M2B)

to:

- `cos.graph/checkpoint/v1alpha2` (M2C)

The parser keeps explicit read compatibility with v1alpha1. A valid legacy image is verified against its original v1alpha1 canonical hash and then normalized in memory to v1alpha2 with:

- `interrupt = null`
- `decisions = []`
- a newly derived v1alpha2 checkpoint hash

The next ordinary checkpoint transition persists the new schema. No legacy checkpoint is trusted without first validating its legacy hash.

## Approval gate in the execution plan

A step may declare:

```ts
approval: {
  reason: string;
  payload?: GraphValue;
  metadata?: GraphProperties;
}
```

The gate is part of the normalized execution plan and therefore part of `planHash`. It cannot be added, removed, or changed while resuming an existing `runId` without producing `WORKFLOW_PLAN_MISMATCH`.

The runtime checks the gate **before** `GraphRuntime.invokeById()`.

## Durable interrupt

When an unapproved gated step is reached, M2C persists:

- deterministic `interrupt.id`
- pending `stepId`
- human-readable `reason`
- immutable JSON-like `payload`
- immutable metadata
- `requestedAt`

The checkpoint transitions:

```text
status: running -> interrupted
lease: owned -> null
nextStepIndex: unchanged
completed steps: unchanged
```

The deterministic interrupt identifier is derived from:

```text
runId + planHash + stepId -> int_<sha256 prefix>
```

An interrupted workflow cannot hold an executor lease and cannot execute the pending capability.

## Decision model

A human decision contains:

- optimistic `expectedRevision`
- `interruptId`
- globally stable client `decisionId`
- outcome: `approved | rejected`
- `actorId`
- optional comment
- optional JSON-like payload

The server derives a payload-bound `requestHash` from the semantic decision fields. `expectedRevision` is intentionally not part of that hash: it is a concurrency precondition, not part of the human decision identity.

Accepted decisions are appended to the checkpoint as immutable `GraphWorkflowDecisionRecord` entries with a server-side `decidedAt` timestamp.

### Idempotency law

Decision lookup occurs before revision checks, but after authorization policy:

- same `decisionId` + same semantic payload -> return durable current checkpoint
- same `decisionId` + different semantic payload -> `WORKFLOW_DECISION_CONFLICT`

This remains true even if later workflow execution has advanced several checkpoint revisions.

## Authorization is fail-closed

`GraphCheckpointRuntime.decide()` requires an explicit `GraphWorkflowDecisionPolicy`.

No configured policy:

```text
WORKFLOW_DECISION_POLICY_REQUIRED
```

Policy returns false:

```text
WORKFLOW_DECISION_DENIED
```

Policy throws/fails:

```text
WORKFLOW_DECISION_POLICY_FAILED
```

The policy also runs for exact decision replays. The runtime never treats knowledge of a prior `decisionId` as authorization.

The framework intentionally does not persist authorization callbacks. Production adapters must bind `actorId` to an authenticated principal outside the checkpoint payload; caller-supplied strings are not, by themselves, identity proof.

## Approval transition

For `approved`:

```text
interrupted -> running
interrupt -> null
decision -> append-only history
lease -> null
```

The human control path does **not** execute the capability. A worker must subsequently acquire a fresh lease and resume the workflow. This cleanly separates control-plane authorization from execution-plane ownership.

Once resumed, M2B laws still apply:

- side-effecting capability requires `idempotency: required`
- deterministic `gw_*` key
- checkpoint CAS
- crash/retry convergence

## Rejection transition

For `rejected`:

```text
interrupted -> cancelled
interrupt -> null
decision -> append-only history
lease -> null
```

`cancelled` is terminal. Re-running the plan returns the durable cancelled checkpoint and does not invoke the guarded capability.

## Integrity rules

The v1alpha2 checkpoint hash binds:

- execution state,
- active interrupt,
- complete decision history.

Additionally each decision has its own independently recomputed `requestHash`. This gives defense in depth: changing a decision and recomputing only the outer checkpoint hash still fails decision-level validation.

Other invariants include:

- unique `decisionId`
- at most one decision per `interruptId`
- timestamp-ordered decisions
- decision times within checkpoint lifetime
- interrupted checkpoint has exactly one active undecided interrupt
- interrupted/terminal checkpoints have no executor lease
- cancelled checkpoint ends with a rejected decision
- interrupt step must equal the pending plan step
- every persisted decision must map to an approval-gated step in the current plan

## M2C adversarial gauntlet

The dedicated suite uses the real M2A durable graph backend and M2B SQLite checkpoint backend and proves:

1. gated graph mutation pauses before any side effect,
2. interrupt survives checkpoint DB close/reopen,
3. no decision policy fails closed,
4. deny policy leaves checkpoint unchanged,
5. policy exception fails closed,
6. approved decision does not itself execute the capability,
7. exact decision replay converges,
8. reused decision ID with changed content conflicts,
9. post-approval execution commits exactly once,
10. accepted decision remains replayable after workflow reaches `succeeded`,
11. rejected decision yields terminal `cancelled`,
12. rejected capability is never invoked,
13. inner decision tampering is caught even after recomputing the outer checkpoint hash,
14. v1alpha1 checkpoint hash is verified and normalized to v1alpha2,
15. full M1 + M2A + M2B regression remains green.

## Deliberate proof boundary

M2C does not claim:

- a web/UI approval inbox,
- identity-provider integration,
- RBAC/ABAC policy language,
- quorum / multi-party approvals,
- approval expiration/escalation,
- signed human decisions,
- distributed monotonic fencing for long-running executors,
- branching/loops/fan-out workflow DSL,
- graph-event compaction/snapshot anchors,
- Postgres/Supabase parity.

Those should be additive control-plane or persistence layers; they must not bypass this CAS/idempotency foundation.

## Promotion gate

M2C may be marked `TARGETED_ACCEPTED` only when the exact compacted head and its PR merge ref both pass:

- clean install,
- targeted strict TypeScript compile,
- M1 protocol/state/runtime/CSR regression,
- M2A durable-state crash/restart suite,
- M2B checkpoint crash-recovery suite,
- M2C durable HITL suite.

Whole-repository production certification remains independently gated by #76/#79.
