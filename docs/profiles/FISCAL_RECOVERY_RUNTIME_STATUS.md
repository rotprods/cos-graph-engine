# Fiscal Recovery Runtime Status

- Profile contract: separate PR #70.
- Event/identity/runtime slice: this branch.
- CI infrastructure blocker: issue #71.
- Private fiscal evidence: not committed.
- Drive `/FISCAL`: remains raw evidence authority.
- This slice is intentionally source-agnostic and test-fixture based.

Next code slice after CI repair:
1. merge/stack profile contract;
2. add authority-aware L8/L9 projector;
3. add fiscal GraphQL read resolvers;
4. add L11 evidence context compiler;
5. add L13/L14/L15 runtime agent/tool/workflow traces.
