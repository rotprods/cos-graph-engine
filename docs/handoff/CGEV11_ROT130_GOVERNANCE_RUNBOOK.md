# CGEV11 / ROT-130 — MAIN GOVERNANCE ENFORCEMENT RUNBOOK

Date: 2026-09-15
Repository: `rotprods/cos-graph-engine`
Authority: Linear `ROT-130` / GitHub `#122`

## Mission

Enforce the already-proven W3.2 promotion authorities at the repository boundary without changing PR #119 source bytes, weakening CI, or gambling on a blind legacy branch-protection overwrite.

This runbook is intentionally **operator-safe and additive**. The preferred repair is a named repository Ruleset because the current managed integration cannot read the full legacy branch-protection object. A blind `PUT /branches/main/protection` could replace settings that are currently invisible and is therefore prohibited.

## Frozen technical state

Before any governance action, all of these values must still match:

```text
main = 3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83
PR #119 head = e3e198ce01e576d30ac89b3760a52f2d8461d781
PR #119 synthetic merge = 567d84059ff024c6dbd4f2fdc09079122bc86aa1
PR #119 = OPEN / DRAFT / UNMERGED
Convergence = 34855327390 PASS
Recovery = 34855327394 PASS
```

If `main`, #119 head/base, or check identity differs, STOP. Reconcile live truth before governance promotion.

## Required aggregate checks

The qualified head exposes these aggregate checks from GitHub Actions integration id `15368`:

```text
complete
stack-complete
```

They are the minimum required status checks for CGEV11 W3.2. Supporting checks remain useful evidence but should not replace the aggregates.

## Phase 0 — Acquire correct authority

Use a GitHub user/PAT/App credential with repository **Administration: write** and repository contents/pull-request visibility.

Do not expose the token in logs, shell history, issue comments, screenshots, or generated artifacts.

Recommended environment variable:

```bash
export GITHUB_TOKEN='***'
```

Never commit it.

## Phase 1 — Snapshot before state

Persist the pre-change governance state locally/private evidence before writing anything.

```bash
mkdir -p .governance-evidence/rot130

curl -fsS -L \
  -H 'Accept: application/vnd.github+json' \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  https://api.github.com/repos/rotprods/cos-graph-engine/branches/main \
  > .governance-evidence/rot130/branch-main.before.json

curl -fsS -L \
  -H 'Accept: application/vnd.github+json' \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  https://api.github.com/repos/rotprods/cos-graph-engine/branches/main/protection \
  > .governance-evidence/rot130/legacy-protection.before.json

curl -fsS -L \
  -H 'Accept: application/vnd.github+json' \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  https://api.github.com/repos/rotprods/cos-graph-engine/rulesets \
  > .governance-evidence/rot130/rulesets.before.json

curl -fsS -L \
  -H 'Accept: application/vnd.github+json' \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  https://api.github.com/repos/rotprods/cos-graph-engine/rules/branches/main \
  > .governance-evidence/rot130/effective-main-rules.before.json
```

Record SHA-256 digests of all evidence files.

```bash
sha256sum .governance-evidence/rot130/*.before.json \
  > .governance-evidence/rot130/before.sha256
```

### STOP conditions

Stop before writing if:

- `main` moved from the frozen SHA;
- an existing ruleset already enforces equivalent or stronger rules and needs reconciliation rather than duplication;
- an existing bypass actor or organization-level rule changes the threat model;
- API readback fails or is incomplete;
- the operator cannot prove they are acting on `rotprods/cos-graph-engine`.

## Phase 2 — Validate the template offline

Canonical template:

`docs/handoff/CGEV11_MAIN_GOVERNANCE_RULESET_TEMPLATE.json`

Extract only the `githubRequest` object before POSTing; top-level `schema`, `purpose`, `apiVersion`, `policyNotes`, and `frozenEvidence` are documentation metadata, not GitHub API fields.

Example with `jq`:

```bash
jq '.githubRequest' \
  docs/handoff/CGEV11_MAIN_GOVERNANCE_RULESET_TEMPLATE.json \
  > /tmp/cgev11-main-ruleset.json

jq -e . /tmp/cgev11-main-ruleset.json >/dev/null
```

