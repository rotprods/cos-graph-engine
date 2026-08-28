# Compatibility Matrix — Legacy → Authority

**Authority status:** SHADOW_ONLY  
**Removal policy:** no legacy surface is removed before qualification evidence and explicit migration acceptance.

| Domain | Legacy/current surface | Authority candidate | Legacy status | May write authority truth? | Migration rule | Removal gate |
|---|---|---|---|---|---|---|
| State | `StateMachine` / L2 state APIs | `AuthorityStateMachine` | SHADOW_COMPAT | NO | new authority workflows use explicit state/revision fencing; legacy remains for old graph consumers | legacy+authority tests green, API migration inventory zero unresolved writers |
| CAS/concurrency | shallow-copy `VersionedStore` / idempotency records | copy-safe `VersionedStore` + detached idempotency records | BEHAVIOR_TIGHTENED | reference store only | callers must treat reads/receipts as snapshots; nested mutation no longer mutates canonical state | legacy+authority concurrency tests + Phase 05 durable protocol |
| Property graph | mutable read/query/traversal objects; reverse traversal of directed incoming edges | copy-safe `PropertyGraph` with exact hop/direction/path invariants | BEHAVIOR_TIGHTENED | derived graph only unless explicitly selected | callers must use update APIs rather than mutating returned objects; directed edges traverse source→target only; depth=0 returns origin path | legacy graph suite + additive PropertyGraph contract + caller inventory |
| Agentic topology | `AgenticResourceRegistry` | `AuthorityAgenticRegistry` | SHADOW_COMPAT | NO | project/chat/task/decision topology authority uses revisioned registry | parity + scope/sensitivity + replay evidence |
| GraphRAG | `GraphRAGEngine` | `AuthorityGraphRAGIndex` | SHADOW_COMPAT | NO | legacy mutable corpus may serve demos/read-only compatibility; canonical projection replaced atomically | gold-query + leakage + replay/hash evidence |
| Context | `ContextPackCompiler` | `AuthorityContextPackCompiler` | SHADOW_COMPAT | NO | authority packs require explicit `asOf/knownAt/generatedAt` and exact projection version/hash | pack parity + tamper/staleness/non-leakage evidence |
| Hub repo runtime | `CosHub` | `AuthorityHub` | SHADOW_COMPAT | NO | new authority repo state uses command+outcome event protocol | event/replay/recovery evidence + no legacy authority writers |
| Hub query | ad-hoc Hub/registry queries | `AuthorityHubQueryService` | DEPRECATED_PATTERN | NO | queries require explicit valid/system time and sensitivity | query contract + cold-agent evidence |
| Hub context projection | older context projectors | `AuthorityHubContextProjector` | SHADOW_COMPAT | NO | source registry → atomic authority GraphRAG → verified ContextPack | projection parity + no cross-project leakage |
| Hub recovery | legacy snapshot/recovery helpers | `AuthorityHubSnapshotManager` | SHADOW_COMPAT | NO | sealed snapshot + tail outcome replay; other domains restore separately | corrupted snapshot + empty projection restore evidence |
| Memory | `MemoryManager` | `AuthorityMemoryGateway` | CACHE/SHADOW | NO | epistemic truth uses append-only revision ledger; legacy manager can remain cache/compat | validAt/knownAt + retry + Postgres parity evidence |
| Durable memory DB | `PostgresMemoryStore` current-row model | `PostgresAuthorityMemoryStore` | NON_AUTHORITY_COMPAT | NO | authority writes are INSERT-only immutable revisions/relations | transaction/concurrency/restore fixtures |
| Event transport | `EventBus` | `IEventLog` / `PostgresEventLog` for accepted history | COMPLEMENTARY | NO | EventBus remains bounded delivery/observation transport; event log owns durable causal history | event-log replay + idempotency parity evidence |
| Tool runtime | permissive historical ToolRegistry/SearchTool behavior | strict ToolRegistry/SearchTool behavior | BEHAVIOR_TIGHTENED | only through future operation ledger | callers must handle structured failures and duplicate registration errors | security/side-effect qualification |
| Observability | generic tracing/collector | `AuthorityTelemetry` on authority paths | COMPLEMENTARY | NO | telemetry observes authority operations and may never alter protected outcome | telemetry-failure isolation evidence |
| Identity | `generateId()` on durable logical entities | canonical URI / deterministic identity | EPHEMERAL_ONLY | NO | random IDs remain valid for genuinely ephemeral instances only | durable aggregate migration inventory |
| Integrity | `stableHash128` used as generic hash | `sha256Hex` for integrity; stable hash for identity/projection keys | SPLIT_SEMANTICS | N/A | never treat compact deterministic hash as cryptographic evidence | snapshot/evidence verification tests |

## Compatibility classes

### SHADOW_COMPAT
Public symbol may remain callable for existing consumers, but must not be connected as an authority writer.

### CACHE/SHADOW
May hold derived/rebuildable state. Loss or divergence cannot redefine canonical truth.

### COMPLEMENTARY
Not replaced; responsibility is narrowed so it cannot conflict with the authority owner.

### BEHAVIOR_TIGHTENED
Same public family but invalid/unsafe historical behavior now fails closed. Migration requires callers to handle the stricter result.

## Adapter rule

Allowed:

```text
legacy input → validate/normalize → authority owner
legacy read  ← copy/transform    ← authority owner
```

Forbidden for an assigned authority domain:

```text
legacy API → independent mutation → separate legacy store/projection
```

## Qualification requirement

Before a legacy authority-adjacent surface can be retired:

1. no unresolved production/canonical caller writes through it;
2. legacy evidence remains green;
3. authority contract/evidence is green;
4. rollback remains possible;
5. independent review accepts the exact migration diff.
