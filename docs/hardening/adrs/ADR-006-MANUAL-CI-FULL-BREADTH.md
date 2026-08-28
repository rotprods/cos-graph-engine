# ADR-006 — Manual CI Must Preserve Full Verification Breadth

**Status:** ACCEPTED_FOR_HARDENING  
**Date:** 2026-08-28

## Context

Automatic GitHub Actions can consume real money. A previous cost-control proposal correctly removed automatic invocation but also compressed away verification categories such as CSR, pruning, WASM, observability, visualization, coverage, benchmarks and Docker qualification.

## Decision

Invocation policy and verification breadth are separate concerns.

During hardening:

- GitHub Actions are manual-only;
- CD/deploy/release are off;
- expensive categories may be opt-in inputs;
- the complete verification surface remains representable and runnable;
- no required failure may be hidden with `|| echo`, `continue-on-error`, or a final job that ignores upstream failures.

Phase 07 owns the full manual matrix.

## Consequences

- normal coding iterations incur zero automatic Actions spend;
- final qualification remains broad enough to support Authority claims;
- local verification can replace remote execution where equivalent, but evidence must record executor/toolchain.

## Failure condition

Cost control removes a verification category rather than changing when/how it runs, or a required failing category can still produce a green qualification result.

## Rollback

Restore the legacy verification category from `main`/historical workflow while retaining manual invocation and removing false-green constructs separately.
