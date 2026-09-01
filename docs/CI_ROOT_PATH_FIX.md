# CI Root Path Remediation

Issue #71 documents that `.github/workflows/ci.yml`, `deploy.yml` and `release.yml` use `WORKING_DIR: cos` even though the repository itself is the COS root.

Required one-line semantic change in each workflow:

```yaml
WORKING_DIR: .
```

Do not merge feature PRs based on current red Actions state: the jobs fail in `actions/setup-node` before `npm ci` or tests run.

A second cleanup is required for the stale checkout warning about gitlink/submodule path `cos-graph-engine-026bb43d-eec2-4a08-872e-020acdbf97cf`.
