# COS Graph Engine — Full-Stack Adversarial Review

**Review date:** 2026-08-24  
**Scope:** PRs #17, #18, #20–#37 and the cumulative `main...hardening/w13-authority-qualification` diff  
**Review mode:** STOP-THE-LINE / independent adversarial reassessment  
**Authority state:** `SHADOW_ONLY`  
**Merge state:** all hardening and qualification merges frozen pending reconciliation and evidence

---

## 1. Executive verdict

The current hardening program contains a large amount of valuable engineering, but it is **not yet safe to describe as fully verified, internally coherent, or ready for merge**.

The reviewer does **not** have full confidence in every decision made so far. That would be an unsupported claim because:

1. the stack has not passed a clean install, full typecheck, canonical tests, negative tests, replay, restore, contention, security and benchmark campaign;
2. several large files were replaced through the GitHub Contents API without a repo-local compile loop;
3. tests and benchmarks were sometimes rewritten alongside production code, creating a risk of adapting the evidence to the implementation instead of preserving the original behavioral contract;
4. two competing W12.4 branches were created from the same parent and were not reconciled before W13 began;
5. this review found concrete defects in graph immutability, temporal semantics, CAS integrity, durability claims, tool-side-effect fencing, workflow coverage and test governance.

The correct current statement is:

> The hardening stack is an ambitious **implemented-but-unverified candidate**, with several strong primitives and several material correctness and governance gaps. It must be reconciled and reworked before certification.

No code has been merged to `main`. That containment is valuable: all findings remain reversible.

---

## 2. Deletion analysis

Large deletion counts are real, but line count alone does not determine whether a change is good or bad.

The cumulative `main...W13` diff is strongly net-additive. Most deletions are concentrated in four classes:

1. **workflow replacement** — large CI/deploy/release YAML files replaced by smaller manual-only workflows;
2. **module rewrites** — memory, state-machine, GraphRAG, tool-runtime and agent-runtime implementations replaced rather than incrementally patched;
3. **test rewrites** — old L2 tests changed to match copy-safe context and strict-constructor semantics;
4. **benchmark rewrites** — legacy benchmark logic reduced or replaced.

The concern is therefore not “deletion is always wrong.” The concern is **semantic loss without a preservation ledger**.

### Mandatory deletion ledger from now on

Any PR deleting more than 50 non-generated lines from one file must document:

| Field | Required evidence |
|---|---|
| Previous behavior | What capability, contract or test the deleted code provided |
| Reason for removal | Defect, duplication, unsafe behavior, cost, or supersession |
| Replacement | Exact file/function/job/test that preserves or intentionally changes it |
| Behavioral delta | What callers will observe differently |
| Compatibility policy | Backward-compatible, deprecated, migration-required, or breaking |
| Verification | Test, typecheck, replay, security or benchmark evidence |
| Rollback | How to restore the old path if the replacement fails |

No deletion should be accepted solely because the replacement is shorter or appears cleaner.

---

## 3. Critical governance defect: W12.4 fork divergence

PR #34 (`hardening/w12-4-authority-completion`) and PR #35 (`hardening/w12-4-authority-closure`) are **divergent sibling implementations** from the same #33 base.

The comparison shows:

- #35 is 28 commits ahead of #34;
- #35 is 40 commits behind #34;
- their merge base is #33;
- neither is a superset of the other.

W13 PR #36 was created from #35. It therefore does **not** qualify the complete W12.4 candidate.

### Valuable capabilities present in #34 but not canonically reconciled into #35/W13

- atomic `AuthorityGraphRAGIndex.replaceProjection()`;
- version/CAS mutation semantics for `AgenticResourceRegistry`;
- explicit global-resource inclusion semantics;
- `VersionedStateMachine` with expected state/revision fencing;
- `AuthorityTelemetry` terminal-operation instrumentation;
- authority-memory contracts and store;
- Hub query/runtime layer;
- command/outcome event separation for deterministic replay;
- provider fixtures and authority contract scripts.

### Valuable capabilities present in #35/W13

- stricter real tool execution and false-success elimination;
- incremental authority GraphRAG implementation plus verified facade;
- epistemic/temporal memory envelope and Postgres temporal index;
- Hub snapshot and restore adapters;
- transactional rewrite of the core state machine;
- immutable EventBus delivery-failure observation;
- expanded W13 negative/recovery/orphan suites.

