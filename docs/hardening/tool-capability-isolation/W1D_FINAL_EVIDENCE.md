# W1D Canonicalization Reconciliation — 2026-09-11

Status: REPAIR CANDIDATE — requalification required

This file supersedes the previous canonical W1D ledger because live GitHub reconciliation found that PR #111 branch head `eb1e56fd0522155f0442d856ff729814fa9f02b1` contained the W1D.1 registry lineage plus a final-evidence document, but did not contain the independently qualified W1D.2–W1D.5 product composition. The previously recorded synthetic heads `1a602709...` and `c54749ad...` are therefore not accepted as repository authority.

No global W1D qualification claim is valid solely from that earlier ledger.

## Live authoritative inputs

- W1C parent: `f85fe66bce8079c0e3ec481bbeb3a88bf2c8184c`
- W1D.1 canonical registry head: `aadd8a1079f5acd2d3f0f9b00af3bd6c8bc83e0b`
- prior #111 ledger-only head: `eb1e56fd0522155f0442d856ff729814fa9f02b1`
- last independently composed W1D product/evidence head that actually exists and passed the dual-runtime gauntlet: `a6f32b5a31ec5854111adfaa31be3e6a5ce1135c`
- W1D.5 qualified run for that existing head: `34632181477`

The composed head `a6f32b5a...` is a strict descendant of `aadd8a...` and contains the qualified filesystem, HTTP, Search and cross-tool composition implementation and regression contracts.

## Repair rule

The repaired canonical branch must preserve both histories without force rewriting:

1. current #111 head remains a parent;
2. `a6f32b5a...` remains a parent;
3. resulting tree is based on the composed `a6f32b5a...` tree;
4. this corrected ledger and a dual-runtime canonical workflow are layered onto that composed tree;
5. the resulting merge head must pass the full Node 22.12.0 and Node 26.8.2 canonical gauntlet before W1D is re-declared qualified.

## Required requalification

Node 22.12.0 must pass: exact ancestry binding, pinned sandbox TCB, strict TypeScript, W1D.1 registry, W1D.2 filesystem, W1D.3 HTTP egress, W1D.4 Search authority, W1D.5 cross-tool zero-side-effect E2E, portable W1C sandbox, full canonical suite, integrated c8 plus immutable W1C coverage ratchet, high-severity audit, scope/anti-bypass and artifact preservation.

Node 26.8.2 must pass the same behavioral/security authority contracts, sandbox regression, strict TypeScript and full canonical suite.

Until that new head is green, Linear ROT-79/84/85 completion status is historical bookkeeping and must not be interpreted as current repository qualification authority.
