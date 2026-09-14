# W1D.5 GREEN Evidence — Cross-Tool Capability Composition

Status: GREEN product candidate / evidence-binding head pending requalification
Date: 2026-09-11

This document qualifies the composed W1D product candidate only after preserving the exact runtime, CI, artifact and coverage provenance below. ROT-84/85 are not closed until this evidence-binding documentation head repeats the same dual-runtime gauntlet.

## Composition ancestry

The common candidate explicitly composes already-qualified W1D slices over the same W1D.1 authority parent:

- W1D.1 / ROT-80 ToolRegistry evidence head: `aadd8a1079f5acd2d3f0f9b00af3bd6c8bc83e0b`
- W1D.2 / ROT-81 filesystem evidence head: `74f06d489aafd844d480eb5392d73039c69d3b54`
- W1D.3 / ROT-82 HTTP egress evidence head: `16388346a07593c82817525efb920b3b8a63216c`
- W1D.4 / ROT-83 SearchTool evidence head: `37172869e1f38e24cb035b7031cf1fcc2cca2f78`

Product composition commit:

- `0c63919c571b4483d4f52cfb24f19996572a137b`

Fail-closed CI/harness head before branch-coverage repair:

- `982006b28936eed8163e65b965c521688def532e`

Coverage-repair test head and qualified W1D.5 product candidate:

- `0e7d12a453e89fb5e1643fd6e5a4565608ea80d8`

No coverage threshold, compiler setting, production authority rule or source exclusion was weakened to reach GREEN.

## Qualified pull-request merge candidate

- PR: #115 `fix/tool-capability-e2e-w1d5` → `fix/tool-capability-isolation-w1d`
- exact branch head: `0e7d12a453e89fb5e1643fd6e5a4565608ea80d8`
- synthetic PR merge checkout used by artifacts: `2dd34e63799b38536e6a36b85def4ddb9166036f`
- Actions run: `34631910561`

## Node 22.12.0 authority qualification

- exact runtime: Node `v22.12.0`
- job: `103370515921`
- artifact ID: `10276154324`
- artifact name: `tool-capability-e2e-w1d5-node22-2dd34e63799b38536e6a36b85def4ddb9166036f`
- artifact digest: `sha256:a42105a370219362883d42297ded5e9afc91d44d590528af22dc3bd7bfec8ac4`
- artifact size: `16,717,558` bytes

Every configured Node22 gate passed on the same candidate:

1. exact source/parent binding — PASS
2. exact Node 22.12.0 assertion — PASS
3. W1C pinned Docker TCB pull/inspect — PASS
4. strict TypeScript — PASS
5. W1D.1 ToolRegistry contract — PASS
6. W1D.2 filesystem confinement contract — PASS
7. W1D.3 HTTP egress/SSRF contract — PASS
8. W1D.4 SearchTool authority contract — PASS
9. W1D.5 cross-tool zero-side-effect composition — PASS
10. portable W1C sandbox semantic regression — PASS
11. full canonical `npm run test:all` — PASS
12. integrated c8 coverage + immutable W1C coverage ratchet — PASS
13. high-severity dependency audit — PASS
14. W1D.5 scope + anti-bypass policy — PASS
15. evidence artifact preservation — PASS

## Node 26.8.2 compatibility qualification

- exact runtime: Node `v26.8.2`
- job: `103370515646`
- artifact ID: `10276715899`
- artifact name: `tool-capability-e2e-w1d5-node26-2dd34e63799b38536e6a36b85def4ddb9166036f`
- artifact digest: `sha256:71284516b83a4a00b505b94aee4a62e56749301b5bad9a0fb6091a3bb85ca808`
- artifact size: `7,730` bytes

Node26 passed strict TypeScript, all W1D child authority contracts, W1D.5 cross-tool composition, the same portable W1C sandbox regression and the full canonical suite.

This demonstrates the composed authority semantics are compatible across the declared minimum Node runtime and the newer comparison runtime used by prior qualification work.

## Coverage ratchet result

The ratchet remained unchanged:

| Metric | Immutable W1C floor | W1D.5 measured | Delta |
|---|---:|---:|---:|
| statements | 78.22% | 80.05% | +1.83 pp |
| branches | 78.93% | 80.04% | +1.11 pp |
| functions | 84.99% | 85.80% | +0.81 pp |
| lines | 78.22% | 80.05% | +1.83 pp |

Measured raw branch counts: `4,781 / 5,973`.

The preceding composed candidate had already passed behavioral/security contracts but was correctly blocked at `78.32%` branches. The repair added deterministic tests for real defensive paths instead of changing thresholds or exclusions: invalid filesystem roots/paths/resource bounds, malformed HTTP inputs/DNS/policy/transport/redirect behavior, malformed Search providers/results/configuration, and ToolRegistry snapshot/provenance failures.

## Proven composition invariants

### Outer authority dominance

A ToolRegistry denial occurs before any inner authority is exercised and therefore produces:

- zero filesystem writes;
- zero DNS resolver calls;
- zero HTTP egress-policy calls;
- zero pinned-transport calls;
- zero Search provider calls.

Authorization infrastructure failure is also fail-closed and produces zero effects.

### Layered allow semantics

An explicit outer allow does not bypass inner boundaries:

- filesystem still enforces explicit canonical root + traversal/symlink confinement;
- HTTP still requires public resolved address set + inner egress policy + pinned transport;
- Search still requires authority-scoped provider outputs and result/file-class bounds;
- inner failures remain `success:false`; the registry adds authorization provenance but never rewrites a failure into success.

### Provenance

Successful or inner-failed allowed dispatches carry a registry-generated serialized authorization receipt binding:

- capability/tool name;
- tool id/version;
- trace id;
- definition-derived permissions;
- side-effect classification;
- decision/reason;
- normalized policy references.

### Default authority posture

The composed built-ins are discoverable but carry zero ambient privileged authority by default:

- default FileSystemTool: no filesystem root;
- default HTTPTool: no resolver/policy/pinned transport;
- default SearchTool: no authority-scoped providers;
- ToolRegistry without policy binding: deny.

## Sandbox compatibility finding

The initial W1D.5 RED run exposed a Node22 module-loading incompatibility in the historical subprocess test harness and a missing `pipefail` on one `tee` pipeline. Both evidence defects were repaired before GREEN without modifying `packages/execution/src/sandbox.ts`.

The portable semantic sandbox harness now resolves named/CJS-default exports consistently and proves on both Node22 and Node26:

- constructible public/direct sandbox exports;
- pinned-container JavaScript execution;
- no inherited host process/secret authority;
- blocked constructor/string-code-generation escape;
- blocked dynamic import;
- hard termination of sync/async hangs;
- byte-bounded output flood failure;
- fail-closed filesystem/network/module grants;
- defensive config API;
- protocol framing integrity;
- Docker-unavailable => fail closed with no host fallback.

## Explicit residual threat-model seam

W1D.2 deliberately does not claim general defense against a hostile same-user actor concurrently replacing workspace directory components between kernel path lookups. Portable Node does not expose a general directory-fd/openat-style primitive for all operations. That stronger adversary requires an OS broker/openat boundary and remains an explicit future hardening seam rather than an unstated guarantee.

## Evidence-binding requirement

This file itself changes the branch head. Therefore this document is **not** the final W1D.5 seal until its new evidence-binding SHA repeats both Node22 and Node26 jobs successfully. Only after that requalification may ROT-84 and ROT-85 transition to Done and the qualified W1D.5 head be promoted into the canonical W1D branch for a final canonical re-run.
