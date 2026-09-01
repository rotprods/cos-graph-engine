# Stacking Sequence

Expected merge order:
1. CI infrastructure fix (#71 / dedicated PR).
2. COS 20D fiscal-financial profile PR #70.
3. Fiscal event/identity/L1-L3 runtime PR-B.
4. L8/L9 + GraphQL read layer.
5. Authority-aware GraphRAG.
6. L13-L15 agent/tool/workflow runtime.
7. persistence/replay and zero-context benchmark.

PR-B is independent in Git history today and must be reconciled with #70 before merge.
