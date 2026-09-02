# COS Graph Framework M1B — Runtime State Module

Status: **IMPLEMENTED / TARGETED-VALIDATED / STACKED ON M1A**

M1B turns the canonical M1A state kernel into an executable Graph Protocol module rather than requiring callers to know the concrete store class.

## Module contract

`cos.graph.state.memory` exposes three conformant capabilities:

- `cos.graph.state.commit` — `mutate`, side effects=`graph`, idempotency=`required`.
- `cos.graph.state.snapshot` — `stream`, side effects=`none`.
- `cos.graph.state.verify` — `stats`, side effects=`none`.

The commit capability binds GraphRuntime execution identity into canonical state truth: runtime `operationId`, policy authorization, graph reference, idempotency key and execution start time feed the M1A transaction/event contract.

## Security boundary

State mutation is no longer callable through the framework runtime without the existing fail-closed GraphRuntime execution policy. The capability declares graph side effects, so missing/denied/broken policy prevents store mutation. Runtime graph references are checked against transaction graph ID and expected revision before the store is invoked.

The module uses protocol schemas on both input and output. A successful store return is not trusted blindly: commit receipts, snapshots and replay verification results are parsed again, and snapshot/replay state hashes must match their returned canonical graph content.

## Why this matters

This is the point where COS stops being only a bag of graph classes. A caller can discover the module, inspect declared safety semantics, authorize it, invoke by typed object or capability ID, observe execution receipts, and swap a future durable implementation behind the same protocol contract.

## Targeted validation

The M1B suite verifies module conformance, fail-closed policy behavior, accepted mutation, exact retry convergence through GraphRuntime, receipt identity, snapshot and replay verification, dynamic capability invocation, graph-reference mismatch rejection and non-mutation on rejected bindings.

## Proof boundary

The module currently wraps the M1A in-memory reference store. A persistent implementation must satisfy the same capability semantics and a store-specific conformance suite before it can be considered equivalent.
