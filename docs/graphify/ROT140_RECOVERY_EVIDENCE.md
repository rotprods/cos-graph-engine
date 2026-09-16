# ROT-140 — Graphify Snapshot V1 Recovery Evidence

Status: QUALIFIED_PRODUCT_HEAD / EVIDENCE-BOUND SUCCESSOR PENDING

Parent authority: `fix/l8-l11-oracle-wiring-20260915` @ `1c8e7259977d9dbd08e5a6ce429f4b96279c6ef4`  
Donor authority: `feat/graphify-snapshot-v1` @ `2be33ebe03a3a74e729c02252580f0aeba48a35a`  
Qualified product head: `d3ef3565760080dd7cc5b3369b2f5be41a6de0dc`  
Frozen W3.2 authority remains unchanged: `e3e198ce01e576d30ac89b3760a52f2d8461d781` / PR #119.

## Why recovery is justified

W0 clustering proved Graphify Snapshot is not checkpoint noise: it is a coherent no-PR family tip with product code, public export, regression tests, coverage ratchet, workflow and evidence. It carries 11 patch IDs not present in W3.2 across an 8-path capability surface.

The capability projects one authority-tagged snapshot into existing L8 Knowledge, L9 Semantic, L10 Embedding and L11 GraphRAG engines. It does not introduce duplicate graph engines.

## Donor audit result

The donor is valuable but must not be merged or copied as public authority unchanged.

A bounded audit of the exact donor source reproduced integrity gaps that historical tests did not cover:

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

## First exact-head GREEN

Workflow: `ROT-140 Graphify Snapshot Recovery`  
Run: `35090755032`  
Exact tested head: `d3ef3565760080dd7cc5b3369b2f5be41a6de0dc`

Jobs:

- Node 22.12.0: `104776222787` — PASS
- Node 26.8.2: `104776222964` — PASS
- exact-SHA aggregate receipt: `104776611109` — PASS

Node 22 proved:

- exact ancestry from parent `1c8e7259977d9dbd08e5a6ce429f4b96279c6ef4`;
- pinned sandbox TCB `node@sha256:ef24c5053d50fdc3e4e56eb4e7ddb7861874ab0fdc797046ba897581deb8e868`;
- strict TypeScript PASS;
- historical Graphify contract PASS with 40 authority-failure families exercised;
- Graphify hardening contract PASS with 5/5 provenance tables protected;
- prototype-sensitive metadata preservation PASS;
- circular-array fail-closed PASS;
- non-plain-object fail-closed PASS;
- canonical `test:all` PASS;
- integrated W3 coverage corpus PASS, including sandbox/W1D/W2 carry-forward;
- HIGH dependency audit PASS with 0 vulnerabilities;
- mutation allowlist + anti-bypass PASS.

Measured integrated coverage:

- statements: **82.14%** vs 80.05% floor (**+2.09 pp**)
- branches: **80.66%** vs 80.05% floor (**+0.61 pp**)
- functions: **87.26%** vs 85.80% floor (**+1.46 pp**)
- lines: **82.14%** vs 80.05% floor (**+2.09 pp**)

Graphify-specific coverage in that run:

- `graphify-snapshot-v1-internal.ts`: 96.81% statements / 92.17% branches / 88.88% functions / 96.81% lines
- `graphify-snapshot.ts`: 100% statements / 94.44% branches / 94.73% functions / 100% lines

Node 26 proved strict TypeScript + historical Graphify + hardening + full canonical suite compatibility.

Artifacts:

- Node22: `10444191390`, `sha256:3b78def18d404d67bb9868e230012f15c6b8f5f3826da444b9f8e5bf4e137688`
- Node26: `10443729519`, `sha256:020554a15b6d35c664cc1984594c0f86fa9e56f338fe4c7d9ff86f3561f9b1d3`
- complete receipt: `10444241248`, `sha256:ff9f82c52cb5bec7c4288f2a1eaccec738e0cdfd0a821fe152b7d57301f8c39a`

## Evidence-binding rule

The GREEN above belongs to product head `d3ef3565...`. This documentation update changes branch identity, so it cannot inherit that GREEN automatically.

The documentation-bound successor MUST repeat the same Node22 + Node26 + exact-SHA aggregate workflow before ROT-140 can close. No threshold or test oracle may be weakened for that requalification.

## Non-claims

This recovery does not claim merge into W3/main, production deployment, Graphify Adapter + Persistence V1, OpenClaw/Ollama execution, filesystem watching, or global CGEV11 qualification.

Even after the evidence-bound successor is GREEN, integration into W3/main remains separately governed by ROT-23/ROT-130 and cannot inherit promotion authority automatically.
