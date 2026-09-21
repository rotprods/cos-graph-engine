# /CGEV2 × COS Graph Engine — Death-Safe Checkpoint

**Checkpoint ID:** `CGEV2-CGE-20260921-ROT149-RED-001`  
**Repository:** `rotprods/cos-graph-engine`  
**Mode:** `ONLINE / DURABLE / RECOVERABLE / EXACT-HEAD`  
**Seal:** `CGEV11_SUBLIME_STATE_NOT_VERIFIED`  
**Checkpoint base:** `a1a53e9429020b80f4f6912b5c1f191168bc6639`  
**Checkpoint purpose:** context rollover only. This branch is not a promotion candidate and must never be merged merely because it is a checkpoint.

---

## 0. Authority law

Do not trust chat memory as operational authority.

Use, in descending order:

1. exact Git refs / immutable Git blobs / GitHub Actions run+job+artifact evidence;
2. current Linear issue state and relations;
3. durable checkpoint/handoff material tied to exact refs;
4. historical PRs/branches only as donor/provenance evidence;
5. summaries and model inference only as navigation hints.

Mutable refs must be re-read before every source mutation.  
Unknown is not PASS.  
RED is evidence, not a reason to relax a gate.

---

## 1. North Star

Converge all valid COS Graph Engine recovery work into a reliable, recoverable canonical authority without losing valid historical value, fabricating promotion, weakening security/compatibility/recovery contracts, or mutating production.

The global seal remains:

`CGEV11_SUBLIME_STATE_NOT_VERIFIED`

because the active Phase05A recovery is RED and main-promotion governance remains externally blocked.

---

## 2. Live world state — revalidated 2026-09-21

### Canonical main

- `main`: `3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83`
- protected: `true`
- visible required check contexts: `[]`
- visible required check bindings: `[]`
- enforcement level: `everyone`

Do not infer effective governance from `protected=true`.

### Frozen W3.2 promotion candidate

PR #119 remains:

- state: `OPEN`
- draft: `true`
- merged: `false`
- base: `main@3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83`
- head: `e3e198ce01e576d30ac89b3760a52f2d8461d781`
- ref: `integration/cgev11-w3-2-promotion-20260912`

Do not mutate or merge PR #119 from this workstream.

### Governance blocker

- Linear `ROT-130`: `In Progress`
- GitHub issue #122: `OPEN`
- required admin-capable readback/enforcement is still not proven.
- required aggregate checks to enforce when admin authority is available: `complete` and `stack-complete`.
- no routine bypass, force-push or deletion should be accepted without explicit verified governance.

### STOP-THE-LINE

GitHub issue #39 remains `OPEN`.

Therefore:

- do not remove `.github/workflows/release.yml`;
- do not remove `.github/workflows/deploy.yml`;
- do not treat W4 workflow consolidation as authorized by this checkpoint.

---

## 3. Closed recovery already verified in Linear

Do not repeat archaeology unless live evidence contradicts it.

- `ROT-138` — Done — PR #78 L8/L9 reconciliation.
- `ROT-140` — Done — Graphify Snapshot recovery.
- `ROT-141` — Done — alternate V2 lineage reconciliation.
- `ROT-143` — Done — L8–L11 regression oracle restored into canonical `test:all`.
- `ROT-145` — Done — Graphify fail-closed boundary hardening.
- `ROT-158` — Done — canonical identity / strict serialization / provenance foundation.

Critical qualified parent used by the active Phase05A qualification:

`01104b63deeb6aab3ac465766c2d2443bccc5159`

---

## 4. ROT-159 — materialized but not qualified/closed

Linear `ROT-159`: `In Progress`.

Materialized lineage:

1. `b6e50e076b7ceac175319c876235e8e9728ab8ae`  
   `recover(runtime): restore minimal injected Postgres authority port`
2. `8c9dd2457fb114553ffa921081a743a8937c6133`  
   exports the port from `@cos/runtime`.

Canonical port:

`packages/runtime/src/postgres.ts`  
blob `8f56181b39bd577b8ada433635e7516b14a8c533`

