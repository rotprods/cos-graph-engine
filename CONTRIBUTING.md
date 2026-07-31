# Contributing to Higgsfield Hardness

## Code Review Process

Every change to `main` goes through this process:

```
1. Branch → 2. Code → 3. Pre-commit → 4. Push → 5. PR → 6. CI → 7. Review → 8. Merge
```

### 1. Branch Naming

```
<type>/<short-description>
```

Types: `feat`, `fix`, `chore`, `docs`, `ci`, `test`, `refactor`, `hotfix`, `security`

Examples:
- `feat/add-cross-repo-sync-skill`
- `fix/recover-shebang-error`
- `security/harden-gitleaks-config`
- `docs/update-fable-with-cp4-status`

### 2. Commit Messages

Strict conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

| Element | Rule |
|---------|------|
| **Types** | `feat`, `fix`, `chore`, `docs`, `ci`, `test`, `refactor`, `perf`, `hotfix`, `security` |
| **Scopes** | `hooks`, `workflows`, `scripts`, `policies`, `config`, `docs`, `platform`, `meta`, `security`, `deps`, `ci` |
| **Header** | 10-100 chars, lowercase |
| **Body** | Blank line before, max 100 chars per line |
| **Footer** | Blank line before, issue references encouraged |

Examples:
```
feat(policies): add cross-repo-sync sync manifest

Define the 16 shared files with overwrite/seed policies
for propagation to all downstream repos.

Closes #42
```

```
security(hooks): add gitleaks to pre-commit hook

Enforce secret scanning before every commit across
all repos in the ecosystem.
```

```
ci(workflows): add nightly hardened audit

Runs full gitleaks history scan, dependency audit,
broken link check, and registry validation daily.
```

### 3. Pre-commit Checks (automatic)

- Secret scanning (gitleaks)
- Lint-staged (eslint + prettier)
- TypeScript typecheck (where applicable)
- Build verification

### 4. Pre-push Checks (automatic)

- Blocks direct pushes to main
- Validates branch name convention
- Warns about unstaged changes
- Confirms signed commits

### 5. Pull Request Requirements

- Title follows conventional commits format
- Description with: **¿Qué?** (what changed) / **¿Por qué?** (why) / **Verify** (how to test)
- Screenshots for UI changes (if applicable)
- Security review required for sensitive paths
- No draft PRs for security changes
- All conversations must be resolved before merge

### 6. CI Status Checks (all required)

- typecheck ✅
- lint ✅
- test ✅
- build ✅
- codeql ✅
- dependency-review ✅
- gitleaks ✅

### 7. Code Review Requirements

- **2 approvals required** (owner + security for sensitive paths)
- Code owner review required (CODEOWNERS)
- Maker ≠ checker (author cannot approve their own PR)
- Last push requires re-approval
- 24-hour minimum merge window for non-urgent changes

### 8. Merge Requirements

- Linear history (squash merge only)
- Signed commits
- All status checks passing
- All conversations resolved
- Branch up to date with main

## Security Review

Changes to these paths require additional security review:

| Path | Reason |
|------|--------|
| `.github/workflows/*` | CI/CD pipeline changes affect all downstream repos |
| `policies/AGENTS.md` | Master agent protocol governs all repos |
| `hooks/.githooks/pre-commit` | Pre-commit hook enforced across all repos |
| `config/repos.json` | Inventory of monitored repos |
| `SECURITY.md` | Security policy |
| `commitlint.config.js` | Commit policy enforcement |

## Definition of Done (DoD)

A contribution is considered complete when:

- [ ] Code follows the repository's style and conventions
- [ ] All CI checks pass (typecheck, lint, test, build, codeql, dependency-review)
- [ ] At least 2 approvals received (with security review if applicable)
- [ ] All conversations resolved
- [ ] Branch is up to date with main
- [ ] Commit message follows conventional commits format
- [ ] Changes are properly documented (README, FABLE, or inline docs)
- [ ] Downstream impact assessed (does this change affect sync-manifest repos?)
- [ ] If adding a new shared file, update `sync-manifest.json`
- [ ] If removing a shared file, update `sync-manifest.json` and notify downstream repos
- [ ] PR merged with squash + signed commit

## Downstream Impact

This is the **central repository** for the rotprods ecosystem. Changes here can affect 30+ downstream repos. Consider:

- **AGENTS.md changes** → propagate to all repos via cross-repo-sync
- **Hook changes** → all repos with `.githooks/` get the update
- **Workflow changes** → only repos without their own version get the seed
- **Script changes** → all repos with `tools/` scripts get the update

**If your change affects shared files, add the `sync` label to the PR** so the cross-repo-sync bot can track it.

---

*Last updated: 2026-07-30*