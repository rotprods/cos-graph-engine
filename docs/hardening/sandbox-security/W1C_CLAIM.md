# W1C — Sandbox Security Claim

**Status:** CLAIMED / implementation not yet certified  
**Parent:** `fix/durable-memory-w1b` @ `08c90d11d850f7c4f0c95702a4d0a541a1cf5e02`  
**Branch:** `fix/sandbox-security-w1c`

## Objective

Replace both in-process JavaScript execution paths with one fail-closed execution boundary that cannot mutate the COS host process and that enforces bounded time, memory and output while denying ambient host capabilities by default.

## Observed parent defects

1. `packages/execution/src/sandbox.ts` executes arbitrary JavaScript with `new Function(code)` in the COS process.
2. Its timeout is `Promise.race`; synchronous CPU-bound code cannot be terminated.
3. It monkey-patches global `console.log` and restoration is not guaranteed on failure.
4. `networkAccess`, `filesystemAccess`, `allowedModules`, `maxMemory` and `maxCpu` are declarative fields without an enforcement boundary.
5. `packages/execution/src/tool-runtime.ts` contains a second `CodeSandbox` based on `node:vm`.
6. Node documents `node:vm` as a context mechanism, not a security mechanism for untrusted code.
7. Node 26 also documents its Permission Model as a defence-in-depth / accidental-access control, **not** a hostile-code security boundary. W1C therefore may not certify a child Node process merely because `--permission` is enabled.
8. The two implementations can drift and provide contradictory security semantics.

## W1C security contract

The first accepted profile is intentionally narrow and uses a real OS/container boundary:

- JavaScript only.
- one ephemeral Docker container per execution;
- no host bind mounts;
- empty/minimal container environment (no inherited application secrets);
- `--network=none`;
- read-only container root filesystem;
- all Linux capabilities dropped;
- `no-new-privileges` enabled;
- bounded PID count;
- Docker memory and CPU quotas derived from sandbox config;
- bounded writable tmpfs only where runtime mechanics require it, with `nosuid`/`noexec` where compatible;
- Node Permission Model enabled **inside the container as defence in depth**, not as the primary isolation claim;
- no filesystem/network/child-process/worker/addon/WASI grants to the sandboxed Node process;
- no arbitrary npm module imports/requires exposed to user code;
- V8 string/wasm code generation disabled inside the execution context;
- parent-enforced hard wall timeout plus forced container removal;
- bounded protocol/stdout/stderr collection with forced termination on overflow;
- no global console mutation in the COS host;
- one canonical `CodeSandbox` implementation exported by `@cos/execution`.

Capability requests that this slice cannot safely enforce are rejected rather than silently granted.

## Runtime / host compatibility boundary

W1C is **fail closed** when a compatible Docker engine is unavailable. It must never fall back to `new Function`, same-process `node:vm`, an unrestricted child process, or a weakened local execution mode.

The container image/runtime is an explicit part of the security TCB and must be version-pinned in code/evidence. CI qualification runs against the same declared sandbox image contract.

## Explicit non-claims

W1C does **not** claim:

- VM/microVM-grade hostile multi-tenant isolation;
- immunity to Docker/kernel/container-runtime vulnerabilities;
- perfect seccomp/AppArmor/SELinux equivalence on every host OS;
- safe arbitrary npm package loading;
- safe host filesystem/network grants;
- Python/Bash execution;
- multi-tenant side-channel resistance.

Docker quotas provide materially stronger resource enforcement than the parent implementation, but W1C still records wall-clock timeout separately from CPU quota and reports memory usage conservatively.

A future gVisor/Kata/Firecracker/rootless-worker backend can strengthen the same adapter contract without weakening the default-deny semantics.

## Required RED→GREEN evidence

The W1C gate must prove at least:

- parent host globals remain unchanged;
- parent host prototypes remain unchanged;
- host console is not monkey-patched even when untrusted code throws;
- synchronous infinite loops are terminated;
- unresolved async execution is terminated;
- output flooding is bounded and terminates execution;
- `eval` / `Function` code generation is blocked;
- `process`, `require`, module loading and inherited secrets are unavailable to user code;
- container has no network;
- container cannot see host filesystem through an implicit mount;
- capability-enable requests fail closed;
- unsupported languages fail closed;
- Docker-unavailable path fails closed;
- simple deterministic JavaScript still executes and returns output/result;
- all existing repository regressions and the W1B coverage floor remain green.

No production/main mutation is authorized by this claim.