### Required correction

Create one canonical reconciliation branch from #33. Port both implementations capability by capability. For every duplicate abstraction, choose one after comparing:

- invariant strength;
- atomicity;
- replay determinism;
- migration cost;
- API compatibility;
- typecheck surface;
- testability;
- operational failure modes.

W13 must be rebased or recreated from the reconciled branch. It cannot certify one sibling while ignoring the other.

---

## 4. PR-by-PR verdict

| PR | Area | Deletion profile | Current verdict |
|---:|---|---:|---|
| #17 | hardening control-plane docs | +440 / -0 | **KEEP**. Low-risk documentation baseline. |
| #18 | W0/W1 CI truth | +332 / -590 | **REWORK / SUPERSEDE**. Correct diagnosis, but workflow capability was collapsed too aggressively. |
| #20 | PropertyGraph correctness | +192 / -87 | **REWORK**. Index repair is useful; mutable-reference leaks and traversal defects remain. |
| #21 | deterministic identity | +182 / -1 | **REWORK**. Strong direction; normalization and serializer domain are insufficiently strict. |
| #22 | temporal/provenance | +358 / -34 | **REWORK**. Preserves history better, but domain validity and transaction-time supersession are still conflated. |
| #23 | event kernel | +229 / -40 | **REWORK**. Correct event-log/delivery split; semantic identity and durable operational behavior need tightening. |
| #24 | recovery protocol | +182 / -0 | **KEEP CORE / HARDEN**. Good protocol abstraction; needs durable fixtures, cryptographic integrity and restore evidence. |
| #25 | policy/security | +192 / -52 | **REWORK**. Fail-closed improvements are valuable; enforcement coverage and principal/scope model remain incomplete. |
| #26 | agent runtime | +230 / -148 | **REWORK**. Removes false success, but runtime remains mutable and in-memory in important paths. |
| #27 | CAS/leases | +391 / -1 | **REWORK — HIGH PRIORITY**. Current CAS values leak mutable references, defeating the version/hash guarantee. |
| #28 | resilience model | +228 / -1 | **KEEP MODEL / INTEGRATE**. Strong ontology; automatic evidence ingestion and combination analysis remain incomplete. |
| #29 | scientific benchmark harness | +177 / -1 | **KEEP**. Better methodology; real benchmark suites still need migration and evidence. |
| #30 | scoped GraphRAG | +319 / -93 | **REWORK**. Good pre-prompt scope rule; authority and legacy paths remain ambiguous. |
| #31 | memory integrity | +435 / -314 | **REWORK — HIGH PRIORITY**. Index handling improved, but deep mutable content still leaks. |
| #32 | cold-start/governance | +138 / -0 | **KEEP**. Useful current-truth surface. |
| #33 | cross-wave integration | +3258 / -111 | **HOLD**. Valuable integration substrate, but too large and unverified to merge independently. |
| #34 | W12.4 completion sibling | +4142 / -266 | **DO NOT DISCARD**. Contains material guarantees missing from #35. Must be reconciled. |
| #35 | W12.4 closure sibling | +3267 / -278 | **DO NOT MERGE ALONE**. Contains material guarantees, but is not a superset of #34. |
| #36 | W13 qualification | +1170 / -499 | **PAUSE**. It certifies only #35 lineage and rewrites parts of the test contract. |
| #37 | manual Actions control plane | +189 / -597 | **REQUEST CHANGES**. Manual-only trigger is right; deletion of verification breadth is not. |

---

## 5. Confirmed high-risk findings

### P0 — Qualification branch does not contain the complete candidate

W13 is based on #35 while #34 contains 40 divergent commits and meaningful authority primitives. Any successful W13 run would certify an incomplete architecture.

**Required action:** reconcile #34/#35 first.

---

### P0 — Workflow cost control deletes verification capability

PR #37 correctly removes automatic triggers, but it also removes explicit jobs for:

- CSR;
- pruning;
- benchmark tests and benchmark artifacts;
- WASM tests;
- observability tests;
- visualization tests;
- core-level suites;
- coverage artifacts;
- Docker build verification;
- benchmark history.

The desired transformation is:

```text
automatic matrix
    ↓
manual/reusable matrix
```

not:

```text
broad verification
    ↓
one reduced job
```

