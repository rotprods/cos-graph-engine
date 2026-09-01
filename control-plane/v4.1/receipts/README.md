# V4.1 Cryptographic Receipt Slice

> Status: WRITTEN_UNEXECUTED / IMPLEMENTED_UNVERIFIED
> Authority: SHADOW_ONLY
> Parent slice: PR #67 / `refactor/v4.1-assurance-contract-kernel` @ `ba7ec597428f66bb635f80d14d51df1542a7e059`

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

## Current durable state

`model/receipt-contract.v1.json` is published. The executable validator and its local adversarial corpus are not yet durable Git evidence, therefore no PASS is claimed for this slice.

The next safe action is to publish the zero-dependency validator, verify its exact Git blob identity against the executed bytes, then create an exact-SHA evidence packet.
