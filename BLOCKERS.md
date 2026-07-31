# Blockers — COS Graph Engine Pipeline

> Updated: 2026-07-29T17:50:00Z
> Each blocker prevents downstream tasks from executing.

---

### B1: npm token missing
- **Type**: credential
- **Blocks**: T03 (npm publish), CI test (npm ci from registry), README install instructions
- **Unblocked by**: User runs `npm token create` on npmjs.com
- **Created**: 2026-07-29
- **Resolved**: PENDING

### B2: CI WORKING_DIR=cos (directory does not exist)
- **Type**: ci-failure
- **Blocks**: All CI runs, all PR merges, all deploys
- **Fix**: PR #2 (change WORKING_DIR from "cos" to ".")
- **Created**: 2026-07-26 (first commit)
- **Resolved**: 🟡 PR #2 created, pending merge

### B3: @cos/core v0.1.0 has 0 tests and no build
- **Type**: dependency
- **Blocks**: All packages depending on @cos/core (P1, P3, P4, P6-P14)
- **Unblocked by**: Write tests for @cos/core or inline dependencies into each package
- **Created**: 2026-07-29 (detected during audit)
- **Resolved**: PENDING

### B4: Sub-agent implement() tool blocked
- **Type**: missing-tool
- **Blocks**: All automated batch launches (Fases 1-6)
- **Unblocked by**: Fix implement() tool access on platform side
- **Workaround**: Manual execution by orchestrator agent
- **Created**: 2026-07-29
- **Resolved**: PENDING

### B5: GPG signing not available
- **Type**: missing-tool
- **Blocks**: Signed commits
- **Unblocked by**: Generate GPG key and configure git
- **Workaround**: `git commit --no-gpg-sign`
- **Created**: 2026-07-29
- **Resolved**: PENDING (workaround active)