**Required action:** preserve the full verification surface behind `workflow_dispatch`, reusable workflows or scoped manual jobs. Benchmarks and Docker can default off, but their definitions should not be erased without an explicit retirement decision.

---

### P0 — CAS can be bypassed through mutable references

`VersionedStore<T>` currently shallow-copies the wrapper while retaining the same `value` reference. `compareAndSwap()` also stores `nextValue` by reference.

A caller can therefore:

```text
read value
mutate nested field directly
state changes
version does not change
contentHash does not change
```

That violates the central CAS guarantee.

**Required action:** canonical deep-copy/freeze on write and read, or constrain `T` to immutable values and enforce the constraint. Add mutation-adversarial tests.

---

### P0 — Temporal memory does not preserve transaction-time history

The temporal-memory index stores one current row per memory ID and overwrites that row on update. `recordedAt` is preserved, while future fields such as `validUntil` are written into the same row.

A historical `knownAt` query can therefore observe a future closure because the prior revision no longer exists.

That is versioned current state, not a complete bi-temporal history.

**Required action:** append-only temporal revisions or a separate history table with `system_from/system_until`; queries must choose the revision visible at `knownAt` before applying domain-validity filters.

---

### P0 — Tool side-effect idempotency and fencing are presence checks, not enforced guarantees

`CapabilityRouter` currently requires an idempotency key and fencing version for side-effecting capabilities, but the tool path does not necessarily:

- claim a durable operation-level idempotency ledger;
- validate fencing against the authoritative resource version immediately before commit;
- persist the side-effect result for crash recovery;
- renew the goal lease during long executions.

A crash after a side effect but before result persistence can still cause duplication on retry.

**Required action:** side-effect transaction/outbox or saga contract; resource-level fencing validation; durable idempotency result ledger; lease renewal/heartbeat; crash-window tests.

---

### P1 — PropertyGraph still leaks canonical mutable objects

`getNode()`, `getEdge()`, query results and traversal paths expose internal graph objects. Nested arrays/objects are also retained by reference on insertion.

A caller can mutate type, tags, source, target or properties without updating indexes or versions.

Additional traversal concerns:

- depth zero can still emit an edge path;
- emitted paths may omit the destination node;
- directed edges are traversed incoming and outgoing without an explicit direction contract;
- fractional depth is accepted.

**Required action:** clone/freeze boundaries; explicit directed traversal policy; integer depth; path invariant tests; rollback on add/index failure.

---

### P1 — Identity serializer accepts unsupported object classes

`stableSerialize()` traverses arbitrary objects using enumerable keys. Values such as `Date`, `Map`, `Set`, typed arrays or class instances can serialize ambiguously or as `{}`.

Canonical identity also lacks:

- Unicode normalization;
- provider-specific case rules for resource IDs;
- immutable/copy-safe registry returns;
- alias normalization policy.

**Required action:** accept only plain JSON-like objects; reject unsupported prototypes; normalize Unicode; define provider identity profiles; clone/freeze registry outputs.

---

### P1 — Temporal correction conflates two time axes

`supersedeTemporal()` closes both `supersededAt` and `validUntil` by default. A newly discovered correction does not always mean the old assertion ceased to be domain-valid at the discovery time.

Retroactive correction, delayed observation and knowledge revision must remain independently representable.

**Required action:** make domain closure optional and explicit; always close transaction/system validity on supersession; test late-discovered and retroactive cases.

---

### P1 — KnowledgeGraph mutations are not atomic or compensating

Observed mutation sequences can leave partial state:

- record stored before graph edge creation;
- record retired before edge retirement;
- old statement retired before replacement projection succeeds;
- entity identity based on first matching label/type rather than canonical identity.

**Required action:** transaction-capable graph adapter or explicit saga/compensation ledger; canonical entity identity; copy-safe record reads; failure-injection tests at every boundary.

---

### P1 — Memory integrity claim is incomplete

The memory store clones top-level tags, representations and metadata, but `content` and nested structures can remain shared references. Retrieval updates access counters without a semantic revision, and maintenance queries can alter access statistics.

**Required action:** deep copy/freeze canonical content and nested metadata; separate operational access telemetry from semantic memory revision; lifecycle disposal through `MemoryManager`; circular-content-safe size accounting.

---

### P1 — Agent runtime exposes mutable goals and remains operationally in-memory

