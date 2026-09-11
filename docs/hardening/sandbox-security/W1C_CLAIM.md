# W1C — Sandbox Security Claim

**Status:** QUALIFIED / implementation evidence bound; PR still draft and unmerged  
**Parent:** `fix/durable-memory-w1b` @ `08c90d11d850f7c4f0c95702a4d0a541a1cf5e02`  
**Branch:** `fix/sandbox-security-w1c`  
**Qualified branch head:** `3116b953ebe82d38741ba18c1d121496c13d48b6`  
**Last product-code mutation:** `656e85c9258d8a2fb06eb060d07f9aa08c8c666b`  
**Framing regression-test mutation:** `71ba68aa5639b3a41250c37a9b6b53cbaf47d552`  
**Qualified PR merge checkout:** `1770d4c793b585bc42146497b750ebd599a8da7a`  
**Qualification run/job:** `34601676448` / `103270384719`  
**Evidence artifact:** `10264403436` / `sha256:0b627ea8700dae04d5bccff8313d2090a9cdfc2ce6597ccb27e2d6fd118ca4dd`

## Objective

Replace both in-process JavaScript execution paths with one fail-closed execution boundary that cannot mutate the COS host process and that enforces bounded time, memory and output while denying ambient host capabilities by default.

## Observed parent defects

1. `packages/execution/src/sandbox.ts` executes arbitrary JavaScript with `new Function(code)` in the COS process.
2. Its timeout is `Promise.race`; synchronous CPU-bound code cannot be terminated.
3. It monkey-patches global `console.log` and restoration is not guaranteed on failure.
4. `networkAccess`, `filesystemAccess`, `allowedModules`, `maxMemory` and `maxCpu` are declarative fields without an enforcement boundary.
5. `packages/execution/src/tool-runtime.ts` contains a second `CodeSandbox` based on `node:vm`.
6. Node documents `node:vm` as a context mechanism, not a security mechanism for untrusted code.
7. Node 26 also documents its Permission Model as defence in depth rather than a hostile-code security boundary. W1C therefore does not certify a child Node process merely because `--permission` is enabled.
8. The two implementations can drift and provide contradictory security semantics.

## W1C security contract

The accepted profile is intentionally narrow and uses an OS/container boundary:

- JavaScript only;
- one ephemeral Docker container per execution;
- no host bind mounts and no writable host-backed volumes;
- no application environment variables forwarded into the container;
- `--network=none`;
- read-only container root filesystem;
- non-root container user (`1000:1000`);
- all Linux capabilities dropped;
- `no-new-privileges` enabled;
- bounded PID count;
- Docker hard memory limit derived from `maxMemory`, with swap capped to the same value;
- container CPU throughput capped at one CPU via `--cpus=1.0`;
- `maxCpu` and `timeout` combined into a parent-enforced hard wall execution budget; `maxCpu` is **not** claimed as kernel CPU-time accounting;
- bounded open-file descriptors and private IPC namespace;
- Node Permission Model enabled **inside the container as defence in depth**, not as the primary isolation claim;
- no filesystem/network/child-process/worker/addon/WASI grants to sandboxed user code;
- no arbitrary npm module imports/requires exposed to user code;
- V8 string/wasm code generation disabled inside the execution context;
- parent-enforced hard timeout plus forced container removal;
- byte-accurate bounded protocol/stdout/stderr collection, including multibyte UTF-8 output, with fail-closed termination on overflow;
- result framing parses the first bootstrap-owned marker so marker-looking user output inside the JSON envelope cannot desynchronize the protocol;
- no global console mutation in the COS host;
- one canonical `CodeSandbox` implementation exported by `@cos/execution`.

Capability requests that this slice cannot safely enforce are rejected rather than silently granted.

## Runtime / host compatibility boundary

W1C is **fail closed** when a compatible Docker engine is unavailable. It must never fall back to `new Function`, same-process `node:vm`, an unrestricted child process, or a weakened local execution mode.

