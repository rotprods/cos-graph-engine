---
authority: PROJECTION
scope: COS V2 test, evidence and empirical qualification architecture
owner: Test Architect / Assurance Lead
last_updated: 2026-08-30T17:30:00.000Z
source_revision: 1bc137eb6e635f55db293b402f561e420dc83c4f
supersedes: test-count and green-badge maturity claims
status: PROPOSED
---

# COS Graph Engine V2 — Test Strategy

## 1. Objective

Testing must establish falsifiable guarantees for an exact artifact, not accumulate impressive counts. Every critical invariant has an authoritative test, every escaped bug has a permanent regression, and every physical claim has an empirical qualification campaign.

## 2. Evidence law

A claim is qualified only when evidence records:

```text
claim / invariant ID
exact candidate SHA
test / campaign ID
command and toolchain
fixture and schema versions
environment
PASS / FAIL / SKIPPED / CANCELLED / NOT_RUN
raw output or measurements
artifact hash
reviewer / owner
```

A test file, test name, PR description or historical “600 tests” statement is not executed evidence.

## 3. Test taxonomy

### 3.1 Unit

Pure behavior of serializer, identity, graph operation, reducer, state transition, policy predicate and hash verification.

### 3.2 Contract

Port/adapter semantics shared by in-memory and PostgreSQL implementations, tools, providers, event logs and ContextPack consumers.

### 3.3 Schema

JSON, event, snapshot, database row and provider payload version validation. Unknown versions fail closed.

### 3.4 Property

Generated inputs test invariants such as deterministic serialization, graph traversal consistency, idempotent convergence and temporal query laws.

### 3.5 Mutation

Intentional code mutations must be detected by the test corpus. Survivors become explicit coverage gaps.

### 3.6 Integration

Cross-package behavior: event log → projection; registry → GraphRAG → ContextPack; policy → lease → provider operation → evidence.

### 3.7 End-to-end

A real operator goal becomes bounded context, a policy-authorized action, durable outcome and recoverable evidence.

### 3.8 Physical runtime

Controlled TLS, DNS, filesystem handles, real PostgreSQL, process death and multi-process contention.

### 3.9 Security

Prompt/provider poisoning, secret leakage, SSRF, path traversal, shell injection, replay, stale writer, authority escalation and dependency compromise.

### 3.10 Concurrency

CAS conflicts, duplicate deliveries, lease expiry/reacquisition, fencing takeover, concurrent agent claims and repair-worker contention.

### 3.11 Replay

Rebuild projections from immutable recorded outcomes and require deterministic state/hash.

### 3.12 Recovery

Corrupt snapshot, missing projection, empty database, lost checkout, agent death and provider ambiguity.

### 3.13 Performance

Distribution-based benchmarks with pinned environment, raw samples and variance.

### 3.14 Empirical qualification

Campaigns proving real adapter/provider and operational behavior beyond static contracts.

### 3.15 Death drill

A zero-context successor or restarted process recovers without hidden conversational/local state.

## 4. Critical invariant coverage map

| Invariant | Minimum authoritative test |
|---|---|
| one authority writer per capability | export/import graph + startup duplicate-owner rejection |
| canonical serialization deterministic | property corpus across key order, Unicode and supported values |
| unsupported objects fail closed | Date/Map/Set/class/function/cycle negative corpus |
| all returned authority state detached | nested-mutation campaign over every read/query/history API |
| event append payload-bound | duplicate same payload converges; different payload conflicts |
| historical replay preserves outcomes | change rules after recording and require same replay state |
| bitemporal queries are accurate | validAt × knownAt matrix with corrections and contradictions |
| project/sensitivity isolation | negative cross-project and clearance queries before ranking |
| stale projection/ContextPack rejected | mismatched version/hash/watermark/source revision |
| policy defaults deny | unknown action/capability/resource/project |
| approval exact and expiring | altered operation hash/resource/time fails |
| one accepted external effect | timeout-after-acceptance + reconciliation + retry fencing |
| stale worker cannot commit | lease takeover and old fence at resource boundary |
| telemetry cannot change result | sink construction/storage failure on accepted and rejected paths |
| repair survives restart | fail post-commit duty, restart, lease and resolve repair |
| snapshots detect corruption | payload/hash/schema/watermark/scope mutations |
| empty database restores | migrations + snapshot + tail + projections + gold queries |
| successor resumes without chat | timed cold-agent drill |
| manual CI retains breadth | suite manifest coverage and known-failure red proof |
| evidence belongs to candidate | wrong-SHA artifact/approval rejection |

## 5. Escaped-bug corpus

The machine-readable source is `control-plane/v2/model/bug-escape-graph.json`.

Every escape follows:

```text
BUG
→ ROOT_CAUSE
→ BROKEN_INVARIANT
→ WHY_PRIOR_TESTS_MISSED_IT
→ PERMANENT_REGRESSION
→ ADJACENT_FAILURE_FAMILY
→ PROPERTY / FUZZ / GAUNTLET
```

Priority permanent regressions include:

- tool false success;
- mutable-reference CAS bypass;
- false bi-temporal overwrite;
- PR closed ≠ merged ≠ deployment succeeded;
- replay re-decision;
- manual CI breadth deletion;
- incomplete W13 lineage;
- provider evidence hash tamper;
- lost post-commit repair;
- stale continuity documents.

## 6. Test levels by program phase

### P00 — Control plane

