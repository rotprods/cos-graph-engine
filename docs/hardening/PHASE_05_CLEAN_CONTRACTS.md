# Phase 05D — Clean Core Contracts

Status: `WRITTEN_UNEXECUTED / SHADOW_ONLY`

This PR adds only contracts whose import closure points at the selected clean
Phase 05 source. It deliberately does not copy historical tests that depend on
excluded V1 prototypes or superseded barrels.

## Strict graph

```text
npx tsc -p tsconfig.phase05.clean.json --noEmit
```

The strict graph starts from `authority-phase05-clean.ts`, so every selected
source module is typechecked even when a particular contract does not execute it.

## First contract set

- in-memory and Postgres lease semantics;
- live execution fencing;
- default-deny policy and policy-bound mutations;
- append-only agent-run aggregate;
- HTTP/filesystem isolation decision contracts;
- capability evidence V2 observer-failure isolation;
- durable repair aggregate lifecycle.

## Excluded until normalized

The exploratory PR contains useful tests whose imports still reference excluded
objects such as `authority-phase05-current`, `authority-phase05-repair`,
`authority-phase05-provider-integrations`, `authority-phase05-platform-v2` or the
old `InMemoryAuthorityFencingValidator`. Those tests are not copied blindly.
They will be rewritten or minimally normalized in a separate adapter-contract
slice.

No test has run and no Assurance score changes.
