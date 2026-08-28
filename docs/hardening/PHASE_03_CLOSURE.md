# Phase 03 Closure — Core Correctness

**Status:** `COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`  
**Date:** 2026-08-28  
**Authority:** `SHADOW_ONLY`

## Frozen code checkpoint

- ref: `checkpoint/phase-03-core-ad6a93c`
- exact SHA: `ad6a93c0b2986c36efefb5cd59a4d14a9dffceb3`
- parent Phase 02 closure head: `097df3dcba6b71f8eb5621dfbcc376bad9f48ed`
- Phase 02 checkpoint: `checkpoint/phase-02-contracts-06487e7`

The checkpoint freezes Phase 03 code before closure/state-only commits. Do not move it.

## Guarantees implemented

### P03.1 — CAS and idempotency copy safety

- canonical state is detached on constructor/write boundaries;
- `read()` and CAS receipts are deep detached;
- nested caller mutation cannot alter canonical value/version/hash;
- idempotency payloads/results/records are detached;
- stale version/hash and uncloneable values fail closed.

### P03.2 — PropertyGraph copy/index safety

- nodes/edges detached on write/read/query/traversal;
- type/tag/source/target indices updated with canonical mutations;
- endpoint and identity checks before commit;
- query property/offset/limit semantics explicit.

### P03.3 — Traversal correctness

- safe-integer non-negative depth;
- depth=0 returns origin only;
- directed edges traverse source→target only;
- undirected edges may traverse either direction;
- every path satisfies `nodes = edges + 1` and includes destination nodes.

### P03.4 — Strict canonical serialization

- `canonicalSerialize` / `canonicalHash128` added for authority data;
- rejects unsupported JS types, cycles, sparse arrays, accessors and non-finite values;
- Unicode strings/keys normalize to NFC;
- normalized-key collisions fail closed;
- legacy `stableSerialize/stableHash128` retained as explicit compatibility lane;
- `sha256Hex` now hashes strict canonical serialization.

### P03.5 — Provider-aware identity normalization

- authority/resource type normalization explicit;
- GitHub repository/organization/user/commit identities case-normalized;
- case-sensitive branch and opaque Drive IDs preserved;
- aliases and canonical URI lookup use the same normalization;
- IdentityRegistry never exposes stored identity objects by reference.

### P03.6 — Authority CSR consolidation

- existing `BidirectionalCSRGraph` selected; no third CSR implementation;
- deterministic default edge identity using `source/target/type/identityKey`;
- intentional parallel edges via distinct identityKey;
- deterministic forward + reverse CSR projections;
- reverse traversal O(in-degree);
- cursor BFS;
- copy-safe canonical node/edge data;
- deterministic projection hash and stronger validation.

## Additive authority evidence written

- `scripts/test-authority-concurrency-copysafe.ts`
- `scripts/test-authority-property-graph.ts`
- `scripts/test-authority-identity.ts`
- `scripts/test-authority-csr.ts`

These are wired into the authority runner/strict typecheck but remain unexecuted.

## Governance

- no legacy test was edited or deleted;
- material replacements are classified in `DELETION_GOVERNANCE.json`;
- rolling `STATE.md`, `TASKS.md`, `HANDOFF.md` replacements are explicitly classified;
- ADR-007 defines strict canonical serialization;
- ADR-008 defines deterministic authority CSR identity;
- compatibility and rollback addendum were updated.

## Known follow-up created by strict canonical integrity

Strict SHA-256 payload hashing now rejects explicit `undefined` and non-canonical objects. Phase 04 must canonicalize/version persisted snapshot/event payloads rather than weakening the serializer. In particular, optional authority snapshot fields must be omitted or represented canonically before signing.

## What Phase 03 does NOT prove

- clean compilation/typecheck;
- legacy or authority test success;
- concurrency under real contention;
- persistence/recovery parity;
- performance;
- security resilience;
- production authority.

Assurance therefore remains unchanged.

## Phase 04 entry

Phase 04 owns Temporal / Event / Persistence:

1. align InMemory/Postgres EventLog semantics and copy safety;
2. canonicalize persisted/signed payloads for strict serialization;
3. make KnowledgeGraph mutations transactional or explicitly saga-compensable;
4. extend append-only system-time semantics beyond memory;
5. add executable Postgres/Supabase semantic fixtures;
6. complete snapshot/replay/restore contracts and corrupted-state fixtures.

## Rollback

- Phase 03: `checkpoint/phase-03-core-ad6a93c`.
- Phase 02: `checkpoint/phase-02-contracts-06487e7`.
- Phase 01: `checkpoint/phase-01-reconciled-76dfdc7`.
