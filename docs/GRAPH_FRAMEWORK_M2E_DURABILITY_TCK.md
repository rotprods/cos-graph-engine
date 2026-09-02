# COS Graph Framework M2E — Durability Technology Compatibility Kit

Status: **candidate until exact compacted-head CI is green**.

M2E changes the adapter model from “implements the TypeScript interface” to “proves the required persistence laws against a real backend.”

## North Star

A `GraphDurabilityDriver` is not M2-compatible merely because its methods have the right names.

The backend must demonstrate the semantic laws that higher runtime layers depend on:

```text
TypeScript structural compatibility
            !=
COS durability compatibility
```

Certification is therefore executable.

## Public compatibility profile

Conformance schema:

`cos.graph/durability-conformance/v1alpha1`

Profile:

`cos.graph/durability-profile/m2d/v1`

The profile currently represents the persistence contract established by M2A + M2D:

- atomic event/head/idempotency persistence,
- optimistic storage CAS,
- durable restart/reopen,
- semantic revision vs storage-clock separation,
- verified snapshot anchors,
- atomic compaction CAS,
- post-anchor event continuity,
- retained idempotency authority after pruning,
- time monotonicity through the anchor boundary,
- no-op compaction stability.

M2B/M2C checkpoint/HITL semantics use a different persistence port and are intentionally not conflated into this profile.

## Factory contract

Adapter authors supply a `GraphDurabilityConformanceFactory`:

```ts
interface GraphDurabilityConformanceFactory {
  backendId: string;
  open(scope: string): GraphDurabilityDriver | Promise<GraphDurabilityDriver>;
  destroy(scope: string): void | Promise<void>;
}
```

The TCK derives isolated scopes from a caller-provided namespace.

Repeated `open(scope)` calls must address the **same** durable authority. This is essential: several laws intentionally use multiple live handles or full close/reopen cycles.

`destroy(scope)` exists only for TCK-owned namespaces and allows the same compatibility kit to target local files, database schemas, temporary databases, containers or managed-service test tenants without embedding backend-specific lifecycle logic into the framework.

## Mandatory M2D laws

### 1. `first-commit-atomicity`

Starting from absent authority:

- CAS at storage version 0 commits,
- result storage version is 1,
- one event exists,
- one idempotency record exists,
- canonical head is revision 1,
- event terminal hash binds the head snapshot.

A backend that can expose only a subset of event/head/idempotency state is non-conformant.

### 2. `stale-storage-cas`

Two handles observe the same empty scope.

The first write wins. The second stale write with the same expected storage version must return `conflict`.

It may not:

- last-write-wins,
- manufacture another storage version,
- duplicate the event,
- duplicate idempotency authority,
- convert a uniqueness exception into apparent success.

### 3. `restart-recovery`

After two commits, the driver is closed and reopened through a new handle.

The TCK requires:

- same canonical state hash,
- same terminal event hash,
- deterministic replay equivalence,
- same semantic event count,
- exact retries of both old transactions returning their original receipts.

### 4. `compaction-clock-separation`

After three semantic commits:

```text
revision = 3
eventCount = 3
storageVersion = 3
```

Compaction must produce:

```text
revision = 3
eventCount = 3
storageVersion = 4
```

State hash and semantic terminal event hash must be unchanged. The full retained tail becomes an anchor-covered compacted prefix.

### 5. `compaction-cas`

Two real handles race the same anchor installation against the same storage version.

One wins. The stale compactor must return `conflict` and must not advance storage clock or replace the winning anchor.

### 6. `post-anchor-continuity`

After full-head compaction, the next semantic commit must create one retained tail event whose:

```text
previousEventHash == anchor.snapshot.lastEventHash
```

Anchored replay must include that event and reproduce the new head state.

### 7. `pruned-exact-retry`

The TCK physically compacts old event envelopes, then retries the first transaction with its original stale graph revision.

The backend must return the original receipt via retained idempotency authority without:

- recreating the pruned event,
- advancing semantic revision,
- advancing storage version.

### 8. `pruned-idempotency-conflict`

After the original event envelope is gone, the same idempotency key with changed semantic payload must still fail as `IDEMPOTENCY_CONFLICT`.

Pruning event envelopes may never degrade payload-bound idempotency.

### 9. `anchor-time-monotonicity`

The anchor’s terminal timestamp remains an event-time boundary after old event envelopes are deleted.

A post-anchor event earlier than that boundary must fail as `EVENT_TIME_REGRESSION`.

### 10. `compaction-noop`

Compacting an unchanged head that is already fully represented by its anchor must be a no-op.

It may not manufacture a storage revision or silently replace anchor identity.

## Certification report

A successful run returns an immutable report containing:

- conformance schema,
- profile,
- backend ID,
- caller namespace,
- ordered laws passed,
- `certified: true`,
- deterministic `certificationHash`.

The hash proves the identity of the declared certification tuple; it is not a cryptographic attestation that the tests ran on trusted infrastructure.

Example conceptual shape:

```text
backendId
+ profile
+ namespace
+ exact ordered law manifest
-> canonical SHA-256 certificationHash
```

Changing the profile or mandatory law manifest changes the certification artifact.

## Fail-fast semantics

A failed law throws `GraphDurabilityConformanceError` with:

- backend ID,
- exact law,
- isolated scope,
- preserved cause.

The suite stops at the first violated mandatory law. A partially completed run never returns `certified: true`.

## Anti-ceremonial test

The repository does not merely run the TCK against the known-good SQLite adapter.

The M2E gauntlet also wraps the real SQLite backend with a deliberately non-conformant adapter that lies about stale CAS conflicts and reports them as committed.

Expected behavior:

```text
backend: cos.test.sqlite-lying-cas
law: stale-storage-cas
result: CONFORMANCE_LAW_FAILED
```

This proves the compatibility kit itself detects a critical broken-backend class instead of rubber-stamping any structurally compatible adapter.

## SQLite certification

`SQLiteGraphDurabilityDriver` is the first backend submitted to the public TCK.

The test uses real SQLite files and real reopen semantics. It does not replace SQL operations with an in-memory fake.

The same TCK is executed twice against fresh scopes using the same certification namespace; the resulting certification hash must be identical.

## What M2E does **not** claim

Passing the durability TCK does not certify:

- whole-repository production readiness,
- SQL injection/security configuration outside the adapter,
- managed-database HA/SLA,
- malicious storage-admin resistance,
- benchmark/performance targets,
- checkpoint/HITL driver compatibility,
- distributed worker fencing,
- multi-backend parity when only one real backend has passed.

Most importantly:

> SQLite passing the TCK does not let COS claim Postgres/Supabase parity.

A second backend becomes equivalent only after its **real transactional implementation** runs the exact same compatibility profile and passes it independently.

## Postgres/Supabase admission rule

The next independent backend should use genuine PostgreSQL transaction semantics.

Minimum implementation shape:

```text
BEGIN
  lock/read graph head
  compare storageVersion
  append event
  append idempotency authority
  update snapshot/head
COMMIT
```

Compaction must similarly lock/CAS the head and atomically install the anchor while pruning only the covered event tail.

A sequence of independent REST calls that can expose a torn event/head/idempotency tuple is **not** acceptable as a substitute for a transactional backend.

CI should run the adapter against a real PostgreSQL service before COS claims cross-backend parity.

## Promotion gate

M2E may be marked `TARGETED_ACCEPTED` only after the exact one-commit candidate and its PR merge-ref both pass:

- clean install,
- targeted strict TypeScript compile,
- every M1/M2A/M2B/M2C/M2D regression,
- SQLite real-backend TCK certification,
- anti-ceremonial lying-CAS rejection.

Whole-repository certification remains independently governed by the #76/#79 convergence train.
