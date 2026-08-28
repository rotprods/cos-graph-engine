# Rollback Map — COS Authority Program

Rollback is defined before authority promotion. A code revert is not sufficient when durable events/data have been written; each domain states its data/replay implications.

## Global anchors

- Pre-reconciliation: #33 `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`
- Phase 01 code checkpoint: `checkpoint/phase-01-reconciled-76dfdc7` / `76dfdc737c231b2637f122125f7acf98b735ff1f`
- Phase 01 source evidence: PR #34 + PR #35 preserved and unmerged
- Production authority: NONE at Phase 02; no production data migration has occurred

| Domain | Authority surface | Code rollback | Data/event rollback semantics | Operational rollback |
|---|---|---|---|---|
| State | `AuthorityStateMachine` | Phase 01 checkpoint or legacy L2 shadow path | no durable state DB migration yet; recorded outcome events must not be deleted | disable authority workflow routing; preserve events for diagnosis |
| Agentic registry | `AuthorityAgenticRegistry` | Phase 01 checkpoint | current implementation in-memory; future durable revisions must be replayed, not rewritten | return consumers to read-only Drive/registry mirror |
| GraphRAG | `AuthorityGraphRAGIndex` | Phase 01 checkpoint; legacy L11 remains present | projection is rebuildable from source registry/evidence | rebuild shadow projection using last accepted source cursor/hash |
| ContextPack | `AuthorityContextPackCompiler` | legacy compiler remains available | packs are evidence artifacts; never mutate historical sealed packs | stop authority pack issuance; retain existing hashes/provenance |
| Hub runtime | `AuthorityHub` | Phase 01 checkpoint; `CosHub` remains shadow | command/outcome event history is canonical evidence; do not delete outcomes to force state | disable authority command ingestion; rebuild shadow state from outcomes |
| Hub snapshot | `AuthorityHubSnapshotManager` | Phase 01 checkpoint | `cos_hub.authority_snapshots` is additive; snapshots may be ignored but not rewritten | restore from last verified snapshot/event cursor or rebuild from event log |
| Memory | `AuthorityMemoryGateway` + stores | Phase 01 checkpoint | append-only revisions/relations must be preserved; current view can be rebuilt for any `knownAt` | stop new authority writes; switch reads to last verified projection or shadow cache |
| Memory Postgres | `cos_memory.authority_revisions/relations` | adapter revert only | tables are additive and immutable by contract; never destructive rollback data | revoke writer permission / stop service, retain tables for replay |
| Event log | `IEventLog` / Postgres candidate | adapter revert | durable accepted events cannot be silently removed; repair uses compensating/corrective events | stop producers, snapshot log, recover adapter, replay projections |
| Tools/side effects | strict runtime; future operation ledger | disable capability path | external effects may be irreversible; use operation ledger + compensation policy once implemented | fail closed / manual operation mode |
| Policy | future enforced policy path | revert policy version only with evidence | decisions/events remain audit evidence | switch affected capability to deny/manual approval, not allow-all |
| Observability | `AuthorityTelemetry` | disable observer | telemetry data may be dropped without changing truth; never change operation outcome | use no-op observer while preserving authority operation |
| CI/CD | manual qualification | restore workflow category definitions from history | no production data implication | disable workflow dispatch; CD remains off |

## Schema rollback law

Authority migrations should prefer additive schemas/tables/columns until qualification. Destructive rollback is prohibited unless:

1. data has been snapshotted/exported;
2. restore has been demonstrated;
3. the migration ADR explicitly allows destruction;
4. independent review accepts the blast radius.

## Event rollback law

Events are evidence. Correct a bad accepted event by appending a corrective/retraction/compensation event according to domain semantics; do not delete history to make replay pass.

## Emergency degraded mode

If a new authority candidate behaves unexpectedly before promotion:

```text
stop authority writes
→ preserve event/data evidence
→ route reads to last verified/shadow projection where safe
→ diagnose blast radius
→ apply smallest reversible fix
→ rebuild/replay
→ only then resume writes
```

Fail-open promotion is prohibited.
