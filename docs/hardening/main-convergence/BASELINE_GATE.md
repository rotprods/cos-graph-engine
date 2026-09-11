# COS main convergence — canonical baseline gate

Status: **MERGE-CANDIDATE / NOT YET MAIN / NOT PRODUCTION CERTIFIED**.
Tracker: #39. Integration PR: #103.

## Canonical verification owner

`.github/workflows/ci.yml` is the single automatic convergence gate. It now qualifies three distinct states:

1. `push` on `integration/main-baseline-20260907`;
2. `pull_request` targeting `main` — this must exercise GitHub's generated merge ref;
3. `push` on `main` after an authorized merge.

All inherited diagnostic workflows remain manual-only. Deploy and release remain explicit fail-closed freeze guards. The canonical workflow has read-only repository permissions, pinned actions and checkout credentials disabled.

## Mandatory exact-SHA jobs

Every direct job proves `git rev-parse HEAD == GITHUB_SHA` and emits a completion receipt. The aggregate rejects missing, skipped, failed or stale evidence.

- `contract`: aggregate-validator tests + workflow safety tests
- `quality-core`: config bindings, auth/HTTP adversarial, memory/copy-safety, WASM build/workspace test, strict TypeScript, canonical `test:all`, dependency audit
- `specialized`: CSR, pruning, graph benchmark tests, WASM, independent compiled-WASM oracle, observability, visualization
- `performance`: performance benchmark
- `coverage`: c8 coverage + retained artifact
- `docker`: reproducible build + runtime package resolution + non-root + no TypeScript dev runtime + real production `/health` smoke
- `complete`: exact-SHA aggregate over all six direct jobs

## Container RED -> GREEN ledger

A Docker build succeeding was found to be insufficient. The npm workspace lock graph uses `link: true` for `@cos/*`; the old runner image copied `node_modules` but not the linked workspace package directories. It also executed `dist/packages/api/src/server.js`, which defines `COSServer` but is not a production HTTP bootstrap.

RED evidence:

- candidate `cb10f9e7a730fe0653cb9153e6b70c921c9692e5`
- Actions run `34391450416`
- Docker job `102600469751`
- image build: PASS
- runtime smoke: FAIL with `MODULE_NOT_FOUND: @cos/core`

Repair candidate:

- `6b734d7da365d12dac061cc71c61cb93ae774a4f`
- Actions run `34392087428`
- all six direct jobs + aggregate: PASS
- Docker build: PASS
- workspace package resolution: PASS
- runtime user is non-root: PASS
- TypeScript is absent from runtime dependencies: PASS
- real container production `/health`: PASS

The production image now uses a digest-pinned Node 22 Alpine base, materializes compiled `dist` output inside workspace packages, prunes devDependencies, runs as the `node` user and starts `packages/deployment/dist/serve.js`. `serveProduction()` intentionally contains no demo data, synthetic goals or permissive `allow-all` bootstrap policy.

## Donor convergence already represented

The candidate contains reviewed/qualified value from the global baseline lineage, including #79 strict typecheck recovery, #85 PageRank/compiled-WASM oracle, #99 memory lifecycle/index repair, #100 auth boundary, #101 CI safety principles and exact source/test blobs from #102 typed environment bindings. Donor PRs must not later be blindly merged if their content is already represented by this candidate.

## Coverage truth

Coverage is a ratchet, not a certification claim. Last measured global c8 baseline before this ledger commit:

- statements: **64.44%**
- branches: **74.49%**
- functions: **65.49%**
- lines: **64.44%**

The current root coverage command instruments `npm run test:all`; several independently executed adversarial/specialized suites are not yet part of that c8 command. Therefore the first coverage campaign task is to unify truthful JS/TS coverage measurement before writing large volumes of tests. AssemblyScript/WASM remains a separate native conformance domain. No executable production code may be excluded merely to manufacture 100%.

Target remains genuine 100/100/100/100 for eligible executable JS/TS plus separately certified WASM behavior.

## Known non-silent boundaries

These are not represented as solved by the baseline gate:

- effective GitHub branch-protection settings remain unverified through the current connector permissions;
- configuration hot-reload removal/validation semantics need a separate lifecycle slice;
- memory cross-link directionality needs an explicit product contract before claiming bidirectional semantics;
- HTTP listen-error behavior deserves an explicit bind-failure regression;
- the Node WASM loader should receive an adversarial test for Buffer `byteOffset`/`byteLength` correctness and fallback observability;
- an independent human/reviewer approval receipt is not currently present.

## Promotion rule

Do not merge #103 merely because its branch head is green. The PR must target `main`, GitHub must generate a stable merge ref, and the complete canonical gate must pass on that merge ref. Immediately before merge, re-read `main` and the PR head to reject races. Use an expected-head-SHA guarded merge. Then require the same gate to pass again on the resulting `main` SHA.
