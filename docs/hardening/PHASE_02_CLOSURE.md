# Phase 02 Closure — Contracts, Compatibility & Deletion Governance

**Status:** `COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`  
**Date:** 2026-08-28  
**Authority:** `SHADOW_ONLY`

## Frozen code/contract checkpoint

- ref: `checkpoint/phase-02-contracts-06487e7`
- exact SHA: `06487e7acbce82c5a54dbb8dd171dceae2bb67ac`
- parent Phase 01 closure head: `18319232be589899b4ef2465da41bdeb2f579e63`
- Phase 01 code rollback: `checkpoint/phase-01-reconciled-76dfdc7`

The checkpoint freezes Phase 02 implementation before governance-only closure commits. Do not move it.

## Contracts materialized

1. Legacy test evidence is immutable by default.
2. Authority tests are additive and separately identified.
3. Legacy-test changes require explicit waiver + ADR + replacement evidence + rollback.
4. Material deletion (>50 lines per file) requires machine-readable semantic governance.
5. One authority write owner exists per domain; legacy adapters cannot form a second truth path.
6. Authority temporal history is append-only across valid time/system time.
7. Replay uses recorded outcomes rather than re-deciding historical commands.
8. Exactly-once external side effects are not claimed before the Phase 05 durable protocol.
9. Manual CI changes invocation policy/cost only; verification breadth remains intact.
10. Public API deprecation is staged; replacement and removal do not occur in the same phase.

## Executable governance

- `scripts/check-test-evidence.ts`
- `scripts/check-deletion-governance.ts`
- `npm run check:phase02-governance`

These gates are implemented but have not been run in a clean checkout. They do not raise Assurance yet.

## Migration implementation

Only read-only compatibility projections were added:

- authority GraphRAG → detached legacy read snapshot;
- authority Agentic registry → detached legacy read snapshot;
- authority Hub → detached legacy repository snapshot.

A new additive authority contract deliberately mutates the returned compatibility objects and requires canonical authority state to remain unchanged.

## Normative artifacts

- `ADR_INDEX.md` + ADR-001…ADR-006;
- `TEST_EVIDENCE_MANIFEST.json`;
- `TEST_COMPATIBILITY_WAIVERS.json`;
- `DELETION_GOVERNANCE.json`;
- `COMPATIBILITY_MATRIX.md`;
- `ROLLBACK_MAP.md`;
- `PUBLIC_API_POLICY.md`.

## What Phase 02 does NOT prove

- gates compile/run;
- legacy/authority tests pass;
- runtime correctness;
- data-store parity;
- security/contention/recovery performance.

Those remain downstream evidence tasks.

## Phase 03 entry gate

Phase 03 may modify core implementation only if:

- legacy tests remain preserved or receive an explicit waiver;
- >50-line deletions receive a governance entry;
- public behavior changes update compatibility/rollback contracts;
- changes stay on one linear descendant branch.

## Next

Phase 03 — Core Correctness:

1. deep-safe CAS values;
2. PropertyGraph copy/index invariants;
3. traversal direction/depth/path invariants;
4. canonical serialization domain;
5. Unicode/provider identity normalization;
6. canonical CSR multiedges + reverse CSR + deterministic invariants.
