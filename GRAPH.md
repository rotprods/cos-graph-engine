# GRAPH — COS Graph Engine Authority Program

## 1. Truth ownership

```text
GitHub repository / exact commit
        │
        ├── executable truth: code, schemas, migrations, tests, workflows
        ├── review truth: PRs, comments, approvals, expected SHA
        └── evidence truth: artifacts, logs, manifests, benchmark outputs

Google Drive control plane
        │
        ├── cross-chat Acta de Consciencia
        ├── AGENTIC_SYSTEMS_OS STATE
        └── durable handoff / portfolio context

Todoist
        │
        └── live task execution state, phases and checkpoints
```

GitHub owns executable truth. Drive and Todoist may reference it but may not override code/evidence state.

## 2. Branch topology

```text
main @ 3ae197e
  └── ... hardening stack ...
       └── #33 hardening/w12-3-core-gap-closure @ 5806a71
            ├── #34 hardening/w12-4-authority-completion @ af49735
            ├── #35 hardening/w12-4-authority-closure @ 8b7e197
            │    └── #36 hardening/w13-authority-qualification @ c0434b4 [PAUSED]
            └── hardening/canonical-authority-reconciliation [ACTIVE]

main
  ├── #37 ops/manual-actions-control-plane [DRAFT / REWORK]
  └── #38 audit/full-stack-adversarial-review [AUDIT CONTROL]
```

Rules:

- #34 and #35 are evidence sources, not merge targets.
- The active reconciliation branch starts from #33.
- #36 cannot certify the complete candidate and remains paused.
- #37 must preserve full verification breadth before merge.
- #38 and issue #39 govern the reconciliation gate.

## 3. Program dependency DAG

```text
P00 Control plane
  ↓
P01 #34/#35 reconciliation
  ↓
P02 contracts + deletion ledger
  ↓
P03 core correctness
  ├──────────────┐
  ↓              ↓
P04 temporal     P05 security/concurrency/runtime
  └──────┬───────┘
         ↓
P06 Hub / memory / GraphRAG / observability
         ↓
P07 test truth + manual full CI
         ↓
P08 security / contention / replay / restore / benchmarks / cold-start
         ↓
P09 20D authority qualification + independent review
         ↓
AUTHORITY_READY
```

P03–P06 may be developed in bounded parallel slices only when they do not create competing authority paths. P07–P09 are strictly downstream of canonical architecture convergence.

## 4. Canonical runtime target

```text
                     AGENTIC_SYSTEMS_OS
                    CONTROL / TRUTH PLANE
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
    Identity Kernel     Durable Event      Policy / Scope
          │               Kernel               Kernel
          └──────────────────┼──────────────────┘
                             ↓
                    Versioned Projection Bus
                             ↓
                    COS GRAPH ENGINE
                             │
      ┌──────────────┬───────┼─────────┬──────────────┐
      ↓              ↓       ↓         ↓              ↓
 Property/CSR    Temporal  Memory    Agent/Workflow  Resilience
 Graph           Graph     Graph     Runtime         Graph
      └──────────────┴───────┼─────────┴──────────────┘
                             ↓
                   Authority GraphRAG Index
                             ↓
                   Verified ContextPack
                             ↓
               ChatGPT / Claude / Gemini / Codex
```

## 5. Canonical authority-owner map

| Domain | Target owner | Non-authority compatibility |
|---|---|---|
| identity | canonical URI + provider-native ID registry | ephemeral `generateId()` |
| accepted history | durable event log | EventBus diagnostic history |
| graph mutation | one versioned projection owner | legacy graph APIs in shadow/deprecated mode |
| state transition | transactional StateMachine + revision fence | read-only visualization/legacy adapters |
| memory truth | append-only epistemic revision store | legacy MemoryManager as non-authority cache |
| side effects | durable operation ledger + fencing | ToolRegistry implementation transport |
| Hub replay | recorded command outcomes | webhook command interpretation at ingest time only |
| context | one authority GraphRAG projection + verified pack | legacy L11 retrieval in shadow mode |
| observability | AuthorityTelemetry / immutable evidence streams | console diagnostics |
| verification | manual full matrix + local execution | no automatic paid pipeline |

## 6. Failure / resilience graph

```text
LatentCondition
   ├── divergent sibling branches
   ├── mutable reference leakage
   ├── current-row temporal overwrite
   ├── orphan tests
   └── reduced workflow surface
           │
           ↓ CONTRIBUTES_TO
FailureMode
   ├── incomplete candidate qualification
   ├── stale writer bypass
   ├── future knowledge visible in historical query
   ├── duplicate side effect
   └── false-green release gate
           │
           ├── DEFENDED_BY → canonical reconciliation
           ├── DEFENDED_BY → deep immutability / CAS
           ├── DEFENDED_BY → append-only revisions
           ├── DEFENDED_BY → full suite manifest
           └── DEFENDED_BY → manual full CI matrix
```

Near misses are first-class evidence. A defense working does not mean no failure condition existed.

## 7. Score graph

```text
Implementation / static review ──→ Build
Executed evidence ────────────────→ Assurance
min(Build, Assurance) ────────────→ Authority

D01..D20 all Authority=10.0 ──────→ AUTHORITY_READY
```

No average, model confidence or test count can bypass an individual vertical gate.

## 8. Change protocol

```text
/leydekidlin
  ↓ define fact / assumption / unknown / scope / success / failure
/leydegilbert
  ↓ own discovery and implementation path
/complexsystems
  ↓ couplings / latent conditions / defenses / degraded modes / rollback
smallest reversible change
  ↓
static review + local evidence
  ↓
PR + deletion ledger + score delta
  ↓
independent review
  ↓
merge with expected SHA
  ↓
Drive + Todoist synchronization
```
