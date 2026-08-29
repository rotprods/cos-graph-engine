---
authority: PROJECTION
scope: canonical agent operating protocol for COS V2 work
owner: Agentic Systems Architect
last_updated: 2026-08-30T17:30:00.000Z
source_revision: 1bc137eb6e635f55db293b402f561e420dc83c4f
supersedes: stale current-status portions of root AGENTS.md after root pointer is installed
status: IMPLEMENTED_UNVERIFIED
---

# AGENTS V2 — COS Graph Engine

## Prime directive

Improve the durable state of the project, not the persuasiveness of the response. Every material discovery becomes traceable; every unverifiable claim loses authority; every escaped failure becomes a permanent test; every successor can resume without chat memory.

## Startup protocol

Before any write:

1. read `control-plane/v2/continuity/README_FIRST.md`;
2. verify live GitHub main, branch and PR SHAs;
3. read the selected model manifest;
4. verify event watermark and projection revisions;
5. inspect active sessions and claims;
6. inspect issue #39 and current blockers;
7. inspect exact task dependencies and applicable decisions/ADRs/tests;
8. calculate ContextPack staleness;
9. create a globally unique session ID;
10. acquire a bounded resource/semantic claim;
11. append `HELLO_WORK_STARTED` with authority ceiling and next action.

If current authority cannot be reconstructed, set `STATE=BLOCKED`. Do not improvise.

## Session identity

Every material execution declares:

```text
project_id
agent_id
session_id
workstream_id
objective_id
correlation_id
```

Never reuse a `session_id`.

## Claim law

- Exclusive file/resource scopes may not overlap active claims.
- Semantic overlap requires explicit collaboration/handoff.
- Claims expire and require heartbeat/renewal.
- Unknown external claims are represented as degraded coordination.
- A stale claim cannot authorize mutation.

## Engineering laws

### `/leydekidlin`

State the precise falsifiable problem and acceptance condition before implementation.

### `/leydegilbert`

When a task appears blocked, search the actual implementation path, tools, existing primitives and provider contracts before concluding it cannot be done.

### Complex-systems law

Assume failure emerges from combinations: latent conditions, local adaptations, stale state, concurrency, observation gaps and recovery behavior. A defense working once does not prove safety.

### Smallest reversible change

Prefer bounded additive changes with clear rollback. Do not mix architecture, runtime, tests, workflow and migration scopes unless the hypergraph shows they are inseparable.

## Authority rules

```text
exact commit / qualified artifact
> append-only events/revisions
> projections
> ContextPacks/docs
> chat/model output
```

- One authority writer per capability.
- Compatibility paths are read-only or shadow-only.
- No score promotion from code volume, test count or prose.
- `Authority = min(Build, Assurance)`.
- `VERIFIED` requires exact-SHA executed evidence.
- `AUTHORITY_READY` requires CP14 and Roberto’s explicit promotion.

## Required analysis for every change

```text
upstream impact
downstream impact
lateral impact
temporal impact
security impact
test impact
recovery impact
agent impact
documentation impact
graph impact
cost impact
complexity impact
product impact
```

A local improvement that worsens global topology is rejected.

## Runtime safety rules

- default deny policy;
- project and sensitivity isolation;
- payload-bound durable idempotency;
- resource-bound fencing;
- no blind retry after provider execution begins;
- unknown provider outcome stays unknown until reconciliation;
- partial effect requires compensation;
- HTTP uses pinned transport with no second DNS;
- filesystem uses broker-opened handle with no path reopen;
- observation failure cannot change protected outcome;
- post-commit duties become durable repair work.

## Evidence rules

Every test/result records:

```text
exact SHA or explicit unbound status
command
toolchain/environment
fixture/schema versions
PASS / FAIL / SKIPPED / CANCELLED / NOT_RUN
raw output / measurement
artifact hashes
```

A required skipped, cancelled, flaky or not-run test blocks promotion.

## Documentation law

Canonical current documents declare authority, scope, owner, last update, source revision and supersession. Generated sections derive from the selected machine model. Historical documents remain historical and must not present stale state as current.

## Persistence at session end

Every material session must persist:

- event or heartbeat;
- session/claim status;
- exact Git refs;
- implementation and evidence result;
- gaps/risks/decisions discovered;
- STATE/TASKS/HANDOFF/graph delta;
- Drive Acta and AGENTIC state delta;
- dedicated COS Todoist task state;
- next safe action.

A session with no material change still emits a heartbeat or blocked event.

## Current prohibitions

- no merge of PR #49–#55;
- no automatic Actions or CD;
- no production/Supabase mutation;
- no runtime edit on PR #55;
- no use of PR #46 as qualification source;
- no new W13 before frozen candidate;
- no package-root authority promotion before P07;
- no modification of unrelated Todoist projects.
