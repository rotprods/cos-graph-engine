# Security Policy — Higgsfield Hardness (Central)

## Scope

This security policy applies to the `rotprods/higgsfield-hardness` repository and all its artifacts — including CI/CD pipelines, scripts, policies, hooks, and QA suites. As the central repository for engineering standards across the rotprods ecosystem, every change here has downstream effects on 30+ repos.

## Data Classification

| Level | Description | Examples | Handling |
|-------|-------------|----------|----------|
| CRITICAL | Auth tokens, secrets, deploy keys | GitHub tokens, SMB API keys, deploy credentials | Encrypted at rest, gitleaks enforced, never in logs |
| HIGH | Security policies, branch protection configs | AGENTS.md, branch-protection.yml, SECURITY.md | PR required, 2 approvals, security team review |
| MEDIUM | Scripts, workflows, QA suites | recover.sh, CI/CD YAMLs, test files | 1 review required, CI green |
| LOW | Documentation, templates | README, CONTRIBUTING.md, DEPENDENCIES.md | 1 review sufficient |

## Security Requirements

### Code & Configuration
- **Zero secrets in code** — gitleaks enforces in pre-commit and CI across all repos
- **Zero direct pushes to main** — all changes via PR with 2 approvals
- **Signed commits required** — all commits GPG-signed (enforced by branch protection)
- **Linear history** — squash merge only, no merge commits on main

### Infrastructure (Branch Protection for `main`)
- Required approvals: 2 (owner + security for sensitive paths)
- Required status checks: typecheck, lint, test, build, codeql, dependency-review
- Signed commits required
- Linear history (squash merge only)
- Force push: blocked
- Deletions: blocked
- Code owner review required (CODEOWNERS)
- Conversation resolution required

### CI/CD Security
- **CodeQL SAST** — push + PR + weekly scheduled
- **Trivy** — filesystem + config vulnerability scan
- **Gitleaks** — secret detection full history on push + PR + daily
- **Dependency review** — license + vulnerability check on every PR
- **Nightly hardened audit** — full gitleaks history, dep audit, broken links, registry validation

### Data Propagation
- Policy changes in this repo are propagated to all downstream repos via automated PRs (cross-repo-sync)
- Each downstream repo receives the same AGENTS.md, pre-commit hooks, and workflows
- SECURITY.md and CONTRIBUTING.md are seeded once — repos may adapt their own versions

## Reporting a Vulnerability

**DO NOT** create a public issue for security vulnerabilities.

Contact the rotprods security team directly:
- **GitHub:** `@rotprods` (private message via GitHub Security Advisory)
- **Email:** security@higgsfield.ai
- **Repo:** Use the Security Vulnerability issue template (visible only to repo admins)

Response SLA:
- **Critical:** 24 hours to acknowledge, 7 days to fix
- **High:** 48 hours to acknowledge, 14 days to fix
- **Medium/Low:** 7 days to acknowledge, 30 days to fix

## Compliance Checklist

- [x] Pre-commit secret scanning (gitleaks) — enforced in all repos
- [x] CI/CD security scanning (CodeQL, Trivy, Dependency Review)
- [x] Branch protection (2 approvals, signed commits, linear history)
- [x] Automated PR-based policy propagation (cross-repo-sync)
- [x] GPG-signed commit history
- [x] Conventional commits enforced
- [x] Zero secrets in code — gitleaks blocks on pre-commit
- [x] Lockfile integrity verification
- [x] Security review required for sensitive paths
- [x] Automated nightly audits with full reports

## Incident Response

1. **Detect**: Monitor CI/CD failures, gitleaks alerts, and dependency vulnerability reports
2. **Contain**: Rotate exposed tokens immediately, revoke deploy keys, force-rotate SMB API keys
3. **Eradicate**: Patch the vulnerability in the central repo, propagate via cross-repo-sync
4. **Recover**: Verify downstream repos have received the fix (check PRs in each repo)
5. **Post-mortem**: Document root cause, update threat model, add regression test

## Related Documents

- `AGENTS.md` — Master protocol for all agents in the ecosystem
- `CONTRIBUTING.md` — How to contribute to this repository
- `platform/security/` — Platform-level security implementation (auth, sanitization, rate limiting)
- `workflows/hooks-monitor.yml` — Centralized hooks monitoring across 14+ repos

---

*Last updated: 2026-07-30*
*Maintainer: rotprods Security Team*
