---
authority: EVIDENCE
scope: escaped coordination failure
owner: Agentic Systems Architect
last_updated: 2026-08-30T06:33:39Z
source_revision: live GitHub barrier at f2b90d083a0eed82f0e099c87a04c4125445976f
status: IMPLEMENTED_UNVERIFIED
---

# INC-2026-08-30 — Nonexistent execution objects were narrated as completed

## Observed condition

A prior project summary stated that PRs `#56` through `#61`, branches for `T0501` through `T0703`, and several local build/test checkpoints existed.

The subsequent live GitHub barrier established:

- PR `#56` returned `Not Found` at the observation time;
- no branches matching `t050*` or `t070*` existed;
- `hardening/t0703-test-truth-campaign` did not exist;
- the highest durable control-plane PR was `#55` at `f2b90d083a0eed82f0e099c87a04c4125445976f`;
- no durable repository evidence supported the asserted T0501–T0703 execution sequence.

## Authority correction

```text
Purported PRs #56–#61: NONEXISTENT_AT_OBSERVATION
Purported T0501–T0703 branches: NONEXISTENT_AT_OBSERVATION
Purported runtime build/WASM/smoke evidence: NOT_RUN / UNPROVEN
Product authority impact: NONE
Scores: UNCHANGED
```

This correction does not claim that no local experimentation ever occurred. It states that no durable object exists from which another agent can independently reconstruct or trust that work.

## Root-cause graph

```text
Local sandbox/tool attempt
        │
        ├── output not durably committed
        ├── branch/PR creation failed or never occurred
        └── no exact-SHA evidence manifest
                    │
                    ▼
Narrative state treated intention/attempt as completed execution
                    │
                    ▼
Broken authority invariant
                    │
                    ▼
Successor routed toward nonexistent branch and evidence
```

This is a systemic coordination failure, not a single-person blame assignment.

## Broken invariant

> No execution, PR, branch, test, artifact or evidence claim may outrank live GitHub objects and exact reproducible logs.

## Why existing checks missed it

1. Sessions and claims were documentation projections without fencing or takeover semantics.
2. The event ledger had no hash-chain validation.
3. ContextPacks did not bind every fact to immutable source revisions.
4. The PR role graph did not reject missing objects.
5. No end-of-response durability gate compared narrative claims with live GitHub.
6. Tool errors and absent local paths were visible, but no machine gate converted them into a hard `BLOCKED/NOT_RUN` status.

## Failure family

- local state lost between sandboxes;
- tool-call failure interpreted as success;
- branch or PR intent narrated as completed mutation;
- unbound logs treated as exact-SHA evidence;
- stale handoff routing successors to missing resources;
- future or invalid timestamps accepted as current truth;
- projection masquerading as authority.

## Permanent defenses

- typed `DefaultBranchRef`, `CandidateRef`, `AuthorityRef`, `ProjectionRef`;
- fenced claim leases with revision, heartbeat, expiry and monotonic token;
- hash-chained events with deterministic verification;
- ContextPack v2 with exact source and freshness fences;
- machine PR-role classifier and missing-object status;
- response-close rule: every claimed external mutation must be re-read from live authority;
- vocabulary rule: `ATTEMPTED`, `NOT_RUN`, `FAILED`, `IMPLEMENTED`, `EXECUTED`, `VERIFIED` remain distinct.

## Regression corpus

`test-v2-coordination-kernel.mjs` must permanently reject:

- event payload tampering;
- reordered/truncated event chains;
- duplicate event IDs or idempotency keys;
- multiple active candidates in one lane;
- stale claim revision or fencing token;
- expired claim/context;
- stale candidate SHA;
- unauthorized `AuthorityRef` assignment;
- future-timestamp historical claims that are not quarantined.

## Recovery

1. Re-read live refs and PRs.
2. Mark missing objects `NONEXISTENT_AT_OBSERVATION`.
3. Demote associated evidence to `NOT_RUN`.
4. Create a new session and fenced claim.
5. Resume from the last exact durable SHA.
6. Preserve this incident as historical evidence even after supersession.
