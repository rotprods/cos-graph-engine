# COS V2 — CURRENT V4

Authority: `SHADOW_ONLY / IMPLEMENTED_UNVERIFIED`

## Current candidates

- PR #58 — `refactor/v2-integration-evidence-repair` — bounded control-plane evidence repair.
- PR #56 — coordination kernel — targeted exact-SHA PASS remains valid.
- PR #57 — integration V3 — **evidence demoted to UNREPRODUCIBLE** because the published validator is syntax-invalid.
- PR #54 — runtime candidate — `IMPLEMENTED_UNVERIFIED`.

## Hard temporal law

PR #57's former PASS claim is not rewritten into truth. The implementation remains historical/provenance; its evidence authority is removed. The V4 repair starts from PR #57 exact head and must produce new exact-byte reproducible evidence.

## Current one-shot claim

- session: `ses_e73f2954-bbbb-4ddb-9761-0a9dd862f84e`
- claim revision/fence: `5 / 5`
- expected parent: `8e48986178b9b70f5e36adeedc4f23a8bb3c0605`
- status after implementation commit: `CONSUMED_BY_IMPLEMENTATION_COMMIT`

## Next safe sequence

1. execute `scripts/validate-v2-integration-v4.mjs` from the exact published implementation bytes;
2. bind PASS/FAIL evidence to the resulting immutable implementation SHA;
3. keep runtime qualification `NOT_RUN` until that evidence exists;
4. only then create the first real runtime qualification child.

No automatic Actions, CD, deployment, production DB or Supabase mutation.
