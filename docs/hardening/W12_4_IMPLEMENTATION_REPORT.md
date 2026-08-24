# W12.4 — Authority Completion Implementation Report

Status: **IMPLEMENTED / UNVERIFIED**
Branch: `hardening/w12-4-authority-completion`
Parent: `hardening/w12-3-core-gap-closure`
Automatic CI/CD: **OFF**

## Executive result

W12.4 closes the largest remaining architecture gaps before the W13 evidence campaign. The work is executable source code, schemas, provider fixtures and a manual qualification pipeline — not a planning-only layer.

No dimension is declared 10/10 yet. W13 must compile, execute, attack, replay, restore and benchmark this candidate.

## Implemented system slices

### 1. Deterministic authority GraphRAG

`packages/graph/src/authority-graphrag.ts`

- atomic projection replacement;
- deterministic entity/relation/chunk IDs supplied by the canonical projection;
- projection version and hash;
- duplicate/collision and dangling-reference rejection;
- uniform embedding dimensions;
- provenance required;
- project, sensitivity and temporal filtering before graph expansion/ranking;
- deterministic candidate and tie ordering.

### 2. Agentic graph → bounded context

`packages/hub/src/agentic-context.ts`

- projects Portfolio/Project/Chat/Task/Decision/Artifact/AgentRun/etc. into authority GraphRAG;
- explicit shared/global resource inclusion;
- versioned resource/relation evidence;
- injectable embedding provider;
- zero-cost lexical-hash fallback explicitly labeled as non-semantic;
- ContextPack projection version/hash fencing.

### 3. Versioned Agentic Resource Registry

`packages/hub/src/agentic-registry.ts`

- immutable canonical identity/type/project scope;
- expected-revision updates;
- deterministic content hashes;
- conflict-safe idempotent create semantics;
- relation scope inference and conflict detection;
- optional shared/global resources in project views;
- bounded neighborhood and projection hash.

### 4. Authority memory

`packages/core/src/memory-authority.ts`
`packages/memory/src/authority-memory-store.ts`

- bi-temporal validity vs system-knowledge time;
- epistemic type, confidence, sensitivity, provenance and verification time;
- explicit supersession, contradiction/confirmation relations and retraction;
- in-memory reference store;
- Postgres/Supabase DDL and repository;
- revision CAS during supersession/retraction;
- deterministic project projection hash.

### 5. Hub persistence/query/recovery

`packages/hub/src/store.ts`
`packages/hub/src/query.ts`

- SHA-256 snapshot envelope integrity;
- semantic state hash;
- in-memory and Postgres snapshot stores;
- fail-closed restore when non-importable agent/workflow definitions exist;
- repository topology restore + event-log projection replay;
- project runtime, open loops, neighborhood, blast radius and provenance-path queries.

### 6. Deterministic repository state replay

`packages/graph/src/versioned-state-machine.ts`
`packages/hub/src/hub.ts`

- serialized transition dispatch;
- expected-state/revision fencing;
- partial callback failure detection;
- partial mutation advances revision and becomes explicit failure evidence;
- command and transition-outcome are separate durable events;
- duplicate command without outcome fails as incomplete transaction;
- replay consumes explicit outcomes and verifies final state/revision/hash;
- rejected and partial transitions cannot silently become applied during replay.

### 7. Authority observability

`packages/observability/src/authority.ts`
`packages/api/src/server.ts`

- exactly one terminal event per wrapped authority operation;
- latency and count metrics;
- trace/correlation/causation/project/resource/projection/evidence metadata;
- telemetry sink failure cannot change the protected operation outcome;
- coordinated autonomous goal execution is instrumented.

### 8. Provider semantics

`packages/hub/fixtures/github-webhook-contracts.json`
`scripts/w13-provider-contract.ts`

- PR closed != PR merged != deployment;
- deployment success/failure modeled separately;
- workflow failure maps to build failure;
- GitHub delivery ID is the idempotency key;
- duplicate deliveries must not advance event cursor;
- command/outcome replay is checked.

### 9. W13 qualification substrate

`tsconfig.authority.json`
`scripts/w13-authority-contract.ts`
`scripts/w13-state-partial-commit-contract.ts`
`.github/workflows/w13-authority-qualification.yml`

- manual-only workflow;
- lockfile truth preflight;
- clean install;
- canonical and strict authority type gates;
- fail-closed WASM build;
- authority/provider/state contracts;
- full canonical regression;
- evidence artifact upload.

## Defects found and corrected during W12.4

1. Top-level await in the qualification harness could fail under CommonJS; wrapped in an explicit async main.
2. State callback failure could mutate state while leaving the revision unchanged; partial commits now advance fencing revision and throw a dedicated error.
3. Hub replay could apply a command that had originally been rejected because only command events existed; explicit outcome events now make replay deterministic.
4. Project-scoped agentic context could omit shared/global resources; the projection now supports explicit global inclusion.
5. Reusing canonical resource/relation identity with conflicting payload could silently return old data; replay conflicts now fail.
6. Root TypeScript build graph did not include `@cos/hub`; it now does.

## Residual risks / W13 blockers

- `package-lock.json` is stale relative to the expanded workspace. W13 intentionally generates and exposes the corrected lock, then fails until it is committed.
- W12.4 has not been compiled or executed in a clean environment yet.
- strict authority type-check may expose legacy barrel/import errors.
- legacy CSR/GraphRAG/state APIs coexist with authority paths until cutover evidence.
- state callbacks can have external side effects that generic rollback cannot reverse; partial commits are fenced/observable, not magically undone.
- URL validation is not a complete egress/DNS-rebinding defense; deployment network policy is still required.
- Hub snapshots cannot recreate agent/workflow definitions until those levels expose importable definition snapshots.
- Postgres adapters require migration/transaction integration tests against the selected free target.

## Exact next action

1. Open this branch as a stacked draft PR against W12.3.
2. Keep it draft.
3. At the owner-selected final checkpoint, manually run W13.
4. Commit generated lockfile from first W13 preflight.
5. Triage all compile/test failures without suppression.
6. Repeat W13 until green.
7. Run the 20D adversarial re-audit and only then assign VERIFIED/10 scores.
