# CGEV11 W3.2 — GOVERNANCE BLOCKER DELTA

Date: 2026-09-15
Repository: `rotprods/cos-graph-engine`
Parent handoff: `handoff_dc8d287c-ef3b-4c42-8601-61d03806ea50`
Parent handoff PR: #121

## Why this delta exists

The 2026-09-14 post-GREEN handoff correctly classified detailed branch protection as `UNKNOWN` because the managed integration receives `403 Resource not accessible by integration` from the detailed branch-protection endpoint.

A fresh 2026-09-15 live read exposed a stronger, independently observable fact: the public branch metadata for `main` reports branch protection enabled but **no required status checks configured**.

This delta supersedes only the blocker classification. It does not supersede any technical qualification evidence from the parent handoff.

## Frozen technical authority

- live `main`: `3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83`
- W3.2 source: `integration/cgev11-w3-2-promotion-20260912`
- source head: `e3e198ce01e576d30ac89b3760a52f2d8461d781`
- PR #119: `OPEN / DRAFT / UNMERGED / mergeable:true`
- exact synthetic merge candidate: `567d84059ff024c6dbd4f2fdc09079122bc86aa1`
- Convergence run `34855327390`: 7/7 PASS
- Recovery run `34855327394`: Node22 + Node26 + exact-SHA receipt PASS
- ROT-121: DONE

Do not mutate the W3.2 source merely to resolve governance.

## New observed governance evidence

Current GitHub branch metadata for `main`:

```text
protected = true
required_status_checks.enforcement_level = everyone
required_status_checks.contexts = []
required_status_checks.checks = []
```

Therefore `protected:true` must not be interpreted as proof that W3.2 qualification is enforced before merge.

The detailed branch-protection endpoint remains unavailable to this managed integration, so the following remain unverified until an admin-capable authority reads them:

- pull-request requirement;
- approval count;
- stale review dismissal;
- CODEOWNERS requirement;
- conversation-resolution requirement;
- force-push policy;
- deletion policy;
- admin/bypass actors;
- break-glass behavior.

Visible repository rulesets remain empty through the current integration.

## Exact checks that exist on the qualified head

GitHub check-run readback on source head `e3e198ce...` exposes 10 successful GitHub Actions checks, all produced by GitHub Actions app id `15368`.

Aggregate promotion authorities:

1. `complete`
   - Convergence aggregate
   - job `104014157949`
   - run `34855327390`

2. `stack-complete`
   - Recovery exact-SHA aggregate
   - job `104013954104`
   - run `34855327394`

Supporting successful checks:

- `quality-core`
- `specialized`
- `contract`
- `docker`
- `performance`
- `coverage`
- `node22-stack`
- `node26-stack`

Minimum W3.2 repository governance must require `complete` and `stack-complete`; where GitHub supports app binding, bind them to GitHub Actions to reduce same-name spoofing risk.

## Durable tracking

GitHub blocker:

- #122 — `[P0 GOVERNANCE] Require exact CGEV11 promotion checks on main`
- https://github.com/rotprods/cos-graph-engine/issues/122

Linear blocker:

- ROT-130 — `W3.2.2 — Enforce main promotion governance + required exact checks`
- parent: ROT-87
- state: IN PROGRESS
- priority: URGENT
- ROT-130 now blocks ROT-87

Historical correctness blocker ROT-121 is DONE and has been removed from the active `blockedBy` edge on ROT-87; it remains related for provenance.

## Governance DoD

An admin-capable GitHub Settings/API authority must:

1. read and persist the full effective protection for `main`;
2. require pull-request based promotion;
3. require `complete` and `stack-complete`;
4. bind those checks to GitHub Actions where supported;
5. verify routine writers/agents cannot bypass required checks;
6. verify force-push and deletion behavior;
7. record review, stale-review and conversation-resolution behavior;
8. define/document an auditable break-glass path;
9. execute a safe negative enforcement probe proving an unqualified/direct routine path cannot reach `main`;
10. re-read `main`, #119 head/base, checks and review state after governance changes.

If `main`, #119 source bytes, the PR base or required-check identity changes, the old exact GREEN becomes stale and W3.2 must requalify before promotion.

## Current state machine

```text
W3.2_TECHNICALLY_QUALIFIED
  -> GOVERNANCE_GAP_OBSERVED
  -> ROT-130 / GITHUB-122 ACTIVE
  -> ADMIN_GOVERNANCE_READBACK_REQUIRED
  -> REQUIRED_CHECKS_ENFORCED
  -> NEGATIVE_ENFORCEMENT_PROBE
  -> POST-GOVERNANCE_LIVE_RECONCILE
  -> [if unchanged and satisfied] READY_FOR_REVIEW_DECISION
  -> [if candidate changed] REQUALIFY_EXACT_SHA
```

Current state: `ADMIN_GOVERNANCE_READBACK_REQUIRED`.

## Next-agent instruction

Do not begin another code wave. Do not rerun qualified CI without a new candidate/reason. Do not mark #119 Ready for Review while ROT-130 is unresolved.

First obtain an admin-capable read/write authority for GitHub repository governance, satisfy GitHub #122 / Linear ROT-130, and preserve evidence of the effective `main` rules. Then re-read live truth. Only if all governance conditions are satisfied and the qualified candidate remains current may ROT-87 consider moving #119 out of DRAFT.

No automatic merge, deploy, production certification or global sublime seal is authorized by this delta.
