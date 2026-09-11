# W1D.4 RED Evidence — SearchTool Authority Boundary

Status: RED reproduced before product repair
Date: 2026-09-11

## Bound parent and candidate

- qualified ROT-80 parent: `aadd8a1079f5acd2d3f0f9b00af3bd6c8bc83e0b`
- RED branch head: `1a3adcde796498bbfea7c7eaed513976070f8a1a`
- synthetic PR #112 merge: `ec1002dc6e2bee2f4ef7995ef885050450505a28`
- Actions run: `34627988277`
- job: `103357635460`
- artifact ID: `10275181905`
- artifact digest: `sha256:4dfdb33185c4e23676b292700b7f1a926c6341e41c47e150ec86fd7e2e3cc5cb`

## Preconditions proven green

Before the SearchTool contract failed:

1. exact parent/source binding passed;
2. Node `v22.12.0` exact passed;
3. lockfile install passed;
4. strict TypeScript passed;
5. qualified ROT-80 ToolRegistry capability contract remained `5/5 PASS`.

## Reproduced defect

The first SearchTool invariant requires file search without an explicitly authority-scoped provider to fail with `SEARCH_AUTHORITY_UNBOUND`. Instead the current implementation recursively searched the process working tree and returned a success envelope:

```text
AssertionError [ERR_ASSERTION]: expected SEARCH_AUTHORITY_UNBOUND to fail closed
true !== false
```

This reproduces two source-review findings at once:

- SearchTool owns ambient host filesystem traversal independently of the canonical filesystem boundary;
- lack of an authorized search source can still become `success:true` rather than a fail-closed result.

## Repair target

W1D.4 will remove direct filesystem traversal from SearchTool. File-backed search must come from an explicit provider carrying an authority scope. SearchTool itself will validate provider outputs and enforce query/result/snippet/file-class bounds, while provider errors and scope violations become real failures.

This evidence does not claim external exploitability; it demonstrates absence of the required authority invariant on the tested parent.
