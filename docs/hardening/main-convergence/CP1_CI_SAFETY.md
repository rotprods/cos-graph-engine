# CP1 — CI safety implementation, 2026-09-07

Program: COS-MAIN-CONVERGENCE-2026-09-07. Canonical tracker: issue #39.
Status: LOCAL_TARGETED_PASS / NOT_MERGE_QUALIFIED / SHADOW_ONLY.

## Exact source and ownership

Parent: PR #85, `fix/pagerank-correctness-oracle`, commit
`41bd2b10cee542fbf0c257d63eb517d9d3efae98`, tree
`eb033655818721c41ff2796b4cd79fb37ec25971`.

This is one isolated child, not a write to the shared #76/#79/#85 heads.
Runtime source, package manifests, lockfile and production data are unchanged.
The historical AGENTS version-bump instruction is not applied: this task is a
convergence safety repair, not a package release. No publishing is authorized.

Git compare against current #79 (`2dc2ad05b438ca3b3da2c2f440c3cbe2360e180a`)
reports #85 DIVERGED, ahead 1 / behind 3; merge-base
`f4f447184d617c0b5b6185fd1d473c39b307e5c1`. This child deliberately preserves
its exact source, but is NOT the final combined baseline. Reconcile the three
missing #79 commits before main, including its additional diagnostic workflows.
PR metadata naming #79 as base is not proof that #85 contains its current head.

## Defects addressed in this candidate

1. CI published Docker images automatically on main and omitted Docker from
   the final gate. Docker now builds locally in its runner, without login/push,
   and is mandatory for the aggregate result.
2. Deploy listened to CI workflow completion, but its privileged build did not
   depend on check-ci. Deploy is now a manual, explicitly failing freeze guard.
3. Release ran on main pushes and wrote a new version commit before publication.
   Release is now a manual, explicitly failing freeze guard. It is not a fake
   successful release or a production implementation.
4. The final gate depended only on full-regression. It now evaluates every
   direct required job and demands success, exact checkout SHA and a completion
   receipt. Missing, skipped, cancelled, neutral and stale results are rejected.
5. Diagnostic workflows no longer auto-trigger. Audit failure is retained as a
   failure instead of suppressed; its JSON artifact is uploaded even on failure.

Every workflow in this source candidate is workflow_dispatch only. No Actions
run is started by this implementation session. Main and other branches retain
their prior configuration until reviewed integration: this is NOT a global
repository-policy change.

## Verification breadth and deliberate behavior changes

All 30 explicit source CI verification commands are preserved, normalizing
`npx tsx` to `npx --no-install tsx`. The retained surfaces are strict typecheck,
CSR, pruning, graph benchmark tests, WASM build/tests, four observability suites,
three visualization suites, twelve core suites, performance/report generation,
coverage and test:all. The repeated release test commands are covered by these
CI suites; production publication and remote smoke requests are intentionally
frozen, not counted as tested.

The compiled WASM/JS oracle from #85 is invoked explicitly using
`npm test --workspace=@cos/wasm`. Full regression builds WASM after its own clean
install. Artifact uploads reject missing files. The misleading Lint + Type Check
label becomes Strict Type Check: actual lint coverage remains an open gate.

CI installs use --ignore-scripts, with WASM built explicitly. Dependency lifecycle
requirements must be validated in the clean baseline campaign. The root asbuild
script and Dockerfile still use their existing tool resolution; Docker image
base digests and container supply chain remain outside this slice's proof.

Required jobs (also exported by scripts/verify-ci-results.mjs):
ci-contract, lint, test-graph-csr, test-graph-pruning, test-graph-benchmark,
test-wasm, test-observability, test-visualization, test-core, benchmark, coverage,
docker, full-regression. The aggregate job has always() and all thirteen direct
needs. Each job seals only after its configured commands complete.

YAML anchors share identical checkout/install/receipt mappings; no YAML merge
keys are used. Local expanded-AST comparison confirmed equivalence before and
after this deduplication. GitHub documents anchors/aliases in
https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations .

Action v4 refs were resolved through GitHub's Git reference API and pinned:
- actions/checkout: 11d5960a326750d5838078e36cf38b85af677262
- actions/setup-node: 49933ea5288caeca8642d1e84afbd3f7d6820020
- actions/upload-artifact: ea165f8d65b6e75b540449e92b4886f43607fa02

Checkout does not persist credentials. Workflow token permissions are read-only,
or empty for freeze guards. No secret expression or external mutation command
is present in the new workflow steps. This is not a security audit of every
transitive build dependency or an attestation of the GitHub runner.

## Local targeted execution

Executed with Node 22.16.0:

```
node --check scripts/verify-ci-results.mjs
node --test scripts/test-ci-results.mjs
```

Result: 40 tests passed, 0 failed, 0 skipped. Tests include real child-process
exit codes for rejected CI summaries, SHA/receipt checks for every job, immutable
reports, malformed/oversized input and redacted error output. Synthetic summaries
are intentional test fixtures, not claimed GitHub workflow outcomes.

A separate local structural audit using PyYAML 6.0.3 parsed all five workflows,
verified the 30-command source manifest, rejected 16 configuration mutants and
executed the exact deploy/release guard shell bodies (both exit 1). That audit is
not added as a COS runtime dependency or claimed as GitHub execution. Its script,
manifest, logs and results accompany the session evidence bundle.

The aggregate report intentionally sets productionCertified=false. It proves
only the configured job-summary contract, not test completeness, authorization,
runner authenticity, whole-repository correctness or production readiness.

## Replacement / rollback ledger

The source workflows remain recoverable from the exact parent commit:

| Path under .github/workflows | Original Git blob | Disposition |
|---|---|---|
| ci.yml | 5d5286cd08d997b42f33a279dc071920d4fa3b2b | Retain verification; remove publication; add explicit aggregate |
| deploy.yml | bf907241e929b8528e5000bd3a6a2b7533fa1dff | Freeze unsafe deployment, explicitly non-successful |
| release.yml | 47d43a5d3fe21098ad6afc93a64a36be710b58e8 | Freeze publication/version writes; tests retained in CI |
| security-audit-diagnostic.yml | 873e9fce5facba23eed92b03dc22e7a5fc90c76c | Manual diagnostic, preserve audit failure |
| strict-typecheck-remediation.yml | 3ba18c780f3098b08f783280c2befe166fd33891 | Manual diagnostic, preserve typecheck/WASM |

Do not blindly restore automatic publication during rollback. Revert runtime
changes independently while retaining the freeze. Restoring any production
workflow requires a separately reviewed release/deployment contract, verified
protection/environment permissions and owner authorization.

## Open gates / handoff

- CP0: all 94 historical PR metadata rows observed; complete diffs, review threads,
  exact checks, backups and the complete Git ancestry graph remain incomplete.
- Classic main protection returns 403 to this integration. It is UNKNOWN, not
  absent. Rulesets returned []. Do not change or bypass protection.
- #79/#85 divergence must be reconciled and requalified; #76/#79 reviews are not
  complete merely because their workflow files were read.
- Full COS frozen install, global typecheck, compiled WASM, Docker, coverage,
  regression, dependency/security audits and post-merge smoke: NOT_RUN here.
- Real GitHub Actions execution and independent exact-head review: NOT_RUN.
- #97/#98 TCK wiring remains a separate known blocker; untouched here.
- No main merge, package/image publication, deploy, production mutation or
  production certification. CP0, CP1 and CP2 remain OPEN.

Next: verify publication matches executed blobs; record evidence on this PR and
#39; then reconcile the latest #79 changes, review #76/#79/#85 source closures,
and run the safe combined baseline in a clean environment before any main merge.
