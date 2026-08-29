# Phase 05 — Capability Evidence V2 Delta

Status: `IMPLEMENTED_UNVERIFIED / SHADOW_ONLY`

## Why V2 exists

The first additive capability observer correctly isolated sink and telemetry calls, but its outer `try/catch` still allowed a signal-construction failure after an accepted protected result to be misinterpreted as the protected operation failure.

That is unacceptable in a complex system: observability is a defense, not an execution dependency.

## Canonical candidate

Use:

- `authority-capability-evidence-v2.ts`;
- `authority-capability-signal-store-v2.ts`;
- `authority-phase05-evidence-v2.ts`;
- `tsconfig.phase05.evidence-v2.json`.

The earlier files remain unpromoted drafts and must be removed or archived under deletion governance before package-root promotion.

## V2 guarantee

The protected runtime call and evidence path are separate failure domains:

```text
protected capability result/error
          │
          ├── returned/rethrown unchanged
          │
          └── best-effort evidence domain
                ├── signal construction
                ├── append-only signal sink
                └── telemetry terminal
```

Signal construction, signal storage, telemetry start or telemetry terminal failure cannot:

- replace an accepted provider result;
- replace the original policy/isolation/runtime error;
- convert uncertain provider truth into local failure;
- convert a rejected operation into allow.

If signal construction fails, the telemetry terminal receives only `observationBuildFailed=true`; raw provider input/result remains absent.

## Additive contracts

- `scripts/test-authority-capability-evidence-v2.ts`;
- `scripts/test-authority-capability-signal-store-v2.ts`.

They explicitly test protected-result preservation when:

- the signal sink throws;
- telemetry start throws;
- telemetry terminal throws;
- signal details contain a non-canonical value;
- error-observation signal construction fails.

## Proof boundary

No V2 contract or typecheck has run. Assurance remains unchanged.
