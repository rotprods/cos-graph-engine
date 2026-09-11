# /GRAPHIFY Snapshot V1 — Authority-Safe Projection Claim

**Status:** CLAIMED / RED→GREEN implementation pending  
**Parent:** `fix/sandbox-security-w1c` @ `f85fe66bce8079c0e3ec481bbeb3a88bf2c8184c`  
**Branch:** `feat/graphify-snapshot-v1`

## North Star

Turn the already-discovered machine topology into a durable, recoverable, queryable COS knowledge substrate without allowing semantic enrichment or LLM inference to overwrite higher-authority evidence.

The existing `/GRAPHIFY` mission already established a deterministic base graph and a degraded semantic overlay. V1 does **not** rescan the machine and does **not** call OpenClaw/Ollama. It establishes the canonical schema and projection boundary that those producers must feed.

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
- every projected semantic relation carries its authority classification;
- unknown relation vocabulary is preserved as metadata even when mapped onto COS's narrower canonical relation enums;
- graph projections are recoverable views, never the sole source of truth.

## Canonical Snapshot V1

A snapshot contains:

- schema version;
- `generatedAt` and `sourceRoot`;
- deterministic nodes and edges;
- explicit evidence records;
- optional semantic nodes/edges;
- optional embedded chunks for GraphRAG;
- producer metadata.

The projector must be pure: same validated snapshot => same canonical serialized snapshot and equivalent L8–L11 views.

## Required validation

Fail closed on:

- unsupported schema version;
- duplicate node/edge/evidence/semantic/chunk IDs;
- dangling deterministic or semantic edges;
- malformed SHA-256 values;
- non-finite or empty embeddings;
- mixed embedding dimensions inside one semantic vector set or chunk vector set;
- confidence/strength outside `[0,1]`;
- chunks referencing unknown entities;
- semantic source references pointing at unknown deterministic nodes;
- malformed timestamps.

Validation must not silently repair authority-bearing input.

## Projection contract

### L8

Every deterministic node becomes one KG entity with its original ID. Every deterministic edge becomes one KG relation with its original edge ID. COS relation types may be normalized, but the original graphify relation and authority are retained in relation properties.

### L9

Only explicit semantic overlay nodes/edges enter the semantic graph. Deterministic file-system topology is not hallucinated into semantic taxonomy.

### L10

Only semantic nodes with explicit vectors enter the embedding graph. V1 never invents embeddings.

### L11

Explicit chunks enter GraphRAG with their supplied vectors and deterministic entity references. RAG relations are projected from the deterministic graph while preserving the original relation type.

## Canonicalization

V1 exposes deterministic canonical JSON:

- arrays sorted by stable IDs;
- object keys recursively sorted;
- no mutation of caller-owned input;
- semantically identical snapshots with different input ordering canonicalize identically.

Cryptographic hashing of the canonical string belongs to the persistence/runtime adapter wave, not this pure graph package.

## Non-claims

V1 does not yet claim:

- reading `/mnt/data` or File Library;
- parsing the historical `inventory.json`, `edges.ndjson`, or `semantic-overlay.json` wire formats;
- OpenClaw/Ollama execution;
- embeddings generation;
- filesystem watching/incremental scanning;
- append-only snapshot persistence;
- cross-process locking;
- a production semantic model quality score.

Those are subsequent adapters/waves built against this contract.

## DOD

V1 is GREEN only when:

- malformed authority input fails closed;
- canonicalization is order-independent and non-mutating;
- deterministic topology projects losslessly enough to recover original IDs/types/authority metadata;
- semantic inference cannot overwrite deterministic hash/path identity;
- L8/L9/L10/L11 projections validate;
- GraphRAG chunk/entity relations work with supplied embeddings;
- full canonical repository tests stay green;
- coverage does not regress below the exact W1C floor;
- no product surface outside graphify + export/test/workflow/docs scope changes.
