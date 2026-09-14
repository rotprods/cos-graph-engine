# W1C — Exact RED Evidence

**Parent production authority:** `08c90d11d850f7c4f0c95702a4d0a541a1cf5e02` (qualified W1B head)  
**RED candidate:** `3761e57281926ea965664d3fecc108ca58678afb`  
**Production source mutation before RED:** none  
**Workflow run:** `34599046874`  
**Job:** `103261604862`  
**Artifact:** `10263178330`  
**Artifact ZIP SHA-256:** `a7bb415f419ee7d6c08a555be20f5eb051944b2334cb3dcdd00f11301e119adf`

## Preconditions proven

- GitHub-hosted Ubuntu 24.04 runner.
- Node `v26.8.2` installed successfully.
- frozen install succeeded.
- strict `tsc --noEmit` succeeded.
- failure occurred specifically in `W1C sandbox security contract`.
- full regression / coverage / audit were skipped after the intentional RED gate failure.

## RED result

`12 / 14` W1C contracts failed against the untouched W1B production implementation.

### Failures reproduced

1. **Return semantics are inconsistent** — direct `sandbox.ts` execution logged `"hello"` but did not return expression result `42`.
2. **Host global mutation** — untrusted code changed `globalThis.__cosW1cSentinel` from `clean` to `pwned`.
3. **Host prototype pollution** — untrusted code changed host `Object.prototype`.
4. **Global console corruption** — after an exception, `console.log` remained monkey-patched.
5. **Ambient process/secret authority** — the direct in-process sandbox did not establish the required no-`process` boundary.
6. **Dynamic string code generation** — `Function('return 7')()` executed successfully.
7. **Synchronous runaway code** — `while (true) {}` could not be terminated by the sandbox; the outer evidence harness had to SIGKILL the host case process.
8. **Async runaway semantics** — `new Promise(() => {})` was reported as successful instead of being hard-terminated/failing closed.
9. **Output limit not enforced** — observed stdout was `349999` bytes with configured `maxOutput=1024`.
10. **Filesystem capability flag is ceremonial** — a grant-request case never returned normally and had to be killed externally.
11. **Network capability flag is ceremonial** — same failure family.
12. **Module capability flag is ceremonial** — same failure family.

### Parent behaviors that did pass

- unsupported language rejection;
- the separate `tool-runtime.ts` VM implementation hides direct `process` in the simple tested expression.

The latter is **not** accepted as a security proof: Node documents `node:vm` as not being a security mechanism for untrusted code, and W1C also requires one canonical implementation rather than contradictory duplicate sandboxes.

## Conclusion

`W1C_SANDBOX_SECURITY = RED_CONFIRMED`

The repair must replace the in-process execution authority rather than patching individual symptoms. No threshold lowering, test deletion, timeout inflation, or same-process fallback is permitted.
