---
authority: PROJECTION
scope: canonical COS V2 terms and deprecated aliases
owner: Documentation Architect / Knowledge Graph Engineer
last_updated: 2026-08-30T17:30:00.000Z
source_revision: 1bc137eb6e635f55db293b402f561e420dc83c4f
supersedes: ambiguous uses of complete, verified, ready, active and authority
status: IMPLEMENTED_UNVERIFIED
---

# COS V2 Canonical Lexicon

## Usage law

These definitions constrain code, documentation, issues, PRs, events and agent communication. A deprecated alias may appear in historical material but must not be used to promote current authority.

## Lifecycle terms

### PROPOSED

**Definition:** Designed or decided but not yet materially implemented.

**Anti-example:** A Markdown design that says a store exists.

**Next valid states:** `IMPLEMENTED`, `BLOCKED`, `SUPERSEDED`.

### IMPLEMENTED

**Definition:** Code, schema, document or model exists at an exact revision.

**Does not mean:** compiled, executed, tested, secure, correct or production-ready.

### EXECUTED

**Definition:** A named command, workflow, drill or review ran in a stated environment against an identified artifact.

**Required metadata:** exact SHA or explicit `UNBOUND_LOCAL_EXECUTION`, toolchain, command, timestamp and output artifact.

### VERIFIED

**Definition:** All required non-empirical checks for the declared scope executed and passed against an exact immutable artifact.

**Does not mean:** physical provider, network, storage or performance behavior has been empirically qualified.

### EMPIRICALLY_QUALIFIED

**Definition:** Applicable physical/runtime campaigns—real database, process death, contention, TLS, filesystem broker, provider timeout, recovery or scientific benchmark—have passed.

### AUTHORITY_READY

**Definition:** The exact candidate satisfies all applicable program gates, no P0/P1 remains, D01–D20 each equal Authority 10.0, independent review is valid and the owner has explicitly promoted it.

### CANONICAL_AUTHORITY

**Definition:** The source currently authorized to define truth for a stateful concept.

**Constraint:** Exactly one writer per capability/domain.

### BLOCKED

**Definition:** A genuine dependency or failed gate prevents justified advancement.

**Required fields:** blocker, owner, resolution path, evidence needed and rollback/safe fallback.

### DEGRADED_EXTERNAL

**Definition:** An external dependency or unknown state prevents full guarantees while the local system remains bounded and honest.

**Example:** Unknown agents operating outside the repository-backed claim registry.

### SUPERSEDED

**Definition:** Historical artifact or decision replaced by an identified newer artifact. It remains queryable for provenance.

### NOT_APPLICABLE

**Definition:** A dimension, test or subsystem does not apply to the declared scope. It is not equivalent to PASS.

## Test-result terms

### NOT_RUN

The test exists or is required but has not been executed against the qualifying artifact.

### PASS

The executed test met its explicit acceptance criterion.

### FAIL

The executed test violated an acceptance criterion or could not complete in a way that invalidates the guarantee.

### SKIPPED

The test runner intentionally skipped the test. A reason is mandatory. It does not count as PASS.

### CANCELLED

Execution began or was scheduled but was intentionally terminated. It does not count as PASS.

## Authority terms

### UNTRUSTED_DATA

External payload, prompt, issue, comment, webpage, media, archive, URL, path or provider response before validation and policy enforcement.

### REFERENCE_ONLY

Useful context that cannot write or overrule authority.

### PROJECTION

A rebuildable view derived from authority: graph, index, dashboard, state document, ContextPack or scorecard.

### SHADOW_ONLY

An implementation may receive mirrored input and produce comparison evidence, but cannot control production truth or irreversible side effects.

### IMPLEMENTED_UNVERIFIED

The artifact exists, but required compile/test/security/recovery evidence is missing.

### VERIFIED_CANDIDATE

The declared verification gates passed for the exact candidate. Empirical qualification or owner promotion may still be pending.

## Graph terms

### Node

A uniquely identified material entity with type, lifecycle, authority, owner and provenance.

### Edge

An attributed relationship between two nodes. It declares direction, semantics, confidence, authority and temporal validity when applicable.

### Hyperedge

A relationship whose meaning depends on a set of more than two entities, such as an authority promotion gate or multi-component transaction.

### Temporal hypergraph

A graph in which nodes, edges and hyperedges preserve valid/system time, source events, versions and supersession history.

### Projection revision

Monotonic identifier of a rebuildable view. It is not a domain revision.

### Event watermark

Highest contiguous source-event position incorporated into a projection.

### Orphan

A node, task, test, artifact or module without required ownership, dependency, consumer, evidence or lifecycle relationship.

### Articulation point

A dependency node whose removal disconnects major graph regions or critical paths.

## Event and state terms

### Command

A request to attempt a state transition or external action.

### Outcome

The accepted, rejected, failed, uncertain or compensated result recorded after evaluating a command.

### Event

An immutable statement that something was observed or accepted at a particular source position and time.