Goal objects, plan arrays, result maps and metadata are returned directly. Callers can mutate runtime state outside controlled methods.

Other risks:

- first available reasoning cell is selected rather than capability-matched routing;
- acceptance defaults to existence or substring matching;
- plan adaptation lacks durable revision/fencing semantics;
- memory persistence failure after a successful step can distort the step outcome;
- execution trace and goal state are not yet durably authoritative.

**Required action:** immutable DTOs; versioned goal aggregate; durable event-sourced execution state; capability routing; acceptance contracts; outbox for step-result persistence.

---

### P1 — Hub replay should consume recorded outcomes, not re-decide old commands

The #35 Hub appends a repository command/event and re-runs the state-machine transition during replay. If transition semantics change, an event rejected historically could be accepted later.

#34 contains a stronger command/outcome separation.

**Required action:** preserve the command event and a separate accepted/rejected outcome event; replay only the recorded outcome under a schema/versioned projector.

---

### P1 — Safe GraphRAG facade coexists with an unsafe public base path

The verified facade requires source `recordedAt` and derives effective sensitivity before relation identity. The underlying base engine remains exported and permits implicit wall-clock behavior.

**Required action:** make the verified path the public authority default; move legacy implementation behind an explicit compatibility namespace/deprecation; require explicit `asOf` for replay/certification.

---

### P1 — Test rewrites can hide compatibility regressions

W13 changes legacy L2 tests and benchmarks to use the new state API. Some changes are valid, but replacing old assertions without a compatibility matrix risks proving only that the new implementation matches its new tests.

The strict constructor also breaks the earlier builder pattern of creating an empty machine and adding states incrementally.

**Required action:** preserve the original tests as `legacy-compat`; add new authority tests separately; classify each old behavior as preserved, deprecated with migration, or intentionally breaking with semver/ADR.

---

## 6. Confidence assessment by area

| Area | Confidence in direction | Confidence in current implementation | Reason |
|---|---:|---:|---|
| Graph breadth / 20-level architecture | High | Medium | Strong substrate; integration still unsettled |
| Property graph correctness | High | Low | Mutable object leaks and traversal defects remain |
| Deterministic identity | High | Medium-low | Correct concept; normalization/serializer gaps |
| Bi-temporal model | High | Low | Current storage/update semantics do not preserve full history |
| Event log architecture | High | Medium | Correct separation; durability and semantic contracts need tests |
| Recovery protocol | High | Medium | Good design; adapters and drills unverified |
| Policy/security | High | Medium-low | Fail-closed direction; incomplete end-to-end enforcement |
| Agent runtime | High | Low | Important improvements, but not durable/immutable enough |
| Concurrency/leases | High | Low | CAS reference leak and in-memory protection are material |
| Resilience graph | High | Medium | Good ontology; evidence pipeline incomplete |
| Benchmarks | High | Medium | Better harness; real suites not fully migrated |
| GraphRAG/context | High | Medium-low | Scope model improved; duplicate authority paths and replay gaps |
| Memory | High | Low | Index fixes useful; deep-copy and true temporal history absent |
| Hub | High | Medium-low | Strong strategic fit; replay/outcome semantics need reconciliation |
| CI/CD cost posture | High | Low in #37 | Trigger policy right; verification breadth deletion wrong |
| Overall 10/10 claim | N/A | **Not justified** | Evidence campaign has not run and candidate is not reconciled |

---

## 7. Corrected implementation process

### Gate R0 — Stop and preserve

- No hardening PR merges.
- No W13 Actions run.
- Keep all branches and commits; do not delete evidence.
- PR #37 remains draft.
- Authority remains `SHADOW_ONLY`.

### Gate R1 — Build a canonical change inventory

For every changed file from `main...W13`:

- classify as add / patch / replacement / deletion;
- record old contract and new contract;
- map every removed test/job/capability to a replacement;
- identify public API and data-migration effects;
- assign owner and verification gate.

### Gate R2 — Reconcile #34 and #35

Create one reconciliation branch from #33. Import the stronger primitive for each capability. No blind merge commit.

Mandatory explicit decisions:

- atomic projection replacement vs incremental GraphRAG mutation;
- versioned registry semantics;
- core transactional state machine vs wrapper-based expected-revision machine;
- command/outcome Hub replay;
- authority telemetry;
- authority-memory model vs temporal envelope model;
- provider fixtures;
- public legacy/authority export boundaries.

