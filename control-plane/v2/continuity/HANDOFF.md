---
authority: PROJECTION
scope: successor handoff for current COS V2 work
owner: Agentic Systems Architect
last_updated: 2026-08-30T17:30:00.000Z
source_revision: 1bc137eb6e635f55db293b402f561e420dc83c4f
supersedes: stale root HANDOFF until regeneration
status: IMPLEMENTED_UNVERIFIED
---

# HANDOFF — COS V2 Hypergraph Refactor

## Recovery point

The current control-plane branch is:

`refactor/v2-hypergraph-control-plane`

The current draft control-plane PR is:

`#55 — refactor(v2): temporal hypergraph control plane and architecture compiler`

Its runtime parent is PR #54 / `hardening/phase-05f-observed-outcome-recovery`, observed at:

`789edef87549d4f173de03f73e54f5b6193c2e98`

Main was observed at:

`3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83`

Verify all refs live before writing.

## Current session

```text
session_id: ses_43c3d959-9e6f-4f4a-8466-8df96163d4c8
claim_id: claim_688937e0-7550-46be-9c3d-8dbb6d1c891b
correlation_id: corr_94fe93d6-0f0a-4bdf-8720-acde1a88a4cf
event_watermark: 3
claim_expiry: 2026-08-31T17:30:00.000Z
unknown_external_claims: true
authority_ceiling: IMPLEMENTED_UNVERIFIED
```

Do not reuse the session ID. Create a new session and renew/supersede the claim if this execution continues after handoff.

## Read first

1. `control-plane/v2/continuity/README_FIRST.md`
2. `control-plane/v2/model/MODEL_MANIFEST.json`
3. `control-plane/v2/state/live-truth.r2.json`
4. `control-plane/v2/events/manifest.json`
5. `control-plane/v2/state/active-claims.r2.json`
6. `control-plane/v2/continuity/STATE.md`
7. `control-plane/v2/continuity/TASKS.md`
8. `ARCHITECTURE.md`
9. `LEXICON.md`
10. `SECURITY.md`
11. `RECOVERY.md`
12. `TEST_STRATEGY.md`
13. `MIGRATION.md`
14. `control-plane/v2/NEXT_ITERATION_METAPROMPT.md`

## Implemented in PR #55

- operational session/claim/event model;
- segmented append-only event ledger;
- live-truth, ContextPack and active-claim projections;
- canonical temporal-hypergraph ontology;
- shared-ID architecture graph and COS projections;
- ranked gap/risk matrix;
- decision ledger;
- ten-phase, 34-task implementation program;
- CP0–CP14 checkpoint model;
- historical regression and bug-escape graph;
- canonical architecture/security/recovery/test/migration/lexicon docs;
- zero-dependency validator/compiler;
- successor acceleration packet.

## Local execution evidence

The canonical V2 validator and compiler were executed locally against a downloaded branch workspace:

```text
node scripts/validate-v2-control-plane-v2.mjs --self-test --write
node scripts/compile-v2-control-plane-v2.mjs
node scripts/validate-v2-control-plane-v2.mjs --self-test --write
```

Observed result:

```text
validation PASS
compiler PASS
five defect-injection self-tests PASS
```

Classification:

`EXECUTED_LOCAL_UNBOUND_EXACT_SHA`

It is not runtime evidence and does not move Assurance or Authority.

## Known defects and boundaries

1. The first `program.json` draft and first validator/compiler are malformed/superseded. Use only `MODEL_MANIFEST.json` selected sources.
2. Root continuity documents remain stale until T0007 replaces/generated-sections are installed.
3. PR #54 provider outcome wrapper requires an evidence hash but does not independently recompute canonical evidence content: P0 G005.
4. Clean Phase 05 stack has not had clean install, strict typecheck or tests.
5. Native atomic filesystem broker and controlled TLS evidence are absent.
6. Provider-specific GitHub/Drive reconciliation adapters are incomplete.
7. Signal/telemetry repair is incomplete.
8. Manual CI full breadth is not yet restored.
9. Replay, empty-DB restore, contention, process-kill, security and cold-agent campaigns are not run.
10. No independent exact-head review exists.

## Next exact safe action

### Control-plane lane

1. fetch current PR #55 head and confirm no competing claim;
2. rerun validator/compiler with `COS_GIT_SHA=<exact head>` in a clean checkout;
3. commit report, generated manifest and fingerprints;
4. append `CONTROL_PLANE_VALIDATED` checkpoint event and advance watermark;
5. regenerate root continuity documents;
6. update Drive Acta + AGENTIC state and only the dedicated COS Todoist project;
7. renew or close/handoff the claim.

### Runtime lane

Only under a separate unique session, branch and exclusive claim from exact PR #54 head:

`T0501 — canonical provider-evidence verification and tamper/replay tests`.

Do not edit runtime code on PR #55.

## Hard prohibitions

- no merge;
- no automatic Actions/CD;
- no production/Supabase mutation;
- no runtime score promotion;
- no use of PR #46 as qualification source;
- no reuse of current session ID;
- no blind provider retry after execution begins;
- no root package promotion before compatibility/evidence gates.

## Rollback

PR #55 is additive. To abandon it, leave it draft/close without merge and return to exact PR #54 head. Operational history remains in the V2 event ledger and archive branches.
