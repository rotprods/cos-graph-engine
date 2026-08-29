# STATE — COS Graph Engine

Updated: 2026-08-29  
Mode: **PHASE_05_CLEANROOM_EXTRACTION**  
Authority status: **SHADOW_ONLY / IMPLEMENTED_UNVERIFIED**  
Current phase: **05 / 09 — SECURITY / CONCURRENCY / AGENT RUNTIME**  
Automatic CI/CD: **OFF**  
Merge authorization: **DENIED UNTIL EXECUTED EVIDENCE + INDEPENDENT REVIEW**

## North Star

Bring COS Graph Engine to `10.0 Authority` in every audited vertical and qualify it as the zero-cost graph/runtime substrate of AGENTIC_SYSTEMS_OS.

`Authority = min(Build, Assurance)`

Calibrated baseline remains:

- Build: **7.6/10**
- Assurance: **2.6/10**
- Authority: **2.6/10**

No score moved during this extraction. Code volume is not evidence.

## Frozen upstream lineage

- Phase 01 — `checkpoint/phase-01-reconciled-76dfdc7` @ `76dfdc737c231b2637f122125f7acf98b735ff1f` — PR #40
- Phase 02 — `checkpoint/phase-02-contracts-06487e7` @ `06487e7acbce82c5a54dbb8dd171dceae2bb67ac` — PR #43
- Phase 03 — `checkpoint/phase-03-core-ad6a93c` @ `ad6a93c0b2986c36efefb5cd59a4d14a9dffceb3` — PR #44
- Phase 04 canonical base — `checkpoint/phase-04-temporal-2e15b88` @ `2e15b88388836b94b97a93753cb4db347e275e7e` — PR #45

## Phase 05 lineage correction

Exploratory PR #46 remains preserved as design/provenance archive:

- head: `ea5023caab7741aa72d7b9cfdfbcdab28e47f6fe`
- 152 commits / 118 files / +26,125 / -373
- title now identifies it as superseded archive
- it is not qualification lineage

The selected source was re-created from the exact Phase 04 base as three reviewable commits:

1. **PR #49 — Phase 05A**
   - branch: `hardening/phase-05a-side-effect-core`
   - SHA: `3e79488a3ca5013812ab3f64d18b2a55b8050333`
   - 1 commit / 10 files / +3,941
   - side-effect truth, leases/fencing, policy and reconciliation core
2. **PR #50 — Phase 05B**
   - branch: `hardening/phase-05b-capability-isolation`
   - SHA: `45a565ac945363ab45f0f6b1ddb6a2795843084d`
   - 1 commit / 10 files / +4,084
   - agent-run, isolation, strict provider tools and capability facade
3. **PR #51 — Phase 05C**
   - branch: `hardening/phase-05c-evidence-repair`
   - SHA: `a4122eb80ad319a0cbf6497b2cc618c2f99d27a9`
   - 1 commit / 9 files / +2,490
   - evidence V2, signal stores, durable repair and cleanroom manifest
4. **PR #52 — Phase 05D contracts**
   - branch: `hardening/phase-05d-clean-core-contracts`
   - source-test commit: `008734a20afb78bebddf8420b2ac8e74a861216a`
   - 1 source-test commit before this state sync / 13 files / +2,323
   - strict selected graph plus first dependency-pure contract set

Integration source alias:

`hardening/phase-05-clean-selected` @ `a4122eb80ad319a0cbf6497b2cc618c2f99d27a9`

## Selected Phase 05 source

Single additive surface:

`packages/execution/src/authority-phase05-clean.ts`

Selected capabilities:

- append-only side-effect operation history;
- explicit provider uncertainty, reconciliation and compensation;
- bounded leases and monotonic fencing;
- default-deny scoped policy and exact approvals;
- append-only agent-run aggregate;
- DNS-pinned HTTP and broker-handle filesystem decision contracts;
- strict provider tools and private capability router;
- provider status inspection and retry planning;
- pinned HTTPS transport candidate;
- FileHandle executor V2;
- failure-isolated capability evidence V2;
- append-only capability signal stores;
- durable post-commit repair ledger.

Package-root export remains unchanged. Legacy production callers cannot select this candidate accidentally.

## Deliberately excluded from qualification lineage

- capability evidence V1;
- signal store V1;
- FileHandle executor V1;
- early capability executor and side-effect coordinator;
- duplicate lease/side-effect ledgers and Postgres prototypes;
- version-stacking barrels and draft tsconfigs;
- exploratory control-plane documents from PR #46.

## Contracts now written on PR #52

Strict graph:

`npx tsc -p tsconfig.phase05.clean.json --noEmit`

Initial dependency-pure contracts cover:

- in-memory/Postgres lease semantics;
- lease-bound execution and stale-worker rejection;
- default-deny policy and policy-bound mutations;
- append-only agent-run semantics;
- HTTP/filesystem isolation decisions;
- capability evidence V2 observer isolation;
- repair dedupe/CAS/lease/retry/abandonment.

Everything remains `WRITTEN_UNEXECUTED`.

## Remaining Phase 05 gates

P0:

1. normalize adapter tests that still import superseded barrels;
2. write clean replacements for side-effect tests that depended on the excluded in-memory fencing prototype;
3. prove the selected strict graph compiles;
4. prove pinned HTTPS transport against a controlled TLS fixture;
5. implement/prove a trusted atomic filesystem broker (`openat`/dirfd or equivalent);
6. implement real provider-specific status inspectors and target factories;
7. durably repair signal/telemetry delivery failures;
8. prove no package-root authority bypass before promotion.

P1:

- real PostgreSQL/Supabase semantic campaign;
- contention/process-kill/restart campaign;
- compatibility and rollback deltas for the clean stack;
- deletion governance for superseded archive files;
- exact Phase 05 checkpoint after static and executed gates.

## Next exact action

Create **Phase 05E — normalized adapter contracts** on top of PR #52:

- direct-import capability runtime contract;
- provider reconciliation and retry-planner contracts;
- JSON idempotency inspector contract;
- FileHandle V2 contract;
- signal-store in-memory/Postgres contracts;
- repair Postgres and capability-repair contracts;
- clean side-effect store/runtime replacements without the excluded fencing prototype.

Then perform static import/export review. No automatic Actions or score promotion.