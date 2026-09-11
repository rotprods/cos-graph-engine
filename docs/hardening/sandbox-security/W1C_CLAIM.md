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
7. The two implementations can drift and provide contradictory security semantics.

## W1C security contract

The first accepted profile is intentionally narrow:

- JavaScript only.
- dedicated child Node process per execution;
- empty/minimal child environment (no inherited application secrets);
- Node Permission Model enabled;
- no filesystem capability;
- no network capability;
- no child-process capability;
- no worker capability;
- no addons/WASI capability;
- no module imports/requires;
- V8 string/wasm code generation disabled inside the execution context;
- parent-enforced hard wall timeout with process termination;
- V8 old-space limit derived from `maxMemory`;
- bounded protocol/stdout/stderr collection;
- no global console mutation in the COS host;
- one canonical `CodeSandbox` implementation exported by `@cos/execution`.

Capability requests that this slice cannot safely enforce are rejected rather than silently granted.

## Runtime compatibility boundary

Network denial was not part of the Node Permission Model in the repository's historical Node 22.12 baseline. W1C therefore must not claim secure network denial on a runtime that cannot enforce it. The sandbox runtime will fail closed when the running Node version is below the minimum permission-model version required by this implementation.

This is preferable to executing untrusted code under a false security claim.

## Explicit non-claims

W1C does **not** claim:

- kernel/container-grade hostile multi-tenant isolation;
- seccomp/AppArmor/SELinux/macOS Sandbox parity;
- precise kernel CPU quota accounting (`maxCpu` is a hard execution budget, not cgroup CPU accounting);
- RSS-hard memory cgroups (V8 heap is bounded; parent/OS overhead is separate);
- safe arbitrary npm package loading;
- safe filesystem/network grants;
- Python/Bash execution.

A future container/namespace backend can strengthen these without weakening this default-deny contract.

## Required RED→GREEN evidence

The W1C gate must prove at least:

- parent host globals remain unchanged;
- synchronous infinite loops are terminated;
- unresolved async execution is terminated;
- output flooding is bounded and terminates execution;
- `eval` / `Function` code generation is blocked;
- `process`, `require`, module loading and inherited secrets are unavailable to sandbox code;
- capability-enable requests fail closed;
- unsupported languages fail closed;
- simple deterministic JavaScript still executes and returns output/result;
- all existing repository regressions and the W1B floor remain green.

No production/main mutation is authorized by this claim.