# COS #134 — PDF dependency remediation / CGEV2 handoff

Date: 2026-10-22 (Europe/Madrid). Outcome: **BLOCKED for complete verification / NO_GO for merge**. The dependency-removal candidate is implemented; this is not incident closure.

- Authority: https://github.com/rotprods/cos-graph-engine/issues/134
- Base: `3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83`
- Source candidate: `7bba2b9f4eab33b0ed68ba193ee39453243312f5`
- Branch: `fix/134-pdf-dependency-chain`
- Source tree: `87cb6764ab78171ec03dd8e8cd3e56f6b94616bd`
- Local Linux VM, Node 24.19.0 / npm 11.9.0; CI's Node 18.20.4 was not tested. Documentation-only successor commits do not change the qualified source files; confirm their blob hashes before reuse.

## Finding and compatibility contract

Updater run 39731019378 / job 119665838015 reports `security_update_not_possible` for sprintf-js, affected <=1.1.3 and no non-vulnerable resolvable version. Original lock path: md-to-pdf5.2.5 -> gray-matter4.0.3 -> js-yaml3.15.0 -> argparse1.0.10 -> sprintf-js1.0.3. Updater logs were read directly in this execution; individual Dependabot alert endpoints remain unavailable.

Invariant: the installed dependency graph must contain no sprintf-js or its unused PDF introducer. Preserve the existing PDF exporter and independently reachable dependencies. All tracked/hidden files were searched: no md-to-pdf caller, CLI/config or documented workflow exists. `scripts/pdf-export.js` imports pdfkit directly and has no link to that chain. Docker copies installed development modules, so development-only classification does not prove deployment absence. No production exploit path is established.

## Change and scope

- Remove the unused root md-to-pdf declaration, retaining pdfkit and the unchanged PDF exporter.
- Regenerate the lock with npm; 120 package records removed, all in the removed introducer's old closure. No retained third-party version changed. Root argparse2.0.1 remains for markdown-it.
- Reuse only the API `@cos/observability` range fix (^2.1.0) already proposed in PR124 (HEAD3da60db60661199d5f974962d693e3419a2bd036). Baseline npm ci reproduced E404 for its old0.1.0 requirement. No other PR124 changes imported, and that PR remains untouched.
- Lock synchronization reflects existing workspace manifests: root2.1.0, graph/observability2.1.0, visualization/wasm links. No release version bump: this is scoped maintenance, not a new roadmap phase.
- No workflows, gates, deployment settings, secrets or production changed. Commits use [skip ci] for the active FinOps draft stage; hosted validation stays UNVERIFIED, never PASS. No rerun/paid promotion or automatic merge authorized.

## Verification gates

| Check | Result |
|---|---|
| Baseline `npm ci --ignore-scripts --no-audit` | FAIL E404 @cos/observability0.1.0; confirms required workspace repair |
| `npm install --package-lock-only --ignore-scripts --no-audit` | PASS; regenerated lock |
| Candidate clean `npm ci --no-audit` | PASS: 116 packages; repeated on the exact source commit |
| `npm ls --all` | PASS, no missing/invalid dependency |
| Lock and installed-tree inspection | PASS: md-to-pdf/gray-matter/sprintf-js absent; no incoming sprintf-js dependency; pdfkit retained |
| `git diff --check` | PASS |
| `npm run test:all` | ENV_BLOCKED: tsx CLI Unix-socket listen EPERM, before tests |
| `npm run build` | ENV_BLOCKED at same tsx CLI IPC step; compiler not reached |
| Equivalent `node --import tsx scripts/run-tests.ts` | PASS 154/154, exit0 |
| Equivalent remaining test:all scripts | See per-script results below |
| Direct unchanged TypeScript compiler command | FAIL TS5107; also reproduced on immutable base with identical compiler |
| Existing PDF export in a mirrored temporary directory | PASS: valid A4 PDF, 16 pages,19646 bytes, expected metadata/title and extractable text |
| `npm audit --json` | FAIL: two existing HIGH advisories, brace-expansion and markdown-it; sprintf-js absent |

The equivalent runner avoids only tsx CLI IPC; it does not modify the source, suppress assertions or turn failed processes green. tsx4.23.15 was installed by the existing build's `npm install --no-save tsx`; it remains undeclared in this source candidate, as on main. Test results preceding source-commit creation used the identical source tree; a subsequent clean install was performed on the exact commit. No hosted tests executed.

