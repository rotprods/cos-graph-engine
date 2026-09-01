# Fiscal Runtime Migration Notes

This branch is intentionally data-free. Existing personal fiscal data remains outside the COS kernel repository.

Migration strategy after runtime contracts are green:
1. read durable fiscal exports from adapters;
2. map source IDs through `FiscalIdentityRegistry`;
3. append `EVIDENCE_OBSERVED` and normalization events;
4. project recovery tasks into L1/L3;
5. reconstruct lifecycle states through L2 transitions;
6. compare resulting projections to existing control-plane snapshots;
7. only then enable live mutation workflows.

No destructive migration is allowed. Existing SQLite/GraphML/Drive artifacts remain read-only reference projections until replay equivalence is proven.
