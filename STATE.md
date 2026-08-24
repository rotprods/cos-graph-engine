# STATE — COS Graph Engine

Updated: 2026-08-24 17:25 Europe/Madrid
Mode: **W13_AUTHORITY_QUALIFICATION_ACTIVE**
Authority status: **SHADOW_ONLY**
Qualification branch: `hardening/w13-authority-qualification`
Qualification draft PR: **#36**
Frozen implementation parent: `hardening/w12-4-authority-closure` / #35
Actions control-plane PR: **#37**
Automatic CI/CD: **OFF**

## North Star
Bring COS Graph Engine to a demonstrable 10/10 engineering standard across all 20 audited dimensions, with machine evidence rather than narrative confidence, before it becomes authoritative infrastructure for AGENTIC_SYSTEMS_OS.

## W13 evidence work implemented before first remote run
- W12.4 architecture frozen; W13 accepts evidence-backed fixes only.
- explicit serialized `StateMachine.patchData()` / `replaceData()` replace leaked mutable context references.
- canonical graph tests, dedicated L2 suite and graph benchmark migrated to safe state setup.
- InMemoryEventLog and PostgresEventLog now share payload-bound idempotency semantics.
- true retries may regenerate transport/event IDs; conflicting logical payloads fail closed.
- InMemoryEventLog reads/cursors are copy-safe and bounded.
- W13 cross-stack authority negative suite authored.
- W13 replay/restore suite authored: cursor replay, deterministic convergence, corruption and schema mismatch.
- historically orphaned/excluded suites from PR #16 are now an explicit W13 gate, including SMB and the two old cognitive exclusions.
- strict authority typecheck and root build graph include @cos/hub.
- manual-only W13 workflow authored.
- Q0 static inspection proved `package-lock.json` is stale: root lock metadata is 0.1.0 and omits several current workspaces including @cos/hub.

## Manual Actions control plane
PR #37 changes only `.github/workflows/*`:
- CI manual-only;
- Deploy manual-only and intentionally disabled;
- Release manual qualification only, no publish;
- W13 runner manual-only with explicit target ref and benchmarks OFF by default.

PR #37 created zero workflow runs. Merge is currently blocked by the repository's healthy rule requiring one approving review from a write-enabled reviewer. This protection must not be weakened merely to bypass the gate.

## W13 first-run sequence after #37 is approved/merged
1. Run `W13 Authority Qualification` manually against `hardening/w13-authority-qualification` with `run_benchmarks=false`.
2. Q0 `npm ci` is expected to prove/reject the stale-lock diagnosis. If red, regenerate and commit the lockfile from the clean npm dependency graph; do not hand-fabricate it.
3. Re-run and proceed through build typecheck, strict authority typecheck, WASM, canonical regression, L2 authority, W13 negative suite, orphan/excluded suites and replay/recovery.
4. Triage every failure without suppression.
5. Only once correctness/security/replay are green run benchmark evidence.

## Remaining after correctness pass
- provider contract fixtures for Postgres/Supabase adapters;
- full security/contention/failure-interaction evidence;
- observability and near-miss evidence;
- benchmark distributions/SLOs;
- blind cold-agent resume;
- final 20D re-audit and score update;
- dependency-ordered merge decision with expected head SHAs.

## Current external blocker
One approving review / permitted admin merge for PR #37 is required before the default branch exposes the cost-safe manual `workflow_dispatch` runner. No product work is blocked; qualification execution is.
