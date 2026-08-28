# Phase 01 — Canonical Reconciliation of PR #34 and PR #35

**Branch:** `hardening/canonical-authority-reconciliation`  
**Base:** `hardening/w12-3-core-gap-closure` @ `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`  
**Source A:** PR #34 / `hardening/w12-4-authority-completion` @ `af4973561b5f7d7a7415fa8f88a12a7d8d678a66`  
**Source B:** PR #35 / `hardening/w12-4-authority-closure` @ `8b7e197f35e6fc114cd90ec0907db4c2f5b625f4`  
**Authority:** `SHADOW_ONLY`  
**Verification:** `NOT_RUN`

## 1. Exact problem

PR #34 and PR #35 are divergent sibling implementations from the same #33 base. Neither is a superset of the other. W13 PR #36 was based only on #35 and therefore cannot certify the complete W12.4 candidate.

Measured topology:

- #34: 40 commits ahead of #33, 30 changed files, approximately `+4142/-266`;
- #35: 28 commits ahead of #33, 21 changed files, approximately `+3267/-278`;
- #35 compared with #34: 28 commits ahead and 40 commits behind;
- merge base: `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`.

The objective is not to merge both branches mechanically. It is to build one canonical authority architecture, capability by capability, while preserving valuable work and rejecting duplicated or weaker authority paths.

## 2. Reconciliation laws

1. **One authority path per capability.** Compatibility adapters may exist, but only one implementation owns canonical writes and truth semantics.
2. **No blind branch merge.** Every imported capability requires an explicit decision and source lineage.
3. **No evidence adaptation.** Legacy tests remain intact; authority tests are additive unless an ADR explicitly authorizes a compatibility break.
4. **No large deletion without a ledger.** Any replacement deleting more than 50 non-generated lines must record prior behavior, replacement, observable delta, verification and rollback.
5. **Build is not Assurance.** Static implementation can raise Build score; only executed evidence can raise Assurance.
6. **No W13 qualification from an incomplete lineage.** W13 must be recreated from the reconciled candidate.
7. **Zero automatic Actions spend.** Remote verification remains manual and full-surface, not reduced-surface.

## 3. Source inventory

### Capabilities exclusive or materially stronger in #34

- atomic `AuthorityGraphRAGIndex.replaceProjection()` with projection-version CAS;
- versioned `AgenticResourceRegistry` mutation and replay-conflict checks;
- explicit shared/global resource inclusion;
- `VersionedStateMachine` expected-state/expected-revision fencing;
- `AuthorityTelemetry` terminal operation events and metrics;
- authority-memory contracts and Postgres adapter;
- Hub query layer;
- command/outcome event separation for deterministic Hub replay;
- GitHub provider fixtures;
- W13 authority/provider/state contract scripts;
- stricter server-side authority wiring.

### Capabilities exclusive or materially stronger in #35

- strict real tool execution and legacy false-success removal;
- `VerifiedAuthorityGraphRAGEngine` requirements for explicit `recordedAt` and endpoint-derived sensitivity;
- transactional core `StateMachine` with internal rollback and timer fencing;
- retriever-agnostic ContextPack compiler with projection version/hash and SHA-256 verification;
- Agentic registry → GraphRAG context projectors;
- temporal-memory service and compensation workflow;
- Hub snapshot/recovery adapters and strict recovery wrapper;
- immutable EventBus delivery-failure observer stream;
- expanded W13 negative/recovery/orphan-suite runners.

### Overlapping surfaces requiring explicit resolution

- `packages/graph/src/authority-graphrag.ts`;
- `packages/graph/src/context-pack.ts`;
- `packages/graph/src/index.ts`;
- `packages/hub/src/store.ts`;
- `packages/hub/src/index.ts`;
- `packages/memory/src/index.ts`;
- `package.json`;
- `tsconfig.authority.json`;
- `tsconfig.build.json`;
- root `STATE.md` and `HANDOFF.md`.

## 4. Canonical capability decisions

