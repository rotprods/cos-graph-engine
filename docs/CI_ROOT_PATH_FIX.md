# CI / Monorepo Remediation

Issue #71 began with a root-path failure and exposed additional pre-existing repo inconsistencies once tests could actually run.

## Fixed in this branch

1. `ci.yml`, `deploy.yml`, `release.yml` now use repository root:

```yaml
WORKING_DIR: .
```

2. Removed orphan mode-160000 gitlink `cos-graph-engine-026bb43d-eec2-4a08-872e-020acdbf97cf` that had no `.gitmodules` entry.

3. Aligned `packages/api` dependency on local `@cos/observability` with workspace version `2.1.0`.

4. Regenerated `package-lock.json` from current workspace manifests in GitHub Actions and verified a frozen `npm ci` before committing the lock.

5. Once core tests became reachable, restored L8/L9 API/test compatibility:
   - `buildCOS()` now reflects Runtime + Governance and satisfies the documented architecture size;
   - Knowledge Graph metrics expose canonical `nodeCount/edgeCount` plus backward-compatible `entityCount/relationCount`;
   - Semantic Graph restores `findSimilar()` and `findPath()`;
   - legacy semantic node/edge input is normalized;
   - child→parent `is_a` LCA/similarity traversal is corrected.

## Validation standard

A feature PR is not considered green because setup/install works. The infrastructure gate passes only when a clean PR run reaches and passes actual core/graph/observability/visualization/benchmark suites.

## Remaining non-blocking warnings to review separately

The regenerated dependency set reports Node-engine warnings for modern Playwright/Puppeteer/c8 packages under Node 18.20.4. Once the functional suite is green, Node runtime modernization should be handled as a separate compatibility PR rather than mixed into this remediation.
