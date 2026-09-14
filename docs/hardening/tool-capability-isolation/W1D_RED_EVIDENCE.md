# W1D RED Evidence — ToolRegistry Default-Deny Capability Boundary

Status: RED reproduced before product repair
Date: 2026-09-11

## Exact parent and candidate

- Qualified W1C parent: `f85fe66bce8079c0e3ec481bbeb3a88bf2c8184c`
- W1D RED branch head: `4c92aab925d5fd54e4547bb327ea5eb2765b6002`
- Synthetic PR #111 merge checkout: `f8943fa8ed433d6ae8afe85d777ce958499398af`
- Actions run: `34627061358`
- job: `103354612482`
- artifact ID: `10274820674`
- artifact digest: `sha256:007e07d5fe8395c05adc29018b0561d26ba7f2445bdaa2c80022a6521bc9b2d6`

## Environment binding

The RED run used the declared minimum runtime exactly:

- Node `v22.12.0`
- npm `10.9.0`
- Ubuntu `24.04.5`
- checkout and setup actions pinned by commit SHA
- `npm ci --ignore-scripts --no-audit --no-fund`

## Preconditions that passed

Before the security contract ran:

1. exact synthetic checkout binding passed;
2. exact W1C parent commit was present;
3. lockfile install passed under Node 22.12.0;
4. runtime-floor assertion `node --version == v22.12.0` passed;
5. strict TypeScript `npx --no-install tsc --noEmit` passed.

Therefore the RED result is not a dependency-install or compiler incompatibility artifact.

## Reproduced defect

The first W1D assertion expected an unbound registry to reject execution with `TOOL_CAPABILITY_DENIED`. Instead the probe tool executed successfully, so the promise did not reject:

```text
AssertionError [ERR_ASSERTION]: expected rejection with TOOL_CAPABILITY_DENIED
    at expectCode (.../scripts/test-tool-capability-w1d.cjs:41:12)
    at async main (.../scripts/test-tool-capability-w1d.cjs:49:3)
```

This reproduces the source-review finding: registration currently implies ambient execution authority because `ToolRegistry.execute()` dispatches directly to `tool.execute()` without a mandatory policy/capability decision.

## Security meaning

This RED evidence proves the absence of the required lower-boundary invariant on the tested parent. It does **not** claim remote exploitability or production exposure. The required repair is structural: authorization must be mandatory inside `ToolRegistry.execute()` itself, before any tool call, so callers cannot bypass policy by skipping an optional router.

## GREEN target

The same immutable test contract must prove:

- no authorization binding => deny;
- explicit deny => zero tool invocations;
- authorization exception => fail closed + zero tool invocations;
- explicit allow => exactly one invocation;
- permissions and side-effect classification derive from the registered definition, never caller input.
