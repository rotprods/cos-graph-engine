# Phase 05 — Capability, Reconciliation and Evidence Checkpoint

Status: `IMPLEMENTED_UNVERIFIED / SHADOW_ONLY`  
Canonical PR: `#46`  
Automatic Actions/CD: `OFF`

## What is now materially implemented

### Canonical provider capability path

`AuthorityCapabilityRuntime` owns the selected execution path:

```text
request
→ authority-owned input binding
→ provider/isolation preflight
→ policy
→ durable operation claim
→ lease + fencing
→ prepare
→ begin
→ StrictToolRegistry / CapabilityRouter
→ pinned provider tool
→ commit OR reconciliation_required
→ agent-run evidence
→ lease release / repair evidence
```

The runtime keeps its router private, rejects legacy direct tools in the authority registry, distinguishes read and mutation tools, binds provider idempotency into the durable operation input, and returns durable committed truth without a second provider call on retry.

### Trusted isolation time

Provider input can no longer select its own effective isolation time:

- read tools are bound to the authority request `at`;
- mutation tools are bound to authority `beginAt`;
- caller-supplied `evaluatedAt` is overwritten;
- conflicting provider idempotency evidence fails closed.

This closes a time-of-check bypass where a caller could present a stale decision while claiming an earlier evaluation time.

### Provider-native reconciliation contract

`AuthorityProviderReconciler` converts read-only provider/resource inspection into the side-effect recovery protocol:

- `applied` commits the existing operation;
- `not_applied` requires explicit authoritative-absence evidence plus a strictly newer fencing token and rotated provider attempt key;
- `partial` requires compensation;
- `unknown` leaves the operation in `reconciliation_required`;
- reconciliation never repeats the original mutation.

This is a generic contract. Actual GitHub/HTTP/filesystem/provider-specific inspectors and retry planners remain to be implemented.

### Failure-isolated capability evidence

`ObservedAuthorityCapabilityRuntime` adds an additive observation layer around the protected capability facade:

- one primary terminal capability signal per invocation;
- explicit policy, isolation, lease, fencing and provider-uncertainty classifications;
- separate repair signals for failed lease release and agent-run evidence append;
- deterministic signal IDs/content hashes;
- no raw input/provider result copied into signal or telemetry details;
- signal or telemetry failure cannot alter the protected operation result;
- observer failures remain bounded local evidence.

A structural telemetry port is used intentionally so `@cos/execution` does not acquire a reverse dependency on `@cos/observability`. A deployment adapter must map it to `AuthorityTelemetry`.

## Additive files

- `packages/execution/src/authority-provider-tools.ts`
- `packages/execution/src/authority-capability-runtime.ts`
- `packages/execution/src/authority-provider-reconciliation.ts`
- `packages/execution/src/authority-capability-evidence.ts`
- `packages/execution/src/authority-phase05-observed.ts`
- `scripts/test-authority-capability-runtime.ts`
- `scripts/test-authority-provider-reconciliation.ts`
- `scripts/test-authority-capability-evidence.ts`
- `tsconfig.phase05.observed.json`

## Prepared static commands — not executed

```text
npm run typecheck:phase05
npm run test:authority:phase05
npx tsc -p tsconfig.phase05.observed.json --noEmit
npx tsx scripts/test-authority-capability-evidence.ts
```

No passing claim is implied by command existence.

## Remaining P0/P1 gaps

1. implement real provider-specific inspectors and retry planners;
2. implement a pinned-address HTTP transport preserving TLS SNI/Host and proving no second DNS resolution;
3. implement a platform filesystem broker/executor using `openat`/directory handles or equivalent;
4. bridge capability evidence to the selected canonical execution signal store and real `AuthorityTelemetry` adapter;
5. make post-commit agent-evidence repair durable rather than status-only;
6. resolve superseded Phase 05 prototypes under deletion governance;
7. promote the narrow API and block alternate package-root side-effect paths only in the Phase 07 compatibility gate;
8. execute clean typecheck, contracts, contention, crash-window and security evidence later.

## Assurance boundary

Everything in this checkpoint is written but unexecuted. Build may be reassessed after static review. Assurance and Authority remain unchanged.
