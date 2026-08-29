# Phase 05 Cleanroom Port

Status: `IMPLEMENTED_UNVERIFIED / SHADOW_ONLY`

## Purpose

Replace PR #46 as qualification lineage with a reviewable clean branch that
contains only the selected Phase 05 dependency closure. PR #46 remains preserved
as an exploratory archive and provenance source.

## Exact lineage

- base: `checkpoint/phase-04-temporal-2e15b88`
- base SHA: `2e15b88388836b94b97a93753cb4db347e275e7e`
- source archive: PR #46 @ `ea5023caab7741aa72d7b9cfdfbcdab28e47f6fe`
- clean branch: `hardening/phase-05-clean-selected`

## Three-commit review structure

1. Side-effect truth, leases/fencing, policy and provider reconciliation.
2. Agent-run truth, isolation decisions, provider tools and capability facade.
3. Evidence V2, signal stores, durable post-commit repair and clean manifest.

## Port law

- one selected implementation per capability;
- no V1/V2 coexistence;
- no speculative draft barrels or duplicate ledgers;
- package root remains untouched;
- legacy Phase 04 behavior remains unchanged;
- tests enter only through an explicit selected contract set;
- no automatic Actions, merge, deploy or Assurance promotion.

## Selected execution path

```text
request
→ authority-owned input normalization
→ isolation preflight
→ default-deny policy
→ append-only operation claim
→ lease + monotonic fence
→ prepare / begin
→ private CapabilityRouter + StrictToolRegistry
→ pinned provider/handle adapter
→ commit | reconciliation_required | compensation
→ append-only agent-run evidence
→ release or durable repair work
→ failure-isolated signal/telemetry channel
```

## Next gate

Add only the selected tests and fixtures, create one strict clean tsconfig, then
perform static import/export review before any execution campaign.
