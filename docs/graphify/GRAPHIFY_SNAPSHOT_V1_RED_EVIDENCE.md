# /GRAPHIFY Snapshot V1 — Exact RED Evidence

**Parent:** `fix/sandbox-security-w1c` @ `f85fe66bce8079c0e3ec481bbeb3a88bf2c8184c`  
**RED head:** `875bf3d351f686a5c46c6c4428c8114a96a3a060`  
**Workflow run:** `34602946705`  
**Job:** `103274427602`  
**Artifact:** `10265475486`  
**Artifact ZIP SHA-256:** `d72650afa5addb4be133a4903a54eeadd4ba4c4d8485d243f18b82627f0ca3df`

## Preconditions proven

- exact parent SHA was present and bound;
- Node 26.8.2 setup succeeded;
- frozen dependency install succeeded;
- strict TypeScript passed before the Graphify implementation existed;
- no production Graphify projector existed at the RED head.

## RED

The `Graphify snapshot contract` gate failed with:

`ERR_MODULE_NOT_FOUND: .../packages/graph/src/graphify-snapshot.ts`

This is an intentional clean RED: the contract test was committed before the implementation. Full repository regression, coverage, audit and scope gates were skipped because the new required capability did not exist yet.

The RED artifact contains the exact failing contract log and is preserved independently from later GREEN candidates.

## Required causal chain

`W1C qualified parent -> V1 contract test -> clean missing-capability RED -> authority-safe projector implementation -> adversarial validation -> repository regression -> coverage ratchet -> GREEN evidence`

No later test weakening or threshold reduction may be used to manufacture GREEN.
