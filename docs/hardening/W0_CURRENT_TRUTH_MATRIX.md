# W0 Current Truth Matrix

Generated from current open PR metadata and changed-file inventories. This is a planning artifact, not a merge authorization.

## Executive finding
The prerequisite work is not four independent clean PRs. There is visible stacking/overlap:
- PR #2 changes 20 files, including many community/docs/package files beyond the advertised CI root fix; this strongly suggests it contains earlier stacked work and should not be blindly merged as a three-workflow patch.
- PR #11 changes only `packages/api/package.json` and is the cleanest isolated prerequisite.
- PR #12 changes `packages/api/package.json` as well as L8–L11 code/tests, therefore it overlaps #11 and must be rebased/reconciled against the dependency fix.
- PR #16 changes `scripts/run-tests.ts` plus `README.md`; README overlap exists with #2 and the test wiring explicitly depends on #12 for some currently excluded suites.

## Matrix
| PR | Intended guarantee | Changed files observed | Dependency / overlap | Recommended disposition |
|---|---|---|---|---|
| #2 `fix(ci): correct WORKING_DIR from cos to root` | G-CI-004 | workflows ci/deploy/release plus README, package READMEs/configs, community templates and a phantom root entry | overlaps README/package/docs work; scope far wider than title | **Reimplement/cherry-pick only the minimal verified CI-root/phantom-directory delta**, unless full diff proves every extra file intentionally belongs |
| #11 `fix(api): align @cos/observability` | clean workspace install prerequisite | only `packages/api/package.json` | overlaps same file in #12 | **Use as first dependency fix or reapply equivalent one-line manifest correction in consolidated branch** |
| #12 `fix(graph): L8–L11 correctness` | cognitive correctness | `packages/api/package.json`, L8 knowledge, L9 semantic, L10 embedding, L11 GraphRAG, test-levels-8-11 | depends/overlaps #11; exposes previously orphaned correctness bugs | **Reproduce failing tests, reconcile package manifest with #11, then integrate fixes as a guarantee-oriented correctness commit** |
| #16 `test(ci): wire 17 orphan level scripts` | G-TEST-001 | `scripts/run-tests.ts`, `README.md` | README overlaps #2; body explicitly says L8–L11 suites depend on #12 | **Integrate after #12; keep exclusions explicit with owner/reason/exit condition; do not use raw test-count claims as proof** |

## Proposed W0/W1 dependency order
1. Establish a clean branch from current `main`.
2. Apply/reimplement #11 equivalent and prove clean workspace install.
3. Apply minimal CI root correction from #2 only after inspecting exact workflow diff; do not import unrelated stacked files by default.
4. Remove false-green required gate patterns from workflows.
5. Reproduce and integrate #12 correctness fixes with failing-before/passing-after evidence.
6. Integrate #16 test wiring after #12, including currently excluded cognitive suites where now valid.
7. Normalize benchmark methodology and forced-failure CI proof.
8. Only then produce a new authoritative baseline commit/PR.

## Known complex-system hazards
- **Stacked-PR hazard:** merging by title can silently import unrelated changes.
- **False-green hazard:** a large passing test count can coexist with orphan suites and swallowed failures.
- **Documentation drift:** README-reported counts may remain stale when the canonical runner changes.
- **Dependency drift:** #12 and #11 touch the same package manifest; merge order can reintroduce registry fallback.
- **Fix-induced coupling:** wiring more suites may expose latent failures and temporarily reduce apparent health. This is expected and must not be “fixed” by suppressing tests.

## Evidence still required from Codex
- exact diffs for #2/#11/#12/#16 against latest main
- clean-checkout install output
- canonical `npm test`/typecheck/build output
- list of every maintained orphan test after #16-equivalent wiring
- forced negative test showing CI command propagates failure
- deterministic benchmark rerun evidence

## Decision
Do not merge #2/#11/#12/#16 directly from this matrix. Treat them as evidence-bearing candidate patches and converge them into a new hardening branch with reproducible gates.
