---
authority: PROPOSED_CONTROL_PLANE
scope: canonical COS Graph Engine V2 architecture
owner: Principal Systems Architect
last_updated: 2026-08-30T17:30:00.000Z
source_revision: 1bc137eb6e635f55db293b402f561e420dc83c4f
supersedes: competing architecture summaries after evidence-backed approval
status: PROPOSED
---

# COS Graph Engine V2 — Canonical Architecture

## 1. Executive V2

COS V2 is a **single-repository, event-accountable, temporal-hypergraph operating substrate** for projects, knowledge, agents and recoverable tool execution.

Its architecture is divided into four planes:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 1. AUTHORITY PLANE                                                  │
│ exact commits · append-only events · durable records · decisions    │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │ derives
┌─────────────────────────────────▼────────────────────────────────────┐
│ 2. PROJECTION & CONTEXT PLANE                                       │
│ temporal hypergraph · indexes · memory · knowledge · GraphRAG       │
│ bounded ContextPacks · human-readable state projections             │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │ constrains / informs
┌─────────────────────────────────▼────────────────────────────────────┐
│ 3. EXECUTION PLANE                                                  │
│ agents · sessions · claims · policy · tools · leases · fencing      │
│ idempotency · provider reconciliation · compensation · repair       │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │ emits evidence
┌─────────────────────────────────▼────────────────────────────────────┐
│ 4. ASSURANCE & QUALIFICATION PLANE                                  │
│ tests · security · recovery · telemetry · benchmarks · score gates  │
│ exact-SHA evidence · independent review · migration / release gate   │
└──────────────────────────────────────────────────────────────────────┘
```

No projection, document, embedding, model response, cache or test name can outrank its underlying authority.

## 2. North Star

The V2 program reaches its North Star only when all twenty audited engineering dimensions satisfy:

```text
Build = 10.0
Assurance = 10.0
Authority = min(Build, Assurance) = 10.0
```

And, independently:

- no open P0 or P1 defect remains;
- deterministic replay and empty-database restore pass;
- concurrency, fencing and provider crash-window campaigns pass;
- the security gauntlet passes;
- a blind successor resumes in under five minutes without chat history;
- one exact, independently reviewed SHA is converged to `main`;
- authority promotion is recorded as an explicit event;
- deployment remains a separate decision.

## 3. Architectural principles

### 3.1 Current truth before reasoning

Every material session reconstructs exact repository state, current branch/head, open PR lineage, event watermark, projection revision, active claims, barriers and evidence status before mutation.

### 3.2 Exact executable authority

The hierarchy is:

```text
exact immutable Git commit / signed release artifact
        ↓
append-only domain and operational events
        ↓
durable canonical records
        ↓
rebuildable projections and indexes
        ↓
compiled ContextPacks and documents
        ↓
