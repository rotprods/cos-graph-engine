---
authority: PROJECTION
scope: generated summary of selected V2 control-plane model
owner: Documentation Architect
last_updated: 2026-08-30T17:30:00.000Z
source_revision: 1bc137eb6e635f55db293b402f561e420dc83c4f
status: IMPLEMENTED_UNVERIFIED
supersedes: null
---

# COS V2 — Compiled Control-Plane Summary

Model topology:

```text
46 nodes
48 edges
6 hyperedges
20 ranked gaps
12 architecture decisions
34 executable tasks
15 objective checkpoints
3 append-only events
```

Current authority boundary:

```text
Runtime: SHADOW_ONLY / IMPLEMENTED_UNVERIFIED
Control plane: EXECUTED_LOCAL_UNBOUND_EXACT_SHA
Automatic GitHub Actions: OFF
CD / deploy / release: OFF
Production DB / Supabase mutation: NONE
```

Current canonical runtime lineage:

```text
PR #49 → PR #50 → PR #51 → PR #52 → PR #53 → PR #54
                                              ↓
                                            PR #55
                                      V2 control-plane overlay
```

The exploratory PR #46 is archive/provenance only. The old W13 PR #36 is not a valid qualification lineage. Issue #39 remains the stop-the-line governance object.

The V2 architecture is organized into four planes:

1. **Authority Plane** — exact commits, append-only events, durable state and explicit lifecycle authority.
2. **Projection and Context Plane** — rebuildable graphs, memory, knowledge, GraphRAG and bounded ContextPacks.
3. **Execution Plane** — agents, sessions, claims, policy, tools, leases, fencing, idempotency, reconciliation and compensation.
4. **Assurance Plane** — tests, evidence, recovery, security, observability, score promotion and release gates.

Current compiled safe frontier:

- `T0006` — bind and rerun the control-plane validator/compiler on an exact immutable SHA;
- `T0501` — independently recompute provider-evidence hashes before observed outcomes can be accepted, on a separately claimed runtime branch.

No generated projection may promote runtime authority. Exact-SHA runtime evidence remains mandatory.