Do not modify PR #119 to carry this configuration.

## Phase 3 — Safe probe before touching main

The negative enforcement test must never gamble with `main`.

Create a disposable probe branch from the frozen `main`:

```bash
PROBE="governance-probe/rot130-$(date -u +%Y%m%dT%H%M%SZ)"
git fetch origin main
git switch --create "$PROBE" "3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83"
git push origin "$PROBE"
```

Create a **temporary clone** of the ruleset request with its condition changed from `refs/heads/main` to the exact probe ref:

```bash
jq --arg ref "refs/heads/$PROBE" \
  '.conditions.ref_name.include = [$ref] | .name = "CGEV11 Governance Probe ROT-130"' \
  /tmp/cgev11-main-ruleset.json \
  > /tmp/cgev11-probe-ruleset.json
```

Create the probe ruleset:

```bash
curl -fsS -L -X POST \
  -H 'Accept: application/vnd.github+json' \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  https://api.github.com/repos/rotprods/cos-graph-engine/rulesets \
  --data-binary @/tmp/cgev11-probe-ruleset.json \
  > .governance-evidence/rot130/probe-ruleset.created.json
```

Capture its `id`:

```bash
PROBE_RULESET_ID=$(jq -r '.id' .governance-evidence/rot130/probe-ruleset.created.json)
test "$PROBE_RULESET_ID" != null
```

### Safe direct-update negative probe

Use a normal non-bypass writer identity for this test. Do **not** use a credential that has been configured as a bypass actor.

Create a harmless commit on a separate local branch, then attempt to push it directly onto the protected probe ref. If governance works, GitHub rejects the update. If it unexpectedly succeeds, only the disposable probe branch changes; `main` remains untouched.

```bash
git switch -c "${PROBE}-mutation"
printf 'rot130 governance probe\n' > /tmp/rot130-probe.txt
git hash-object -w /tmp/rot130-probe.txt >/dev/null
# Use a normal test commit/worktree appropriate for the operator environment.
# Expected result of direct update to refs/heads/$PROBE: REJECTED by repository rules.
```

Record the rejection response as evidence. Do not treat an authentication/permission failure unrelated to rules as a valid enforcement proof.

### Probe deletion

With the same non-bypass writer identity, attempt deletion of the disposable probe ref. Expected: repository rule rejection. If deletion succeeds, record RED and recreate the branch before further analysis. Never perform this test against `main`.

### Required-check behavior

A PR targeting the probe branch should remain blocked because `complete` and `stack-complete` are not produced for that target. This is useful evidence that missing required contexts fail closed. Do not merge the probe PR.

## Phase 4 — Promote the proven ruleset definition to main

Only after the disposable probe demonstrates expected behavior should the operator create the main ruleset from the canonical request.

```bash
curl -fsS -L -X POST \
  -H 'Accept: application/vnd.github+json' \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  https://api.github.com/repos/rotprods/cos-graph-engine/rulesets \
  --data-binary @/tmp/cgev11-main-ruleset.json \
  > .governance-evidence/rot130/main-ruleset.created.json
```

Save the returned ruleset ID and URL.

No bypass actors should be present in the created CGEV11 ruleset. The owner-level break-glass path is an explicit audited ruleset change/disable operation, never an ordinary writer exemption.

## Phase 5 — Mandatory post-write readback

Read back the named ruleset and the effective rules for `main`.

```bash
MAIN_RULESET_ID=$(jq -r '.id' .governance-evidence/rot130/main-ruleset.created.json)

test "$MAIN_RULESET_ID" != null

curl -fsS -L \
  -H 'Accept: application/vnd.github+json' \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  "https://api.github.com/repos/rotprods/cos-graph-engine/rulesets/$MAIN_RULESET_ID" \
  > .governance-evidence/rot130/main-ruleset.after.json

curl -fsS -L \
  -H 'Accept: application/vnd.github+json' \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  https://api.github.com/repos/rotprods/cos-graph-engine/rules/branches/main \
  > .governance-evidence/rot130/effective-main-rules.after.json
```