This is a driver-neutral interface only: no driver, pool, DSN, credentials, environment reads, retry policy, production DB or provider mutation.

ROT-159 must remain `In Progress` until a GREEN exact-head qualification that exercises this contract is persisted.

---

## 5. ROT-149 — active frontier

Linear `ROT-149`: `In Progress`.

Active branch:

`recover/phase05a-rot149-20260917`

Live exact head:

`a1a53e9429020b80f4f6912b5c1f191168bc6639`

Tree:

`98d243cbaf16ce1955ddd5838c33f7689669d57a`

Product recovery commit:

`c5a11f886b0b20eb99bc03466a8cbaf7969861a6`

Parent:

`8c9dd2457fb114553ffa921081a743a8937c6133`

The selected Phase05A product core was ported from frozen donor PR #49 by exact blob identity rather than blind cherry-pick.

Historical donor authority:

- PR #49 head: `3e79488a3ca5013812ab3f64d18b2a55b8050333`
- archival PR #46 is provenance only and must not be ported wholesale.
- PR #54 contains the required observed-provider-outcome recovery correction.
- `authority-observed-outcome-recorder.ts` selected blob: `91560ecf373ce54aa19455958fa920f26035321b`.
- observed-outcome contract blob: `deaa74ceef11fa454b94eb4789ccb8bea685b77f`.

No public `@cos/execution` package-root promotion is authorized yet.

---

## 6. Exact RED authority

Workflow:

`ROT-149 Phase05A Recovery`

Run:

`35234977842`

Head SHA:

`a1a53e9429020b80f4f6912b5c1f191168bc6639`

Result:

`FAILURE`

### Node 22

- job: `105248445182`
- strict TypeScript: PASS
- frozen donor blob identities: PASS
- first 8 targeted contracts: PASS
- artifact: `10503306446`
- artifact digest: `sha256:cd26d757ffaa051e411fef310f4f282af85d0806fccb05ad643aff933ac12435`

### Node 26

- job: `105248445600`
- strict TypeScript: PASS
- first 8 targeted contracts: PASS
- artifact: `10502297312`
- artifact digest: `sha256:91fac5cfc63cfca4d7ee16f0368222b9f725e334aac5ab684079649d7b1154da`

### Passing targeted evidence before RED

Both Node versions independently passed:

- Authority lease/fencing: 28 assertions
- Authority lease Postgres: 20
- Authority execution runtime: 15
- Authority policy: 19
- Policy-bound runtime: 16
- Provider reconciliation clean: 17
- Provider lease retry planner: 10
- Observed-outcome recorder: 10

Total before the first failure: **135 assertions**.

### First failing contract

`scripts/test-authority-side-effect-postgres-clean.ts`

blob:

`d51d3d82104363440404cd45fde8f74e7f401a25`

Failure on both Node 22 and Node 26:

`SIDE_EFFECT_FENCING_NOT_MONOTONIC previous=7 incoming=7`

Stack authority:

- `AuthoritySideEffectService.prepare`
- `packages/execution/src/authority-side-effect.ts`
- failing replay originates at the second identical `prepare` invocation in the Postgres clean contract.

The canonical suite, integrated coverage ratchet, HIGH audit and anti-bypass steps did **not** execute because the targeted authority gate failed first.

No aggregate exact-SHA receipt exists for this run. Do not call this head qualified.

---

## 7. Causal diagnosis

This is currently classified as a **product replay/idempotency ordering defect**, not a TypeScript failure and not a fake-Postgres parsing defect.

Observed sequence:

1. claim is accepted;
2. first `prepare` with fencing token 7 is accepted;
3. contract retries the exact same transition key / payload / provider idempotency identity with fencing token 7;
4. the service loads the already-prepared current revision;
5. `AuthoritySideEffectService.prepare()` checks:
   `current.fencingToken !== null && token <= current.fencingToken`
6. it rejects `7 <= 7` before the append/store transition-key replay path can converge the exact retry.

The contract expectation is consistent with the append-only transition-key design: an **identical accepted transition retry must converge**, while a changed payload or reused transition key with different transition identity must fail closed.