The container image/runtime is an explicit part of the security TCB and is version-pinned by digest in code and CI. CI qualification pulls and inspects that exact image contract before executing the security suite.

## Explicit non-claims

W1C does **not** claim:

- VM/microVM-grade hostile multi-tenant isolation;
- immunity to Docker/kernel/container-runtime vulnerabilities;
- perfect seccomp/AppArmor/SELinux equivalence on every host OS;
- exact kernel CPU-time metering from `maxCpu`;
- safe arbitrary npm package loading;
- safe host filesystem/network grants;
- Python/Bash execution;
- multi-tenant side-channel resistance.

Docker memory/PID/file-descriptor/CPU-throughput restrictions plus the parent wall-time kill provide materially stronger resource enforcement than the parent implementation. Reported `memoryUsed` remains a conservative in-container runtime observation rather than a cgroup peak-memory attestation.

A future gVisor/Kata/Firecracker/rootless-worker backend can strengthen the same adapter contract without weakening the default-deny semantics.

## Required RED→GREEN evidence

The qualified W1C gate proves:

- parent host globals remain unchanged;
- parent host prototypes remain unchanged;
- host console is not monkey-patched even when untrusted code throws;
- synchronous infinite loops are terminated;
- unresolved async execution is terminated;
- ASCII and multibyte output flooding are byte-bounded and fail closed;
- `eval` / `Function` code generation and constructor-based string-code escape are blocked;
- `process`, `require`, dynamic module loading and inherited application secrets are unavailable to user code;
- the container runtime contract declares no network and no host bind mounts;
- capability-enable requests fail closed;
- unsupported languages fail closed;
- Docker-unavailable path fails closed with no local execution fallback;
- marker-looking user output cannot desynchronize result framing;
- simple deterministic JavaScript still executes and returns output/result;
- the historical public `CodeSandbox` and `ToolRegistry` compatibility surfaces remain usable;
- all existing repository regressions and the exact W1B coverage floor remain green;
- high-severity dependency audit remains green;
- branch scope remains confined to the declared W1C allowlist and introduces no bypass primitives.

## Qualified evidence

Final post-hardening candidate: branch head `3116b953ebe82d38741ba18c1d121496c13d48b6`, synthetic PR merge checkout `1770d4c793b585bc42146497b750ebd599a8da7a`.

Pull-request Actions run `34601676448`, job `103270384719`, completed all gates successfully. The exact branch-head push run `34601670830`, job `103270217688`, also completed every configured gate successfully.

W1C-specific tests: **17/17 base + 5/5 hardening = 22/22 PASS**.

Coverage from the post-hardening branch-head artifact:

- statements: **81.01%** (W1B floor 78.22%; +2.79 pp)
- branches: **79.46%** (W1B floor 78.93%; +0.53 pp)
- functions: **85.03%** (W1B floor 84.99%; +0.04 pp)
- lines: **81.01%** (W1B floor 78.22%; +2.79 pp)

`npm audit --audit-level=high` reported 0 known vulnerabilities for the tested lockfile at qualification. This is dependency-audit evidence, not an application security certification.

Primary PR-merge artifact `sandbox-security-w1c-1770d4c793b585bc42146497b750ebd599a8da7a`, ID `10264403436`, size `12,959,154` bytes, digest `sha256:0b627ea8700dae04d5bccff8313d2090a9cdfc2ce6597ccb27e2d6fd118ca4dd`.

The exact branch-head artifact is ID `10264263431`, digest `sha256:10362652cda4a3149f9dc371dfc71a386f250486da3750858ae6244be62607ce`.

The qualification environment used Node 26.8.2 and a digest-pinned Node sandbox image `node@sha256:ef24c5053d50fdc3e4e56eb4e7ddb7861874ab0fdc797046ba897581deb8e868`. Root `engines.node >=22.12.0` remains a separate minimum-version compatibility obligation; this W1C qualification does not prove Node 22.12.0 compatibility.

No production/main mutation, PR merge, deployment, host credential grant or global CGEV11 seal is authorized or implied by this qualification.