chat/model summaries
```

A lower layer may accelerate work. It cannot overrule a higher layer.

### 3.3 One authority writer per capability

Each stateful capability has one selected writer. Compatibility paths may remain read-only or shadow-only during migration but cannot silently write authority truth.

### 3.4 History is superseded, not erased

Historical decisions, claims, revisions, outcomes and defects remain addressable. Corrections create new events or revisions with `SUPERSEDES`; they do not rewrite prior evidence.

### 3.5 Explicit uncertainty

Unknown provider outcome, missing evidence, unavailable connector, stale ContextPack, ambiguous ownership and failed observation are explicit states. They are never coerced into success.

### 3.6 Failure isolation

Telemetry, signal persistence, documentation generation and repair scheduling are defenses. Their failure cannot rewrite the protected provider outcome or security decision.

### 3.7 Zero-cost-first infrastructure

Repository files, local execution and PostgreSQL/Supabase-compatible ports are preferred until measured volume, contention, latency or availability proves that another infrastructure component is necessary.

### 3.8 Reversible migration

Large refactors are extracted into additive selected surfaces, tested against legacy contracts, and promoted only after evidence. Archive branches preserve provenance without becoming runtime authority.

## 4. System boundaries

### 4.1 In scope

- graph storage, traversal and algorithm kernels;
- temporal hypergraph and knowledge projections;
- deterministic identity and canonical serialization;
- append-only events and domain revisions;
- project-scoped memory, knowledge, Hub and GraphRAG;
- agent sessions, claims, plans and evidence-bearing runs;
- policy-bound tool execution;
- leases, fencing, idempotency, provider reconciliation and compensation;
- snapshots, replay, restore and cold-agent continuity;
- test, evidence, security and release qualification;
- documentation and task-state projections.

### 4.2 Outside authority unless explicitly promoted

- chat memory;
- embedding similarity;
- generated prose;
- PR descriptions;
- moving branch names without an exact SHA;
- caches;
- local checkouts;
- dashboards;
- provider payloads before validation;
- archive PR #46 and superseded V1 implementations;
- automatic deployment.

## 5. Plane 1 — Authority Plane

### 5.1 Components

```text
Repository / exact commit
Append-only operational event ledger
Domain event log
Append-only bitemporal revisions
Decision ledger
Contract and schema versions
Evidence manifest
Promotion/demotion events
```

### 5.2 Authority rules

1. An exact commit identifies executable bytes.
2. Operational events record session, claim, handoff, checkpoint and promotion history.
3. Domain events record accepted commands and outcomes.
4. Canonical records preserve object identity and revision lineage.
5. A state projection declares its event watermark and source revision.
6. Evidence declares the exact artifact/commit it qualifies.
7. A changing head invalidates prior approval or qualification unless re-executed.

### 5.3 Event model

Each material event includes:

```text
event_id
sequence or partition position
event_type
project_id
agent_id
session_id
workstream_id
objective_id
correlation_id
causation_id
occurred_at
recorded_at
source_commit
authority
payload schema version
```

Delivery may be at-least-once. Logical append semantics must be payload-bound and idempotent.

### 5.4 Temporal model

V2 separates:

- **valid time** — when the fact is true in the domain;
- **system time** — when COS recorded or knew it;
- **event time** — when an event occurred;
- **record time** — when the event entered authority;
- **projection time** — when a rebuildable view was generated.

Historical queries use explicit `validAt` and `knownAt`. Current-row overwrite is never called bi-temporal history.

## 6. Plane 2 — Projection and Context Plane

### 6.1 Temporal hypergraph

All material entities are nodes with globally unique IDs. Binary relationships are attributed edges. Multi-entity decisions, promotions, transactions and recovery sets are hyperedges.

Every material edge records, when applicable:

```text
type
authority
confidence
valid_from / valid_until
source_event / source_commit
criticality
strength
version
cost
risk
```

### 6.2 Projection ownership

A projection is disposable. It must be rebuildable from authority and declare:

```text
projection_id
projection_revision
source_revision
event_watermark
schema_version
projection_hash
```

Graph projections, search indexes, dashboards, summaries and generated documents cannot become independent sources of truth.

### 6.3 Knowledge and memory

Knowledge and memory use append-only epistemic revisions:

```text
identity
project_id
content / claim
provenance
confidence
epistemic_type
valid_from / valid_until
system_from / system_until
supersedes
contradicts
content_hash
```

Operational access counts and telemetry are separate from semantic revision identity.

### 6.4 GraphRAG and ContextPack

The authority ContextPack path is:

```text
Task + project + principal + sensitivity + validAt + knownAt
        ↓
permission-filtered graph projection
        ↓
provenance-bearing evidence candidates
        ↓
deterministic ranking and token budget
        ↓
ContextPack bound to projection version/hash
        ↓
