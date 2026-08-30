---
authority: PROJECTION
scope: COS V2 current state, tasks, handoff, graph and agent protocol
owner: Agentic Systems Architect
last_updated: 2026-08-30T10:08:00Z
source_parent_revision: e2a4931beed71248677e2eef0a3cde814608ba0c
status: IMPLEMED_UNVERIFIED
---

# CURRENT V3 — COS Coordination Integration

## State

```text
main: 3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83
PR #55 control-plane ancestor: f2b90d083a0eed82f0e099c87a04c4125445976f
PR #56 coordination implementation: a49d1a6ec9e6bfb7c02e22465e1672f439b82354
PR #56 exact-SHA evidence commit: e2a4931beed71248677e2eef0a3cde814608ba0c
PR #57 integration candidate observed head: e2a4931beed71248677e2eef0a3cde814608ba0c
PR #54 runtime candidate: 789edef87549d4f173de03f73e54f5b6193c2e98
authority: SHADOW_ONLY
merge authorization: DENIED
automatic Actions / CD / deploy: OFF
```

PR #56 and PR #57 were created after the earlier observation that they did not exist. Their later existence does not retroactively validate the former narrative. PRs #58–#61 and all alleged T0501–T0703 runtime evidence remain `NOT_RUN / UNPROVEN`.

## Session and claim

```text
session: ses_dd08194b-e8fc-48f3-9dc7-e4a37c3d5b05
claim: claim_2d82507f-d8b9-4c85-bc40-1a57756f1bc3
claim revision: 3
fencing token: 3
expected pre-mutation head: e2a4931beed71248677e2eef0a3cde814608ba0c
event watermark: 11
```

A successor must not reuse this session or claim after the branch moves or the claim expires.

## Graph

```text
main
 └─ runtime stack → PR #54
      └─ V2 control plane → PR #55
           └─ coordination kernel → PR #56
                ├─ exact evidence commit e2a4931
                └─ current integration candidate → PR #57
```

`AuthorityRef` is unassigned. Candidate, evidence, projection and authority are distinct nodes.

## Next safe sequence

1. Validate V3 bundle, continuity fences and hash-chained events.
2. Delete/rebuild the disposable control-plane state and verify the expected hash.
3. Commit the implementation atomically from exact parent `e2a4931...`.
4. Rerun with `COS_GIT_SHA=<implementation SHA>`.
5. Persist exact evidence on an immutable evidence ref.
6. Obtain independent exact-head review.
7. Only then create a real runtime qualification branch.

## Runtime blockers

Clean install, strict runtime typecheck, build, WASM, full regression, orphan suites, Postgres, provider timeout-after-acceptance, contention, process-kill, replay, empty-database restore, security and benchmarks remain `NOT_RUN`.

## Agent law

Every material write requires a unique session, active scoped claim, expected claim revision, monotonic fencing token and exact expected branch head. Narrative and ContextPacks are acceleration only.

Authority status: `SHADOW_ONLY`.
