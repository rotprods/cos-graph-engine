# COS Graph Engine — GRAPH

This document describes the operational graph of the project itself and the target authority topology. It is not a generated visualization; it is the canonical human-readable graph contract.

## 1. Project control graph

```text
GOAL.md
  ↓
SCORECARD_20D.md
  ↓
STATE.md
  ↓
EXECUTION_PLAN.md
  ↓
Issue #39 remediation graph
  ↓
canonical reconciliation PR(s)
  ↓
W13 evidence campaign
  ↓
20D re-audit
  ↓
AUTHORITY_READY
```

`README_FIRST.md` is the cold-start router. `AGENTS.md` defines agent law. `HANDOFF.md` records the exact continuation point.

## 2. Current branch/PR topology

```text
main
 ├─ docs/control branches
 ├─ #18 W0/W1
 │   └─ #20 W2
 │      └─ #21 W3
 │         └─ #22 W4
 │            └─ #23 W5
 │               └─ #24 W6
 │                  └─ #25 W7
 │                     └─ #26 W8
 │                        └─ #27 W9
 │                           └─ #28 W10
 │                              └─ #29 W11
 │                                 └─ #30 W12
 │                                    └─ #31 W12.1
 │                                       └─ #32 W12.2
 │                                          └─ #33 W12.3
 │                                             ├─ #34 W12.4 completion
 │                                             └─ #35 W12.4 closure
 │                                                └─ #36 W13 (incomplete lineage)
 ├─ #37 manual Actions control plane (draft/rework)
 └─ #38 independent adversarial review
     └─ #39 remediation gate
```

Critical invariant: #34 and #35 are siblings, not a linear continuation. Neither may be discarded until capability equivalence is demonstrated.

## 3. Target runtime authority graph

```text
AGENTIC_SYSTEMS_OS
CONTROL / TRUTH PLANE
        │
        ├─ Identity Kernel
        ├─ Durable Event Kernel
        ├─ Temporal / Provenance Kernel
        ├─ Policy Kernel
        ├─ Persistence / Recovery Kernel
        └─ Governance / Release Gates
        │
        ▼
COS GRAPH ENGINE
COMPUTE / PROJECTION PLANE
        │
        ├─ Property / CSR / WASM Graph
        ├─ Knowledge / Temporal Graph
        ├─ Memory Graph
        ├─ Agent / Workflow Graph
        ├─ Resilience Graph
        ├─ Hub / Interoperability Graph
        ├─ GraphRAG / Context Compiler
        └─ Observability / Evidence
        │
        ▼
Agents: ChatGPT / Claude / Gemini / Codex / others
```

## 4. Truth hierarchy

1. verified executable code/release;
2. authoritative transactional state/event log;
3. project control plane (`GOAL/STATE/DECISIONS/HANDOFF`);
4. immutable raw evidence and provenance;
5. Drive/Sheets/Todoist mirrors for navigation/execution;
6. current chat/model context as transient working memory.

## 5. Required graph entities

Portfolio, Program, Project, Workstream, Chat, Session, AgentRun, Task, Decision, Artifact, MemoryItem, Source, Repository, Commit, PullRequest, Checkpoint, Risk, FailureMode, LatentCondition, Defense, NearMiss, Incident, RecoveryPath, ReleaseGate.

## 6. Required relation classes

CONTAINS, BELONGS_TO, DEPENDS_ON, BLOCKS, ADVANCES, REFERENCES, DERIVED_FROM, SUPERSEDES, CONTRADICTS, CONFIRMS, PRODUCED, CREATED_BY, EXECUTED_BY, USES, PROVENANCE_OF, EVIDENCE_FOR, CONTINUES, VERSION_OF, GOVERNED_BY, DEFENDS, BYPASSES, DEGRADES, RECOVERS, AMPLIFIES, COUPLES, INTRODUCED_BY, MITIGATES.

## 7. Mutation law

Before any material mutation, an agent should determine:

- affected nodes/edges;
- upstream/downstream dependencies;
- provenance and current revision;
- blast radius;
- expected version/lease/fencing constraints;
- rollback path;
- evidence that will prove success.

After mutation, the agent records new state, anomalies/near-misses and evidence.

## 8. Context compilation graph

```text
Project ID + Task
  ↓
project scope + sensitivity + temporal filter
  ↓
current GOAL/STATE
  ↓
decisions + constraints
  ↓
chat/session delta
  ↓
relevant memory / graph neighborhood
  ↓
artifact excerpts + provenance
  ↓
open tasks / blockers / contradictions
  ↓
bounded ContextPack + projection hash + SHA-256 evidence
```

No agent should ingest the whole historical corpus by default.

## 9. Score graph

Each D01–D20 vertical has:

```text
Build
  ↓
Assurance evidence
  ↓
Authority = min(Build, Assurance)
  ↓
release gate
```

A new defect may lower a score. Score reduction is legitimate state correction, not a governance failure.