# ROT Viral Content Engine — README FIRST

## Mission
Build a production-grade viral content operating system for Roberto/rot.prods using COS Graph Engine patterns without coupling the application to the COS kernel.

## Architectural decision
COS Graph Engine remains the compute/projection substrate. The content system is an application plane that consumes graph, memory, workflow, GraphRAG and observability primitives through bounded interfaces.

### Truth ownership
- GitHub: executable truth, schemas, prompts, policies, code, tests, migrations, experiment definitions and release lineage.
- Google Drive: persistent corpus, raw media, research, scripts, proof assets, exports, analytics snapshots and handoffs.
- Content DB / event log: authoritative transactional state for content objects, runs, experiments, metrics and publication lifecycle.
- COS Graph Engine: derived projections for content graph, audience graph, hook graph, performance graph, proof graph and retrieval/reasoning.
- Derived analytics: disposable/rebuildable materializations from authoritative events and snapshots.

## Non-negotiable invariants
1. No metric, proof point or factual claim may be invented.
2. Every externally sourced claim carries provenance and observed/recorded timestamps.
3. Every generated script has a version, input lineage, model/config lineage and deterministic content ID.
4. Published-content metrics are append-only observations, never silently overwritten.
5. Graph projections are rebuildable from authoritative source records.
6. Recommendations and scoring must expose evidence and uncertainty.
7. Platform adapters cannot mutate canonical content truth without an explicit lifecycle event.
8. A generation run cannot be marked successful if critical research/factual/QA gates failed.
9. All cross-agent actions are capability-scoped and observable.
10. Drive assets are referenced by canonical IDs/URLs and never treated as executable truth.

## Canonical loop
SIGNAL → INGEST → RESEARCH → FACT CHECK → OPPORTUNITY SCORE → ANGLE → HOOK LAB → SCRIPT → VISUAL PLAN → PLATFORM ADAPTATION → QA → GAUNTLET → APPROVE → PUBLISH → OBSERVE → LEARN → GRAPH REBUILD

## North Star
A self-improving content system that learns which topic × angle × hook × visual pattern × audience × platform combinations maximize Roberto's own retention, shares, saves, follows, qualified inbound and revenue while preserving factual integrity and brand authority.

## Integration boundary with COS
Use COS for:
- temporal/provenance-aware graph projections;
- retrieval/GraphRAG over canonical content knowledge;
- memory and evidence graph traversal;
- workflow/agent graph inspection;
- observability/tracing;
- resilience/failure reasoning.

Do not use COS as the only store for:
- raw files;
- authoritative publication state;
- mutable platform analytics;
- credentials/tokens;
- irreversible business events.

## Program structure
See:
- ARCHITECTURE.md
- EXECUTION_PLAN.md
- DRIVE_CONTRACT.md
- GRAPH.md