SHA-256 integrity seal
```

ContextPacks are stale by default. A consuming agent verifies live state before execution.

### 6.5 Human-readable documents

`README_FIRST.md`, `STATE.md`, `TASKS.md`, `HANDOFF.md`, graph views and scorecards are compiled or validated projections of the same IDs and revisions. Generated sections are not manually edited without changing source state.

## 7. Plane 3 — Execution Plane

### 7.1 Agent and session model

A material execution creates:

```text
Agent
Session
Claim
Workstream
Objective
ContextPack reference
Correlation / causation lineage
Authority ceiling
Expiry / heartbeat
Handoff
```

Exclusive claim overlap fails closed. Unknown external claims are represented as degraded coordination, not presumed absent.

### 7.2 Durable AgentRun

The run aggregate preserves:

```text
Goal
Acceptance criteria
Plan DAG
Step attempts
Evidence references
Side-effect operation references
Criterion evaluations and evaluator versions
Terminal state and reason
```

Completion requires accepted critical steps and explicit required-criterion evidence. Positive prose cannot complete a run.

### 7.3 Policy and capabilities

The selected tool path is:

```text
request
→ canonical input and resource identity
→ scope/sensitivity/principal policy
→ approval when required
→ isolation preflight
→ durable operation claim
→ resource lease + fencing
→ provider execution
→ commit | reconciliation_required | compensation_required
→ agent evidence
→ signal / telemetry / durable repair
```

Default policy is deny. Approvals are exact-operation and time-bound.

### 7.4 Side effects

External providers are not assumed transactional or exactly-once.

A side-effect operation distinguishes:

```text
claimed
prepared
executing
reconciliation_required
committed
failed-before-effect
compensation_required
compensating
compensated
```

A timeout or crash after execution begins creates `reconciliation_required`. Retry is forbidden until a read-only provider/resource inspection proves `not_applied` and allocates a newer fence/provider attempt key.

### 7.5 Leases and fencing

Leases are bounded, append-only revisioned ownership records. Reacquisition after expiry or release allocates a strictly greater fencing token. The token must be validated at the resource commit boundary, not merely present in a request.

### 7.6 Isolation boundaries

**HTTP:** policy, public-address validation, DNS answer pinning, original-host TLS verification, original `Host` semantics, no second DNS resolution, redirect reauthorization, no automatic retry.

**Filesystem:** root policy, lexical rejection, trusted atomic broker, open handle, symlink/TOCTOU protection, no path reopen.

Until physical fixtures prove these adapters, external authority execution remains blocked.

### 7.7 Durable repair

Failures after an accepted provider outcome become independent repair work:

```text
pending
→ leased(fencing token)
→ resolved | retry_scheduled | abandoned
```

Examples: lease release, agent evidence append, signal delivery and telemetry delivery. Repair failure never rewrites provider truth.

## 8. Plane 4 — Assurance and Qualification Plane

### 8.1 Evidence lifecycle

```text
PROPOSED
→ IMPLEMENTED
→ EXECUTED
→ VERIFIED
→ EMPIRICALLY_QUALIFIED
→ AUTHORITY_READY
```

`IMPLEMENTED` means code exists. `EXECUTED` means a named command ran. `VERIFIED` means required checks passed for an exact artifact. `EMPIRICALLY_QUALIFIED` adds physical/runtime evidence. `AUTHORITY_READY` requires all program gates and owner promotion.

### 8.2 Test taxonomy

Authority testing includes unit, contract, schema, property, mutation, integration, E2E, physical runtime, security, concurrency, replay, recovery, performance, empirical qualification and death drills.

Every escaped bug receives:

```text
root cause
broken invariant
why prior tests missed it
permanent regression test
adjacent failure family
generalized campaign
```

### 8.3 Evidence binding

Every qualifying artifact includes:

```text
exact source SHA
command and toolchain
input fixture versions
PASS / FAIL / SKIPPED / NOT_RUN separately
raw logs or measurements
artifact hashes
timestamp and environment
owner/reviewer
```

### 8.4 CI/CD

GitHub Actions are manual-only during convergence. The manual matrix preserves legacy, authority, orphan, WASM, coverage, Docker, security, recovery and benchmark breadth. CD remains off until a separate production decision.

### 8.5 Observability

AuthorityTelemetry records trace/correlation/causation, operation type, latency, status and bounded attributes. Sensitive input/output content is not copied into telemetry. Observer failure is isolated and repairable.

## 9. Identity model

Canonical identities use normalized, provider-aware URIs and a versioned canonical serializer. Unsupported JavaScript objects fail closed.

Examples:

```text
github://rotprods/repository/cos-graph-engine
agentic://COS_GRAPH_ENGINE/session/<session_id>
drive://google/document/<document_id>
provider://github/pull-request/<number>
```

Unicode normalization, provider case rules and canonical null/undefined behavior are explicit contract concerns.

## 10. State machines

### 10.1 Project

```text
PROPOSED → IMPLEMENTED → EXECUTED → VERIFIED
→ EMPIRICALLY_QUALIFIED → AUTHORITY_READY
                  ↘ BLOCKED / DEGRADED_EXTERNAL
```

### 10.2 Pull request

```text
DRAFT → REVIEWABLE → APPROVED → QUALIFIED → MERGED
   ↘ SUPERSEDED / CLOSED_WITHOUT_MERGE
