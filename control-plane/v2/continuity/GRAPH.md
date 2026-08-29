---
authority: PROJECTION
scope: human-readable COS V2 graph views
owner: Graph Systems Architect
last_updated: 2026-08-30T17:30:00.000Z
source_revision: 1bc137eb6e635f55db293b402f561e420dc83c4f
supersedes: stale root GRAPH until regeneration
status: IMPLEMENTED_UNVERIFIED
---

# GRAPH — COS V2

Machine-readable source: `control-plane/v2/model/hypergraph.json`.

## System graph

```text
Roberto / owner authority
        │ owns
        ▼
COS 10/10 Authority Program
        │ defines
        ▼
D01–D20 Authority 10.0 North Star
        │
        ├── Authority Plane
        ├── Projection & Context Plane
        ├── Execution Plane
        └── Assurance & Qualification Plane
```

## Repository and migration graph

```text
main @ 3ae197e

PR #49  Phase 05A
  ↓
PR #50  Phase 05B
  ↓
PR #51  Phase 05C
  ↓
PR #52  Phase 05D
  ↓
PR #53  Phase 05E
  ↓
PR #54  Phase 05F @ 789edef
  ↓
PR #55  V2 control-plane overlay

PR #46 ──SUPERSEDED_AS_REVIEW_SOURCE──► clean #49–#54 lineage
PR #36 ──SUPERSEDED_AS_W13────────────► future frozen-candidate W13
PR #37 ──BLOCKED_BY────────────────────► full manual-matrix restoration
```

## Authority graph

```text
Exact Git commit / qualified artifact
            │ source of truth
            ▼
Append-only events and revisions
            │ derive
            ▼
Graph / index / state projections
            │ compile
            ▼
ContextPack and human documents
            │ inform
            ▼
Agent reasoning
```

No arrow points upward without explicit validation and promotion.

## Agent/session graph

```text
Agent GPT-5.6 Pro
   │ executes
   ▼
Session ses_43c3d959...
   │ owns bounded claim
   ▼
Claim claim_688937e0...
   │ writes
   ▼
V2 model / compiler / control-plane docs
   │ appends
   ▼
Segmented event ledger @ watermark 3
```

Unknown agents/claims outside repository-backed coordination remain `DEGRADED_EXTERNAL`.

## Execution graph

```text
North Star
  ↓
P00 Control Plane ─────────────── current
  ↓
P01 Reconciliation
  ↓
P02 Contracts / compatibility
  ↓
P03 Core correctness
  ↓
P04 Temporal / events / persistence
  ↓
P05 Security / concurrency / runtime
  ↓
P06 Hub / memory / GraphRAG / observability
  ↓
P07 Test truth / manual CI
  ↓
P08 Evidence campaign
  ↓
P09 Qualification / merge / promotion
```

Current executable frontier:

```text
Lane A: T0006 → T0007 → T0008
Lane B: T0501 → T0502
Lane D: T0503
```

Lanes B and D require separate sessions/claims and must not mutate PR #55.

## Critical dependency graph

```text
T0006 exact-SHA control-plane evidence
  ↓
T0007 root continuity regeneration
  ↓
T0008 GitHub/Drive/Todoist sync
  ↓
T0701 clean toolchain
  ↓
T0702 manual full CI matrix
  ↓
T0703 full test corpus
  ├──► T0301 core invariant proof
  ├──► T0401 temporal/event parity
  ├──► T0505 contention/process kill
  ├──► T0601 ContextPack proof
  └──► T0602 memory proof
          ↓
       T0801/T0802/T0803
          ↓
       T0804 score compiler
          ↓
       T0901 independent review
          ↓
       T0902 main convergence
          ↓
       T0903 authority promotion
```

## Risk graph

```text
G001 no execution evidence ─────────────┐
G005 weak provider evidence integrity ──┤
G006 no atomic FS broker ───────────────┤
G007 no TLS proof ──────────────────────┤
G008 provider adapters incomplete ──────┤
G011 CI breadth risk ───────────────────┤──BLOCKS──► P09 / Authority
G015 no independent review ─────────────┤
G016 no cold-agent proof ───────────────┤
G018 no enforced single writer ─────────┘
```

## Test and evidence graph

```text
Invariant
  ↓ TESTED_BY
Test / campaign
  ↓ EXECUTED_AS
TestRun
  ↓ PRODUCES
Evidence artifact
  ↓ BOUND_TO
Exact candidate SHA
  ↓ QUALIFIES
20D dimension / checkpoint
```

A test without a TestRun is `NOT_RUN`. Evidence bound to another SHA cannot qualify the candidate.

## Recovery graph

```text
Exact repo refs + event ledger + canonical revisions
                  │
          snapshot integrity check
                  │
       restore snapshot / replay tail
                  │
        rebuild graph and indexes
                  │
         run invariants / gold queries
                  │
         compile fresh ContextPack
                  │
        create new session and claim
```

## Hyperedges

The source graph includes six initial hyperedges:

1. clean Phase 05 migration lineage;
2. all-required authority promotion set;
3. bounded context compilation set;
4. zero-context recovery reconstruction set;
5. single-writer decision impact set;
6. V2 control-plane checkpoint acceptance set.

## COS projections

- L0 visual architecture clusters;
- L1 execution critical path;
- L2 lifecycle state machines;
- L3 dependency/blast-radius graph;
- L4 call ownership;
- L5 control/failure paths;
- L6 data/provenance flow;
- L7 measured compute/bottlenecks;
- L8 knowledge/decision/evidence graph;
- L9 semantic/lexicon graph;
- L10 similarity only for deduplication, never authority;
- L11 GraphRAG and cold-agent retrieval;
- L12 memory lifecycle/temporal graph;
- L13 agent/session/claim graph;
- L14 tool/provider/trust graph;
- L15 workflow/retry/compensation graph;
- L16 deployed network/failure domains;
- L17–L19 `NOT_APPLICABLE` to the engineering control-plane unless a future domain requirement activates them.
