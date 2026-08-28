# ADR-002 — Append-Only Bi-Temporal Authority Semantics

**Status:** ACCEPTED_FOR_HARDENING  
**Date:** 2026-08-28

## Context

A current-row model can store `validFrom/validUntil/recordedAt` yet still lie about historical knowledge if a later correction overwrites fields that did not exist at the earlier `knownAt` time.

## Decision

Authority history distinguishes:

- **valid time**: when the assertion is true in the represented world;
- **system/knowledge time**: when COS knew the revision.

Authority revisions are append-only. Historical rows are never rewritten to insert future knowledge. `systemUntil` is derived from the next revision, not mutated into the previous row.

Corrections, supersession, contradiction and retraction create new immutable evidence. Queries require explicit `asOf` and `knownAt` on authority paths where temporal truth matters.

## Consequences

- late-arriving corrections do not contaminate past `knownAt` queries;
- storage volume grows monotonically;
- compaction, if ever introduced, must preserve equivalent historical query semantics and evidence hashes.

## Failure condition

A query at `knownAt=T1` exposes a revision, successor timestamp, contradiction or sensitivity change first recorded at `T2>T1`.

## Rollback

Authority memory can be rebuilt from the Phase 01 append-only ledger. Do not migrate back to current-row overwrite as an authority representation.
