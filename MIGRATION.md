---
authority: PROJECTION
scope: migration from current stacked drafts and legacy surfaces to COS V2 authority
owner: Migration Architect
last_updated: 2026-08-30T17:30:00.000Z
source_revision: 1bc137eb6e635f55db293b402f561e420dc83c4f
supersedes: blind stacked-PR merge strategies
status: PROPOSED
---

# COS Graph Engine V2 — Migration Plan

## 1. Migration objective

Move from protected `main`, legacy V2.1 behavior and a stack of unverified hardening PRs to one exact, evidence-qualified, independently reviewed authority candidate—without merging exploratory code, deleting history, reducing compatibility invisibly or enabling automatic deployment.

## 2. Current topology

```text
main @ 3ae197e

Phase 01–04 historical checkpoints / drafts
        ↓
PR #49  Phase 05A — side-effect truth
        ↓
PR #50  Phase 05B — capability and isolation
        ↓
PR #51  Phase 05C — evidence and repair
        ↓
PR #52  Phase 05D — contracts and strict graph
        ↓
PR #53  Phase 05E — adapter normalization
        ↓
PR #54  Phase 05F — observed outcome recovery
        ↓
PR #55  V2 hypergraph control-plane overlay

PR #46 = archive/provenance, not qualification or merge source
PR #36 = invalid old qualification lineage
PR #37 = manual CI concept requiring breadth restoration
issue #39 = stop-the-line governance
```

All hardening PRs remain draft/unmerged and `SHADOW_ONLY`.

## 3. Greenfield target

A greenfield V2 would have:

- one authority package surface;
- one event and revision model;
- one project/sensitivity-aware graph/context path;
- one policy-bound capability runtime;
- one side-effect/reconciliation/repair protocol;
- one evidence and promotion compiler;
- generated continuity documents;
- exact-SHA qualification and independent review.

Migration reaches that topology incrementally rather than rewriting functioning legacy graph, WASM, visualization and observability code.

## 4. Classification of current assets

### KEEP

- protected main history;
- exact Phase 01–04 checkpoints and ADR/deletion evidence;
- graph/WASM/visualization/observability capabilities that pass regression;
- archive PR #46 for provenance;
- selected clean Phase 05 contracts from #49–#54;
- PR #55 machine-readable control plane.

### REFINE

- canonical identity and serializer versions;
- event/persistence parity;
- temporal memory and knowledge semantics;
- GraphRAG/ContextPack scope and integrity;
- observability/evidence correlation.

### REFACTOR

- provider evidence verification;
- provider-specific reconciliation;
- TLS/filesystem physical isolation adapters;
- package-root authority surface;
- CI/manual verification matrix;
- continuity documentation.

### MIGRATE

- legacy writers to selected authority facade;
- current-row temporal records to append-only revisions;
- command replay to recorded-outcome replay;
- manually maintained state/docs to compiled projections.

### DEPRECATE

- archive V1/V2 duplicate Phase 05 surfaces;
- unqualified `complete`, `ready`, `secure`, `tested` and `exactly once` language;
- direct deep imports that bypass selected authority surface.

### DELETE

Only after semantic deletion ledger, compatibility evidence and rollback proof. No historical PR or event is erased.

### DEFER

- Kafka/Redis/distributed queue authority;
- Kubernetes as authority infrastructure;
- paid vector database;
- automatic CD;
- production multi-region deployment;
- any subsystem without a measured trigger.

## 5. Migration phases

### M0 — Control-plane freeze

**Input:** PR #55 selected model.

**Actions:**

- execute validator/compiler against exact commit;
- commit generated fingerprints and evidence;
- regenerate root continuity surfaces;
- synchronize Drive/Todoist;
- run a cold-reader review of the packet.

**Exit:** CP4 V2 architecture frozen.

**Rollback:** leave PR #55 unmerged; continue using prior handoff state.

### M1 — Close critical runtime gaps on clean lineage

Separate bounded branches/claims from exact PR #54 head:

- recompute provider evidence hash/content binding;
- implement GitHub and Drive reconciliation adapters;
- build/prove pinned TLS transport;
- build/prove native atomic filesystem broker;
- complete durable signal/telemetry repair.

Each task uses one owner and file scope. No unrelated refactor.

### M2 — Clean toolchain and selected surface

- freeze one candidate SHA;
- regenerate lockfile from clean install;
- produce SBOM/toolchain manifest;
- enforce selected export allowlist;
- archive/delete superseded drafts under deletion governance;
- preserve legacy tests separately.

### M3 — Verification matrix

- manual-only GitHub Actions or local equivalent;
- strict typegraphs;
- legacy, authority and orphan suites;
- property and mutation tests;
- known-failure red proof;
- all results classified explicitly.

### M4 — Empirical qualification

- real/fake PostgreSQL parity where applicable;
- multi-process contention and process-kill;
- provider timeout-after-acceptance;
- TLS/DNS and filesystem race fixtures;
- replay and empty-DB restore;
- GraphRAG/memory gold queries;
- cold-agent death drill;
- scientific performance campaign.

