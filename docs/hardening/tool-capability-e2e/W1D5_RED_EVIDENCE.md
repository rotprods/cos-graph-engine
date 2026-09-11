# W1D.5 RED Evidence — Cross-Tool Composition + Runtime Compatibility

Status: RED reproduced before composition port
Date: 2026-09-11

## Bound candidate

- qualified W1D.1 parent: `aadd8a1079f5acd2d3f0f9b00af3bd6c8bc83e0b`
- W1D.5 RED branch head: `cb4a961c03e6ef94ea45e2c3a60448bd6ebd31f4`
- synthetic PR #115 merge: `ed47a1e1f044a8c13a44851f2ff3fdd08274d288`
- Actions run: `34630140709`

### Node 22.12.0 job

- job `103364668897`
- artifact `10275548470`
- artifact digest `sha256:1396fb2a77955b99baea9077d75a3e8f13b1b4f11712ad62644b98d37cab14dd`
- artifact size `3283` bytes

Preconditions passed: exact Node `v22.12.0`, pinned W1C Docker image pull/inspect, strict TypeScript and W1D.1 registry contract `5/5`.

The W1D.5 E2E process itself then printed an assertion failure because the registry-only parent still contains the ambient-authority FileSystemTool:

```text
AssertionError [ERR_ASSERTION]: expected FS_AUTHORITY_UNBOUND to fail closed
true !== false
```

A workflow defect was also exposed: that Node22 E2E command was piped through `tee` without `set -o pipefail`, so the GitHub step incorrectly appeared successful even though Node exited non-zero. This is a **test-harness bypass defect** and must be repaired before any GREEN claim.

The next sandbox step exposed a separate Node22 compatibility seam: subprocess imports produced a non-constructible `CodeSandbox` binding under the current `node --import tsx -e` harness, so all constructor-dependent checks failed before reaching sandbox semantics. This is a harness/module-loading compatibility issue until disproven; no Node22 sandbox qualification is claimed from this run.

### Node 26.8.2 job

- job `103364669024`
- artifact `10276061003`
- artifact digest `sha256:c34cbeb0bd87107f879a1f886ce04966fd31e85babd3137d95055531566f3b31`
- artifact size `1126` bytes

Preconditions passed: exact Node `v26.8.2`, pinned W1C Docker image pull, strict TypeScript and registry contract `5/5`.

Because the Node26 authority-contract block already used `set -euo pipefail`, it correctly stopped on the same E2E composition defect:

```text
AssertionError [ERR_ASSERTION]: expected FS_AUTHORITY_UNBOUND to fail closed
true !== false
```

This cross-runtime agreement proves the composition RED is the intended missing-port condition, not Node-version drift.

## RED conclusions

1. Individually qualified W1D.2/3/4 changes are not yet present in the common W1D.5 candidate. Green child slices do not imply green composition.
2. The W1D.5 workflow itself needs fail-closed pipeline semantics on every command piped through `tee`.
3. Node22 W1C sandbox qualification requires a module-loading-compatible harness before sandbox behavior can be compared fairly with Node26.
4. Product composition must port the already-qualified filesystem, HTTP and Search boundaries without weakening the qualified W1D.1 registry.

No product GREEN or compatibility claim is authorized from this run.
