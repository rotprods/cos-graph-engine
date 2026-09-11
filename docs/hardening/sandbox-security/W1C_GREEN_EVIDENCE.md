# W1C — Qualified GREEN Evidence

Status: **QUALIFIED_IMPLEMENTATION / PR DRAFT / UNMERGED**

This record binds the sandbox-security claim to one exact CI candidate. It is not a statement that `main`, a deployment, or CGEV11 as a whole is qualified.

## Identity

- parent W1B: `08c90d11d850f7c4f0c95702a4d0a541a1cf5e02`
- qualified W1C source-code head: `33d328d9bf268af8d7e1d42bae95c2d56d7cfeb4`
- qualified synthetic PR merge checkout: `be1ffd104f7e2f3db11f544a2ca891ddb3c4ee54`
- PR: #110 `fix/sandbox-security-w1c` → `fix/durable-memory-w1b`
- Actions run: `34601114145`
- job: `103268383032`
- artifact: `10263839679`
- artifact name: `sandbox-security-w1c-be1ffd104f7e2f3db11f544a2ca891ddb3c4ee54`
- artifact size: `12,876,366` bytes
- artifact digest: `sha256:357a0d4495c0c0d55e43f63d16e07bec9b5c2ee84dab3948b34f17a244d695cd`

The evidence/claim documentation commits that follow this source-code head do not retroactively change the qualified code bytes. Any later product-code mutation requires a new qualification run and new evidence identity.

## GREEN gate matrix

All configured final gates completed successfully in run `34601114145`:

1. exact checkout / parent-source identity binding — PASS
2. Node + npm setup — PASS
3. dependency install — PASS
4. pinned Docker TCB pull/inspect — PASS
5. strict TypeScript — PASS
6. W1C base adversarial sandbox suite — 17/17 PASS
7. W1C hardening/compatibility suite — 4/4 PASS
8. canonical full repository regression suite — PASS
9. integrated canonical + W1C coverage — PASS
10. W1B exact coverage ratchet — PASS without floor reduction
11. `npm audit --audit-level=high` — PASS, 0 known vulnerabilities for tested lockfile/run
12. W1C scope / anti-bypass policy — PASS
13. evidence artifact preservation — PASS

## Coverage

| Metric | W1B floor | W1C qualified | Delta |
|---|---:|---:|---:|
| Statements | 78.22% | 81.04% | +2.82 pp |
| Branches | 78.93% | 79.46% | +0.53 pp |
| Functions | 84.99% | 85.03% | +0.04 pp |
| Lines | 78.22% | 81.04% | +2.82 pp |

Relevant package evidence:

- `packages/execution/src`: statements 98.33%, functions 94.64%
- `sandbox.ts`: statements 97.49%, functions 100%
- `tool-runtime.ts`: statements 99.66%, functions 90.32%

Coverage percentages are test instrumentation evidence, not proof that every security property is covered.

## Qualification environment

- Ubuntu 24.04.5
- Node 26.8.2
- npm 11.19.1
- Docker 28.0.4
- sandbox runtime image pinned by digest in code/CI

Root package compatibility declares Node `>=22.12.0`. Node 22.12.0 remains unqualified by this run and must be tested independently rather than inferred from Node 26 success.

## RED provenance

Untouched W1B-parent RED evidence:

- run `34599046874`
- job `103261604862`
- artifact `10263178330`
- 12/14 W1C security assertions failed, reproducing the parent pseudo-sandbox weakness families before product mutation.

This preserves the causal chain: parent defect → regression reproducer → repair → exact GREEN qualification.

## Security non-claims

This qualification does not assert:

- VM/microVM hostile multi-tenant isolation;
- immunity to Docker/kernel/container runtime vulnerabilities;
- arbitrary host filesystem/network grants;
- safe arbitrary package loading;
- Python/Bash execution;
- multi-tenant side-channel resistance;
- exact kernel CPU-time accounting from `maxCpu`;
- deployment or production credential safety;
- security of the host-side ToolRegistry/FileSystemTool/HTTPTool/SearchTool capability surface, which is the next W1D scope.

## Next canonical security slice

W1D: host-side Tool Capability Isolation. Required defect families include:

- default-deny policy at ToolRegistry dispatch;
- workspace-root and symlink-safe FileSystemTool confinement;
- SSRF/private/link-local/metadata/DNS/redirect controls for HTTPTool;
- SearchTool traversal/error fail-closed semantics;
- denied-tool zero-side-effect E2E tests;
- minimum supported Node 22.12.0 compatibility qualification.

W1C can move to review. It must not be called merged, main-qualified, production-qualified, or `CGEV11_SUBLIME_STATE_VERIFIED`.