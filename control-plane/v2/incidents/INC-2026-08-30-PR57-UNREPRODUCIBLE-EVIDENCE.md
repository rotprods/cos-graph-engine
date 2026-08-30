# INC-2026-08-30 — PR57 unreproducible integration evidence

Status: `OPEN_REPAIRED_BY_PR58_PENDING_EVIDENCE`

## Observed

PR #57 implementation `23f303a31554ec3b6ff0ce770429e1aa27d2e7be` published `scripts/validate-v2-integration-v3.mjs`.
The published file contains malformed `--at` parsing:

```js
process.argv[process.argv.indexOf('--at'+1]
```

Node cannot parse that source. The later evidence commit `ea88a78dba70f695d387f4ea068fbe3e326ca2be` nevertheless claims exact local `PASS`.

## Broken invariant

> A PASS claim must be reproducible from the exact published implementation bytes.

## Authority correction

```text
PR57 implementation: preserved as provenance
PR57 claimed targeted PASS: DEMOTED → UNREPRODUCIBLE / NON_AUTHORITY
PR56 targeted coordination PASS: unchanged
global runtime qualification: NOT_RUN
```

## Failure family

- local unpublished bytes differ from committed validator;
- evidence metadata is committed without replaying the exact artifact;
- syntax validation is omitted from evidence preflight;
- narrative/evidence commit outranks executable bytes.

## Permanent defenses

PR #58 V4 requires:
- syntax-parse preflight of the exact validator;
- exact implementation blob hashes;
- `COS_GIT_SHA` binding to immutable implementation commit;
- local restore round-trip;
- adversarial mutation corpus;
- successor evidence commit only after implementation SHA exists.

No historical artifact is silently rewritten.
