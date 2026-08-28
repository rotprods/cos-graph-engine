# ADR-007 — Strict Canonical Serialization Boundary

**Status:** ACCEPTED_FOR_HARDENING  
**Date:** 2026-08-28

## Context

Historical `stableSerialize/stableHash128` accepted values such as `undefined`, bigint and arbitrary object instances. That behavior is useful for backward-compatible deterministic keys, but is too ambiguous for authority identity or integrity: `Date`, `Map`, `Set` or class instances may collapse into structurally misleading representations.

## Decision

Two explicit lanes exist during migration:

- `stableSerialize` / `stableHash128`: legacy deterministic compatibility only;
- `canonicalSerialize` / `canonicalHash128`: strict authority canonical data.

Strict canonical data permits only null, boolean, finite number, Unicode string, dense arrays and plain enumerable data objects. It rejects cycles, undefined, bigint, functions, symbols, sparse arrays, accessors, non-plain objects and non-finite numbers. Strings and keys normalize to NFC; normalized key collisions fail closed.

`canonicalIdentity` uses `canonicalHash128`. Cryptographic `sha256Hex` hashes `canonicalSerialize` output.

## Consequences

- historical projection hashes remain readable while callers migrate;
- authority payloads must explicitly canonicalize optional values (omit or use null) rather than rely on `undefined`;
- integrity failures caused by unsupported payloads are design signals, not values to silently coerce.

## Failure condition

An authority identity/integrity path hashes a non-canonical JS object without rejection, or two unsupported values collapse to the same authority representation.

## Rollback

Restore Phase 02 `identity.ts`/`integrity.ts`, but do not promote authority until equivalent strict canonicalization is reintroduced.
