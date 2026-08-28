# Phase 01 — API / Behavior Diff: Legacy → Authority Candidate

Status: `IMPLEMENTED_UNVERIFIED`  
Branch: `hardening/canonical-authority-reconciliation`  
PR: #40  
Rule: this document records intended observable behavior; it is not evidence that the implementation passes.

## 1. State machine

| Surface | Legacy | Authority candidate |
|---|---|---|
| API | `StateMachine` | `AuthorityStateMachine` |
| mutation | transition queue plus legacy mutation semantics | one serialized queue for transition and data mutation |
| context reads | historical callers could rely on mutable patterns | clone-safe reads |
| concurrency | no authority revision fence | expected state + expected revision |
| callback failure | legacy semantics varied | callbacks run against staged copy; canonical commit only after full internal success |
| replay identity | generated/ephemeral by default | durable callers supply canonical machine ID + definition revision |
| timestamps | implicit clock common | authority callers can inject/record exact occurrence time |

Migration: legacy remains shadow. Authority callers must persist/restore snapshots with the exact definition revision.

## 2. Agentic resource registry

| Surface | Legacy | Authority candidate |
|---|---|---|
| API | `AgenticResourceRegistry` | `AuthorityAgenticRegistry` |
| identity | canonical URI available | canonical URI + replay-conflict enforcement |
| mutation | mutable current projection | append-only transaction-time revisions |
| concurrency | no whole-projection fence | object revision CAS + projection CAS |
| temporal query | primarily valid-time/current data | explicit `asOf` + `knownAt` |
| sensitivity | scoped current projection | revision-aware scope/sensitivity filtering |
| relations | deterministic topology but weaker revision semantics | deterministic parallel identity + relation revision history |

Migration: context/query authority paths must consume the authority registry only.

## 3. GraphRAG

| Surface | Legacy | Authority candidate |
|---|---|---|
| API | `GraphRAGEngine` | `AuthorityGraphRAGIndex` |
| writes | incremental `addEntity/addRelation/addChunk` | complete atomic `replaceProjection` |
| relation IDs | random `generateId()` | deterministic identity or explicitly supplied canonical ID |
| concurrency | mutable arrays | expected projection version/hash CAS |
| scope | scoped retrieval available | project + sensitivity + valid-time + known-time enforced before ranking |
| replay | incremental write order can change identity | canonical sort + deterministic projection hash |
| provenance | optional in legacy records | mandatory on authority evidence |

Migration: legacy L11 remains usable for demos/shadow compatibility only. It must never mutate authority truth.

## 4. ContextPack

| Surface | Legacy | Authority candidate |
|---|---|---|
| API | `ContextPackCompiler` | `AuthorityContextPackCompiler` |
| retriever | legacy concrete GraphRAG path | `AuthorityScopedRetriever` only |
| generated time | implicit wall clock | explicit `generatedAt` |
| domain/system time | `asOf`; weaker system-time contract | explicit `asOf` + `knownAt` |
| staleness | version fence | exact projection version + projection hash fence |
| evidence | deterministic compact hash | deterministic evidence hash + SHA-256 pack integrity |
| privacy | dependent on retriever | scope/sensitivity asserted again before rendering |

Migration: model/agent authority handoffs use only the authority compiler.

## 5. Hub repository runtime

| Surface | Legacy | Authority candidate |
|---|---|---|
| API | `CosHub` | `AuthorityHub` |
| event model | repository event stored then state transition interpreted | registration + command + accepted/rejected outcome are distinct durable facts |
| replay | could re-run transition interpretation | applies recorded outcome snapshots; no historical re-decision |
| concurrency | state transition serialized locally | complete command→transition→outcome serialized per repo |
| incomplete write | command could exist without authority outcome semantics | retry/snapshot/replay fail closed on command-without-outcome |
| outcome store failure | potential partial state | in-memory transition rolled back before repo queue releases |
| identity | canonical repo ID | canonical repo ID + command/outcome logical hashes and causation checks |
| snapshot hash | historical implementations mixed cursor/state concerns | semantic state hash excludes cursor/creation time; envelope SHA-256 covers snapshot artifact |

Migration: legacy Hub remains shadow until W13 proves replay/recovery parity.

## 6. Hub query / context

New authority surfaces:

- `AuthorityHubQueryService` — requires explicit `asOf` + `knownAt`; exposes runtime/open-loop/blast-radius/provenance views.
- `AuthorityHubContextProjector` — `AuthorityAgenticRegistry → AuthorityGraphRAGIndex → AuthorityContextPackCompiler`.

Defense-in-depth rule: project/sensitivity/temporal filtering happens at registry, retrieval and pack construction boundaries.

## 7. Memory

| Surface | Legacy/current-row | Authority candidate |
|---|---|---|
| entrypoint | `MemoryManager`, `PostgresMemoryStore`, lower-level authority drafts | `AuthorityMemoryGateway` |
| history | current row / overwrite semantics | immutable append-only revisions |
| system time | row carried current recorded values | `systemFrom` stored; `systemUntil` derived from successor, never back-written |
| knownAt | current-row adapters can expose future corrections | latest revision known at cutoff only; no future successor timestamp leakage |
| retry | stale current head could mask already accepted old operation | `AuthorityMemoryCoordinator` resolves accepted operation by idempotency key against historical parent |
| relations | fixed recorded sensitivity | query sensitivity is max(relation + endpoint revisions known at cutoff) to prevent indirect leakage |
| persistence | mutable row store | `PostgresAuthorityMemoryStore` uses append-only INSERT + per-memory advisory transaction lock + CAS |
| contradictions/supersession | mutation/status fields | append-only relations; effective status derived at query time |

Migration: lower-level `AuthorityMemoryService` is a construction/query helper, not the agent-facing authority boundary. Agents use `AuthorityMemoryGateway`.

## 8. Durable events versus EventBus

`EventBus` is a delivery/observation mechanism. It is not the accepted-history source of truth.

Authority history uses `IEventLog`; persistent deployment uses `PostgresEventLog`/Supabase-compatible storage. In-memory adapters are valid for deterministic tests and local/reference execution only.

## 9. Tools / side effects

Strict tool execution fixes false-success and validates inputs, but authority side effects are **not complete** yet.

Still required before promotion:

- durable operation ledger;
- claim/prepare/execute/commit/compensate lifecycle;
- resource-level fencing immediately before commit;
- lease renewal/expiry;
- crash-window and duplicate-side-effect evidence.

Therefore tool runtime status is `AUTHORITY_CANDIDATE_REQUIRES_SIDE_EFFECT_LEDGER`.

## 10. Compatibility / removal policy

Nothing in this Phase 01 document authorizes deletion of legacy APIs.

A legacy surface may be removed only after:

1. migration adapter or caller migration exists;
2. legacy tests remain available as historical evidence;
3. authority contract tests pass;
4. API behavior diff is independently reviewed;
5. deletion ledger entry is accepted with exact replacement SHA;
6. rollback is documented.

Until then, legacy surfaces are `shadow/deprecated`, not erased.
