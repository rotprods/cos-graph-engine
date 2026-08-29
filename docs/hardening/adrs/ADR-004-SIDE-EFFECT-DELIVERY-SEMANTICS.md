# ADR-004 — Side-Effect Delivery Semantics

**Status:** ACCEPTED_FOR_HARDENING  
**Date:** 2026-08-28  
**Last implementation checkpoint:** Phase 05 P05.1 candidate

## Context

An `idempotencyKey` and a `fencingVersion` being present in an API call do not prove that an external side effect is exactly-once. The process may execute the effect, crash before persisting the result and retry. A provider can also accept a mutation while the client loses the response, leaving the outcome unknown.

## Decision

COS does not claim exactly-once external side effects.

Authority-grade execution requires all of the following before promotion:

- durable append-only operation/side-effect ledger;
- request-bound idempotency claim;
- explicit `executing` state before provider invocation;
- `uncertain` state for connection loss or crash windows with unknown provider outcome;
- resource-level monotonic fencing checked at the real commit boundary;
- lease ownership, renewal, expiry and reacquisition semantics;
- recorded outcome/result recovery;
- compensation or explicit non-compensable classification;
- provider-specific reconciliation for uncertain operations.

## Phase 05 implementation candidate

P05.1 introduces:

- `SideEffectLedger` and `SideEffectCoordinator`;
- append-only in-memory and Postgres/Supabase candidate stores;
- states `claimed → prepared → executing → succeeded|failed|uncertain` plus compensation states;
- deterministic operation identity scoped by principal/project/operation key;
- request-bound conflict detection;
- immutable result/error/provider evidence;
- provider exceptions classified as `uncertain`;
- `AuthorityCapabilityExecutor`, which requires write/execute/admin tools to enter the ledger before tool invocation.

This is `IMPLEMENTED_UNVERIFIED`. It does **not** satisfy the full ADR yet because resource-bound fencing, durable lease recovery and provider reconciliation remain open, and no clean execution evidence has run.

## Consequences

- direct side-effecting `CapabilityRouter` use remains shadow/non-authoritative;
- read-only capabilities may route without the side-effect ledger;
- a terminal accepted result can be reused without re-invoking the provider;
- an `executing` or `uncertain` operation cannot be automatically retried;
- external mutations remain a critical P0 qualification area;
- docs/UI must not imply guarantees stronger than the durable protocol;
- providers without conditional-write/fencing support require reconciliation or manual authority boundaries.

## Failure condition

Any of the following invalidates authority qualification:

- a provider operation executes twice after crash/retry while COS reports exactly-once;
- a stale worker can commit after a newer fencing token exists;
- an unknown provider outcome is converted directly to failed/succeeded without reconciliation evidence;
- a side-effecting authority path bypasses the operation ledger.

## Rollback

Disable the side-effect capability or return it to shadow/manual execution. Event and operation evidence must remain intact for diagnosis. Never delete uncertain-operation history during rollback.
