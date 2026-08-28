# STATE — COS Graph Engine

Updated: 2026-08-28  
Mode: **CORE_CORRECTNESS_HARDENING**  
Authority status: **SHADOW_ONLY**  
Current phase: **03 / 09 — CORE CORRECTNESS**  
Phase 01 draft PR: **#40**  
Phase 02 draft PR: **#43**  
Automatic CI/CD: **OFF**  
Merge authorization: **DENIED UNTIL HARDENING + EVIDENCE**

## North Star

Bring COS Graph Engine to `10.0 Authority` in all 20 audited engineering verticals and qualify it as the zero-cost graph compute/projection and agent-runtime substrate of AGENTIC_SYSTEMS_OS.

`Authority = min(Build, Assurance)`.

Calibrated baseline remains:

- Build: **7.6/10**;
- Assurance: **2.6/10**;
- Authority: **2.6/10**.

Static implementation may improve Build after review. Assurance remains unchanged until executed evidence exists.

## Frozen checkpoints

### Phase 01 — Canonical reconciliation

- status: `COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`;
- code ref: `checkpoint/phase-01-reconciled-76dfdc7`;
- exact SHA: `76dfdc737c231b2637f122125f7acf98b735ff1f`;
- PR: #40.

### Phase 02 — Contracts / compatibility / deletion governance

- status: `COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`;
- code/contract ref: `checkpoint/phase-02-contracts-06487e7`;
- exact SHA: `06487e7acbce82c5a54dbb8dd171dceae2bb67ac`;
- closure artifact: `docs/hardening/PHASE_02_CLOSURE.md`;
- PR: #43.

Phase 02 added:

- immutable legacy-test evidence manifest and explicit waiver registry;
- executable legacy-test preservation gate;
- executable >50-line deletion-governance gate;
- ADR-001…ADR-006 and ADR index;
- legacy→authority compatibility matrix;
- rollback map for code/data/events/operations;
- public API stability/deprecation policy;
- detached read-only compatibility adapters for GraphRAG, Agentic registry and Hub;
- additive compatibility contract proving mutations of those snapshots cannot alter authority state.

No Phase 02 gate/test was executed in a clean checkout, so Assurance did not move.

## Authority candidate ownership

```text
State             → AuthorityStateMachine
Agentic topology  → AuthorityAgenticRegistry
GraphRAG          → AuthorityGraphRAGIndex
ContextPack       → AuthorityContextPackCompiler
Hub runtime       → AuthorityHub
Hub query         → AuthorityHubQueryService
Hub context       → AuthorityHubContextProjector
Hub recovery      → AuthorityHubSnapshotManager
Memory            → AuthorityMemoryGateway + Coordinator + append-only stores
Durable history   → IEventLog / PostgresEventLog candidate
Observability     → AuthorityTelemetry
Tools             → strict ToolRegistry path
```

Legacy counterparts remain shadow/deprecated/read-only compatibility and may not write authority truth.

## Phase 03 objective

Raise graph/state/identity primitives from “strong candidate” to internally coherent, mutation-safe foundations before temporal/security/runtime hardening.

### P03.1 — CAS deep safety

- prevent nested mutation through `VersionedStore.read()` or snapshots;
- canonicalize/clone/freeze authority values;
- keep hash/version consistent with every observable value;
- stale writes remain fail-closed.

### P03.2 — PropertyGraph mutation/read safety

- clone/freeze returned nodes/edges/query/traversal results;
- preserve secondary indexes atomically on type/tags/source/target updates;
- validate endpoints and identity collisions.

### P03.3 — Traversal correctness

- depth must be a non-negative safe integer;
- depth=0 returns only the origin path and zero edges;
- directed edges are not traversed backwards unless mode explicitly permits it;
- every path contains the destination node corresponding to its edges;
- traversal result objects are detached from canonical graph state.

### P03.4 — Canonical serialization domain

- deterministic serializer rejects unsupported values rather than collapsing Date/Map/Set/class instances/functions/undefined/non-finite numbers ambiguously;
- cycles fail closed;
- plain JSON-like values have deterministic key ordering.

### P03.5 — Identity normalization

- explicit Unicode normalization;
- scheme/provider profile rules for authority/resource components and aliases;
- no hidden locale-dependent case conversion;
- deterministic IDs remain distinct from cryptographic integrity hashes.

### P03.6 — Authority CSR

- one canonical multiedge-capable representation;
- forward + reverse CSR;
- reverse traversal O(in-degree);
- no `queue.shift()` hot-loop behavior;
- deterministic edge identity/projection hash;
- invariants detect index/edge divergence.

## Phase 03 governance constraints

Every change inherits Phase 02:

- legacy tests cannot be modified/deleted without waiver+ADR;
- authority tests are additive;
- >50 deleted lines/file require `DELETION_GOVERNANCE.json` entry;
- compatibility/rollback docs update when public behavior changes;
- only one linear descendant authority branch;
- no automatic Actions or CD;
- no Assurance promotion before execution.

## W13 timing

PR #36 remains non-authoritative and paused. A replacement W13 is created only after Phase 07 freezes the exact qualification SHA.

## Next exact action

Create `hardening/phase-03-core-correctness` from the Phase 02 closure head and attack P03.1 → P03.6 as small guarantee-oriented commits, starting with the CAS mutable-reference bypass and its additive adversarial contract.