### Forbidden fake fixes

Do NOT:

- change the retry test from token 7 to token 8 merely to make CI green;
- weaken the monotonic-fence law globally;
- change `<=` to `<` without proving new-attempt semantics;
- bypass the service and test only the store;
- delete the duplicate-retry assertion;
- lower coverage/audit/typecheck gates;
- weaken `canonicalSerialize`;
- claim exactly-once provider effects.

The repair must distinguish **replay of an already accepted identical transition** from **a new attempt that requires a strictly newer fence**.

---

## 8. Exact next-safe-action

Start from live branch readback. If and only if the active branch still equals:

`a1a53e9429020b80f4f6912b5c1f191168bc6639`

then:

1. inspect the existing transition-key lookup/replay path in `AuthoritySideEffectService` + `IAuthoritySideEffectStore`;
2. add/repair replay-aware resolution so an identical already-accepted `prepare` converges **before** new-attempt monotonic-fence validation;
3. ensure same transition key with changed payload/transition identity fails closed;
4. ensure a genuinely new attempt with equal/older fence still fails;
5. keep the historical Phase05A donor blobs unchanged unless a demonstrated product defect requires a narrowly justified current repair;
6. create a child commit, never reset/force-push;
7. run the exact-head ROT-149 workflow on Node 22 + Node 26;
8. require targeted contracts, canonical `test:all`, integrated coverage ratchet, HIGH audit, scope/freeze/anti-bypass and aggregate exact-SHA receipt all GREEN;
9. persist run ID, job IDs, artifact IDs and digests in Linear;
10. only then close `ROT-149` and, if its full DoD is covered by the same evidence, `ROT-159`;
11. re-read the Linear DAG before selecting the next frontier.

If the branch has moved, do not overwrite/reset/force. Reconstruct the new ancestry first.

---

## 9. Immediate DAG after ROT-149

Current ROT-149 blocks:

- `ROT-150` — selected Phase05B capability/isolation recovery;
- `ROT-152` — T0501/T0502 cryptographic provider-truth core.

Related current work also includes:

- `ROT-147` — PR #89 T0502F provider-truth reconciliation;
- `ROT-151` — selected Phase05C evidence/durable repair recovery;
- `ROT-146` — mega-lineage reconciliation parent.

Do not choose the next workstream from this snapshot alone. Re-read live relations after ROT-149 is qualified.

---

## 10. Global hard gates

- no main merge;
- no PR #119 mutation;
- no production/provider/Supabase mutation;
- no release/deploy;
- no force-push/reset;
- no blind cherry-pick;
- no threshold/test relaxation;
- no fake security/performance/full-20D claims;
- no exactly-once provider-effect claim;
- no package-root authority promotion without current callsites/tests;
- no W4 cleanup while W3/ROT-23 and issue #39 gates remain unresolved;
- no global sublime seal while ROT-130 remains externally unverified.

---

## 11. Cold-start recipe for the next agent

Read this checkpoint first, then verify live truth in this order:

1. branch `recover/phase05a-rot149-20260917`;
2. latest workflow runs for that branch;
3. Linear `ROT-149`, `ROT-159`, `ROT-130`;
4. PR #119 and `main`;
5. GitHub issues #39 and #122;
6. only then inspect source around the failing replay path.

Expected first live assertion:

`branch_head == a1a53e9429020b80f4f6912b5c1f191168bc6639`

If false, this checkpoint becomes historical evidence and the next agent must reconcile the newer state before writing.

Expected first engineering reproduction:

`scripts/test-authority-side-effect-postgres-clean.ts`

must reproduce the same replay/fencing failure before repair unless another valid writer has already repaired it.

---

## 12. Checkpoint semantics

This CGEV2 checkpoint creates **no promotion authority**, claims no GREEN, releases no external governance blocker, and does not alter the active ROT-149 source branch.

Its purpose is loss-proof continuity across context rollover.

**NEXT:** repair the exact replay/idempotency ordering defect, then perform complete exact-head qualification.

**GLOBAL SEAL:** `CGEV11_SUBLIME_STATE_NOT_VERIFIED`
