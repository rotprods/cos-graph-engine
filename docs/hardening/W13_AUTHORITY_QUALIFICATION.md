# W13 — AUTHORITY QUALIFICATION

Status: ACTIVE — evidence campaign
Branch: `hardening/w13-authority-qualification`
Parent: `hardening/w12-4-authority-closure`
Authority state until completion: `SHADOW_ONLY`
Cost policy: one manual single-job workflow; no automatic CI/CD.

## North Star
A 10/10 score is granted only when the relevant guarantee has reproducible machine evidence. W13 may fix defects exposed by verification, but may not add product breadth or hide failures.

## Qualification order

### Q0 — dependency reproducibility
- `npm ci` from a clean checkout.
- record Node/npm/TypeScript/tsx versions.
- reconcile `package-lock.json` if the frozen W12 workspace graph changed it.
- no network-fetched implicit compiler version after reconciliation.

### Q1 — static contracts
- `npm run typecheck:build`.
- `npm run typecheck:authority` with `strict:true`.
- `npm run asbuild`.
- all authority workspaces are part of the root build graph, including `@cos/hub`.

### Q2 — canonical regression
- `npm run test:all`.
- inventory orphan suites instead of trusting a test-count headline.
- `npm run test:l2:authority`.

### Q3 — cross-stack negative guarantees
- `npm run test:w13:authority`.
- deterministic identity / serialization.
- payload-bound EventLog idempotency and copy-safe reads.
- expected-version/content CAS.
- lease fencing and stale-token rejection.
- idempotency-key payload conflict.
- policy default-deny and malformed-operator behavior.
- malformed tool-result rejection.
- side-effect idempotency/fencing requirements.
- scope-safe deterministic GraphRAG.
- stale ContextPack rejection.
- SHA-256 verified agentic context.
- strict incomplete Hub restore rejection.

### Q4 — provider contract fixtures
Required before production adapter qualification:
- PostgresEventLog: concurrent insert, retry, conflicting retry, cursor ordering.
- PostgresMemoryStore: revision CAS, TTL, JSON/array round trip.
- PostgresTemporalMemoryIndex: canonical timestamp/NULL round trip, revision CAS.
- PostgresHubSnapshotStore: SHA-256 integrity, collision, latest ordering.

Provider fixtures may use an isolated ephemeral PostgreSQL service or a dedicated free Supabase test project. They must never point at unrelated production data.

### Q5 — replay / recovery
- same canonical event stream -> same graph/state/context hashes.
- snapshot + replay == uninterrupted projection.
- corrupted snapshot fails before import.
- schema mismatch fails closed.
- empty-database restore rebuilds all declared durable resource classes.
- partial Hub recovery requires an explicit shadow-mode override.

### Q6 — security
- unknown policy operators/fields do not authorize.
- DENY wins equal-priority conflicts.
- restricted/private context cannot leak into lower permission scopes.
- filesystem roots and HTTP egress preconditions reject unsafe requests.
- side effects without policy/idempotency/fencing fail closed.
- no secrets committed to fixtures/logs/artifacts.

### Q7 — concurrency / failure interaction
- simultaneous stale writers cannot silently win.
- expired lease + successor fencing prevents stale commit.
- duplicate delivery is harmless; conflicting duplicate is rejected.
- state-machine transitions are serialized.
- transition callback failure restores internal state/history/counters.
- policy/lease/idempotency/delivery failures appear as near-miss evidence without invented root cause.

### Q8 — scientific performance / observability
Run only after Q0–Q7 are green.
- seeded fixtures.
- objective-specific benchmark claims.
- median/p95/distribution evidence.
- no speedup claim for pruning-only success.
- no fabricated zero-memory result after GC.
- tracing around authority query/agent paths.

### Q9 — cold-agent continuity
A fresh agent gets only repository URL + Project ID + Task. It must reconstruct North Star, current state, relevant decisions, current branch/PR, blockers and next action from `README_FIRST.md`, `GOAL.md`, `STATE.md`, `HANDOFF.md`, hardening docs and graph context — no hidden chat memory.

### Q10 — 20D re-audit
For each audited dimension attach:
- guarantee IDs;
- implementation paths/PRs;
- test/evidence paths;
- failure-injection evidence where applicable;
- current residual risks;
- score.

A dimension cannot be scored 10/10 while a P0/P1 authority defect or unverified required gate remains.

## Failure policy
A red check is evidence. Fix the underlying defect. Forbidden responses include:
- `|| true`;
- `|| echo` on required gates;
- deleting/skipping a failing required test without replacement evidence;
- weakening authority contracts to preserve legacy behavior;
- changing benchmark objectives after seeing results;
- marking partial restore as complete restore.

## Cost control
`.github/workflows/w13-authority-qualification.yml` has only `workflow_dispatch` and one job. Benchmark execution is an explicit boolean input and defaults to false. No deploy/release action exists in W13.

## Evidence status
- [x] W12 architecture frozen.
- [x] `@cos/hub` included in root build graph.
- [x] strict authority typecheck surface created.
- [x] L2 copy-safe context migration API (`patchData` / `replaceData`).
- [x] legacy L2 tests migrated away from mutable canonical references.
- [x] in-memory/Postgres EventLog idempotency semantics reconciled.
- [x] W13 cross-stack negative suite authored.
- [x] manual-only qualification workflow authored.
- [ ] Q0 clean install.
- [ ] Q1 static/build gates.
- [ ] Q2 regression gates.
- [ ] Q3 authority negative suite.
- [ ] Q4 provider fixtures.
- [ ] Q5 replay/restore.
- [ ] Q6 security.
- [ ] Q7 contention/failure interaction.
- [ ] Q8 benchmarks/observability.
- [ ] Q9 blind cold-agent resume.
- [ ] Q10 final 20D re-audit.
