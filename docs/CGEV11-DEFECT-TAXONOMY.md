# CGE V11 — Canonical Repository Defect Taxonomy P01–P50

Status vocabulary: `UNKNOWN`, `DETECTED`, `REPAIRING`, `VERIFIED`, `NOT_APPLICABLE`.

A category may be marked `VERIFIED` only when the relevant detection method has been run against the current integration head and the evidence is durable (tests, Actions logs, commit/PR evidence, or an explicit architectural proof). Absence of a currently visible failure is not proof of absence.

| ID | Defect class | Detection / failure signal | Canonical repair | Closure evidence |
|---|---|---|---|---|
| P01 | Install/build non-determinism | clean install/build differs across runs or machines | pin toolchain, reconcile lockfiles, remove hidden working-directory assumptions | repeated clean `npm ci` + build pass |
| P02 | Type-system / compile-contract drift | strict compiler errors, stale declarations, unsafe escapes | repair canonical types/callers; no blanket suppressions | zero-error strict typecheck |
| P03 | Functional regression | unit/integration behavior differs from contract | fix root cause, add regression test | failing-before/passing-after test or equivalent invariant proof |
| P04 | CI false-green / swallowed failures | `|| true`, ignored exits, non-blocking critical gates | make critical gates fail-closed | intentionally failing probe blocks CI; normal CI passes |
| P05 | Branch / PR topology drift | active work stranded off canonical integration path | reconstruct ancestry, dependencies and intended merge order | explicit branch/PR DAG with valid merge path |
| P06 | Merge-stack contradiction | stacked PRs contain incompatible assumptions or duplicate repairs | reconcile lowest common contract before merge | stack merges without conflict/regression |
| P07 | Vulnerable dependency | HIGH/CRITICAL advisory or unsafe package | attribute dependency path; minimally upgrade/remove | zero unresolved HIGH/CRITICAL in supported scope |
| P08 | Dependency / lockfile drift | manifest-lock mismatch, frozen install failure, stale transitives | regenerate narrowly under pinned package manager | `npm ci` deterministic and dependency tree explained |
| P09 | Secret / credential exposure | secrets in source, logs, fixtures, history, artifacts | revoke where needed, remove, rotate, add prevention | secret scan + history review clean for active scope |
| P10 | Authentication defect | identity can be forged/bypassed/confused | explicit authenticated principal contract | negative/positive auth tests |
| P11 | Authorization / policy defect | authenticated caller can exceed permissions | deny-by-default policy and resource/action checks | privilege-boundary tests |
| P12 | Injection / unsafe input | command, query, HTML, path or template injection | validate/encode at trust boundary | adversarial input tests |
| P13 | Unsafe parsing / traversal / deserialization | untrusted parser or path crosses intended boundary | parser limits, canonicalization, schema validation | malicious fixture tests |
| P14 | Unsafe code/tool execution | sandbox escape, ambient authority, unbounded generated code | capability isolation, resource limits, fail-closed execution | sandbox adversarial tests |
| P15 | Error handling / fail-open semantics | error becomes success, ignored failure, silent fallback | explicit failure state, typed errors, bounded fallback | failure-path tests |
| P16 | Data-integrity defect | invalid state accepted, partial write, silent corruption | invariants + transactional/atomic update | round-trip and corruption tests |
| P17 | Persistence / recovery defect | state lost, non-durable checkpoint, broken restore | durable event/state boundary, versioned recovery | cold-start/recovery test |
| P18 | Concurrency / race condition | state depends on scheduling/interleaving | synchronization, ownership, leases, atomic transitions | stress/interleaving test |
| P19 | Retry / idempotency defect | retries duplicate side effects or never converge | idempotency keys, bounded retry, dedupe | retry replay test |
| P20 | Resource leak / backpressure defect | unbounded queue, handle/memory growth | limits, cleanup, pressure propagation | soak/resource-limit test |
| P21 | Timeout / cancellation defect | hung operation or cancellation ignored | cancellation propagation and bounded timeout | timeout/cancel tests |
| P22 | Identity / branded-ID drift | string/opaque/generated IDs confused across layers | preserve generated canonical IDs and map projections explicitly | identity round-trip / cross-level tests |
| P23 | Schema / interface contract drift | producer and consumer disagree on shape/signature | choose canonical schema and migrate all callers | strict compile + contract tests |
| P24 | Backward-compatibility break | public API/format breaks without migration/versioning | compatibility layer only when justified; otherwise version/migrate | compatibility fixtures |
| P25 | Dead / unreachable code | no valid call/import/runtime path | delete-first; retain only proven extension points | reachability/import analysis + tests |
| P26 | Semantic duplication | two implementations own same responsibility | select canonical owner, migrate, delete duplicate | one implementation per responsibility |
| P27 | Generated/codegen drift | generated artifacts disagree with source schema | deterministic regeneration and source-of-truth rule | regenerate-clean diff |
| P28 | Partial / half migration | old/new systems coexist with inconsistent boundaries | finish migration or deliberately revert | no mixed contract on active paths |
| P29 | Dependency cycle | package/module/runtime cycle creates ordering or init hazards | invert dependency / extract stable interface | cycle analysis clean |
| P30 | Layering / architecture violation | lower layer imports higher/sideways authority unexpectedly | restore dependency direction and ownership | architecture graph invariant |
| P31 | Graph-edge direction / topology defect | source/target or dependency semantics reversed | canonical edge convention + invariant helpers | topology property tests |
| P32 | Graph algorithm correctness defect | wrong BFS/DFS/path/rank/component/etc result | reference implementation parity + edge cases | oracle/parity/property tests |
| P33 | Native/WASM ABI drift | JS/native signatures or memory layouts differ | explicit linear-memory ABI and typed loader | native↔JS parity suite |
| P34 | Algorithmic complexity regression | hot path asymptotics or benchmark slope worsens | data-structure/algorithm correction | controlled benchmark comparison |
| P35 | Memory-efficiency regression | memory footprint/growth exceeds expected model | remove duplication, compact representation, bounded caches | memory benchmark/estimate |
| P36 | Non-determinism / randomness defect | same input produces unstable state/test without contract | seed/control randomness or define stochastic contract | repeatability test |
| P37 | Observability blind spot | critical operation lacks trace/metric/error provenance | structured events, correlation IDs, useful metrics | observability integration test |
| P38 | Telemetry privacy / sensitive-data leak | secrets/PII/raw prompts emitted unintentionally | redaction/minimization and safe defaults | telemetry inspection tests |
| P39 | Feature-flag / stale switch defect | dead flag, inconsistent branch, permanent temporary path | remove stale flags or define lifecycle/owner | flag inventory closure |
| P40 | Configuration / environment drift | runtime config disagrees across layers/env/files | explicit precedence + typed adapter boundary | config precedence tests |
| P41 | Deployment / release automation defect | recursive release, fail-open deploy, unsafe permissions | least-privilege Actions + explicit gates | dry-run / workflow review + green release gate |
| P42 | Documentation / runbook drift | docs claim APIs/commands/state that no longer exist | derive docs from canonical code/state and classify historical docs | clean-room operator follows docs successfully |
| P43 | Example / demo rot | examples compile poorly, call removed APIs, produce empty/false demos | real adapters/fixtures aligned to current APIs | example/demo smoke tests |
| P44 | CLI / UX contract drift | command signature/help/output diverges from engine | centralize command→API adapter | CLI smoke/integration tests |
| P45 | Packaging / module-export collision | duplicate barrels, missing exports, ESM/CJS mismatch | explicit public exports and package boundary | consumer import tests |
| P46 | Platform / toolchain compatibility | Node/OS/browser/WASM assumptions break target platform | declare supported matrix and normalize platform APIs | matrix/clean runner tests |
| P47 | Coverage blind spot | important branch/failure mode untested | risk-weighted coverage additions | coverage + critical-path map |
| P48 | Mutation / fuzz / property-test gap | tests pass despite broken invariant | mutation/property/fuzz tests on high-risk logic | mutants/adversarial cases killed |
| P49 | Lost historical value | closed/reverted/abandoned PR contains still-valid code/tests/docs | atomize and recover only independently valid pieces | historical disposition ledger |
| P50 | Canonical-authority / governance ambiguity | multiple sources claim current truth, ownership unclear | explicit source-of-truth and update rules | authority map + zero unresolved critical contradictions |

## W1 verified subset

The current W1 remediation has already produced direct evidence for substantial parts of P01, P02, P07, P08, P15, P22, P23, P28, P33, P40, P43, P44 and P45. These categories are not globally closed for the entire repository until the later CGE V11 waves re-run their detectors across history, architecture and all active surfaces.

## Fixed-point rule

The repository may emit `CGEV11_SUBLIME_STATE_VERIFIED` only when:

1. P01–P50 each have a durable terminal disposition (`VERIFIED` or evidence-backed `NOT_APPLICABLE`).
2. unresolved P0/P1 defects = 0.
3. critical unknowns and authority contradictions = 0.
4. every material repair has verification evidence.
5. the canonical integration/main head passes the clean-room gate.
6. two independent adversarial sweeps produce no new material P0/P1/P2 defect.
