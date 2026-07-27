# COS Memory System

## Architecture

Memory is implemented as 12 layered stores with per-layer TTL, importance scoring, compression, and consolidation.

## Layers

| Layer | TTL | Importance | Purpose |
|-------|-----|-----------|---------|
| Working | 5 min | 1.0 | Active processing context |
| Short-Term | 24h | 0.6 | Recent interactions |
| Long-Term | ∞ | 0.8 | Consolidated knowledge |
| Semantic | ∞ | 0.9 | Facts and concepts |
| Procedural | ∞ | 0.8 | How-to sequences |
| Episodic | 30d | 0.5 | Timestamped events |
| Temporal | 7d | 0.4 | Time-ordered sequences |
| Spatial | 7d | 0.4 | Location-based memory |
| Vector | 30d | 0.5 | Embedding-based retrieval |
| Knowledge Graph | ∞ | 0.9 | Structured relationships |
| Cache | 10 min | 0.3 | Fast temporary storage |
| Reflection | 7d | 0.7 | Self-generated insights |

## Operations

- **Store** — Add entry with automatic importance scoring
- **Retrieve** — Access by ID with access tracking
- **Query** — Filter by layer, tags, importance, time, with sorting
- **Update** — Partial updates with version tracking
- **Delete** — Remove entries
- **Consolidate** — Promote important short-term → long-term
- **Forget** — Remove low-importance old entries
- **Cross-link** — Create relationships between entries
- **Compress** — Summarize old entries
- **Sweep** — Remove expired TTL entries

## Implementation

`MemoryManager` orchestrates all layers via an `IMemoryStore` interface. Default store is `InMemoryStore` with in-memory indexing. Production stores: Redis (cache), Qdrant (vector), PostgreSQL (long-term), Neo4j (knowledge graph).