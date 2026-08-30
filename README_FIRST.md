---
authority: PROJECTION
scope: current COS entrypoint
owner: Agentic Systems Architect
last_updated: 2026-08-30T10:08:00Z
source_parent_revision: e2a4931beed71248677e2eef0a3cde814608ba0c
status: IMPLEMENTED_UNVERIFIED
---

# README FIRST — COS Graph Engine

Before any mutation, verify live GitHub. The current bounded projection is:

1. `control-plane/v2/integration/coordination-integration.v3.json`
2. `control-plane/v2/continuity/CURRENT_V3.md`
3. `scripts/validate-v2-integration-v3.mjs`

Current observed candidate:

```text
PR: #57
branch: refactor/v2-coordination-integration
pre-mutation head: e2a4931beed71248677e2eef0a3cde814608ba0c
coordination component: PR #56 / a49d1a6ec9e6bfb7c02e22465e1672f439b82354
runtime candidate: PR #54 / 789edef87549d4f173de03f73e54f5b6193c2e98
authority: SHADOW_ONLY
```

Root `STATE.md`, `TASKS.md`, `HANDOFF.md`, `GRAPH.md` and historical `AGENTS.md` may lag this candidate. They do not outrank the V3 bundle or live GitHub.

No merge, automatic Actions, CD, deployment, production database, Supabase mutation or score promotion is authorized.
