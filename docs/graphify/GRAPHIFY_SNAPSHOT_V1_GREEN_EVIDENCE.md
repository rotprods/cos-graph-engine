# /GRAPHIFY Snapshot V1 — Qualified GREEN Evidence

Status: **QUALIFIED_IMPLEMENTATION / UNMERGED**

This evidence binds the pure authority-safe snapshot/projector implementation to an exact GitHub Actions candidate. It does not claim that historical `/mnt/data` or File Library artifacts have already been imported, nor that OpenClaw/Ollama semantic enrichment is production-qualified.

## Identity

- exact parent W1C: `f85fe66bce8079c0e3ec481bbeb3a88bf2c8184c`
- qualified Graphify V1 implementation head: `1a6dad5f14f51c250c004505eead78dfbc8b18e8`
- workflow run: `34603690662`
- qualification job: `103276891070`
- artifact: `10265232172`
- artifact name: `graphify-snapshot-v1-1a6dad5f14f51c250c004505eead78dfbc8b18e8`
- artifact size: `13,084,669` bytes
- artifact digest: `sha256:d604975300db6c993c54a66695a26a24b93f897639574e641535a01ddf97af3f`

Later documentation-only commits may advance the branch head. They do not supersede the implementation identity above unless product/test/workflow code changes again. A final documentation-only qualification run is required before this evidence is treated as fully sealed.

## RED provenance

The contract was committed before the implementation.

- RED head: `875bf3d351f686a5c46c6c4428c8114a96a3a060`
- RED run: `34602946705`
- RED job: `103274427602`
- RED artifact: `10265475486`
- RED artifact digest: `sha256:d72650afa5addb4be133a4903a54eeadd4ba4c4d8485d243f18b82627f0ca3df`
- failure: `ERR_MODULE_NOT_FOUND` for the not-yet-existing `packages/graph/src/graphify-snapshot.ts`

This preserves the causal chain: qualified W1C parent → executable V1 contract → clean missing-capability RED → projector implementation → authority/adversarial expansion → exact parent-corpus coverage ratchet → GREEN.

## GREEN gate matrix

The exact qualified implementation passed every configured gate:

1. exact source/parent SHA binding — PASS
2. Node 26.8.2 setup — PASS
3. frozen dependency install — PASS
4. restoration of the exact W1C coverage preconditions, including the digest-pinned sandbox image — PASS
5. strict TypeScript — PASS
6. `/GRAPHIFY Snapshot V1` authority/projector contract — PASS
7. 40 authority-validation failure families exercised — PASS
8. full canonical repository regression suite — PASS
9. exact W1C coverage corpus replayed plus Graphify V1 tests — PASS
10. exact W1C coverage ratchet with no floor reduction — PASS
11. `npm audit --audit-level=high` — PASS, `0 vulnerabilities` for the tested lockfile/run
12. Graphify V1 scope/anti-bypass policy — PASS
13. evidence artifact preservation — PASS

## Coverage

The ratchet compares like-for-like corpora: the exact W1C canonical + sandbox security/hardening corpus is replayed, then Graphify V1 tests are added.

| Metric | Exact W1C floor | Graphify V1 | Delta |
|---|---:|---:|---:|
| Statements | 81.01% | 81.48% | +0.47 pp |
| Branches | 79.46% | 79.96% | +0.50 pp |
| Functions | 85.03% | 85.23% | +0.20 pp |
| Lines | 81.01% | 81.48% | +0.47 pp |

The earlier candidate `fb57c12649f466936637553cafbf92f197b94b00` produced an invalid ratchet comparison because it omitted the inherited W1C sandbox suites from the measured child corpus. The workflow was corrected to replay the exact parent corpus rather than weakening floors or manufacturing compensating tests.

## What V1 proves

V1 establishes one canonical, validated snapshot model and pure projector over existing COS graph primitives:

- L8 `KnowledgeGraphEngine` receives deterministic entities/relations while preserving original IDs, relation vocabulary, authority and evidence metadata;
- L9 `SemanticGraph` receives only explicit semantic overlay nodes/edges;
- L10 `EmbeddingGraph` receives only explicitly supplied vectors; V1 invents no embeddings;
- L11 `GraphRAGEngine` receives explicit chunks plus deterministic entity/relation references;
- a parallel provenance ledger preserves authority/evidence/original vocabulary where COS canonical enums normalize a relation;
- lower-authority semantic/LLM annotation cannot rewrite deterministic path/hash identity;
- unknown semantic/deterministic relation vocabulary is normalized for COS execution while the original term remains recoverable in provenance/properties;
- canonical JSON is order-independent for stable-ID arrays, recursively key-sorted and non-mutating;
- topology-only snapshots are valid without requiring semantic/chunk layers;
- malformed authority-bearing input fails closed rather than being silently repaired.

## Validation families demonstrated

The suite covers, among others:

- unsupported schema versions and malformed timestamps/source roots;
- duplicate evidence/node/edge/semantic/chunk IDs and empty IDs;
- invalid authority classifications;
- missing or malformed evidence references and SHA-256 values;
- invalid node size and edge confidence;
- dangling deterministic and semantic endpoints;
- empty relation/concept/text/source values;
- non-finite, empty and dimension-mismatched vectors;
- invalid semantic strength;
- chunks referencing unknown deterministic entities;
- unknown semantic source-node references;
- non-JSON values including `undefined`, functions, BigInt and Infinity;
- circular metadata;
- all supported deterministic entity-kind mappings;
- canonical and normalized deterministic relation mappings;
- unknown semantic relation fallback with original vocabulary retained;
- semantic nodes without embeddings remaining outside L10.

## Authority invariant

The V1 authority ordering is:

`source_ref > content_hash > deterministic_topology > semantic_overlay > llm_inference`

This is an evidence hierarchy, not an instruction to merge conflicting fields automatically. V1 prevents lower-authority semantic layers from becoming the owner of deterministic identity. Graph projections remain recoverable views, never the only authority store.

## Explicit non-claims

V1 does **not** yet claim:

- actual ingestion of the historical `inventory.json`, `edges.ndjson`, `semantic-overlay.json` or related `/mnt/data` artifacts;
- File Library access/recovery;
- OpenClaw/Ollama execution or semantic-model quality;
- embedding generation;
- append-only snapshot persistence or manifest hashing;
- incremental filesystem scanning/watchers;
- cross-process writer coordination;
- production deployment;
- merger into W1C/main;
- a global `/CGEV2 × /COS` seal.

## Next canonical wave

The next wave is **Graphify Adapter + Persistence V1**:

1. parse/normalize the historical graphify artifact family into this exact V1 contract;
2. generate deterministic canonical snapshot manifests and SHA-256 identities;
3. persist append-only snapshots with recoverable current/previous pointers;
4. detect deterministic drift incrementally instead of rescanning/re-embedding unchanged content;
5. connect OpenClaw/Ollama only as semantic/chunk/embedding producers below the authority boundary;
6. prove restart/recovery, corruption handling and semantic-overlay degradation without loss of deterministic topology;
7. ingest the real historical artifacts when the File Library/runtime source becomes accessible again.

No merge or deployment is authorized by this evidence record.