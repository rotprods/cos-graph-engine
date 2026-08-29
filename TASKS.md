# TASKS — COS Graph Engine 10/10 Authority Program

## Program status

- North Star: `20/20 verticals at Authority 10.0`
- Current phase: `05 — SECURITY / CONCURRENCY / AGENT RUNTIME`
- Clean PR chain: `#49 → #50 → #51 → #52`
- Archive only: `#46`
- Authority: `SHADOW_ONLY / IMPLEMENTED_UNVERIFIED`
- Automatic CI/CD: `OFF`
- Todoist project: `COS GRAPH ENGINE · 10/10 AUTHORITY PROGRAM` (`6hMP59rWj7f5xH7M`)

## Phases 00–04

- [x] North Star and cross-plane control plane.
- [x] Canonical reconciliation.
- [x] Contract/compatibility/deletion governance foundations.
- [x] Core graph/identity/copy-safety candidates.
- [x] Temporal/event/persistence candidates.

All remain statically implemented and unverified.

## Phase 05 — cleanroom source extraction

- [x] Preserve PR #46 as non-qualification archive.
- [x] Re-create source from exact Phase 04 base.
- [x] Split source into three one-commit review PRs.
- [x] Exclude V1/V2 duplicates, draft ledgers and stacked barrels.
- [x] Keep package root unchanged.
- [x] Create one selected clean barrel.

### PR #49 — side-effect / lease / policy core

- [x] Append-only side-effect operation revisions.
- [x] Explicit uncertainty/reconciliation/compensation states.
- [x] In-memory and Postgres candidate stores.
- [x] Lease acquire/renew/release/expire/reacquire.
- [x] Monotonic fencing and explicit-time validation.
- [x] Default-deny policy and exact approvals.
- [x] Provider reconciliation and lease retry-planning contract.

### PR #50 — capability / isolation

- [x] Append-only agent-run aggregate and Postgres candidate.
- [x] HTTP DNS/IP pinning decision contract.
- [x] Filesystem broker-handle decision contract.
- [x] Strict provider tools and private capability router.
- [x] Canonical capability facade.
- [x] JSON idempotency inspector candidate.
- [x] Pinned HTTPS transport candidate.
- [x] FileHandle executor V2.

### PR #51 — evidence / repair

- [x] Capability evidence V2.
- [x] In-memory/Postgres capability signal stores.
- [x] Durable append-only repair aggregate.
- [x] Repair Postgres candidate and worker.
- [x] Agent-evidence and lease-release repair handlers.
- [x] Cleanroom source manifest.

## PR #52 — dependency-pure core contracts

- [x] Add one strict selected-source tsconfig.
- [x] Lease contract.
- [x] Postgres lease fixture/contract.
- [x] Execution-runtime fencing contract.
- [x] Policy and policy-bound runtime contracts.
- [x] Agent-run contract.
- [x] Isolation-decision contract.
- [x] Capability evidence V2 contract.
- [x] Repair-ledger contract.
- [x] Record deliberate test exclusions instead of importing archive shims.

Status: `WRITTEN_UNEXECUTED`.

## Phase 05E — normalized adapter contracts — NEXT

- [ ] Agent-run Postgres fixture/contract with direct clean imports.
- [ ] Capability runtime end-to-end contract with direct clean imports.
- [ ] Provider reconciliation contract with direct clean imports.
- [ ] Lease retry-planner contract with direct clean imports.
- [ ] JSON idempotency inspector contract with direct clean imports.
- [ ] FileHandle executor V2 contract with direct clean imports.
- [ ] Capability signal store V2 contract.
- [ ] Capability signal Postgres fixture/contract.
- [ ] Repair Postgres fixture/contract.
- [ ] Capability repair-runtime contract.
- [ ] Rewrite side-effect runtime contract without excluded fencing prototype.
- [ ] Rewrite side-effect Postgres contract without excluded fencing prototype.
- [ ] Extend strict clean graph and evidence manifest.

## Phase 05F — static closure

- [ ] Static import/export cycle review.
- [ ] Review all Postgres SQL/transaction assumptions.
- [ ] Review TLS overloads, SNI/Host and no-second-DNS contract.
- [ ] Design/implement trusted atomic FileHandle broker.
- [ ] Connect signal/telemetry failures to durable repair work.
- [ ] Update compatibility, rollback and deletion-governance maps.
- [ ] Freeze exact clean Phase 05 candidate SHA.

## Later evidence gates

- [ ] Clean install and lockfile reconciliation.
- [ ] Strict TypeScript execution.
- [ ] All legacy/orphan/authority contracts.
- [ ] Real Postgres/Supabase parity.
- [ ] Contention and process-kill campaign.
- [ ] Provider crash-window reconciliation.
- [ ] TLS pinning fixture.
- [ ] Filesystem broker/TOCTOU campaign.
- [ ] Security review and threat model.
- [ ] Replay/restore, benchmarks and cold-agent resume.
- [ ] Final 20D re-audit and independent review.

No checkbox in the evidence section may be closed from narrative alone.