Verify structurally, not visually:

- target includes `refs/heads/main`;
- enforcement is `active`;
- bypass actor list for the CGEV11 ruleset is empty;
- `pull_request` is active;
- `non_fast_forward` is active;
- `deletion` is active;
- `required_status_checks` contains exactly the mandatory aggregate authorities at minimum:
  - `complete`, integration id `15368`;
  - `stack-complete`, integration id `15368`;
- strict latest-base policy is true.

Hash the post-write evidence.

```bash
sha256sum .governance-evidence/rot130/*.after.json \
  > .governance-evidence/rot130/after.sha256
```

## Phase 6 — Reconcile legacy branch protection

The new ruleset is additive. Do **not** delete or overwrite legacy branch protection merely because the ruleset now exists.

Compare `legacy-protection.before.json` with the active ruleset. Preserve any stronger legacy protections unless there is a separately reviewed migration plan.

The only acceptable cleanup is an explicit later governance migration with its own evidence and rollback. W3.2 promotion does not require that cleanup.

## Phase 7 — Clean probe resources

After main ruleset readback is successful, remove the temporary **probe ruleset** using the admin credential and then delete the probe branch. Deletion should become possible only after the probe ruleset no longer protects it.

```bash
curl -fsS -L -X DELETE \
  -H 'Accept: application/vnd.github+json' \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  "https://api.github.com/repos/rotprods/cos-graph-engine/rulesets/$PROBE_RULESET_ID"

git push origin --delete "$PROBE"
```

Retain the probe evidence; delete only the disposable branch/ruleset.

## Phase 8 — W3.2 post-governance reconciliation

Immediately re-read:

- `main` SHA;
- PR #119 head/base;
- PR #119 draft state;
- check-run identity on #119 head;
- submitted reviews and review threads;
- active effective rules for `main`.

Decision matrix:

### A. Everything unchanged, governance active

If:

```text
main == 3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83
#119 head == e3e198ce01e576d30ac89b3760a52f2d8461d781
required check identities == complete + stack-complete / app 15368
both historical exact qualification runs remain attributable to the same source/base candidate
```

then governance changes alone do not mutate the qualified source candidate. Persist the governance receipts, close ROT-130/#122, re-evaluate ROT-87 DoD, and only then consider moving #119 from DRAFT to Ready for Review.

Do not merge automatically.

### B. Candidate identity changed

If `main`, head, base, workflow/check identity, or source bytes changed, prior qualification is stale. Keep #119 DRAFT and rerun the exact dual-gate qualification on the new candidate.

## Break-glass contract

No routine bypass actor is encoded in the CGEV11 ruleset.

Emergency action requires all of:

1. explicit owner/admin action;
2. reason recorded before or immediately after action;
3. ruleset version/history receipt;
4. scope and duration bounded;
5. restoration/readback after emergency;
6. requalification if protected source/base changed.

Never implement break-glass as a standing agent bypass.

## Why the template uses zero mandatory approvals

W3.2 requires PR-based promotion and checks/review-thread reconciliation, but the current repository evidence does not establish an independent reviewer identity capable of approving owner-authored PRs. Requiring one approval here would create a new governance dependency not authorized by the current W3.2 contract.

The template therefore requires the PR mechanism and resolved review threads while leaving approval count at zero. A separate policy decision may ratchet this to one or more approvals later; that should be a deliberate governance change, not silently introduced during W3.2 closure.

## Definition of Done

ROT-130 closes only when all are true:

- pre-change governance snapshot exists;
- probe ruleset demonstrated direct-update/deletion enforcement on a disposable ref;
- main ruleset is active;
- `complete` and `stack-complete` are required with GitHub Actions integration id `15368`;
- pull-request, non-fast-forward and deletion rules are active;
- detailed effective rules are readable and persisted;
- post-change live truth is reconciled;
- either the existing W3.2 candidate remains current or a fresh candidate has been requalified;
- GitHub #122 contains the evidence pointers;
- ROT-87 has one fewer blocker.

No deploy, production certification or global sublime seal is implied.
