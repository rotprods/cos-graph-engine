# ROT-140 — Graphify Snapshot V1 Recovery Evidence

Status: RECOVERY_CANDIDATE / NOT PROMOTED

Parent authority: `fix/l8-l11-oracle-wiring-20260915` @ `1c8e7259977d9dbd08e5a6ce429f4b96279c6ef4`
Donor authority: `feat/graphify-snapshot-v1` @ `2be33ebe03a3a74e729c02252580f0aeba48a35a`
Frozen W3.2 authority remains unchanged: `e3e198ce01e576d30ac89b3760a52f2d8461d781` / PR #119.

## Why recovery is justified

W0 clustering proved Graphify Snapshot is not checkpoint noise: it is a coherent no-PR family tip with product code, public export, regression tests, coverage ratchet, workflow and evidence. It carries 11 patch IDs not present in W3.2 across an 8-path capability surface.

The capability projects one authority-tagged snapshot into existing L8 Knowledge, L9 Semantic, L10 Embedding and L11 GraphRAG engines. It does not introduce duplicate graph engines.

## Donor audit result

The donor is valuable but must not be merged or copied as public authority unchanged.

A bounded local audit of the exact donor source reproduced integrity gaps that historical tests did not cover:

1. provenance dictionaries were ordinary JavaScript objects, so prototype-sensitive IDs such as `__proto__` were not guaranteed to survive as own keys;
2. the same risk existed independently for deterministic-node, deterministic-edge, semantic-node, semantic-edge and chunk provenance tables;
3. canonical JSON object construction used ordinary `{}` dictionaries and could lose a literal own `__proto__` key;
4. node/edge metadata projection reused that unsafe canonicalization path, so authority-bearing metadata could be altered on projection;
5. array cycles were not inserted into the recursive validator's active-object set, allowing a self-referential array to recurse rather than fail closed;
6. non-plain runtime objects such as Date/Map/Set were accepted by the structural JSON walk despite not belonging to the canonical plain-JSON contract.

These findings invalidate a blind PORT of the donor's public boundary. They do not invalidate the underlying L8–L11 projection logic.

## Recovery design

Classification:

- donor L8–L11 projection implementation: PORT, quarantined unchanged as `graphify-snapshot-v1-internal.ts`;
- public Snapshot V1 types/schema/error class: PORT through explicit public facade;
- donor validation/canonicalization public boundary: REWORK;
- donor provenance dictionary construction: REWORK;
- donor tests: PORT unchanged plus adversarial hardening suite;
- old W1C-only qualification workflow/floor: SUPERSEDED by current W3/ROT-143 authority.

The recovery keeps the exact donor implementation blob internally and places a hardened public `graphify-snapshot.ts` facade in front of it. The facade:

- performs a cycle-safe plain-JSON structural preflight before the donor validator;
- rejects non-plain runtime objects;
- canonicalizes object keys into null-prototype dictionaries;
- rebuilds all five provenance dictionaries with null prototypes;
- rewrites projected metadata/evidence strings with hardened canonical JSON;
- preserves the donor projection logic and existing L8–L11 engines.

## Regression contract

Historical donor test `scripts/test-graphify-snapshot-v1.cjs` remains unchanged.

New `scripts/test-graphify-snapshot-v1-hardening.cjs` proves:

- all five provenance tables preserve `__proto__` as an own key;
- prototype-sensitive metadata survives canonicalization/projection without polluting `Object.prototype`;
- circular arrays fail closed with `GraphifyValidationError`;
- Date/Map/Set fail closed as non-plain JSON values;
- shared acyclic references remain accepted.

Both tests are wired into canonical `test:all`, so Graphify becomes part of the standard and coverage corpus rather than a side workflow-only feature.

## Qualification contract

`.github/workflows/rot140-graphify-recovery.yml` qualifies the exact child on:

- Node 22.12.0 and Node 26.8.2;
- strict TypeScript;
- historical Graphify donor contract;
- new hardening contract;
- full canonical `test:all`;
- W3 integrated coverage corpus and unchanged `check-cgev11-stack-coverage.mjs` floors;
- HIGH dependency audit;
- scope + anti-bypass allowlist;
- exact-SHA aggregate receipt.

No product byte in frozen PR #119 is changed by this recovery branch.

## Non-claims

Until the qualification workflow is GREEN, this document does not claim the recovery candidate is qualified. Even after a GREEN child, integration into W3/main remains separately governed by ROT-23/ROT-130 and cannot inherit promotion authority automatically.
