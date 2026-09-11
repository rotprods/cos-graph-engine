# /GRAPHIFY Snapshot V1 — Authority-Safe Projection Claim

**Status:** QUALIFIED_IMPLEMENTATION / final documentation seal pending  
**Parent:** `fix/sandbox-security-w1c` @ `f85fe66bce8079c0e3ec481bbeb3a88bf2c8184c`  
**Branch:** `feat/graphify-snapshot-v1`  
**Qualified implementation head:** `1a6dad5f14f51c250c004505eead78dfbc8b18e8`  
**Qualification run/job:** `34603690662` / `103276891070`  
**Evidence artifact:** `10265232172` / `sha256:d604975300db6c993c54a66695a26a24b93f897639574e641535a01ddf97af3f`

## North Star

Turn the already-discovered machine topology into a durable, recoverable, queryable COS knowledge substrate without allowing semantic enrichment or LLM inference to overwrite higher-authority evidence.

The historical `/GRAPHIFY` mission already established a deterministic base graph and a degraded semantic overlay. Snapshot V1 does **not** rescan the machine and does **not** call OpenClaw/Ollama. It establishes and qualifies the canonical schema and projection boundary that those producers must feed.

## Existing COS primitives reused

V1 projects one canonical snapshot into the existing graph stack:

- L8 `KnowledgeGraphEngine` — deterministic entities/relations + provenance properties;
- L9 `SemanticGraph` — semantic concepts/relations only;
- L10 `EmbeddingGraph` — vectors only when explicitly supplied by the overlay;
- L11 `GraphRAGEngine` — chunk/entity/relation retrieval view.

No duplicate vector database, KG engine, semantic engine or RAG engine is introduced.

## Authority lattice

Highest to lowest:

1. `source_ref` — exact Git ref / runtime identity / source-system reference;
2. `content_hash` — cryptographic content identity;
3. `deterministic_topology` — scanner-derived path/container/reference structure;
4. `semantic_overlay` — deterministic or model-assisted semantic annotation;
5. `llm_inference` — non-authoritative inference.

Rules:

- lower-authority layers may annotate but never rewrite higher-authority identity;
- file/path/hash/topology evidence remains in the deterministic snapshot layer;
- LLM-derived concepts live only in the semantic/embedding/chunk overlay;
- every projected semantic relation carries its authority classification in the parallel provenance ledger;
- unknown relation vocabulary is preserved as metadata/provenance even when mapped onto COS's narrower canonical relation enums;
- graph projections are recoverable views, never the sole source of truth.

This hierarchy classifies evidence; it does not silently reconcile contradictory authority-bearing fields.

## Canonical Snapshot V1

A snapshot contains:

- schema version;
- `generatedAt` and `sourceRoot`;
- deterministic nodes and edges;
- explicit evidence records;
- optional semantic nodes/edges;
- optional embedded chunks for GraphRAG;
- producer metadata.

The projector is pure with respect to validated input: the same snapshot canonicalizes deterministically and produces equivalent L8–L11 views without mutating caller-owned input.

## Validation

V1 fails closed on authority-bearing malformed input including:

- unsupported schema version;
- duplicate node/edge/evidence/semantic/chunk IDs;
- dangling deterministic or semantic edges;
- malformed SHA-256 values;
- non-finite or empty embeddings;
- mixed embedding dimensions inside semantic vector sets or chunk vector sets;
- confidence/strength outside `[0,1]`;
- chunks referencing unknown entities;
- semantic source references pointing at unknown deterministic nodes;
- malformed timestamps/source roots;
- invalid authority classifications and evidence references;
- negative/unsafe deterministic sizes;
- non-JSON and circular metadata.

Validation does not silently repair authority-bearing input.

## Projection contract

### L8

Every deterministic node becomes one KG entity with its original ID. Every deterministic edge becomes one KG relation with its original edge ID. COS relation types may be normalized, but the original Graphify relation and authority remain recoverable in relation properties/provenance.

### L9

