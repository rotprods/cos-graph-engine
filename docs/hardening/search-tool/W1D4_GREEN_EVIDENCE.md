# W1D.4 GREEN Evidence — SearchTool Authority Boundary

Status: GREEN candidate / evidence-binding requalification pending
Date: 2026-09-11

## Qualified product candidate

- qualified ROT-80 parent: `aadd8a1079f5acd2d3f0f9b00af3bd6c8bc83e0b`
- SearchTool product head: `bc12a7207ed1a4477dc5387f7b4efa2c02135d07`
- synthetic PR #112 merge: `bb135487a70c7ea64af2782fa771884ed7a91938`
- Actions run: `34628237556`
- job: `103358444528`
- artifact ID: `10275202368`
- artifact digest: `sha256:4e8c8b03bf48561472f7ad653d0b89f3b2ddad8f17878530e092db1073192fa7`
- artifact size: `10857` bytes

## Same-candidate gates

1. exact parent/source binding — PASS
2. Node `v22.12.0` exact — PASS
3. strict TypeScript — PASS
4. qualified ROT-80 ToolRegistry regression — PASS (`5/5`)
5. W1D.4 SearchTool authority/error/bounds contract — PASS (`8/8`)
6. full canonical `npm run test:all` — PASS
7. high-severity dependency audit — PASS
8. scope and anti-bypass policy — PASS
9. artifact preservation — PASS

## Qualified architecture

SearchTool no longer owns direct host filesystem traversal. Its file-backed authority is now supplied by explicit `SearchProvider` instances. The tool itself:

- fails closed with `SEARCH_AUTHORITY_UNBOUND` when the requested source has no provider;
- propagates provider failures as `SEARCH_PROVIDER_ERROR` rather than success-with-error;
- rejects absolute/parent-traversal provider paths as `SEARCH_SCOPE_VIOLATION`;
- enforces provider-declared file classes for file sources;
- clamps provider work and result count before dispatch;
- bounds snippet length;
- bounds query size before provider invocation;
- emits scalar source/provider/authority provenance in result metadata;
- preserves the previously qualified registry capability boundary.

The default built-in `SearchTool` is therefore discoverable but has zero ambient filesystem read authority until an authority-scoped provider is explicitly bound.

## Residual W1D scope

This qualifies ROT-83 only. ROT-81 filesystem authority, ROT-82 HTTP egress and ROT-84 cross-tool side-effect proofs remain open, followed by final integrated ROT-85 qualification.
