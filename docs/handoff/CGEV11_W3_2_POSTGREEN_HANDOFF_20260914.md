# CGEV11 W3.2 — POST-GREEN COLD-START HANDOFF

Date: 2026-09-14
Repository: `rotprods/cos-graph-engine`

## Identity

- `HANDOFF_ID = handoff_dc8d287c-ef3b-4c42-8601-61d03806ea50`
- `CORRELATION_ID = corr_8474281b-5855-43c5-9192-8d95efe7605e`
- `CLAIM_ID = claim_33af7677-6de7-4217-a828-6043b7ef1a87`
- `HANDOFF_BRANCH_ID = branch_e8b78d9f-39f6-4261-896f-c833edd178e6`
- platform-internal ChatGPT session/chat IDs remain `NOT_EXPOSED`; never fabricate them.

## Exact repository state

- live `main`: `3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83`
- W3.2 branch: `integration/cgev11-w3-2-promotion-20260912`
- W3.2 source head: `e3e198ce01e576d30ac89b3760a52f2d8461d781`
- PR: `#119`
- PR state: `OPEN / DRAFT / UNMERGED / mergeable:true`
- exact synthetic merge candidate: `567d84059ff024c6dbd4f2fdc09079122bc86aa1`

The source branch MUST NOT be changed unless a new repository defect is proven. Any source-byte mutation invalidates all exact-candidate GREEN evidence below.

## What this iteration repaired

The prior Recovery Node22 anti-bypass gate scanned `W1D_SHA...HEAD` and matched the already-qualified W2 AST security checker's own diagnostic literals. The semantic AST checker had already passed; this was a control-plane detector self-hit.

Bounded repair:

- commit `ac4077bf688cfcf0a078a07239b24ff793a7cc38`
- only the coarse textual new-bypass diff changed to `W2_SHA...HEAD`
- full `W1D_SHA...HEAD` mutation allowlist preserved
- W2 AST production-security checker preserved and rerun
- workflow fail-open scanner preserved
- no product, test, coverage-floor, audit, runtime or sandbox weakening

Evidence update commit: `e3e198ce01e576d30ac89b3760a52f2d8461d781`.

Immediately before CI, `W2_SHA...HEAD` contained exactly four authorized W3.2 paths:

1. `.github/workflows/cgev11-stack-integration.yml`
2. `docs/hardening/integration/W3_2_PROMOTION_EVIDENCE.md`
3. `packages/graph/src/pipeline-l4l5l6.ts`
4. `scripts/test-pipeline-l45l6.ts`

## Exact qualification — PASS

### COS Main Convergence Gate

Run: `34855327390`
Candidate: `567d84059ff024c6dbd4f2fdc09079122bc86aa1`
Result: `7/7 PASS`

- quality-core `104013382578`
- specialized `104013382726`
- contract `104013382818`
- docker `104013382855` — production runtime/privilege smoke + production HTTP health PASS
- performance `104013382958`
- coverage `104013383045`
- complete `104014157949`

Coverage artifact:
- ID `10352074720`
- digest `sha256:7dbd3d6ca4064f596ff3657635b4e29999333a4a4015266f19a20b22f045f7c6`

### CGEV11 Recovery Stack Integration

Run: `34855327394`
Candidate: `567d84059ff024c6dbd4f2fdc09079122bc86aa1`
Result: `PASS`

- Node22 `104013326571` PASS
- Node26 `104013326232` PASS
- exact-SHA stack receipt `104013954104` PASS

Node22 proved:

- exact ancestry
- Node `22.12.0`
- pinned sandbox TCB `node@sha256:ef24c5053d50fdc3e4e56eb4e7ddb7861874ab0fdc797046ba897581deb8e868`
- strict TypeScript PASS
- W1B / W1C / W1D PASS
- W2 operator/auth `10/10` PASS
- W2 HTTP trust boundary `18/18` PASS
- W2 production-security AST PASS
- deterministic W3.2 L4→L5→L6 timing regression `69 passed, 0 failed`
- full canonical suite PASS
- integrated coverage PASS
- HIGH audit `0 vulnerabilities`
- workflow-safety PASS
- repaired anti-bypass PASS
- unchanged full W1D→HEAD mutation allowlist PASS

