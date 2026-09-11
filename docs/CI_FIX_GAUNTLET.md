# CI Fix Acceptance

- root `package-lock.json` resolves in setup-node cache.
- npm ci executes.
- test jobs reach test steps.
- deploy/release use root context.
- orphan mode-160000 gitlink is removed or properly declared.
- PR #70/#72/#73/#74/#75 are rerun only after infrastructure fix lands.
