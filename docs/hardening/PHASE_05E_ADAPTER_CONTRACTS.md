# Phase 05E — Normalized Adapter Contracts

Status: `WRITTEN_UNEXECUTED / SHADOW_ONLY`

This slice ports useful archive contracts only after replacing superseded barrel
imports with the single clean authority surface. It adds no production alias and
no V1 implementation.

Current coverage added:

- Postgres agent-run reconstruction and corruption checks;
- lease-backed provider retry planning;
- in-memory capability signal store V2;
- Postgres capability signal store V2;
- Postgres durable repair store.

All fixtures are driver-neutral. They prove intended SQL interaction semantics
only after execution; they do not substitute for a real PostgreSQL/Supabase run.

Next sub-slice adds the JSON idempotency inspector and FileHandle V2 contracts,
then extends the one clean strict graph.
