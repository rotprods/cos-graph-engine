# Codex Handoff — W0/W1 Canonical Main + Test Truth

## Mission
Make `main` trustworthy before any deeper AGENTIC_SYSTEMS_OS integration. Do not add new product features. Resolve only the minimum correctness/governance/CI defects required to establish a reliable baseline.

## Mandatory read order
1. `AGENTS.md`
2. `docs/hardening/MASTER_PLAN.md`
3. `docs/hardening/ENGINEERING_SCORECARD.md`
4. `docs/hardening/GUARANTEE_CATALOG.md`
5. open PRs #2, #11, #12, #16 and their diffs
6. `.github/workflows/*.yml`
7. root/package workspace manifests
8. canonical test runner(s)

## Reasoning gates
For every change apply:
- `/leydekidlin`
- `/leydegilbert`
- `/complexsystems`

Do not explain these philosophically. Materialize them in the change plan, tests and rollback notes.

## W0 task graph
### T-W0-01 — Build current-truth matrix
Compare `main` against PRs #2/#11/#12/#16. Record:
- files changed
- dependency order
- overlap/conflicts
- tests each PR claims
- tests actually runnable from clean checkout
- whether the PR should be merged, cherry-picked/reimplemented, or superseded

Output: `docs/hardening/W0_CURRENT_TRUTH_MATRIX.md`.

### T-W0-02 — Restore clean install
Guarantee: clean checkout can install/link all workspaces without registry fallback for local packages.
Target guarantee: prerequisite for G-CI-004.
Use PR #11 as evidence, but inspect current package graph before applying.

### T-W0-03 — Restore real CI root
Guarantee G-CI-004.
Use PR #2 as evidence, but inspect current workflow files and phantom directories before applying.

### T-W0-04 — Remove false-green required gates
Guarantees G-CI-001/002/003.
Search required workflows for constructs such as:
- `|| echo`
- `|| true`
- ignored exit codes
- steps that print success despite failure
Required typecheck/build/test jobs must propagate non-zero exit status.
Optional capabilities may remain non-blocking only when explicitly named OPTIONAL and recorded separately.

## W1 task graph
### T-W1-01 — Canonical test inventory
Guarantee G-TEST-001.
Inventory every maintained test script/file and map it to the canonical runner.
Anything excluded must have: reason, owner, issue/task, expiry/exit condition.
Use PR #16 as evidence, not as automatic truth.

### T-W1-02 — Cognitive correctness fixes
Reproduce issues addressed by PR #12 with failing tests before accepting fixes.
Guarantees affected: graph/RAG correctness.
Do not merge if tests depend on accidental branch-only behavior.

### T-W1-03 — Benchmark truth
Guarantees G-BENCH-001/002.
- seed synthetic random graph generation
- persist seed in result metadata
- split pass criteria into `correctness`, `throughput`, `memory`, `pruning`
- do not summarize all four as generic performance PASS
- investigate measurement artifacts where memory delta clamps negative values to zero

### T-W1-04 — Forced-failure CI proof
Create a temporary/local verification that deliberately causes typecheck/test failure and proves CI command exits non-zero. Do not merge intentional failure. Persist evidence in `docs/hardening/evidence/` or PR body.

## Acceptance
W0/W1 is PASS only if:
- clean checkout/install works
- canonical test command is documented
- all required tests are wired or explicitly quarantined
- mandatory typecheck/build/test cannot fail green
- benchmark generation is reproducible
- cognitive orphan tests no longer expose unknown failures
- current-truth matrix explains PR disposition
- no unrelated feature work is bundled

## Branch/PR strategy
Prefer a new `hardening/w0-w1-canonical-truth` branch from the latest safe base after inspecting open PR dependencies.
Do NOT blindly merge #2/#11/#12/#16 from this handoff. Reconcile their exact diffs.
Keep commits guarantee-oriented, e.g.:
- `fix(ci): enforce real repository root [G-CI-004]`
- `fix(ci): propagate mandatory typecheck failures [G-CI-001]`
- `test: wire maintained orphan suites [G-TEST-001]`
- `bench: make synthetic benchmark inputs deterministic [G-BENCH-001]`

## Stop conditions
Stop and report rather than improvising if:
- resolving one prerequisite requires deleting/replacing substantial unrelated code
- open PR dependency graph is inconsistent
- a claimed test count cannot be reproduced
- a fix would introduce recurring paid infrastructure
- repository state differs materially from this handoff

## Closure
Update:
- `docs/hardening/W0_CURRENT_TRUTH_MATRIX.md`
- score evidence links
- `AGENTS.md` checkpoint only after actual tests
- PR body with guarantees passed/failed
- exact remaining blockers and next wave entry condition