| Equivalent command: `node --import tsx <script>` | Result |
|---|---|
| `scripts/test-level1-diamond.ts` | PASS |
| `scripts/test-level1-mutation.ts` | PASS |
| `scripts/test-level3-consistency.ts` | PASS |
| `scripts/test-level3-mutation.ts` | PASS |
| `scripts/test-level7-compute.ts` | PASS |
| `scripts/test-levels-12-19.ts` | PASS |
| `scripts/test-pipeline-l45l6.ts` | PASS |
| `scripts/test-pipeline-l891011.ts` | PASS |
| `scripts/test-pipeline-l12131415.ts` | PASS |
| `scripts/test-pipeline-l16171819.ts` | PASS |
| `scripts/test-cli-visualizer.ts` | BLOCKED: assertions pass, process timeout |

Visualizer: 23 assertions pass, but process remains open and is terminated after15s. A separate base worktree reproduces the same23/23 plus timeout8s using the same installed toolchain. This is a failing termination gate, not a passed command. Base worktree used shared installed dependencies to isolate unchanged source behavior; it is not a successful clean installation of the old lock.

Direct build diagnostic, also observed on base:

```text
tsconfig.build.json(15,25): error TS5107: Option 'moduleResolution=node10' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
  Visit https://aka.ms/ts6 for migration information.
```

No ignoreDeprecations, timeout suppression or gate weakening was added.

## Reproduce

```bash
git checkout 7bba2b9f4eab33b0ed68ba193ee39453243312f5
npm ci --no-audit
npm ls --all
npm audit --json
npm run test:all
npm run build
# If this environment denies tsx CLI IPC, after the existing build installed tsx:
node --import tsx scripts/run-tests.ts
# Run the remaining script paths in the table independently, with explicit timeouts.
node node_modules/typescript/bin/tsc -p tsconfig.build.json --outDir /tmp/cos-build
# Copy the unchanged scripts/pdf-export.js into /tmp/cos-pdf/scripts;
# create /tmp/cos-pdf/docs, then:
NODE_PATH="$PWD/node_modules" node /tmp/cos-pdf/scripts/pdf-export.js
pdfinfo /tmp/cos-pdf/docs/ROADMAP-v2.1.pdf
pdftotext /tmp/cos-pdf/docs/ROADMAP-v2.1.pdf -
```

Do not run the PDF exporter in the repository root for this check: its hard-coded output would overwrite the tracked PDF. This run used a temporary mirror and preserved the tracked binary. The exporter logs Pages:0 because bufferedPageRange is called after finalization; pdfinfo independently reports16 pages. That existing logging defect was not modified, and visual layout quality was not assessed.

## Independent review

A fresh read-only investigator independently found the unused dependency and PDFKit workflow before editing. A separate fresh read-only candidate reviewer found no concrete bypass/regression: all120 removed records belong to the old md-to-pdf closure, surviving third-party versions remain unchanged, API range matches workspace, and manifest/lock consistency is intact. Reviewer did not independently execute runtime tests. Shared checkout moved to the immutable source candidate during review; comparison remained anchored to the supplied base.

## Remaining risks and NEXT

