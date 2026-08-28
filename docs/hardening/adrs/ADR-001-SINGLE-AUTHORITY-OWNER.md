# ADR-001 — Single Authority Owner per Capability

**Status:** ACCEPTED_FOR_HARDENING  
**Date:** 2026-08-28

## Context

PR #34 and #35 proved that two simultaneously plausible authority implementations create lineage ambiguity even when both contain valuable work. Qualification of only one sibling was incomplete by construction.

## Decision

Every authoritative capability has exactly one write owner. Legacy implementations may remain only as `shadow`, `deprecated`, `read-only adapter`, or `migration adapter`.

A compatibility adapter MUST NOT:

- write canonical authority state independently;
- allocate a second canonical ID for the same logical object;
- perform a second policy decision for the same side effect;
- replay commands using different semantics from the authority owner.

Current owner map is `docs/hardening/AUTHORITY_SURFACE_MANIFEST.json`.

## Consequences

Positive:

- one lineage to replay/restore/test;
- unambiguous provenance and rollback;
- simpler concurrency and policy enforcement.

Costs:

- some legacy APIs require adapters/deprecation windows;
- migration cannot be a flag-day replacement.

## Failure condition

If two exported production paths can independently mutate the same authority domain, this ADR is violated and merge is blocked.

## Rollback

Revert to the Phase 01 checkpoint `76dfdc737c231b2637f122125f7acf98b735ff1f`; legacy APIs remain present there as shadow compatibility.
