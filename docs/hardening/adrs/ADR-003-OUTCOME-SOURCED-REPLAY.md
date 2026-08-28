# ADR-003 — Outcome-Sourced Replay

**Status:** ACCEPTED_FOR_HARDENING  
**Date:** 2026-08-28

## Context

Replaying historical commands by running today's state-machine rules can reinterpret the past. A command rejected under an older state/revision could later become accepted after code changes.

## Decision

Authority event flows record:

1. observed command/intent;
2. explicit accepted/rejected outcome;
3. resulting state/revision/hash where applicable.

Replay applies recorded outcomes. It does not re-decide historical commands.

A command without its required outcome is an incomplete authority transaction and replay fails closed.

## Consequences

- behavioral code can evolve without rewriting historical decisions;
- event volume increases;
- command/outcome atomicity or compensation must be handled explicitly.

## Failure condition

Replay executes current guards/actions to decide whether an already-recorded historical command should apply.

## Rollback

Rebuild projections from recorded outcome events. If outcome evidence is incomplete, stop and recover/repair the event stream rather than guessing.
