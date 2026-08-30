---
authority: PROJECTION
scope: COS V2 coordination authority kernel candidate
owner: Agentic Systems Architect
last_updated: 2026-08-30T06:33:39Z
source_revision: f2b90d083a0eed82f0e099c87a04c4125445976f
status: IMPLEMENTED_UNVERIFIED
---

# COS V2 Coordination Authority Kernel

This directory closes the highest-priority coordination defects found by the independent review of PR #55. It does not alter runtime behavior or promote product authority.

## Selected contracts

### Typed references

```text
DefaultBranchRef  = mutable default branch observation
CandidateRef      = mutable review candidate, one per lane
AuthorityRef      = immutable promoted artifact; currently UNASSIGNED
ProjectionRef     = disposable derived state tied to source SHA + event watermark
```

`main`, a candidate branch, an authority release and a projection are deliberately different concepts.

### Fenced claim lease

Every material write must present:

```text
claimId
expected claim revision
monotonic fencing token
expected candidate SHA
covered resource scope
```

An expired, superseded, lower-fence or wrong-SHA writer fails closed. The historical claim with a future timestamp is quarantined rather than silently normalized.

### Hash-chained operational events

`events.v2.ndjson` is an append-only candidate segment. Each envelope includes:

```text
sequence
unique eventId
unique idempotencyKey
previousEventHash
eventHash = SHA-256(canonical envelope without eventHash)
```

Corrections become new events; old events are never rewritten.

### ContextPack v2

The pack is acceleration only and is stale by default. It carries exact fences for:

- default branch SHA;
- control-plane candidate SHA;
- runtime candidate SHA;
- event watermark;
- projection revision;
- claim ID/revision/fencing token;
- per-fact source URI and revision;
- compiler version and expiry.

A successful parse does not imply freshness; all fences must still match live authority.

### PR lifecycle roles

The role projection distinguishes active candidates, stack ancestors, archive sources, obsolete qualification branches, review-only objects and superseded rework sources. Narrative references to missing PRs or branches are classified as non-authoritative.

## Verification

```bash
node scripts/validate-v2-coordination-kernel.mjs --self-test --write
node scripts/test-v2-coordination-kernel.mjs --write
```

The tests validate this control-plane kernel only. They do not compile or qualify the COS runtime.

## Rollback

The branch is additive. Abandon it without merge and return to PR #55 head `f2b90d083a0eed82f0e099c87a04c4125445976f`. Preserve the incident and event evidence even if the implementation is superseded.
