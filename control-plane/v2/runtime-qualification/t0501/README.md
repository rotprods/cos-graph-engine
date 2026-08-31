# T0501 — Provider Evidence Integrity

Status: `TARGETED_PASS_WITH_INTEGRATION_PENDING`

Implementation SHA: `ec7f02657251f71655d0a40c1c2b1feec45faf84`
Control-plane parent: `fc7ddb29ffc0368721c5b3f6ae9e777d374f62ca`
PR: #60

## Executed evidence

- exact helper + exact contract: 22 assertions PASS;
- exact provider reconciler + exact contract: 16 assertions PASS;
- exact observed-outcome recorder source: TypeScript compile PASS against minimal contract stubs;
- all five locally executed/compiled source blobs match the GitHub blob SHAs recorded in `evidence.json`.

## Guarantees added

New evidence is schema v2, canonically hashed, idempotently resealable and bound to operation/project/capability/resource/provider attempt/fencing/content hash. Historical v1 evidence remains verifiable but is not granted v2 guarantees retroactively. Unknown provider truth remains uncertain; retry is not authorized from ambiguity.

## Proof boundary

This is not a full monorepo qualification. Full repo typecheck, the existing observed-outcome integration suite, real provider timeout-after-acceptance, Postgres and multi-process contention remain `NOT_RUN` and are mandatory before authority promotion.

Global D01–D20 scores do not move from this targeted evidence alone. Runtime remains `SHADOW_ONLY`.
