# ADR-008 — Deterministic Authority CSR Edge Identity

**Status:** ACCEPTED_FOR_HARDENING  
**Date:** 2026-08-28

## Context

A `source→target` key cannot represent typed/parallel edges, while random generated edge IDs make replay/projection identity depend on insertion history.

## Decision

`BidirectionalCSRGraph` is the authority CSR candidate. When a caller does not provide an external edge ID, COS derives:

```text
csr_<canonicalHash128({source,target,type,identityKey})>
```

`identityKey='default'` represents the default semantic edge. Intentional parallel edges provide distinct identity keys. Duplicate deterministic identities fail closed.

For deterministically generated edges, source/target/type/identityKey are immutable; topology replacement is remove + add. Explicit externally governed edge IDs may retarget under their external identity contract.

Forward and reverse CSR projections are both materialized and sorted deterministically. Canonical node/edge payloads use strict canonical serialization.

## Consequences

- replay insertion order does not alter projection hash;
- reverse traversal is O(in-degree);
- multiedges retain exact edge multiplicity;
- callers that previously relied on random parallel edges must provide identityKey.

## Failure condition

Two equivalent authority graphs produce different projection hashes because of insertion order, an edge appears zero/multiple times in either projection, or two intentional parallel edges cannot coexist with separate identities.

## Rollback

Restore `bidirectional-csr.ts` from Phase 02 and keep it shadow-only until deterministic identity/reverse projection guarantees are restored.