```

Any head change after approval returns the PR to `REVIEWABLE`.

### 10.3 Session / claim

```text
CREATED → ACTIVE → HEARTBEAT* → HANDOFF | COMPLETED | EXPIRED | SUPERSEDED
```

### 10.4 Evidence

```text
NOT_RUN → PASS | FAIL | SKIPPED | CANCELLED
```

These states are never collapsed.

## 11. Recovery model

The reconstruction order is:

```text
empty workspace
→ fetch exact repository refs
→ verify model/schema versions
→ rebuild operational projections from event ledger
→ restore domain snapshots where valid
→ replay event tails
→ rebuild graph/index/context projections
→ run integrity and gold queries
→ compile bounded successor ContextPack
→ resume next safe task
```

Recovery tolerances, RPO and RTO are documented in `RECOVERY.md` and must be empirically demonstrated.

## 12. Developer and agent workflow

```text
verify live truth
→ create unique session and claim
→ state falsifiable guarantee
→ inspect blast radius and failure family
→ implement smallest reversible slice
→ execute local checks where available
→ commit exact evidence
→ adversarial review
→ update event/state/graph/docs/task planes
→ hand off or renew claim
```

Codex is optional for shell-heavy work. GitHub is the persistent control plane. GitHub Actions are a later manual remote execution gate.

## 13. Performance strategy

No performance claim is accepted from one sample or an unpinned environment. Benchmarks report warmup, raw samples, p50/p95/p99, variance, hardware, toolchain and graph shape. Optimizations target measured critical paths and cannot weaken correctness.

## 14. Cost strategy

Current target incremental recurring cost is `EUR 0/month`.

New infrastructure is introduced only after a measured trigger, such as:

- repository event writes cannot serialize concurrent agents within SLO;
- local/Postgres query latency exceeds defined p95;
- data volume or availability requirements exceed the free tier;
- recovery RTO cannot be met;
- self-hosted execution costs less than manual GitHub runners.

## 15. Architecture delta — V1 to V2

| V1 / current condition | V2 direction | Reason |
|---|---|---|
| chat and documents used as continuity | events + exact commits + generated projections | survive context loss and detect drift |
| broad graph engine with test-count claims | 20D evidence-backed qualification | counts do not prove authority |
| multiple candidate writers | one selected writer + read-only shadow adapters | prevent hidden authority drift |
| command replay may re-decide history | accepted/rejected outcome replay | preserve historical truth |
| current-row temporal overwrite | append-only valid/system-time revisions | support accurate historical knowledge |
| idempotency/fence presence checks | durable operation ledger + resource-bound fencing | close duplicate/stale worker paths |
| timeout treated as local failure | explicit unknown + provider reconciliation | avoid blind retry and double effect |
| policy around but not through execution | policy-bound canonical capability facade | enforce the real side-effect path |
| URL/path validation only | pinned transport and atomic handle broker | close DNS rebinding and TOCTOU |
| observer errors risk contaminating outcomes | failure-isolated signal/telemetry + repair | preserve protected truth |
| huge exploratory PR | archive + clean stacked extraction | reviewability and provenance |
| automatic CI/CD assumptions | manual full matrix; CD off | zero cost without losing breadth |
| generic DONE labels | precise lifecycle vocabulary and objective DoD | prevent false completion |

## 16. Greenfield ideal versus justified migration

A greenfield system would implement one integrated authority kernel from day one. COS already contains valuable legacy graph, WASM, visualization and observability capabilities, so a flag-day rewrite is not justified.

Classification:

- **KEEP:** proven graph/WASM/visualization primitives and public contracts that survive regression testing.
- **REFINE:** canonical identity, serializers, projections and ContextPack contracts.
- **REFACTOR:** side-effect runtime, policy/tool boundaries and documentation state.
- **MIGRATE:** legacy writers to selected authority facades.
- **DEPRECATE:** V1/V2 exploratory duplicate surfaces after evidence.
- **DELETE:** only through semantic deletion governance.
- **DEFER:** distributed queues, Redis, Kafka, Kubernetes authority runtime and paid infrastructure until measured triggers.

## 17. Current authority state

```text
Architecture V2: PROPOSED / locally model-validated
Runtime phases: IMPLEMENTED_UNVERIFIED
Assurance baseline: unchanged
Authority baseline: unchanged
Merge authorization: denied
Automatic Actions: off
CD: off
```

The next safe actions are compiled from `control-plane/v2/model/program.mjs`; this document is explanatory and cannot override that machine-readable frontier.
