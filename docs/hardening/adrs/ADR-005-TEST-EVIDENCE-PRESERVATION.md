# ADR-005 — Legacy Test Evidence Preservation

**Status:** ACCEPTED_FOR_HARDENING  
**Date:** 2026-08-28

## Context

Changing implementation and its historical tests in the same diff can hide a regression by redefining the expected behavior after the fact. COS has also historically contained suites that existed but were not wired into the default runner.

## Decision

Tests are separated into:

- **legacy evidence**: tests/scripts that existed at the Phase 01 baseline and are immutable by default;
- **authority evidence**: new additive tests for stricter contracts;
- **retired assertions**: allowed only through an explicit waiver linked to an ADR, replacement evidence and rollback.

`TEST_EVIDENCE_MANIFEST.json` and `scripts/check-test-evidence.ts` enforce the boundary.

Historically orphaned/excluded suites are first-class evidence obligations. Phase 07 must run them or record a current explicit blocker; omission is not success.

## Consequences

- authority hardening cannot silently rewrite history;
- intentional breaking changes require more ceremony;
- the final test matrix contains both compatibility and authority guarantees.

## Failure condition

A legacy test is modified/deleted without a valid waiver, or a test exists in the repo but qualification silently omits it.

## Rollback

Recover the original test from `checkpoint/phase-01-reconciled-76dfdc7` and keep new expectations in additive authority tests.
