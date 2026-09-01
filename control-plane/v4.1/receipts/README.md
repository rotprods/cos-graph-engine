# V4.1 Cryptographic Receipt Slice

> Status: TARGETED_PASS
> Authority: SHADOW_ONLY
> Parent slice: PR #67 / `refactor/v4.1-assurance-contract-kernel` @ `ba7ec597428f66bb635f80d14d51df1542a7e059`
> Exact implementation SHA exercised: `94c0654ea6c9e52dda6b8febf70d33fa3946bb1e`

## Objective

Replace narrative or freely editable evidence records with a deterministic receipt protocol for:

- `OBSERVATION` — what was observed, from which source, at what time, with explicit `UNKNOWN`;
- `EXECUTION_EVIDENCE` — exact candidate SHA, evidence kind, command, exit code, timestamps and artifact hashes;
- `SUPERSESSION` — append-only replacement of an older receipt without rewriting it;
- `EVENT` — hash-chained, idempotency-keyed operational history, including anchored segments.

## Cryptographic boundary

The contract uses canonical SHA-256 for payload and receipt integrity. This detects corruption/tampering when the verification boundary can trust the stored digest lineage.

It does **not** prove authenticity against a malicious writer who is authorized to replace the entire receipt set and recompute all hashes. External signatures/transparency anchoring and the independent V6 verifier remain separate concerns.

## Supersession laws

Supersession must preserve semantic identity:

- receipt type cannot change;
- execution evidence cannot change candidate SHA or evidence kind;
- observations cannot change subject identity;
- replacement cannot predate the receipt it supersedes;
- events cannot be superseded: corrections are new append-only events;
- supersession graph must remain acyclic;
- old receipt bytes remain verifiable historical provenance.

## Event laws

- contiguous explicit sequence;
- exact previous receipt hash;
- unique receipt IDs, hashes and idempotency keys;
- monotonic recorded time;
- anchored segments support non-1 starting sequences and an explicit prior tip hash.

## Exact-published qualification

The initial local expected blob identity for `receipt-selftest.mjs` did not match the Git-published object. The local 38/38 result was therefore refused as authority rather than rationalized.

The exact published object set at implementation SHA `94c0654ea6c9e52dda6b8febf70d33fa3946bb1e` was reconstructed, Git blob identities and SHA-256 digests were recomputed, syntax-checked and re-executed with Node `v22.16.0`.

Result:

- syntax checks: PASS;
- receipt adversarial self-test: **38/38 PASS**;
- failures: 0.

Durable evidence:

`../evidence/receipt-kernel/EVIDENCE_PACKET_V1.json`

The authoritative published self-test blob is `6fc0bdb0a830319800f971285325aad78aafb224`; the earlier expected local blob identity is non-authoritative historical scratch state.

## Proof boundary

`TARGETED_PASS / SHADOW_ONLY` proves the receipt integrity, supersession and event-chain kernel only.

It does not prove:

- authenticity against an authorized malicious writer able to replace all receipts and recompute hashes;
- signatures, transparency anchoring or V6 independent verification;
- completeness of repository observation/discovery;
- full COS build/typecheck/runtime;
- runtime hardening PRs #59 onward;
- real PostgreSQL/provider behavior;
- concurrency, recovery, deployment isolation or production readiness;
- main authority.

## Next bounded frontier

Run an independent exact-head review of this receipt slice. If it survives unchanged, integrate active cryptographic receipt verification into the V4.1 promotion evaluator in a separate child slice; do not widen into runtime hardening or V5 ingestion yet.
