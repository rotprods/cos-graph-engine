# Phase 05 Progress v2 — Security, Concurrency and Agent Runtime

Status: `ACTIVE / IMPLEMENTED_UNVERIFIED`  
Authority: `SHADOW_ONLY`  
Parent checkpoint: `checkpoint/phase-04-temporal-20260828`  
Branch: `hardening/phase-05-security-concurrency-runtime`  
Draft PR: `#46`

## 1. Current static result

Phase 05 now contains an end-to-end authority candidate for the internal control state around an external side effect:

```text
principal + project + sensitivity
        ↓ policy decision / approval
append-only agent run
        ↓ plan step
append-only resource lease
        ↓ monotonic fencing
append-only side-effect operation
        ↓ provider call begins
commit | reconcile | compensate
        ↓
accepted result + near-miss evidence
```

This is no longer a presence check for `idempotencyKey` or `fencingVersion`. It is an explicit set of revisioned aggregates and fail-closed transition rules.

## 2. Durable side-effect authority

The selected authority path is:

- `authority-side-effect.ts` — append-only operation and attempt revisions;
- `authority-side-effect-runtime.ts` — crash/provider reconciliation;
- `authority-side-effect-store-postgres.ts` — conflict-safe Postgres/Supabase candidate;
- `authority-execution-runtime.ts` — live lease-bound execution.

The model distinguishes:

- no effect started;
- effect outcome unknown;
- provider proves not applied;
- provider proves applied;
- partial application;
- committed outcome;
- compensation required/in progress/completed.

An interrupted provider call cannot be retried until a provider/resource reconciler closes the ambiguity.

## 3. Durable leases and fencing

The selected lease path is:

- `authority-lease.ts` — append-only explicit-time lease service;
- `authority-lease-store-postgres.ts` — Postgres/Supabase candidate;
- `authority-execution-runtime.ts` — prepare/begin/commit boundary validation.

Lease ownership includes resource revision, lease revision, bounded TTL and monotonic fencing token. Renewal preserves a token; expiry/release and reacquisition allocate a strictly higher token. A stale worker cannot commit after newer ownership exists.

## 4. Policy enforcement

`authority-policy.ts` implements typed default-deny rules rather than arbitrary field/operator interpretation.

Hard preconditions:

- principal identity;
- project scope;
- sensitivity clearance;
- explicit action/capability/resource match;
- temporal rule validity.

Precedence:

```text
deny > require_approval > allow > default deny
```

Approval grants are append-only, operation-hash scoped and expire fail closed.

`authority-policy-bound-runtime.ts` applies policy before claim, prepare, execution start and commit. Later decisions use canonical attributes from the stored operation rather than caller-supplied resource/capability/project copies.

## 5. Operational evidence and near misses

`authority-execution-evidence.ts` and `authority-execution-signal-store.ts` record accepted outcomes and rejected near misses such as stale fencing or lease conflicts.

The observer is failure-isolated:

- a signal-store failure cannot alter the protected operation result;
- rejected stale commits remain rejected even if evidence recording fails;
- signals preserve machine-actionable error codes;
- evidence does not assert a root cause that was not established.

## 6. Durable agent-run aggregate

`authority-agent-run.ts` provides an append-only goal/plan/step/result/criterion aggregate.

It enforces:

- immutable goal and acceptance-contract identity;
- acyclic plan DAGs;
- dependency ordering;
- exact step-attempt sequencing;
- evidence references for every step result;
- committed operation evidence for accepted side-effecting steps;
- exact evaluator ID and version for acceptance criteria;
- every critical step accepted before completion;
- every required criterion explicitly passed before completion;
- copy-safe restart reconstruction.

Completion is not inferred from a substring such as “all tests passed”.

## 7. Current authority surface

The selected additive barrel is:

`packages/execution/src/authority-phase05-current.ts`

The full static type graph is:

`tsconfig.phase05.full.json`

The complete current evidence and supersession map is:

`docs/hardening/PHASE_05_EVIDENCE_MANIFEST.v2.json`

Package-root cutover is intentionally deferred to Phase 07.

## 8. Superseded drafts retained for provenance

Several early Phase 05 files remain physically present because this phase has not yet executed the deletion/compatibility gate. They are explicitly non-authority in the v2 manifest, including:

- the first Postgres side-effect prototype;
- the first coordinator draft;
- the first in-file signal sink;
- the first incomplete barrels/type graph;
- the first side-effect contract/fixture.

They must not be imported by authority callers. Phase 07 will delete or quarantine them only with deletion-ledger, compatibility and executed evidence.

## 9. Contracts written

The current strict graph includes contracts for:

- side-effect crash/reconcile/compensate;
- Postgres side-effect restart and corruption;
- lease renew/expire/reacquire;
- Postgres lease restart and corruption;
- integrated live lease-bound execution;
- near-miss and observer-failure isolation;
- default-deny policy and scoped approvals;
- policy interception before every operation mutation;
- durable agent-run planning, retries and completion.

All remain `WRITTEN_UNEXECUTED`.

## 10. Remaining Phase 05 work

1. Bind the real `CapabilityRouter` / strict tool execution path to the policy-bound authority runtime.
2. Add provider-native idempotency/reconciliation adapters.
3. Add deployment-layer HTTP egress controls: DNS resolution, IP policy, redirect revalidation and pinning.
4. Add filesystem sandbox controls: realpath containment, symlink/TOCTOU handling and handle-based commit checks.
5. Add a durable Postgres agent-run store.
6. Connect lease, policy, agent-run and compensation outcomes to AuthorityTelemetry without making telemetry a SPOF.
7. Add multi-writer/process-kill contracts in the later execution campaign.
8. Resolve superseded draft files under deletion governance.

## 11. Proof boundary

No clean install, typecheck, test, process-kill campaign, real Postgres fixture, security scan or provider integration has run.

Therefore:

```text
Build may rise after review.
Assurance remains 2.6/10.
Authority remains 2.6/10.
Status remains SHADOW_ONLY.
```

No production database, Supabase project, GitHub Action, deployment or release was used.