### Projection

Disposable state reconstructed from events and canonical records.

### Replay

Reapplying immutable historical outcomes to rebuild derived state. Replay must not reinterpret old commands using new rules.

### Restore

Reconstructing the operational system after loss using migrations, snapshots, event tails, projection rebuild and integrity checks.

### Snapshot

Integrity-sealed state optimization with schema version, source position and hash. It never replaces the event log as historical authority.

### Valid time

When a statement is true in the domain.

### System time / known time

When COS recorded or knew the statement.

### Occurred time

When the originating event happened.

### Recorded time

When the event entered the durable authority boundary.

## Agentic terms

### Agent

An execution actor with declared capabilities, authority ceiling and owner.

### Session

A globally unique, historically queryable execution context. Session IDs are never reused.

### Workstream

A coherent bounded body of work that can span sessions and agents.

### Objective

The falsifiable outcome a workstream currently advances.

### Claim

A time-bounded declaration that a session owns resource or semantic scope. Exclusive overlapping claims fail closed.

### Lease

A bounded runtime ownership grant over a resource.

### Fencing token

A monotonically increasing ownership generation validated at the resource commit boundary. Mere presence is not proof.

### Handoff

A durable event and packet that transfers work, state, blockers and next-safe action to a successor.

### ContextPack

A bounded, project/sensitivity/temporal/provenance-filtered projection for an agent task. It is stale by default and acceleration only.

### Authority ceiling

Maximum lifecycle/authority state an agent or session may claim based on available evidence and permissions.

## Side-effect terms

### Idempotency key

Stable identity of one logical operation. It must be bound to the payload and durable outcome, not merely present in a request.

### Provider idempotency key

Attempt identity recognized by an external provider when the provider supports it.

### Reconciliation required

Execution may have reached the provider, but the accepted outcome is unknown. Retry is prohibited until inspection resolves the state.

### Applied

Provider/resource evidence demonstrates that the intended effect exists.

### Not applied

Authoritative provider/resource evidence demonstrates the effect did not occur. An ambiguous `404` is not automatically sufficient.

### Partial

Only part of the intended effect occurred. Compensation or explicit human recovery is required.

### Compensation

A separate durable operation that mitigates or reverses an accepted partial/undesired effect. It is not rollback of history.

### Repair

A durable secondary obligation after protected truth is already known—for example lease release, signal delivery or agent-evidence append.

### Exactly once

Deprecated as an unqualified provider claim. Use precise language:

- one accepted local operation revision;
- provider-deduplicated attempt;
- at-least-once delivery plus idempotent convergence;
- reconciled single accepted effect.

## Evidence terms

### Evidence

A durable artifact supporting or contradicting a claim. It declares source, exact artifact revision, method, result and hash.

### Evidence hash

Hash recomputed from canonical evidence content. A caller-supplied nonempty hash is not proof.

### Assurance

Strength of executed evidence for the declared guarantee.

### Build

Maturity of the implemented architecture/code for the declared dimension.

### Authority score

`min(Build, Assurance)` for that dimension.

### Evidence manifest

Machine-readable mapping from exact artifact and commands to results, tests, dimensions and hashes.

### Cold-agent drill

A timed test in which a zero-context successor reconstructs North Star, branch, blockers, verified/unverified work and next-safe action without chat history.

## Governance terms

### North Star

The terminal program condition, not a motivational slogan.

### Definition of Done

Objective conjunction of implementation, executed tests, security review, documentation/state/graph updates, durable evidence, no unresolved critical regression and zero-context handoff.

### Checkpoint

Promotion gate with entry criteria, required tasks/tests/evidence, exit criteria, promotion authority and rollback path.

### Deletion ledger

Semantic accounting for removed behavior: what existed, why removed, replacement, compatibility impact, evidence and rollback.

### Decision ledger

Record of problem, constraints, alternatives, selected option, rejections, evidence, tradeoffs, risks, mitigations, reversibility, migration cost and reconsideration trigger.

### Residual risk

Known risk remaining after mitigation. It has owner, detection, recovery and acceptance authority.

## Deprecated ambiguous aliases

| Deprecated term | Required replacement |
|---|---|
| complete | `IMPLEMENTED`, `VERIFIED`, or `EMPIRICALLY_QUALIFIED` with scope |
| done | exact DoD result and evidence IDs |
| ready | `REVIEWABLE`, `VERIFIED_CANDIDATE`, or `AUTHORITY_READY` |
| active | session/claim/phase state with timestamp and expiry |
| production-ready | `AUTHORITY_READY` plus separately approved deployment |
| tested | `EXECUTED: PASS` with exact SHA and suite |
| secure | named threat model and passed security gates |
| deterministic | repeated/replayed artifact hashes match under stated inputs |
| bi-temporal | append-only valid-time and system-time history supports historical queries |
| exactly once | precise local/provider/reconciliation guarantee |
| source of truth | named canonical authority writer and replica/projection rules |
