# Phase 03 Rollback Addendum — Core Correctness

Parent rollback policy: `ROLLBACK_MAP.md`.

| Guarantee | Changed surface | Rollback ref | Data/replay implications | Degraded-mode fallback |
|---|---|---|---|---|
| CAS copy safety | `packages/runtime/src/concurrency.ts` | Phase 02 closure head `097df3dc...` | in-process reference store only; no persisted data migration | stop authority concurrent writers; use last verified snapshot/read-only state |
| PropertyGraph isolation/traversal | `packages/knowledge/src/property-graph.ts` | Phase 02 closure head | derived in-memory graph; rebuild from source events/data | use graph read-only/shadow and rebuild indexes |
| Strict canonical serializer/identity | `packages/core/src/identity.ts` | Phase 02 closure head | deterministic IDs for newly canonicalized provider identities may differ from pre-normalized mixed-case/Unicode variants; migration must preserve aliases | retain native provider ID/URI aliases and stop new canonical registration if collision appears |
| Strict SHA canonicalization | `packages/core/src/integrity.ts` | Phase 02 closure head | existing SHA evidence computed with legacy serializer remains historical evidence; do not relabel old hashes | verify old artifact with recorded algorithm/version; issue new canonical evidence separately |
| Authority CSR | `packages/graph/src/bidirectional-csr.ts` | Phase 02 closure head | CSR is a rebuildable projection; no source-of-truth data migration | rebuild legacy/shadow CSR from canonical graph/event source |

## Identity migration warning

GitHub repository/user/organization/commit resource IDs now normalize case on the authority path. Existing native IDs and historical URIs must remain aliases during migration; never delete historical evidence because two old spellings converge to one canonical identity.

## Integrity migration warning

`sha256Hex` now rejects non-canonical payloads. If an existing snapshot payload contains unsupported values or explicit `undefined`, the correct response is to canonicalize/version the snapshot schema or use its recorded legacy verification path — not coerce it silently.

## CSR migration warning

Default edge IDs are deterministic. Code that depended on random implicit parallel edges must supply an explicit `identityKey` or external `id`. Legacy `CSRGraph` remains available as compatibility during qualification.
