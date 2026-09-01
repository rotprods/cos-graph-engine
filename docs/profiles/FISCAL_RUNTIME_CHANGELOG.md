# Fiscal Runtime Changelog

## 2026-09-01

### Added
- `FiscalEventStore` append-only hash-chained event log.
- `FiscalIdentityRegistry` namespace-scoped canonical alias registry.
- `projectFiscalRecoveryTasks()` for L1/L3 projections.
- L2 fiscal lifecycle machines and evidence policy gate.
- runtime contract tests.

### Known blockers
- CI does not reach tests because workflow `WORKING_DIR` is wrong; tracked in #71.
- This branch was created independently from profile PR #70; integration/export conflicts must be resolved in the eventual stacked/merge sequence.
