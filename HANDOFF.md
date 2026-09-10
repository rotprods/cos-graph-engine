# COS Graph Engine — Zero-Context Handoff

**Checkpoint time:** 2026-09-10 15:49 Europe/Madrid  
**Repository:** `rotprods/cos-graph-engine`  
**Reclaim branch:** `chore/zero-context-handoff-20260910`  
**Handoff parent:** `d0d63a665a7b89205c76145a4b669a2f12866500` (PR #105 head at checkpoint creation)

> This file is the canonical recovery entrypoint for the next agent. Do not rely on chat memory. Read this file first, then refresh every mutable GitHub ref before making changes.

---

## 1. North Star

Converge COS Graph Engine into a production-grade graph-engineering framework without papering over defects or losing historical work.

Non-negotiable operating laws:

1. Never mutate `main` directly.
2. Never merge a historical PR merely because it is open; port validated value into the convergence train and classify redundant PRs as superseded.
3. Preserve RED→GREEN evidence and exact-SHA qualification.
4. No fake coverage: no executable-production exclusions, `c8 ignore`, threshold lowering, or cosmetic tests just to manufacture a number.
5. No security bypasses: no `@ts-ignore`, blanket `any`, `continue-on-error`, publication/deploy shortcuts, or branch-protection bypass.
6. Keep PRs/commits small, reviewable and concurrency-safe.
7. Production claims require observed evidence. `TARGETED_ACCEPTED` or a green slice is not whole-repository production certification.

---

## 2. Current Git topology and authoritative state

### `main`

- Exact SHA at checkpoint: `3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83`.
- It has NOT received the convergence train yet.
- Refresh before any merge attempt.

### PR #103 — main convergence candidate

- PR: `#103 chore(convergence): qualify hardened baseline for main`
- Base: `main`
- Head branch: `integration/main-baseline-20260907`
- Exact head: `bc9250ccd39663cffc6860c5bbe9f1a24b0281ac`
- State at checkpoint: open, `mergeable=true`, `draft=false`.
- Contains 123 commits / 75 changed files relative to old main.
- Main remained unchanged after a guarded merge attempt.

#### What #103 already proved

A PR-event run `34392601415` passed all six direct jobs plus aggregate on a GitHub-generated merge ref:

- contract
- quality-core
- specialized
- performance
- coverage
- docker
- complete aggregate

The qualifying merge ref at that moment was:

`f01dcd93c6d3e74644fb02ca1553b55f47128074`

Contract logs proved checkout of `refs/pull/103/merge`, not merely the source branch. Docker proved:

- production TypeScript build
- workspace module resolution in final image
- non-root runtime
- TypeScript/dev runtime pruned from production image
- real production `/health`

#### Important current nuance: merge-ref regeneration

After the qualification / ready-for-review state changes, current PR metadata reports a newly generated `merge_commit_sha`:

`75861ecbcd24ebf2cdf0c628f241d3b87d0096ef`

Do NOT assume the old `f01dcd...` receipt qualifies this newly generated merge commit by SHA. Even if head/base trees are unchanged, the policy here is exact-SHA evidence. Before merging #103, trigger/re-run the PR gate and qualify the CURRENT merge ref.

#### Current blocker

A guarded merge using `expected_head_sha=bc9250...` was rejected by GitHub with HTTP 405:

`At least 1 approving review is required by reviewers with write access.`

No protection bypass was attempted. The next agent must NOT weaken protection. Required sequence:

1. obtain one qualifying external `APPROVE` from a reviewer with write access;
2. refresh `main`, #103 head, mergeability, approval state and current merge ref;
3. re-run/requalify the current PR merge ref;
4. merge with `expected_head_sha` only if all receipts are green;
5. run the complete convergence gate again on post-merge `main`;
6. only then classify the baseline as promoted.

### PR #104 — truthful coverage measurement

- PR: `#104 test(coverage): unify truthful JS/TS coverage measurement`
- Base: `integration/main-baseline-20260907` (#103 branch)
- Head: `test/coverage-measurement-v1`
- Exact head: `d03066576a7ccb1aa8140847ab585f1cc2915199`
- State at checkpoint: open, draft, mergeable.
- Exactly one commit / four changed files.
- Run `34393472865`: GREEN.
- Artifact ID: `10120578794`.
- Artifact SHA-256 observed: `2a6e070373c3435c4c8e687be2eb4991fe63decc4c6dff6adf5e72fee0c52b39`.

Coverage after instrumenting already-existing suites under one c8 process:

- statements: **73.13%**
- branches: **76.81%**
- functions: **72.85%**
- lines: **73.13%**

Previous baseline was ~64.44/74.49/65.49/64.44. The increase came from truthful measurement, not product exclusions.

### PR #105 — orphan-suite donor recovery

- PR: `#105 test(coverage): recover 17 orphan suites from PR #16`
- Base: `test/coverage-measurement-v1` (#104)
- Head: `test/coverage-orphan-suites-w1`
- Exact head: `d0d63a665a7b89205c76145a4b669a2f12866500`
- State at checkpoint: open, draft, mergeable.
- Exactly one commit / four changed files.
- Run `34394269728`: GREEN.
- Strict TypeScript: GREEN.
- All 17 historical suites from donor #16: GREEN.
- Artifact ID: `10120884164`.
- Artifact SHA-256 observed: `38d43334bd744be1b6a211bfd4fa0e47a9b37c29a12fe3df84720c0959eaf2dc`.

New measured coverage:

- statements: **76.59%**
- branches: **78.35%**
- functions: **84.75%**
- lines: **76.59%**

Delta versus #104 W0:

- statements/lines: +3.46 pp
- branches: +1.54 pp
- functions: +11.90 pp

The 17 recovered suites cover L0, L2, L4, L5, L6, query, GraphQL, convert, security, streaming, plugin, playground, i18n, GCN, AutoML, ML integration and persistence/sharding/cache/replication tests.

**Donor rule:** PR #16 has now had its useful intent ported and requalified. Do NOT later merge #16 literally on top of a future baseline. Once this stack reaches main, classify/close #16 as `PORTED-SUPERSEDED` with provenance.

---

## 3. Important production findings discovered after W1A

Coverage work exposed actual defects. Do not optimize the metric before correcting these semantics.

### A. `packages/infrastructure/src/persistence.ts` is not yet durable memory

Observed at #105 parent:

- `FileBackedMemory.serialize()` returns only `{ type: 'FileBackedMemory', version: 1 }`.
- `FileBackedMemory.deserialize()` is a no-op.
- Therefore memory entries are NOT restored after restart.
- Autosave uses a delayed timer and has no explicit flush/dispose lifecycle.
- `PersistenceManager.load()` catches every error and returns `false`; malformed JSON, validation failure or deserialize failure can be misclassified as "missing file" instead of corruption.
- Current writes are direct `writeFile` to the target path; crash/torn-write semantics have not been hardened with temp-file + atomic rename/fsync policy.

### B. `packages/api/src/server-persist.ts` persists counters, not server authority

Observed at #105 parent:

- `PersistentCOSSERVER` creates an ordinary `COSServer` with its normal in-memory `MemoryManager`.
- It creates separate `FileBackedData` stores.
- `saveNow()` records memory stats / entry count, knowledge stats and learning stats.
- It does NOT serialize and later restore the real `COSServer.memory` entries.
- Its `init()` loads those side stores but does not rehydrate server memory authority.

Do not preserve the illusion that this is complete restart durability.

### C. Correct integration direction: dependency injection, not casts

`COSServer` currently constructs `this.memory = new MemoryManager()` internally and immediately passes that instance into `AutonomousLoop(this.cellHost, this.memory, ...)`.

For true persistent memory integration, the server must receive the memory authority during construction (e.g. a dependency/options injection) so every consumer, including `AutonomousLoop`, shares the exact same `MemoryManager` / backing store from the beginning.

Do not replace a public property after construction; that would leave already-constructed consumers holding the old store.

### D. `packages/execution/src/sandbox.ts` is a separate security defect; DO NOT combine casually with durability

Current `CodeSandbox` is not a security sandbox:

- executes untrusted JS with `new Function(code)` in the same Node process;
- `networkAccess`, `filesystemAccess`, `allowedModules`, `maxMemory` and `maxCpu` are configuration fields but are not actually enforced;
- timeout via `Promise.race` does not terminate synchronous CPU-bound code;
- `console.log` is monkey-patched globally and restoration is not protected by `finally`, so exceptions/timeouts can leave global console state corrupted;
- output/memory controls do not establish an isolation boundary.

This deserves a dedicated threat-model/security PR after W1B durability, not cosmetic coverage tests over the unsafe implementation. Preferred direction is an isolated worker/process/container boundary with explicit capabilities and hard termination semantics; refresh architecture before implementation.

### E. Current zero/low-coverage surfaces after W1A

Not exhaustive, but highest-priority observed surfaces include:

- `deployment/src/*` — 0% under c8 (Docker runtime smoke exists separately for `serve.ts` behavior)
- `api/src/server-persist.ts` — 0%
- `infrastructure/src/persistence.ts` — 0%
- `execution/src/sandbox.ts` — 0%
- several cognition/orchestration/knowledge modules remain materially below target

Do not exclude type-only files merely to raise the number until a documented coverage-universe policy distinguishes executable code, generated artifacts, declarations and AssemblyScript.

---

## 4. EXACT NEXT RESUME POINT — W1B Durable Memory / Restart Truth

**Do this next. Do not start elsewhere unless a new external blocker changes priority.**

Create a NEW branch directly from the frozen #105 head:

`d0d63a665a7b89205c76145a4b669a2f12866500`

Suggested branch:

`fix/durable-memory-w1b`

Do NOT base implementation work on this handoff-only branch; this branch exists to preserve continuity without invalidating #105 exact-head evidence.

### W1B execution sequence

#### W1B.0 — refresh and claim

1. Refresh `main`, #103, #104, #105 and relevant branches.
2. Verify #105 still equals `d0d63a...` and remains mergeable.
3. Ensure no concurrent agent owns `persistence.ts`, `server-persist.ts`, `server.ts`, or `memory-manager.ts`.
4. Create the W1B branch from `d0d63a...`.
5. Persist a claim/checkpoint before source mutation.

#### W1B.1 — RED tests first

Add a focused durability regression suite that fails on the parent and proves at least:

1. **Memory restart round-trip**: store multiple entries with nested content, metadata, tags, TTL/null TTL and layers; save/close; reconstruct persistence/store; load; retrieve/query; canonical content survives.
2. **Access telemetry preservation**: lastAccessed/accessCount behavior after restore is explicitly defined and tested.
3. **Corruption fail-closed**: malformed JSON or invalid snapshot schema throws a typed/clear persistence error; only `ENOENT` maps to `missing`.
4. **Atomicity safety**: failed serialization/write must not silently replace a known-good snapshot with partial JSON.
5. **Lifecycle**: autosave timer cannot keep the process alive; `flush()`/`dispose()` semantics are idempotent and deterministic.
6. **Single memory authority**: persistent server's public memory and the memory used by `AutonomousLoop` are the same injected authority. A goal-created memory write must be observable through the persistent store and survive restart.
7. **Shutdown**: persistent wrapper flushes durable state AND cleanly shuts down the underlying server/runtime.

Capture the RED result against the untouched W1B parent before implementation.

#### W1B.2 — minimal source repair

Preferred minimal architecture:

- Add explicit snapshot export/import to `InMemoryStore` or a narrow snapshot-capable store interface. Preserve deep-copy/canonical boundaries and rebuild indexes rather than serializing private Maps blindly.
- Make `FileBackedMemory` serialize/validate a versioned snapshot containing the real entries and necessary telemetry.
- Make corrupt/unknown schema fail closed.
- Change persistence writes to a crash-safer atomic replacement protocol (temporary file in same directory, write/close, rename; document fsync boundary if not fully guaranteed).
- Add explicit `flush()` and `dispose()` to `FileBackedMemory`; timers must be `unref()` and errors must not become unhandled promise rejections.
- Extend `COSServer` construction with a typed dependency injection surface for `MemoryManager` (or equivalent narrow port). Default behavior remains backward compatible.
- Rebuild `PersistentCOSSERVER` around `PersistenceManager` + `FileBackedMemory` + `MemoryManager(fileBacked)` injected into `COSServer` before `AutonomousLoop` construction.
- Remove persisted-statistics-as-authority behavior. Metrics may remain derivative, but must not masquerade as restart state.
- Eliminate any `as any` needed only to patch readonly internals.

Do NOT introduce a large generic DI container or rewrite unrelated subsystems.

#### W1B.3 — GREEN + regression

Minimum gates:

- new durability suite: GREEN
- `node scripts/test-memory-regressions.cjs`: GREEN
- strict `tsc --noEmit`: GREEN
- `npm run test:all`: GREEN
- existing #105 orphan suite corpus: GREEN
- unified coverage corpus: GREEN
- no coverage metric below **76.59 statements / 78.35 branches / 84.75 functions / 76.59 lines**
- `npm audit --audit-level=high`: GREEN
- process natural-exit test: GREEN
- no new `any`, `@ts-ignore`, `continue-on-error`, or swallowed corruption paths

Then measure the new truthful coverage and ratchet upward to the achieved floor; do not predeclare the percentage.

#### W1B.4 — review / adversarial gauntlet

Ask and test:

- What happens if process dies between temp write and rename?
- What happens if destination directory is not writable?
- What happens if a snapshot is valid JSON but schema-invalid?
- Can `__proto__`, accessors, cycles or non-JSON values mutate prototypes or bypass snapshot validation?
- Can duplicate IDs corrupt indexes on restore?
- Can expired memories resurrect after restart?
- Is telemetry restoration deterministic, or can a read during verification mutate the snapshot being compared?
- Can autosave race `shutdown()` / `flush()` and overwrite newer state with older state?
- Can two `FileBackedMemory` instances write the same file concurrently? If multi-process correctness is not solved, document that boundary explicitly rather than pretending it is.
- Does `PersistentCOSSERVER.shutdown()` remain idempotent?

### W1B Definition of Done

`W1B_DURABILITY = TARGETED_ACCEPTED` only when:

- RED parent defect evidence exists;
- implementation is one bounded review slice;
- focused + regression + coverage gates are exact-head green;
- corruption is fail-closed;
- restart round-trip proves real entries, not stats;
- autonomous loop uses the same persistent memory authority;
- lifecycle has no hanging timers / unhandled save errors;
- coverage ratchet is raised to observed evidence;
- PR remains draft until parent train is safe.

---

## 5. Following slice after W1B — W1C Sandbox Security

Do not mix into W1B unless an unavoidable interface dependency appears.

W1C objective:

Replace the in-process `new Function` pseudo-sandbox with a real isolation boundary and capability policy. Threat model must cover infinite loops, process/global mutation, filesystem, network, module loading, output flooding, secrets/env access, child processes, memory/cpu/time limits and termination cleanup.

No claim of "sandbox" is allowed until adversarial tests prove these boundaries.

---

## 6. Merge train once approval arrives

Preferred convergence order, subject to fresh ancestry checks:

1. #103 -> `main` only after external write-access approval + CURRENT merge-ref qualification + guarded merge.
2. Post-merge `main` convergence gate must be green.
3. Rebase/retarget #104 onto the promoted baseline, run its exact merge-ref gate, merge.
4. Rebase/retarget #105, requalify, merge.
5. Rebase/retarget W1B and later W1C serially, each with its own exact merge-ref and post-merge verification where appropriate.
6. Close donor #16 as `PORTED-SUPERSEDED` only after #105-equivalent content is in main.

Never merge the whole historical PR backlog in bulk. Inventory and classify each PR as: `MERGE`, `PORT`, `SUPERSEDED`, `OBSOLETE`, `CONFLICTING`, or `NEEDS-REQUALIFICATION`.

---

## 7. Parallel framework lane — do not lose, do not blindly merge

A separate graph-framework stack exists (Protocol/M1/M2/TCK work around PRs #81, #90-#98). Several slices previously reached dedicated `TARGETED_ACCEPTED` states with exact framework gates, including M1 canonical state/runtime/CSR and later durable/checkpoint/compaction work.

This handoff does NOT re-certify their present heads. Before touching that lane:

1. refresh every PR/head/ancestry;
2. ensure global convergence changes from #103+ are incorporated without semantic regression;
3. rerun each framework conformance/TCK against the converged baseline;
4. do not equate historical dedicated green runs with present merge authority.

---

## 8. Known limitations / non-claims

At this checkpoint:

- `main` is NOT production-certified.
- #103 is NOT merged.
- current global JS/TS coverage is NOT 100%; latest truthful measured child baseline is 76.59/78.35/84.75/76.59.
- AssemblyScript/WASM source coverage is not represented by c8 as ordinary JS/TS line coverage; correctness is currently separately tested through compiled WASM/oracle suites.
- branch protection could not be fully read via the connector, but the actual merge endpoint proved one write-access approval is required.
- durable multi-process file locking/fencing is NOT yet established for the legacy filesystem persistence layer.
- `CodeSandbox` is NOT a trusted sandbox in its current implementation.

---

## 9. Reclaim command for the next agent

When a new agent starts with zero chat context, the intended instruction is:

> Read `HANDOFF.md` from branch `chore/zero-context-handoff-20260910` in `rotprods/cos-graph-engine`. Refresh all mutable refs before acting. Resume exactly at **W1B.0 — Durable Memory / Restart Truth** from parent `d0d63a665a7b89205c76145a4b669a2f12866500`. Do not mutate #103/#104/#105 heads merely to update documentation; preserve their exact-SHA evidence. Do not merge #103 until required external approval exists and the current GitHub merge-ref is freshly requalified.

---

**END OF HANDOFF**
