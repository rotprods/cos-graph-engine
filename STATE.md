# COS Graph Engine — Current State

`checkpoint_schema: cos.state/reclaim/v1`

```yaml
checkpoint_time: 2026-09-10T15:49:00+02:00
repository: rotprods/cos-graph-engine
north_star: production-grade graph-engineering framework with evidence-backed convergence
production_certified: false

main:
  sha: 3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83
  convergence_merged: false

main_convergence:
  pr: 103
  branch: integration/main-baseline-20260907
  head: bc9250ccd39663cffc6860c5bbe9f1a24b0281ac
  base: main
  state: OPEN_READY_MERGEABLE
  blocker: REQUIRED_EXTERNAL_WRITE_ACCESS_APPROVAL
  last_qualified_pr_run: 34392601415
  last_qualified_merge_ref: f01dcd93c6d3e74644fb02ca1553b55f47128074
  current_reported_merge_ref: 75861ecbcd24ebf2cdf0c628f241d3b87d0096ef
  current_merge_ref_requalification_required: true

coverage_w0:
  pr: 104
  head: d03066576a7ccb1aa8140847ab585f1cc2915199
  run: 34393472865
  status: GREEN_DRAFT
  statements: 73.13
  branches: 76.81
  functions: 72.85
  lines: 73.13

coverage_w1a:
  pr: 105
  head: d0d63a665a7b89205c76145a4b669a2f12866500
  run: 34394269728
  status: GREEN_DRAFT
  statements: 76.59
  branches: 78.35
  functions: 84.75
  lines: 76.59
  donor_pr_16: PORTED_REQUALIFIED_DO_NOT_BLIND_MERGE

next_resume:
  checkpoint: W1B.0
  name: Durable Memory / Restart Truth
  base_sha: d0d63a665a7b89205c76145a4b669a2f12866500
  suggested_branch: fix/durable-memory-w1b
  first_action: refresh mutable refs and claim persistence/server/memory files
  red_tests_first: true

known_blocking_findings:
  - FileBackedMemory serialize/deserialize does not persist real entries
  - PersistenceManager.load masks corruption as missing
  - PersistentCOSSERVER persists derived counters rather than server memory authority
  - COSServer must receive persistent memory via construction-time dependency injection
  - CodeSandbox is in-process new Function and is not a trusted security sandbox

forbidden_next_actions:
  - mutate PR 103 head merely for docs
  - merge PR 103 without qualifying external approval
  - reuse stale merge-ref receipt without refreshing current merge ref
  - merge historical PR 16 literally
  - lower coverage thresholds or exclude executable product code to inflate coverage
  - combine W1B durability and W1C sandbox security without an unavoidable dependency

handoff_file: HANDOFF.md
handoff_branch: chore/zero-context-handoff-20260910
handoff_parent: d0d63a665a7b89205c76145a4b669a2f12866500
```

For rationale, evidence, DoD, adversarial questions and exact resume protocol, read `HANDOFF.md` on this same branch.
