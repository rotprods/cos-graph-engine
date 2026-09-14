# W1B Durable Memory / Restart Truth — Claim Checkpoint

```yaml
checkpoint_schema: cos.w1b/claim/v1
checkpoint_time: 2026-09-10T19:12:00+02:00
repository: rotprods/cos-graph-engine
branch: fix/durable-memory-w1b
parent_sha: d0d63a665a7b89205c76145a4b669a2f12866500
phase: W1B.0
status: CLAIMED_NO_SOURCE_MUTATION
scope:
  - packages/infrastructure/src/persistence.ts
  - packages/api/src/server-persist.ts
  - packages/api/src/server.ts
  - packages/memory/src/memory-manager.ts
next_phase: W1B.1_RED_TESTS
red_tests_first: true
production_certified: false
```

## Authority snapshot refreshed before claim

- `main`: `3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83` (unchanged, protected).
- PR #103 / `integration/main-baseline-20260907`: `bc9250ccd39663cffc6860c5bbe9f1a24b0281ac`, open, mergeable, ready-for-review; still lacks an external write-access approval. Current reported merge ref remains `75861ecbcd24ebf2cdf0c628f241d3b87d0096ef`; prior exact merge-ref receipt must not be reused as authority for a later regenerated merge ref.
- PR #104 / `test/coverage-measurement-v1`: `d03066576a7ccb1aa8140847ab585f1cc2915199`, open, draft, mergeable.
- PR #105 / `test/coverage-orphan-suites-w1`: `d0d63a665a7b89205c76145a4b669a2f12866500`, open, draft, mergeable. This exact SHA is the W1B parent.
- Handoff PR #108 / `chore/zero-context-handoff-20260910`: docs-only head `d640e0d41bcd9e2b945057a2d54a034f0291922a`; it is not an implementation base.

## SHA correction

The string `d0d63a665a7ccb1aa8140847ab585f1cc2915199` is **not** a valid W1B parent. It splices the #105 prefix with the #104 suffix. GitHub confirms the authoritative #105 head and implementation parent is:

`d0d63a665a7b89205c76145a4b669a2f12866500`

## Concurrency preflight

Before this claim:

- no branch matching `*w1b*` existed;
- no open PR search advertised ownership of `persistence.ts`, `server-persist.ts`, or `memory-manager.ts`;
- contemporary PR #106 changes only GGEV2 telemetry files;
- contemporary PR #107 changes CI/package/WASM/graph files and does not touch the W1B source scope;
- PR #108 changes only `HANDOFF.md` and `STATE.md`.

This establishes the best available GitHub-observable claim window. It does not pretend to prove absence of an unpublished local worktree.

## Non-negotiable execution laws

1. Do not mutate `main`, #103, #104, #105, or the handoff branch.
2. Preserve RED→GREEN evidence; W1B source repair cannot precede a failing regression suite on this lineage.
3. Corruption must fail closed; only a genuine missing-file condition may map to `missing`.
4. Persist real memory entries/telemetry, not derived counters masquerading as authority.
5. Inject the persistent memory authority into `COSServer` before `AutonomousLoop` construction; do not patch readonly internals after construction.
6. Add deterministic `flush()` / `dispose()` lifecycle and natural-exit behavior.
7. Use crash-safer atomic replacement semantics and document any remaining multi-process locking/fencing boundary.
8. Do not combine W1B with the separate W1C sandbox-security repair.
9. Do not lower coverage or add product-code exclusions to manufacture metrics.

## Resume point

Claim is persisted before source mutation. The next permitted action is **W1B.1 — RED tests first** against this branch lineage, proving restart round-trip, telemetry preservation, corruption fail-closed behavior, atomicity safety, lifecycle, single injected memory authority, and shutdown semantics before implementation.