### Gate R3 — Correct static defects before CI

At minimum:

- immutable clone/freeze boundaries for graph, memory, goals, CAS and registries;
- append-only temporal revision history;
- durable tool idempotency/fencing contract;
- Hub command/outcome replay;
- explicit API compatibility layer for L2;
- provider normalization for canonical identity;
- verified GraphRAG as authority default;
- package workspace and lockfile reconciliation.

### Gate R4 — Preserve evidence breadth

Rework workflows so all old verification categories remain available manually:

- smoke;
- core correctness;
- graph CSR/pruning;
- cognitive levels;
- WASM;
- observability;
- visualization;
- coverage;
- benchmarks;
- Docker build without push;
- release qualification without publish.

Default execution can remain minimal and manual. Definitions should remain available.

### Gate R5 — Independent tests

- restore legacy tests untouched where possible;
- add authority tests in separate files;
- add property-based mutation tests;
- add crash-window and failure-injection tests;
- add Postgres fixtures;
- add replay across projector schema versions;
- add corrupted snapshot and empty-database restore;
- add cross-project leakage and stale-context tests;
- add symlink escape and DNS/private-egress tests.

### Gate R6 — One consolidated manual evidence campaign

Only after R1–R5:

```text
clean install
→ lockfile truth
→ typecheck legacy + strict authority
→ build/WASM
→ unchanged legacy regression
→ authority negative/property suites
→ Postgres adapter fixtures
→ concurrency/crash tests
→ event/graph/context replay
→ snapshot corruption + empty restore
→ security diff scan
→ benchmarks/observability
→ cold-agent resume
→ 20D re-audit
```

### Gate R7 — Merge strategy

Do not merge the full stacked chain one PR at a time into `main` after it has diverged this much.

Preferred path:

1. produce one canonical reconciled branch;
2. compare it directly to `main`;
3. split it into a small number of independently reviewable guarantee PRs or one explicitly reviewed convergence PR;
4. use expected head SHA;
5. preserve rollback tags/refs;
6. merge only after independent approval and evidence attachment.

---

## 8. New non-negotiable governance rules

1. **No confidence language without evidence class.** Use `PROPOSED`, `IMPLEMENTED`, `STATICALLY_REVIEWED`, `TESTED`, `REPLAY_VERIFIED`, `RESTORE_VERIFIED`, or `AUTHORITY_QUALIFIED`.
2. **No test deletion without one-to-one replacement mapping.**
3. **No workflow deletion without coverage-equivalence mapping.**
4. **No full-file replacement above 200 lines without a before/after contract review.**
5. **No sibling implementation branches may silently become the qualification base.**
6. **No mutable canonical objects may cross a public API boundary.**
7. **No “idempotent” claim based only on a key being present.**
8. **No “bi-temporal” claim without append-only system-time history.**
9. **No “durable” claim for process-local state.**
10. **No authority promotion while legacy and authority paths are both publicly ambiguous.**
11. **Every destructive or high-deletion PR requires an independent approving reviewer.**
12. **Red CI is evidence; tests may not be weakened to obtain green.**

---

## 9. Actions already taken by this review

- PR #37 converted back to draft.
- STOP-THE-LINE review comment added to #37.
- W13 pause/reconciliation comment added to #36.
- No merge performed.
- No Actions run triggered.
- This audit branch was created independently from `main` so the review itself does not depend on the disputed hardening lineage.

---

## 10. Final conclusion

The project contains genuinely strong ideas and a substantial amount of useful implementation. The concern raised by the owner is valid: the pace and breadth of full-file changes exceeded the assurance level available without compilation and independent review.

The correct response is not to discard the work. It is to stop treating the current stack as a linear, trusted implementation and convert it into a **reconciled, evidence-driven candidate**.

Current verdict:

```text
Architecture potential: HIGH
Implementation value: HIGH
Internal consistency: NOT YET PROVEN
Regression safety: NOT YET PROVEN
Security assurance: NOT YET PROVEN
Replay/restore assurance: NOT YET PROVEN
10/10 confidence: NOT JUSTIFIED
Merge authorization: DENIED PENDING RECONCILIATION
```

This document is the controlling review until superseded by a completed reconciliation report and W13 evidence package.
