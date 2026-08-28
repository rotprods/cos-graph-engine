# HANDOFF — COS Graph Engine

## Recovery point

Phases 01–04 are statically complete. COS remains `SHADOW_ONLY / IMPLEMENTED_UNVERIFIED`.

### Frozen lineage

- Phase 01: `checkpoint/phase-01-reconciled-76dfdc7` → `76dfdc737c231b2637f122125f7acf98b735ff1f` — PR #40
- Phase 02: `checkpoint/phase-02-contracts-06487e7` → `06487e7acbce82c5a54dbb8dd171dceae2bb67ac` — PR #43
- Phase 03: `checkpoint/phase-03-core-ad6a93c` → `ad6a93c0b2986c36efefb5cd59a4d14a9dffceb3` — PR #44
- Phase 04: `checkpoint/phase-04-temporal-event-bedfec6` → `bedfec6b8ea147c91ac7d50a888c38b0439d53ff` — PR #45

The Phase 04 branch continued after the code checkpoint only for rolling control-plane synchronization. Do not move the checkpoint ref.

Source #34/#35 remain preserved. W13 #36 remains paused/non-authoritative. PR #37 remains draft/rework. No merge, automatic Action, deployment or production data mutation has occurred.

## Read first

1. `README_FIRST.md`
2. `GOAL.md`
3. `STATE.md`
4. `SCORECARD_20D.md`
5. `TASKS.md`
6. `GRAPH.md`
7. `docs/hardening/PHASE_01_CLOSURE.md`
8. `docs/hardening/PHASE_02_CLOSURE.md`
9. `docs/hardening/PHASE_03_CLOSURE.md`
10. `docs/hardening/PHASE_04_CLOSURE.md`
11. `docs/hardening/ADR_INDEX.md`
12. `docs/hardening/COMPATIBILITY_MATRIX.md`
13. `docs/hardening/ROLLBACK_MAP.md`
14. `docs/hardening/TEST_EVIDENCE_MANIFEST.json`
15. `docs/hardening/DELETION_GOVERNANCE.json`
16. `docs/hardening/AUTHORITY_SURFACE_MANIFEST.json`
17. `AGENTS.md`

## Phase 04 completed-static guarantees

### Durable event contract
- InMemory/Postgres share one payload-bound logical-event projection/hash.
- Same logical retry converges despite attempt-local ID/trace/span/recordedAt changes.
- Conflicting key reuse and event-ID reuse fail closed.
- Accepted events/read results are detached.
- Fake Postgres covers transaction/conflict parity.

### Canonical persistence wire
- canonical JSON wire v1 is explicit;
- optional object `undefined` is omitted only at the wire boundary;
- invalid/ambiguous JS values fail closed;
- NFC normalization and normalized-key collision rejection;
- SHA-256 covers the exact persisted wire value.

### Knowledge authority
- `AuthorityKnowledgeGateway` + append-only stores own candidate truth;
- valid time and system time are independent;
- late correction/closure cannot leak into earlier `knownAt`;
- PropertyGraph is a rebuildable projection;
- projection failure becomes explicit degraded saga evidence and is retry-repairable;
- Postgres candidate uses advisory lock + revision CAS + INSERT-only history.

### Hub recovery
- Hub logical/projection hashes are canonical-wire stable;
- transaction-time retry may arrive later without redefining logical command identity;
- snapshot envelope has schema + serialization version;
- SHA-256 covers exact JSONB wire payload;
- runtime hydration preserves semantic/integrity hashes;
- snapshot + command/outcome tail rebuilds empty projection;
- corruption/version/tamper/log-behind failures are explicit.

All contracts remain unexecuted. Assurance did not move.

## Next phase — Phase 05 Security / Concurrency / Agent Runtime

Create exactly one descendant branch:

`hardening/phase-05-security-concurrency-runtime`

from the **synchronized current Phase 04 branch head**, while retaining `checkpoint/phase-04-temporal-event-bedfec6` as the immutable implementation rollback point.

### Exact implementation order

1. Durable side-effect ledger
   - canonical operation identity from principal/project/resource/capability/request hash;
   - immutable attempts and outcomes;
   - explicit `uncertain` crash window;
   - accepted retry convergence and conflict rejection;
   - in-memory + Postgres/Supabase candidates.
2. Resource fencing
   - monotonic resource fence;
   - validate at protected resource commit boundary;
   - stale worker rejection + near-miss evidence.
3. Lease lifecycle
   - acquire/renew/release/expire/reacquire;
   - bounded TTL and deterministic clock;
   - crash/orphan recovery.
4. Durable goal aggregate
   - immutable goal/plan/step/result history;
   - restart without repeating accepted side effects;
   - explicit compensation/waiver for partial completion.
5. Policy enforcement
   - principal/project/sensitivity context;
   - real server/retrieval/memory/tool/workflow/destructive boundaries;
   - unknown field/operator/action fails closed;
   - durable approvals.
6. Deployment isolation
   - HTTP/DNS/egress + filesystem sandbox contract;
   - rebinding/private-network/symlink/TOCTOU cases.
7. Near-miss evidence
   - duplicate/stale/lease/policy/uncertain/compensation signals;
   - observer failure cannot change protected outcome.

## Hard safety rules

- do not claim exactly-once provider effects;
- idempotency-key presence is not durable idempotency;
- fencing-token presence is not commit-boundary validation;
- do not auto-retry when provider outcome is unknown;
- state-machine rollback cannot undo external side effects;
- no alternate authority tool/runtime path may bypass the operation ledger;
- no legacy test rewrite without waiver+ADR;
- material deletion requires deletion-governance entry;
- no automatic Actions/CD;
- no Assurance score movement before execution.

## Branch law

```text
Phase01 → Phase02 → Phase03 → Phase04 → Phase05 → Phase06 → Phase07
                                                                  ↓
                                                     exact qualification SHA
                                                                  ↓
                                                               new W13
```

## Cost / verification

- recurring incremental infrastructure cost: `EUR 0/month`;
- Actions manual-only;
- CD/deploy/release OFF;
- Codex optional only for shell-heavy work;
- GitHub/Drive/Todoist remain the cross-plane control system.

## Rollback

- Phase04 implementation: `checkpoint/phase-04-temporal-event-bedfec6`;
- Phase03: `checkpoint/phase-03-core-ad6a93c`;
- Phase02: `checkpoint/phase-02-contracts-06487e7`;
- Phase01: `checkpoint/phase-01-reconciled-76dfdc7`;
- pre-reconciliation: #33 `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`.