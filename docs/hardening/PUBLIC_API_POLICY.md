# Public API Stability & Deprecation Policy

## Scope

Applies to exported COS symbols, package entrypoints, serialized contracts, event types and database schemas used by external or cross-package consumers.

## Stability classes

### LEGACY_STABLE

Existing public behavior preserved while migration is active. Bug/security fixes may tighten invalid behavior but require compatibility documentation.

### SHADOW_COMPAT

Callable for compatibility but explicitly non-authoritative. It cannot independently write canonical truth.

### AUTHORITY_CANDIDATE

Selected future authority surface. API may still change during hardening, but every breaking change requires ADR/compatibility/rollback updates.

### AUTHORITY_STABLE

May be declared only after W13/evidence qualification and independent review.

### INTERNAL

No compatibility guarantee outside the owning package.

## Deprecation process

A public symbol is not removed in the same phase in which its replacement is introduced.

Minimum sequence:

```text
legacy public surface
→ authority candidate added
→ migration/compatibility matrix
→ legacy + authority evidence
→ caller inventory
→ deprecation annotation/documentation
→ qualification
→ separate removal decision
```

## Breaking-change requirements

Any intentional public behavior break requires:

- ADR or explicit ADR reference;
- compatibility-matrix update;
- preserved legacy evidence or explicit waiver;
- replacement evidence plan;
- rollback map update;
- deletion-ledger entry if material code is removed;
- caller migration notes.

## Event/schema stability

Durable event types and persisted authority schemas are more restrictive than in-process APIs:

- historical event meaning must remain replayable;
- schema evolution must be versioned/additive by default;
- field reinterpretation in place is prohibited;
- unknown schema versions fail closed on authority restore/replay;
- migrations never erase provenance merely to simplify the current model.

## Package version caveat

Current workspace package versions are historically inconsistent (`0.1.x`, `2.1.x`, etc.). They are not sufficient evidence of semantic compatibility. Phase 07 will reconcile the dependency graph/toolchain; until then this policy, ADRs and exact commit SHAs govern hardening compatibility.