1. Keep issue OPEN and PR DRAFT; verification outcome remains BLOCKED. No merge/deploy.
2. Resolve existing TypeScript configuration/build and visualizer process termination under their existing owners/PRs (#124/#125), without importing their broad changes here. Requalify the combined source if integrated later.
3. Qualify required commands on a permitted environment and supported runtime; retain local vs hosted provenance. FinOps policy forbids blind reruns or paid fan-out.
4. Two independent HIGH advisories remain. Do not describe the repository as security-clean. Track without blindly broadening this fix.
5. Only after explicitly authorized integration: reread actual main SHA, prove lock/installed closure absence, and verify updater plus accessible alert state. No closing #134 based only on this PR.

## Evidence fingerprints

SHA256 of source files and local command artifacts (raw logs are local execution artifacts; essential outputs and outcomes retained above):

```text
5bc753f28276350836ca55d2b3c318b49d2f7aa730f976acc1921d02d23986da  package.json
be51cf953603003e2d8fe715a84408e076be87319e21e31cc18a35540fc1670b  package-lock.json
24acd473c99af6e21da626989d34297d02a2ecf82052bb7861674287b833bd97  packages/api/package.json
23a864b7e9209bf88c8b74f7561454bb9301701b0214786a6b9b6f700cd2ac32  scripts/pdf-export.js
7125f194612fcff2f454c05d848e7cb71facc1967b4d5017e25b34fdee3ba74f  audit-stderr.log
c47817be05cf2446250c82edd4e603d9473c56a0b02b3a885575fa40ac60f82b  audit.json
89ec2d0d7c810a40a0d9bd718c0cfbd1264ec545f568234d9263441d88b4195b  baseline-ci.log
c9a09857903e1ad31e37e3b49fbba14be1a47d2e787648e55a5655bd6d7845b5  baseline-cli.log
8cb08c5c0b7ca02aece2848f0a9c04cd6db285133a1c985537fd910913117443  baseline-tsc.log
26dad44410666e793f44f9bdfcde4f1ffbc536e55f2eea430f4cffed40dc5633  build.log
b5701b3010f0e1e9ca7721ad5833cf5758cb41f22cd327933f5c38629ae1d43e  candidate-ci.log
23b98efce78ca29c31de32c6afcc201004ea6e0531fcbe2abc7f2bcfe5e586b9  dependency-tree.log
c08d01e3b100a37aac3563fab24883ef9c9cfa4705c67dc90c6779f95fbbb2d9  equivalent-tests.json
346b80c4ae305b78385d1db36492c1b75256477b8ee2bc38498d405de5a7342d  exact-sha-ci.log
e2b9669e515ca65bf95dd0cdf1b3884fff5c8908d430a463e12061bcf981f3c0  exact-sha-pdf.log
23b98efce78ca29c31de32c6afcc201004ea6e0531fcbe2abc7f2bcfe5e586b9  exact-sha-tree.log
7db14e2bb9b121e7be756a00e749877f8c4084b6ab04e8242d6da0a5c540f4ee  lock.log
e2b9669e515ca65bf95dd0cdf1b3884fff5c8908d430a463e12061bcf981f3c0  pdf-export.log
ebabc3e3b01e863272e658dbc44e4234684abe9d3775341419cefc87c5189c09  pdf-info.log
45a909522bc8fd28f1c48ccc6dd138bff2823f25a5fbc64470d372094e6d67c2  pdf-text.txt
2eddf714622cee583775d20a1b5254acac77065de7b6f9bcf7128d31326231eb  test-all.log
c9a09857903e1ad31e37e3b49fbba14be1a47d2e787648e55a5655bd6d7845b5  test-cli-visualizer.ts.log
89f407e5b135f81bad867eee52eab1b3db21cff71aef4f15fb5eff89549bff87  test-import.log
86b04417d033040f3dff15828f7f17c42995045edf64e1483fd18a2e81a700c3  test-level1-diamond.ts.log
e2403e722f5a0cc56f7d9041305938af8ce01832137169d673cf785f537fdc80  test-level1-mutation.ts.log
2d736b684dbcb53a7e1324829bf0d6dc2112448bb866dce871a4b39569b9b2da  test-level3-consistency.ts.log
35cd1704830eea0573ef7e1240df355e6b61f9c70dab424ad148540b9dabc4bb  test-level3-mutation.ts.log
a5c8af2a2e51a47329e8eb0b81837657cb9737e1e621dd3dbbe0d6ad6e8f0eea  test-level7-compute.ts.log
951772e9b93a280a4bd2df090d54360643f9a89169372c9d7a6578e47ad8fcf5  test-levels-12-19.ts.log
1b5a26be470005cff6b8e454b5c5fce6c2852eb4240506d21a402c9b97029ec9  test-pipeline-l12131415.ts.log
8c80881299c0e61d10a4a25a14b9799e259663d6b5c318b8335c43e8fde736cb  test-pipeline-l16171819.ts.log
24aec87d67bb121120c9a50f487f81430850348ff9913e706584e384ccc41315  test-pipeline-l45l6.ts.log
1c3b7770bcbfe3e2ef207532f285a2f0a18482a83847fbf4af0d8bd4e3dbc169  test-pipeline-l891011.ts.log
d19d34a28ccf0ba844532cdbb6e88f1152a3c0123901062d8369ece2f1c7677a  tsc.log
```
