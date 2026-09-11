# W1D.3 RED Evidence — HTTP Egress / SSRF Boundary

Status: RED reproduced before product repair
Date: 2026-09-11

## Bound parent and candidate

- qualified ROT-80 parent: `aadd8a1079f5acd2d3f0f9b00af3bd6c8bc83e0b`
- RED branch head: `0b42f715af51e94e382dceae8f08ec28a686c537`
- synthetic PR #113 merge: `6ceed0440b396433677fc737158010f3568e2a80`
- Actions run: `34628411877`
- job: `103359027759`
- artifact ID: `10275162650`
- artifact digest: `sha256:02dddb118a54d678cd2aef6b39ee2989a396983c77a5e49dd49a6eac89c6b62f`
- artifact size: `789` bytes

## Preconditions proven green

Before the HTTP egress contract failed:

1. exact parent/source binding passed;
2. Node `v22.12.0` exact passed;
3. exact lockfile install passed;
4. strict TypeScript passed;
5. qualified ROT-80 ToolRegistry capability contract remained `5/5 PASS`.

## Reproduced defect

The first W1D.3 invariant creates a controlled loopback HTTP server and invokes the default `HTTPTool` against it. The required behavior is `HTTP_EGRESS_UNBOUND` with zero requests emitted. Instead the current implementation performed ambient host network I/O and returned a success envelope:

```text
AssertionError [ERR_ASSERTION]: expected HTTP_EGRESS_UNBOUND to fail closed
true !== false
```

This proves the tested parent has no mandatory lower egress-authority boundary inside `HTTPTool`: direct construction carries ambient DNS/network authority.

## Repair target

The W1D.3 target is structural rather than hostname-blacklist based:

- default `HTTPTool` has zero egress authority;
- public egress requires an explicit resolver, policy decision and pinned transport;
- special/private/local address classes are non-overridable deny;
- every redirect hop is independently parsed, resolved, classified and authorized;
- transport receives the already-authorized IP and must not perform hostname DNS itself;
- credentials in URLs fail before DNS;
- mixed public/private DNS answers fail closed;
- timeout/response size/redirect budgets are tool-enforced.

This RED evidence demonstrates absence of the invariant on the parent; it does not claim internet-facing exploitability or a deployed attack path.
