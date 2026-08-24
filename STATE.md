# STATE — COS Graph Engine

Updated: 2026-08-24
Mode: **CONVERGENCE_AND_HARDENING**
Authority status: **SHADOW_ONLY / W13_CANDIDATE**
Final verification: **NOT YET EXECUTED**
Cost posture: **LOCAL_FIRST + MANUAL_GITHUB_ACTIONS_ONLY + CD_OFF**

## Current truth

The original 20D audit found exceptional breadth but uneven guarantees. W2→W12.4 now contains real implementation for the authority substrate. No 10/10 claim is valid until W13 produces machine evidence from a clean checkout.

## Active stacked hardening chain

- #18 — W0/W1 canonical truth + manual-only CI/CD posture
- #20 — W2 graph correctness
- #21 — W3 deterministic identity
- #22 — W4 bi-temporal + provenance
- #23 — W5 durable event kernel
- #24 — W6 snapshot/recovery protocol
- #25 — W7 policy/security enforcement
- #26 — W8 durable autonomous runtime
- #27 — W9 CAS + leases
- #28 — W10 resilience/change-risk runtime
- #29 — W11 scientific benchmark harness
- #30 — W12 scope-safe temporal GraphRAG
- #31 — W12.1 memory integrity
- #32 — W12.2 deterministic cold-start/governance
- #33 — W12.3 cross-wave authority integration
- current branch — W12.4 authority completion + W13 substrate

All PRs remain draft/unmerged until stack convergence and W13 evidence.

## W12.4 implemented

- deterministic `AuthorityGraphRAGIndex` with atomic projection replacement;
- `AgenticResourceRegistry → AgenticContextProjector → ContextPack` authority path;
- projection-version and projection-hash stale-context fencing;
- bi-temporal, provenance-native authority memory contracts;
- in-memory and Postgres/Supabase authority memory stores with supersession/retraction and CAS;
- external Hub snapshot stores with SHA-256 integrity and event-log recovery;
- bounded Hub project-runtime/open-loop/blast-radius/provenance query service;
- serialized `VersionedStateMachine` with expected-state/revision fencing;
- repository Hub state transitions migrated to versioned serialized dispatch;
- `AuthorityTelemetry` terminal operation evidence;
- COSServer goal execution instrumented through the authority telemetry path;
- semantic GitHub provider fixtures and duplicate-delivery contract;
- manual-only W13 qualification workflow and authority contract harness;
- canonical TypeScript build graph now includes `@cos/hub`.

## Known remaining proof/cutover work

- package-lock is expected to be stale after workspace changes; W13 preflight generates evidence and fails until the committed lock is reconciled;
- no compile/test/benchmark/replay claim has been made for W12.4 yet;
- legacy CSR and legacy GraphRAG remain for compatibility; W13 determines authority-consumer migration/deprecation;
- state-machine wrapper serializes transitions but cannot roll back arbitrary external side effects inside legacy transition callbacks;
- HTTP input guard is not a complete DNS-rebinding/egress boundary; deployment network policy remains required;
- Hub agent/workflow definition restore is intentionally fail-closed until those projections expose import contracts;
- final security, contention, corruption, restore, benchmark and fresh-agent drills remain W13.

## Current next action

1. Open the stacked W12.4 draft PR against W12.3.
2. Perform static adversarial review of W12.4 diff and repair obvious compile/API errors.
3. Persist W12.4 state to the external AGENTIC_SYSTEMS_OS control plane.
4. At the owner-selected final checkpoint, manually dispatch W13.
5. First W13 run is expected to expose lock/compile/test defects; triage them without suppressing failures.
6. Re-run until evidence is green, then re-audit 20/20 dimensions and decide stack collapse/merge order.