Only explicit semantic overlay nodes/edges enter the semantic graph. Deterministic filesystem/runtime topology is not hallucinated into semantic taxonomy.

### L10

Only semantic nodes with explicit vectors enter the embedding graph. V1 never invents embeddings.

### L11

Explicit chunks enter GraphRAG with supplied vectors and deterministic entity references. RAG relations are projected from the deterministic graph while preserving original relation vocabulary in the V1 provenance layer.

### Provenance

The projector returns an explicit parallel provenance ledger for deterministic nodes/edges, semantic nodes/edges and chunks. This prevents canonical COS enum normalization from erasing the originating Graphify authority/evidence/type vocabulary.

## Canonicalization

V1 exposes deterministic canonical JSON:

- stable-ID arrays sorted deterministically;
- object keys recursively sorted;
- no mutation of caller-owned input;
- semantically identical snapshots with different input ordering canonicalize identically.

Cryptographic hashing of the canonical string belongs to the Adapter + Persistence wave, not this pure graph package.

## RED→GREEN authority

Clean RED:

- head `875bf3d351f686a5c46c6c4428c8114a96a3a060`
- run/job `34602946705` / `103274427602`
- artifact `10265475486`
- digest `sha256:d72650afa5addb4be133a4903a54eeadd4ba4c4d8485d243f18b82627f0ca3df`
- failure: required projector module did not yet exist.

Qualified implementation GREEN:

- head `1a6dad5f14f51c250c004505eead78dfbc8b18e8`
- run/job `34603690662` / `103276891070`
- artifact `10265232172`
- digest `sha256:d604975300db6c993c54a66695a26a24b93f897639574e641535a01ddf97af3f`
- Graphify V1 suite PASS with 40 authority-failure families exercised;
- full canonical repository tests PASS;
- `npm audit --audit-level=high` PASS with 0 vulnerabilities for the tested lockfile/run;
- scope/anti-bypass gate PASS.

Coverage replays the exact W1C parent corpus plus Graphify V1:

- statements: **81.48%** vs 81.01% floor (**+0.47 pp**)
- branches: **79.96%** vs 79.46% floor (**+0.50 pp**)
- functions: **85.23%** vs 85.03% floor (**+0.20 pp**)
- lines: **81.48%** vs 81.01% floor (**+0.47 pp**)

An earlier child-only coverage attempt was rejected because it did not replay the inherited W1C sandbox suites. The ratchet was corrected by restoring the exact parent corpus; no threshold was lowered.

## Non-claims

V1 does not yet claim:

- reading `/mnt/data` or File Library;
- parsing the historical `inventory.json`, `edges.ndjson`, or `semantic-overlay.json` wire formats;
- OpenClaw/Ollama execution;
- embeddings generation;
- filesystem watching/incremental scanning;
- append-only snapshot persistence or canonical manifest hashing;
- cross-process locking;
- a production semantic-model quality score;
- deployment, merge into W1C/main, or global `/CGEV2 × /COS` qualification.

Those are subsequent adapters/waves built against this qualified contract.

## DOD

Snapshot V1 satisfies its implementation DOD when the documentation-only head also requalifies:

- malformed authority input fails closed;
- canonicalization is order-independent and non-mutating;
- deterministic topology projects while preserving original IDs/types/authority metadata;
- semantic inference cannot overwrite deterministic hash/path identity;
- L8/L9/L10/L11 projections validate;
- explicit GraphRAG chunk/entity relations work with supplied embeddings;
- topology-only snapshots work without semantic/chunk layers;
- full canonical repository tests remain green;
- exact W1C coverage corpus is replayed and every floor is exceeded;
- dependency audit and scope/anti-bypass gates remain green.

## Next canonical wave

After the final documentation-only seal, proceed to **Graphify Adapter + Persistence V1**: historical artifact adapters, canonical SHA-256 manifests, append-only/recoverable snapshots, deterministic drift detection, corruption/restart semantics and OpenClaw/Ollama as lower-authority semantic producers only.