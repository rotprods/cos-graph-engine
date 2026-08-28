# HANDOFF — COS Graph Engine

## Recovery point

Phase 01 and Phase 02 are statically complete. COS remains `SHADOW_ONLY / IMPLEMENTED_UNVERIFIED`.

### Phase 01

- checkpoint: `checkpoint/phase-01-reconciled-76dfdc7`
- exact SHA: `76dfdc737c231b2637f122125f7acf98b735ff1f`
- PR #40

### Phase 02

- checkpoint: `checkpoint/phase-02-contracts-06487e7`
- exact SHA: `06487e7acbce82c5a54dbb8dd171dceae2bb67ac`
- PR #43
- closure: `docs/hardening/PHASE_02_CLOSURE.md`

Source #34/#35 remain preserved. W13 #36 remains paused/non-authoritative. PR #37 remains draft/rework.

No merge, automatic Action, deployment or production data mutation has occurred.

## Read first

1. `README_FIRST.md`
2. `GOAL.md`
3. `STATE.md`
4. `SCORECARD_20D.md`
5. `TASKS.md`
6. `GRAPH.md`
7. `docs/hardening/PHASE_01_CLOSURE.md`
8. `docs/hardening/PHASE_02_CLOSURE.md`
9. `docs/hardening/ADR_INDEX.md`
10. `docs/hardening/COMPATIBILITY_MATRIX.md`
11. `docs/hardening/ROLLBACK_MAP.md`
12. `docs/hardening/TEST_EVIDENCE_MANIFEST.json`
13. `docs/hardening/DELETION_GOVERNANCE.json`
14. `AGENTS.md`

## Normative Phase 02 laws now in force

- one authority write owner per domain;
- append-only valid/system-time authority history;
- replay recorded outcomes, never re-decide historical commands;
- no exactly-once external side-effect claim before durable operation-ledger/fencing protocol;
- legacy test evidence immutable by default; authority tests additive;
- material >50-line deletion requires governance entry;
- manual CI changes cost/invocation, not verification breadth;
- public deprecation is staged;
- migration adapters must be read-only or forward directly into the single authority owner.

Executable Phase 02 gates exist but remain unexecuted:

```text
npm run check:legacy-evidence
npm run check:deletion-governance
npm run check:phase02-governance
```

## Current next phase — Phase 03 Core Correctness

Create one branch only:

`hardening/phase-03-core-correctness`

from the Phase 02 closure head after STATE/TASKS/HANDOFF synchronization.

### Exact implementation order

1. CAS deep safety
   - inspect `packages/runtime/src/concurrency.ts`;
   - prevent nested mutation through reads/snapshots;
   - reject unsupported authority CAS values;
   - add additive adversarial contract.
2. PropertyGraph read/mutation isolation
   - detached nodes/edges/query/traversal;
   - atomic secondary-index maintenance.
3. Traversal semantics
   - depth validation;
   - directed-edge behavior;
   - node/edge path consistency.
4. Identity serialization domain
   - reject unsupported JS objects/cycles/non-finite values;
   - deterministic plain-data semantics.
5. Unicode/provider identity normalization
   - explicit normalization profiles;
   - alias parity.
6. Authority CSR
   - multiedges;
   - forward+reverse CSR;
   - deterministic hash/invariants;
   - no hot-loop queue.shift().

## Phase 03 change gates

Before every material diff:

```text
legacy test touched? → waiver + ADR required
>50 deletions in file? → DELETION_GOVERNANCE entry required
public behavior changed? → compatibility + rollback update
new alternate writer? → prohibited
```

Authority tests must be additive.

## Branch law

```text
Phase 01
  └─ Phase 02
       └─ Phase 03
            └─ Phase 04
                 └─ Phase 05
                      └─ Phase 06
                           └─ Phase 07
                                └─ exact qualification SHA
                                     └─ new W13
```

No sibling authority line.

## Cost / verification

- recurring incremental cost: €0/month;
- Actions manual-only;
- CD/deploy/release OFF;
- no Assurance promotion without executed evidence.

## Rollback

- Phase 02: `checkpoint/phase-02-contracts-06487e7`
- Phase 01: `checkpoint/phase-01-reconciled-76dfdc7`
- pre-reconciliation: #33 `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`
