# ADR-010 — Observed Provider Outcome Recovery

Status: `PROPOSED / IMPLEMENTED_UNVERIFIED`

## Problem

The live side-effect commit path correctly requires the current active fence.
However, provider reconciliation can happen after the original lease expires or
a newer worker acquires a higher token. Reusing the live commit validator would
prevent COS from recording that the old provider attempt actually succeeded.

## Decision

Introduce `AuthorityObservedOutcomeRecorder` as the selected recovery boundary.
It does not authorize a new mutation. It:

1. requires an existing `reconciliation_required / unknown` operation;
2. finds the exact historical `executing` revision;
3. proves the operation's fencing token belonged to an active lease at execution time;
4. requires content-hashed provider inspection evidence;
5. records the observed outcome without treating the current resource owner as the authorizer of historical truth;
6. leaves the current lease and fencing token unchanged.

## Security boundary

A historical token is accepted only inside this recovery facade and only after
matching operation and lease histories. The general live execution runtime still
requires the current active lease at prepare/begin/commit.

## Consequences

- an applied provider effect can be recorded after lease expiry;
- a newer owner does not erase historical provider truth;
- no mutation is retried during reconciliation;
- missing historical lease evidence or unsealed provider evidence fails closed;
- package-root promotion remains deferred to Phase 07.