| ID | Capability | Canonical decision | Source lineage | Status / required hardening |
|---|---|---|---|---|
| C01 | Tool runtime | Select strict #35 execution semantics | #35 + #33 CapabilityRouter | `SELECTED_WITH_HARDENING`: add durable side-effect ledger and resource fencing before authority |
| C02 | GraphRAG projection | Build one atomic authority projection using #34 replacement/CAS model | #34 core + #35 deterministic constraints | `COMBINE`: explicit recordedAt, endpoint-derived sensitivity, immutable snapshots, no second authority engine |
| C03 | ContextPack | Keep retriever abstraction, scope-first filtering and SHA-256 evidence | #35 compiler + #34 projection contract | `COMBINE`: one projection version/hash source and gold-query evidence |
| C04 | State machine | Use #35 internally transactional StateMachine as execution core | #35 core + #34 revision fencing | `COMBINE`: integrate expected state/revision without two competing mutation queues |
| C05 | Agentic registry | Select #34 versioned/CAS registry semantics | #34 | `SELECTED_WITH_HARDENING`: deep immutability and append-only change evidence |
| C06 | Hub event/replay | Replay recorded outcomes, never re-decide historical commands | #34 command/outcome + #35 snapshots/recovery | `COMBINE`: restore definitions and verify final state/revision/hash |
| C07 | Hub context | Keep bounded context projection and verified pack path | #35 + #34 registry | `COMBINE`: project only canonical registry revisions |
| C08 | Memory authority | Neither adapter is authority-ready as written | #34 contracts + #35 service ideas | `REWRITE_REQUIRED`: append-only system-time revisions, deep clone/freeze, durable CAS |
| C09 | Observability | Select #34 AuthorityTelemetry | #34 | `SELECTED_WITH_HARDENING`: instrument canonical paths and isolate observer failure |
| C10 | Delivery failure learning | Select #35 immutable EventBus observer stream | #35 | `SELECTED`: bridge to ResilienceObserver without causal invention |
| C11 | API/server wiring | Rebuild after canonical exports exist | #33/#34/#35 | `DEFERRED`: do not copy either server diff blindly |
| C12 | W13 qualification | Recreate after Phase 01–07 candidate freeze | #34/#35/#36 evidence ideas | `BLOCKED`: current #36 remains non-authoritative |
| C13 | Workflows | Preserve full verification breadth behind manual dispatch | legacy CI + W13 ideas | `REWORK_REQUIRED`: no automatic triggers and no capability deletion |

## 5. Rejected patterns

The canonical branch must not preserve these as authority behavior:

- multiple exported GraphRAG classes that can independently mutate canonical truth;
- `Date.now()`/`new Date()` implicit timestamps in replay-critical projection identity;
- shallow wrapper copies around mutable CAS values;
- current-row overwrite marketed as complete bi-temporal history;
- idempotency/fencing values checked only for presence;
- replay that re-runs business decisions instead of applying recorded outcomes;
- tests rewritten in place without preserving legacy behavior evidence;
- reduced CI surface justified only by cost control.

## 6. Port sequence

### R1 — Control-plane truth

- create this branch from #33;
- publish this matrix, scorecard, graph, tasks, state and handoff;
- open a draft reconciliation PR;
- keep #34/#35/#36/#37 draft and unmerged.

### R2 — Low-conflict exclusive primitives

- port strict tool runtime;
- port AuthorityTelemetry;
- port EventBus delivery-failure observation;
- port provider fixtures as non-authority evidence assets.

### R3 — Canonical state and registry

- port transactional StateMachine core;
- integrate expected state/revision semantics into one versioned facade;
- port versioned AgenticResourceRegistry;
- remove mutable-reference bypasses before calling the slice complete.

### R4 — GraphRAG/context convergence

- implement one atomic authority projection;
- incorporate #35 relation normalization constraints;
- compile verified ContextPacks from that single projection;
- retain legacy L11 only as explicit shadow/deprecated compatibility.

### R5 — Hub convergence

- command + accepted/rejected outcome ledger;
- deterministic state/revision/hash replay;
- query layer;
- snapshot store + strict recovery + context projector.

### R6 — Memory redesign

- preserve useful contracts, not flawed storage semantics;
- implement append-only transaction-time revisions;
- add supersession/retraction/contradiction and deep immutability;
- provide in-memory and Postgres semantic parity.

### R7 — Surface reconciliation

- update package exports, root scripts, tsconfig references and server wiring;
- regenerate lockfile only from a clean install;
- produce API/behavior diff and deletion ledger.

### R8 — Qualification handoff

- freeze candidate architecture;
- recreate W13 branch from this branch;
- execute full manual evidence matrix.

## 7. Phase 01 acceptance gates

Phase 01 is complete only when:

- one canonical reconciliation branch exists from #33;
- #34/#35 capability inventory is complete;
- every overlapping primitive has one documented owner;
- no duplicate authority path remains ambiguous;
- root exports and package boundaries are coherent by static inspection;
- deletion ledger covers every material replacement;
- W13 is recreated from the reconciled candidate, not from either sibling;
- GitHub, Drive and Todoist checkpoints agree.

## 8. Rollback

The rollback point is #33 SHA `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`. Source branches #34 and #35 remain untouched until equivalence is demonstrated. No historical PR or branch is deleted during reconciliation.
