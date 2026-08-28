# ADR-004 — Side-Effect Delivery Semantics

**Status:** ACCEPTED_FOR_HARDENING  
**Date:** 2026-08-28

## Context

An `idempotencyKey` and a `fencingVersion` being present in an API call do not prove that an external side effect is exactly-once. The process may execute the effect, crash before persisting the result and retry.

## Decision

COS does not claim exactly-once external side effects until Phase 05 implements and verifies:

- durable operation/side-effect ledger;
- payload-bound idempotency claim;
- resource-level fencing checked at commit boundary;
- lease ownership/renewal semantics;
- recorded outcome/result recovery;
- compensation or explicit non-compensable classification.

Until then, authority tool execution is `at-least-once-risk-aware`, even when protected by in-process idempotency/fencing metadata.

## Consequences

- capability routing may exist before exactly-once authority promotion;
- external mutations remain a critical P0 qualification area;
- docs/UI must not imply guarantees stronger than the durable protocol.

## Failure condition

A side-effecting tool can execute twice after crash/retry while COS reports exactly-once semantics.

## Rollback

Disable the side-effect capability or return it to shadow/manual execution. Event and operation evidence must remain intact for diagnosis.