```text
ontology references
graph dangling IDs and orphan ownership
task DAG
claim overlap
event sequence/watermark
ContextPack freshness
authority ceiling
document drift
validator mutation self-tests
```

### P01–P02 — Reconciliation and governance

```text
lineage completeness
legacy evidence preservation
semantic deletion ledger
compatibility contract
one selected authority surface
```

### P03 — Core correctness

```text
PropertyGraph invariants
canonical identity/serialization
CAS immutability
multiedge forward/reverse CSR
algorithm property/mutation/performance tests
```

### P04 — Temporal/event/persistence

```text
in-memory/Postgres semantic parity
bitemporal revisions
command/outcome replay
snapshot integrity
empty-DB restore
```

### P05 — Security/concurrency/runtime

```text
policy and approval
provider evidence verification
side-effect lifecycle
idempotency and fencing
lease takeover
provider timeout/reconciliation/compensation
TLS/DNS and filesystem physical boundaries
AgentRun evidence
repair restart
```

### P06 — Hub/memory/GraphRAG/observability

```text
Hub outcome replay
memory epistemic history
ContextPack scope/freshness/integrity
cross-project leakage
gold-query quality
telemetry and repair isolation
```

### P07 — Test truth/manual CI

```text
clean install
strict typegraphs
legacy, authority and orphan suites
property/mutation corpus
failure-red CI self-contract
coverage/artifact preservation
```

### P08 — Empirical campaign

```text
security gauntlet
contention/process kill
replay/restore
degraded-mode/failure injection
scientific benchmarks
cold-agent resume
```

### P09 — Qualification

```text
exact-head review
lineage and selected-file completeness
promotion gate rejects any score < 10 or open P0/P1
post-merge smoke/recovery check
```

## 7. Manual CI architecture

During convergence, workflows use only `workflow_dispatch`. They preserve—not reduce—the full matrix.

Suggested manual stages:

```text
Q0  clean checkout and toolchain evidence
Q1  lockfile / workspace / dependency integrity
Q2  strict TypeScript graphs
Q3  build and WASM
Q4  legacy regression
Q5  authority contract suites
Q6  orphan and excluded suites
Q7  property and mutation campaigns
Q8  security static/negative corpus
Q9  contention and process-kill
Q10 replay and restore
Q11 coverage and artifact manifest
Q12 scientific benchmark (explicit opt-in)
Q13 evidence and score compiler
```

Automatic triggers and CD stay off. Every stage records cost and duration.

## 8. Test-result semantics

- `PASS`: acceptance criteria satisfied.
- `FAIL`: acceptance criteria violated or required execution error.
- `SKIPPED`: runner intentionally omitted; reason required.
- `CANCELLED`: execution terminated; not PASS.
- `NOT_RUN`: no execution against candidate.
- `FLAKY`: not a terminal qualification state; quarantine plus root-cause task required.

A required test that is skipped, cancelled, flaky or not run blocks promotion.

## 9. Property and fuzz campaigns

### Canonical serialization

Generate nested canonical JSON-like values with reordered keys and Unicode variants. Require stable bytes/hash. Generate unsupported values and require rejection.

### Graph operations

Generate directed/undirected multigraphs, parallel/self edges and random mutation sequences. Compare canonical graph to a simple reference model.

### Temporal semantics

Generate facts, corrections and contradictions over independent valid/system-time orderings. Compare query results to an exhaustive reference reducer.

### Idempotency and events

Generate duplicate and conflicting delivery orders. Require convergence for identical logical events and conflict for changed payloads.

### Claims/leases/fencing

Generate overlapping scopes, expiry boundaries, takeover sequences and stale commits. Require at most one accepted authority writer/effect.

### Context retrieval

Generate projects, sensitivity levels, provenance and stale projection versions. Require no unauthorized chunk enters candidate ranking or rendered context.

## 10. Mutation testing targets

At minimum mutate:

- remove clone/deep-freeze;
- invert policy default-deny;
- skip evidence hash comparison;
- ignore expected revision;
- reuse fencing token;
- allow stale lease;
- treat provider `unknown` as `not_applied`;
- replay commands instead of outcomes;
- omit sensitivity filter;
- accept corrupt snapshot;
- suppress process exit on test failure;
- remove a suite from the manual matrix.

Every mutation must be killed by at least one authoritative test before CP12.

## 11. Scientific performance methodology

For each benchmark:

```text
candidate SHA
hardware/OS/runtime/toolchain
fixture generator and seed
graph shape and size
warmup policy
sample count
raw samples
p50/p95/p99
variance/confidence interval
memory allocation/peak
correctness checksum
baseline and comparison method
```

Thresholds cannot be adjusted after observing the candidate without a recorded decision.

## 12. Evidence storage

Canonical layout:

```text
EVIDENCE/
  toolchain/
  tests/
  security/
  concurrency/
  replay/
  recovery/
  performance/
  cold-agent/
  scorecard/
```

Control-plane evidence lives under `control-plane/v2/evidence/` until the final repository evidence architecture is promoted.

## 13. Current evidence state

```text
V2 control-plane validator/compiler: PASS locally, exact-SHA binding pending
Phase 05 clean install: NOT_RUN
Phase 05 strict typecheck: NOT_RUN
Authority contracts: NOT_RUN
Physical TLS/filesystem/Postgres: NOT_RUN
Contention/process kill: NOT_RUN
Replay/restore: NOT_RUN
Security gauntlet: NOT_RUN
Cold-agent drill: NOT_RUN
```

Therefore Assurance and Authority remain unchanged.
