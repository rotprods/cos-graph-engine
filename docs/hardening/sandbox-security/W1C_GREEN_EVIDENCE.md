# W1C — Qualified GREEN Evidence

Status: **QUALIFIED_IMPLEMENTATION / PR DRAFT / UNMERGED**

This record binds the sandbox-security claim to one exact post-hardening CI candidate. It is not a statement that `main`, a deployment, or CGEV11 as a whole is qualified.

## Identity

- parent W1B: `08c90d11d850f7c4f0c95702a4d0a541a1cf5e02`
- qualified W1C branch head: `3116b953ebe82d38741ba18c1d121496c13d48b6`
- last product-code mutation in this qualification chain: `656e85c9258d8a2fb06eb060d07f9aa08c8c666b`
- framing regression-test mutation: `71ba68aa5639b3a41250c37a9b6b53cbaf47d552`
- qualified synthetic PR merge checkout: `1770d4c793b585bc42146497b750ebd599a8da7a`
- PR: #110 `fix/sandbox-security-w1c` → `fix/durable-memory-w1b`
- pull-request Actions run: `34601676448`
- qualification job: `103270384719`
- PR-merge evidence artifact: `10264403436`
- artifact name: `sandbox-security-w1c-1770d4c793b585bc42146497b750ebd599a8da7a`
- artifact size: `12,959,154` bytes
- artifact digest: `sha256:0b627ea8700dae04d5bccff8313d2090a9cdfc2ce6597ccb27e2d6fd118ca4dd`
- exact branch-head push run: `34601670830`
- push job: `103270217688`
- push artifact: `10264263431`
- push artifact digest: `sha256:10362652cda4a3149f9dc371dfc71a386f250486da3750858ae6244be62607ce`

The prior `33d328d9bf268af8d7e1d42bae95c2d56d7cfeb4` qualification remains valid historical evidence for the pre-framing-hardening candidate, but is superseded as W1C authority by the exact post-hardening candidate above.

This evidence-binding documentation commit does not mutate product code. Any later product-code or security-test mutation requires a new qualification identity.

## GREEN gate matrix

All configured gates completed successfully on both the exact branch head and its PR merge checkout. The stronger PR merge run `34601676448` is the primary qualification authority:

1. exact checkout / parent-source identity binding — PASS
2. Node + npm setup — PASS
3. frozen dependency install — PASS
4. pinned Docker TCB pull/inspect — PASS
5. strict TypeScript — PASS
6. W1C base adversarial sandbox suite — 17/17 PASS
7. W1C hardening/compatibility suite — 5/5 PASS
8. protocol-marker collision regression — PASS
9. canonical full repository regression suite — PASS
10. integrated canonical + W1C coverage — PASS
11. W1B exact coverage ratchet — PASS without floor reduction
12. `npm audit --audit-level=high` — PASS, 0 known vulnerabilities for tested lockfile/run
13. W1C scope / anti-bypass policy — PASS
14. evidence artifact preservation — PASS

## Coverage

Measured from the exact post-hardening branch-head evidence artifact; the PR merge checkout passed the same ratchet:

| Metric | W1B floor | W1C qualified | Delta |
|---|---:|---:|---:|
| Statements | 78.22% | 81.01% | +2.79 pp |
| Branches | 78.93% | 79.46% | +0.53 pp |
| Functions | 84.99% | 85.03% | +0.04 pp |
| Lines | 78.22% | 81.01% | +2.79 pp |

Coverage percentages are test instrumentation evidence, not proof that every security property is covered.

## Security properties demonstrated

The qualified suites directly exercise and pass these W1C properties:

- untrusted JavaScript does not mutate host globals or host prototypes;
- host `console` remains intact after untrusted exceptions;
- `process`, inherited secrets and dynamic string code generation are denied to sandbox code;
- constructor-based escape and dynamic module import paths remain denied;
- synchronous infinite loops and unresolved async execution are terminated;
- ASCII and multibyte UTF-8 output flooding are byte-bounded and fail closed;
- user output containing the internal result-marker string cannot desynchronize the parent protocol parser;
- filesystem, network and module capability requests fail closed in the W1C profile;
- malformed resource configuration is rejected before container execution;
- missing Docker authority fails closed with no local execution fallback;
- unsupported languages fail closed;
- historical public `CodeSandbox` export and `ToolRegistry` compatibility surface remain executable.

## Qualification environment / TCB

- Ubuntu 24.04.5 GitHub-hosted runner family used by the qualification workflow
- Node 26.8.2
- Docker runtime verified before security execution
- sandbox image pinned and inspected by exact digest:
  `node@sha256:ef24c5053d50fdc3e4e56eb4e7ddb7861874ab0fdc797046ba897581deb8e868`

Root package compatibility declares Node `>=22.12.0`. Node 22.12.0 remains unqualified by this W1C run and must be tested independently rather than inferred from Node 26 success.

## RED provenance

Untouched W1B-parent RED evidence:

- parent: `08c90d11d850f7c4f0c95702a4d0a541a1cf5e02`
- run: `34599046874`
- job: `103261604862`
- artifact: `10263178330`
- artifact digest: `sha256:a7bb415f419ee7d6c08a555be20f5eb051944b2334cb3dcdd00f11301e119adf`
- result: 12/14 W1C assertions failed before product repair

This preserves the causal chain: parent defect → reproducible RED → boundary repair → adversarial hardening → exact GREEN branch + PR-merge qualification.

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
- security of the host-side ToolRegistry/FileSystemTool/HTTPTool/SearchTool capability surface.

## Next canonical boundary

W1C can move to review but remains draft and unmerged. The integration order remains W1B #109 → W1C #110.

After that convergence checkpoint, the broader CGEV2/COS train can resume the deferred `/GRAPHIFY` semantic/persistence integration. Host-side tool-capability isolation remains an explicit subsequent security slice and must not be silently conflated with W1C.

W1C must not be called merged, main-qualified, production-qualified, or `CGEV11_SUBLIME_STATE_VERIFIED`.