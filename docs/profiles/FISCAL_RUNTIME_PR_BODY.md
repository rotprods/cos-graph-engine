# PR-B Summary

Adds the first executable fiscal recovery runtime slice:

- append-only hash-chained `FiscalEventStore`;
- canonical identity registry with collision protection;
- L1 ExecutionGraph + L3 DependencyGraph projector from recovery backlog;
- L2 evidence/filing/payment/invoice state machines;
- domain policy gates that reject unsafe FILED/PAID/RECTIFIED promotions;
- runtime contract tests;
- security, migration and merge-gate documentation.

No private fiscal evidence is committed.

Known external blocker: repository CI does not currently reach tests because `.github/workflows/*` still resolve `WORKING_DIR: cos`; tracked in #71.