Integrated coverage:
- statements `80.74`
- branches `80.09`
- functions `86.15`
- lines `80.74`
- floor `80.05 / 80.05 / 85.80 / 80.05`

Recovery artifacts:

- Node22 `10351499914` — `sha256:54cc1a229ebf7b97c11eface87f1155a3a50b465230bde64500cc9c73c785442`
- Node26 `10352477614` — `sha256:aaa495f79b6301a04bbd1c01f4eb3ad3c2622a1de9ac2e66cc93ab6717ae141d`
- receipt `10353006034` — `sha256:04a77f30347c6d47f28d6d720a00100208b75bf0d7b8f085f097a2403ac99382`

## Post-GREEN reconciliation

After both gates completed:

- live `main` was re-read and remained exactly `3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83`
- #119 remained `mergeable:true`
- submitted reviews: none
- unresolved review threads: none
- visible repository rulesets: `[]`
- GitHub branch metadata reports `main protected:true`
- detailed branch-protection endpoint returns `403 Resource not accessible by integration`

Therefore repository technical qualification is PASS, but detailed promotion-protection authority is `UNKNOWN`, not PASS.

## Linear

- `ROT-121` — DONE. The deterministic structured-trace timing repair is proved on the final exact candidate under Node22 and Node26.
- `ROT-87` — IN PROGRESS. Technical qualification complete; promotion authority visibility remains the blocker.
- `ROT-23` — IN PROGRESS, still blocked by ROT-87.

## Do not do

- do not modify source bytes merely to record this checkpoint;
- do not rerun CI without a new reason;
- do not mark protection PASS from `protected:true` alone;
- do not merge #119 while detailed promotion authority is unknown;
- do not deploy;
- do not claim production certification;
- do not claim `CGEV11_SUBLIME_STATE_VERIFIED`.

## Next-agent metaprompt

```text
CGEV11 W3.2 POST-GREEN AUTHORITY CLOSURE

Start by re-reading live main, W3.2 source head, PR #119, ROT-87 and ROT-23. Expected checkpoint: main=3ae197e..., source=e3e198ce..., exact qualified synthetic SHA=567d8405.... If source or main moved, stop and reconcile; never transplant GREEN to new bytes.

Do not change repository source. The exact candidate has already passed Convergence 34855327390 (7/7) and Recovery 34855327394 (Node22, Node26 and exact-SHA receipt), including Docker production HTTP, performance, W1B/W1C/W1D/W2, deterministic timing, coverage 80.74/80.09/86.15/80.74, HIGH audit zero, workflow safety and anti-bypass.

The only known blocker is detailed branch-protection/promotion authority. GitHub reports main protected:true, but the current integration receives 403 from the detailed protection endpoint; visible repo rulesets are empty. Treat protection as UNKNOWN.

Your mission is authority closure, not another code wave:
1. recover/observe the effective main protection requirements through an authorized surface;
2. verify whether required reviews/status checks/restrictions are satisfied by #119 and exact candidate 567d8405...;
3. re-read reviews/threads and main immediately before any state transition;
4. if and only if protection authority is fully observable and satisfied, update ROT-87 according to its DoD and move #119 from DRAFT to Ready for Review if the W3 parent contract permits;
5. do not merge automatically, deploy, production-certify or issue the global sublime seal;
6. if protection remains unobservable, keep fail-closed state and persist that external authority blocker without touching qualified source bytes.

Observed > assumed. Exact SHA > branch badge. No stale GREEN. No oracle weakening. No source mutation unless a fresh repository RED proves it necessary.
```

## Resume point

> Repository correctness and exact-candidate W3.2 qualification are GREEN. The next operation is not code repair: it is obtaining authoritative visibility of effective `main` protection and determining whether #119 may leave DRAFT. Until that authority is observable, remain fail-closed.
