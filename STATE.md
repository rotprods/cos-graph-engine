# STATE — COS Graph Engine

Updated: 2026-08-24 17:05 Europe/Madrid
Mode: **W12_4_FROZEN_W13_QUALIFICATION_NEXT**
Authority status: **SHADOW_ONLY**
Current implementation head: `hardening/w12-4-authority-closure`
Current draft PR: **#35**
Automatic CI/CD: **OFF / MANUAL-ONLY**

## North Star
Bring COS Graph Engine to a demonstrable 10/10 engineering standard across all 20 audited dimensions, with machine evidence rather than narrative confidence, before it becomes authoritative infrastructure for AGENTIC_SYSTEMS_OS.

## Stacked hardening chain
- #18 — W0/W1 canonical truth + cost-safe CI/CD posture
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
- #30 — W12 scoped temporal GraphRAG
- #31 — W12.1 memory integrity
- #32 — W12.2 deterministic cold-start/governance
- #33 — W12.3 cross-wave authority integration
- #35 — W12.4 authority closure

All remain draft until W13 evidence closes the authority gate.

## W12.4 frozen implementation truth
- `StrictToolRegistry` is the COSServer execution path; legacy SearchTool false-success is removed at source.
- Filesystem/HTTP capabilities are bounded before side effects and remain policy-gated.
- Authority tool execution is lease/fencing/idempotency-aware.
- Deterministic authority GraphRAG exists alongside legacy L11 for migration safety.
- `VerifiedAuthorityGraphRAGEngine` derives sensitivity before identity and requires source `recordedAt` instead of wall-clock replay time.
- `ContextPackCompiler` rejects stale projection version/hash and can seal evidence with SHA-256.
- `VerifiedAgenticContextProjector` provides the authority path from Project/Chat/Task/Decision/Artifact topology to bounded context.
- Temporal memory has explicit epistemic type, confidence, provenance, valid/system time, supersession, contradiction and CAS.
- `CanonicalTemporalMemoryIndex` normalizes ISO timestamps and SQL NULL/undefined representation before persistence hashing.
- Postgres/Supabase-compatible durable event, memory, temporal memory and Hub snapshot adapters exist.
- Hub restore has a strict authority wrapper: unresolved agent/workflow definitions fail closed unless partial shadow recovery is explicitly authorized.
- State machines serialize concurrent transitions, roll back internal state on callback failure and fence stale timers.
- Resilience observes policy/lease/idempotency/delivery failures as near-miss evidence without inventing root cause.
- `@cos/hub` is now part of both root npm workspaces and the canonical TypeScript build graph.
- `tsconfig.authority.json` defines a separate strict typecheck surface while legacy build compatibility remains isolated.

## Static preflight defects closed after PR #35 opened
1. Hub missing from `tsconfig.build.json` paths/includes — fixed.
2. Relation identity could be calculated with default `internal` before endpoint-derived sensitivity — verified authority facade added.
3. Relation replay could synthesize `recordedAt=now()` — verified authority facade now requires source timestamp.
4. Postgres temporal-memory round trip could differ only by ISO/NULL representation — canonicalization boundary added.
5. Hub restore could succeed with unresolved agent/workflow definitions as warnings — strict recovery gate added.
6. Authority surface previously depended on monorepo `strict:false` — dedicated strict authority typecheck added.

## Remaining work is qualification/migration, not new architecture
- clean install and package-lock/workspace reconciliation;
- discover/pin the actual TypeScript version from the clean dependency graph rather than relying on `npx` ambiguity;
- typecheck legacy build and strict authority surface;
- compile/build all affected packages;
- reconcile old L2 tests/benchmark callers that intentionally mutated copy-safe `contextData` or constructed invalid empty FSMs;
- provider fixtures for Postgres adapters;
- property/negative/security/contention/fencing/idempotency tests;
- deterministic event/graph/context replay;
- corrupted-snapshot and empty-database restore;
- scientific benchmark and observability evidence;
- blind cold-agent resume;
- final 20D re-audit.

## Next exact action
Create `hardening/w13-authority-qualification` from this frozen head. W13 may fix defects exposed by verification but may not introduce new product breadth. Run one consolidated manual evidence campaign, triage every real failure without suppression, then re-run until all authority gates pass or remain explicitly blocked.