### M5 — Independent review and convergence

- freeze exact qualified SHA and evidence manifest;
- independent write-enabled review;
- create a clean integration branch from current `main`;
- apply only selected qualified files/commits;
- compare behavior, exports, graphs and deletion ledger;
- run final matrix against integration head;
- merge with expected SHA and rollback checkpoint.

### M6 — Authority promotion

- verify every D01–D20 score equals 10.0;
- verify no open P0/P1;
- Roberto records promotion decision/event;
- synchronize GitHub, Drive and Todoist;
- keep deployment/CD as a separate gate.

## 6. Selected-file convergence strategy

Never merge the entire exploratory archive. The integration manifest lists:

```text
selected source files
selected migrations
selected tests
selected docs/ADRs
legacy compatibility adapters
explicit exclusions and their archive provenance
```

For each selected capability:

```text
capability ID
old writer
new writer
read-only compatibility path
schema/data migration
consumer migration
regression suite
rollback
exact evidence IDs
```

## 7. Data migration

### 7.1 Events

Preserve original event IDs and recorded outcomes. Version event schemas; migration creates transformed projections or explicit migrated events, never silent reinterpretation.

### 7.2 Temporal records

Current-row records become append-only revisions. Initial migration records source/provenance and the migration timestamp. Unknown historical system time is represented as unknown/estimated, not invented.

### 7.3 Graph projections

Rebuild from authority. Do not migrate opaque derived indexes when reproducible reconstruction is available.

### 7.4 Memory and knowledge

Map legacy type/layer/tag metadata to canonical epistemic type, project, sensitivity and provenance. Records lacking required authority metadata remain legacy/shadow until reviewed.

### 7.5 Side effects and repairs

Only accepted durable operation outcomes migrate to authority history. In-flight/ambiguous operations enter reconciliation. Failed secondary duties become repair records.

## 8. API migration

```text
legacy package root
        ↓ compatibility audit
selected explicit authority subpath
        ↓ executed contract evidence
package-root allowlist
        ↓ consumer migration
legacy path deprecated/read-only
        ↓ deletion gate
legacy writer removed
```

A deep import that bypasses the authority facade is a P0 defect after promotion.

## 9. Documentation migration

Root continuity documents become validated projections with metadata:

```text
authority
scope
owner
last_updated
source_revision
supersedes
```

Historical narrative stays under reports/ADRs/ledgers. Current documents do not silently preserve stale branch or task pointers.

## 10. CI/CD migration

### Current convergence posture

```text
automatic Actions = OFF
CD = OFF
manual execution = explicit and budgeted
```

### Target manual matrix

Preserve all existing verification categories and add authority/recovery/security gates. A matrix manifest proves no suite was dropped when automatic triggers were removed.

### Future automation trigger

Automatic CI may be reconsidered only when measured developer delay/rework exceeds cost and a budget/runner strategy is approved. CD remains independent.

## 11. Parallelization plan

| Lane | Scope | Dependency | Collision rule |
|---|---|---|---|
| A | PR #55 control plane/docs/compiler | current | exclusive claim on control-plane/root docs |
| B | provider evidence verification | exact PR #54 | separate branch/session/claim |
| C | GitHub/Drive provider adapters | B contract frozen | provider directory only |
| D | TLS and native filesystem fixtures | platform executor available | platform/fixture paths only |
| E | manual CI matrix inventory | architecture freeze | workflow/test manifests only |

No two lanes modify the same contract or selected barrel without an explicit handoff.

## 12. Rollback matrix

| Migration unit | Rollback |
|---|---|
| control-plane projection | discard/rebuild generated outputs; preserve events |
| root document refresh | restore prior blobs; V2 packet remains additive |
| provider evidence verifier | keep operation `reconciliation_required` |
| provider adapter | disable adapter; manual reconciliation |
| HTTP authority path | disable external HTTP capability |
| filesystem authority path | disable filesystem mutation capability |
| selected package export | return to explicit subpath import |
| database schema | restore checkpoint and replay trusted events |
| integration PR | revert merge or restore pre-merge checkpoint branch |
| authority promotion | append demotion event and disable autonomous writes |

## 13. Migration acceptance criteria

Migration is complete only when:

- clean `main` contains the selected qualified surface;
- no archive/V1 writer is exported or callable as authority;
- legacy behavior changes are documented and tested;
- data/event/history provenance is retained;
- replay/restore and cold-agent drills pass;
- exact-SHA review remains valid;
- rollback checkpoint exists;
- D01–D20 each equal Authority 10.0;
- owner records the authority transition.

## 14. Current migration state

```text
M0: active; model locally validates, exact-SHA evidence/root-doc sync pending
M1: critical gaps open
M2: not started
M3: not started
M4: not started
M5: blocked
M6: blocked
```

No PR is authorized for merge by this document.
