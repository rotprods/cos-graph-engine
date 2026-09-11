# W1D Donor Ledger — Tool Capability Isolation

Status: ACTIVE / implementation input only
Parent authority: W1C head `f85fe66bce8079c0e3ec481bbeb3a88bf2c8184c`
Target branch: `fix/tool-capability-isolation-w1d`

## Decision rule
Historical branches are donors, not integration authorities. Every atom is classified as `PORT`, `REWORK`, `REJECT`, or `SUPERSEDED`. No wholesale cherry-pick is authorized.

## Donor A — `hardening/phase-05b-capability-isolation`

| Atom | Historical blob | Decision | Reason |
|---|---|---|---|
| `authority-capability-runtime.ts` | `1ae5cc2787b1ab483d15ecd75ef07b4dff12cd5f` | REWORK | Strong single-facade semantics, policy-before-I/O and evidence binding, but tightly coupled to historical side-effect/lease runtime. Do not install a second authority facade beside the current convergence stack. |
| `capability-router.ts` | `145a222e551f810a8c2882fc57027dfd9d9be780` | REJECT AS AUTHORITY / PORT TEST IDEAS | Its authorization hook is optional, so direct `ToolRegistry.execute()` remains a bypass. Useful input-size/private-host/idempotency test ideas survive, but W1D must put default-deny at the registry boundary itself. |
| `strict-tool-registry.ts` | `d57040f406c850c4516887e8a50b55ceaae1b07f` | REWORK | Result invariant validation is valuable, especially rejecting success-with-error, but subclassing an ambient-authority registry does not close capability bypass. Fold invariants after the capability gate or preserve as a downstream wrapper. |
| `authority-isolation.ts` HTTP egress guard | `9631a89c1cf9c17526f7ed0159e3fd70f54bb378` | PORT CONCEPTS / REWORK | DNS pinning, redirect reauthorization, public-IP classification, TTL and policy hashes are correct primitives for ROT-82. Adapt to the current `HTTPTool`; do not expose ordinary `fetch`/hostname re-resolution after authorization. |
| `authority-isolation.ts` filesystem sandbox | `9631a89c1cf9c17526f7ed0159e3fd70f54bb378` | PORT CONCEPTS / REWORK | Opaque broker-opened handles and symlink-aware containment are stronger than lexical `path.resolve`. Use as the design target for ROT-81. |
| `authority-node-file-handle-executor-v2.ts` | `ce05646d60c358c4720539d27081cda152861144` | PORT AFTER BROKER REVIEW | Strong no-reopen invariant, operation allowlist, per-handle queue, deterministic offsets and fsync. It is only safe if paired with an atomic trusted opener; token registration alone is not a confinement boundary. |
| `authority-node-pinned-http-transport.ts` | `7b1c4e4a47bdf6d45736ea2551f334361fe8b4d2` | PORT / HARDEN | Correctly connects to a pre-authorized IP while preserving TLS SNI/Host verification, disables pooling/retries and refuses redirects. Revalidate Node 22.12 behavior and multi-address strategy before adoption. |
| ADR-009 authority isolation boundary | donor document | PORT PRINCIPLES | Preserve the authority model: policy decision and resource pinning must precede privileged I/O; no path/hostname reopen after validation. |

## Donor B — `hardening/w7-policy-security`

| Atom | Commit | Decision | Reason |
|---|---|---|---|
| fail-closed policy evaluation + audit | `bc7acad278daf593539af69a2b8a198d906ad660` | PORT SEMANTICS | Deny/require-approval must be explicit and auditable. Registry authorization failures must not degrade into implicit allow. |
| API cognitive-path policy binding | `d427662e6846c632564d1ab4d866b3a63e18d485` | REWORK LATER | Useful integration precedent, but W1D first secures the lower tool boundary so every higher caller inherits enforcement. |

## Current W1C surface findings

`packages/execution/src/tool-runtime.ts` at W1C head exposes four host-side authority problems that W1D owns:

1. `ToolRegistry.execute()` invokes registered tools with no mandatory authorization gate.
2. `FileSystemTool` resolves arbitrary caller paths against host CWD and permits read/write/delete/list/mkdtemp.
3. `HTTPTool` performs direct DNS/network I/O for caller URLs and therefore has SSRF/DNS-rebinding/private-network exposure.
4. `SearchTool` recursively reads host filesystem and converts traversal/read exceptions into `success: true` with an embedded `error` field.

## Ordered W1D RepairGraph

1. **ROT-80** — install non-bypassable, default-deny authorization in `ToolRegistry`; denial/authorization exception must produce zero tool calls.
2. **ROT-81** — replace ambient filesystem path authority with configured workspace roots + symlink/TOCTOU-safe handle semantics.
3. **ROT-82** — introduce DNS-pinned HTTP egress authorization, public-address enforcement and redirect reauthorization.
4. **ROT-83** — confine SearchTool to authorized roots/providers and make read/traversal failure fail closed.
5. **ROT-84** — cross-tool adversarial proof: every denial family yields zero privileged side effects.
6. **ROT-85** — run the final W1D corpus on exact minimum Node `22.12.0`, not only the newer CI runtime.

## Non-negotiable invariants

- No authorization hook/configuration means **deny**, never legacy ambient allow.
- A denial or authorization exception occurs before `tool.execute()`.
- Capability metadata comes from the registered definition, not caller claims.
- Built-in registration is not equivalent to execution authority.
- Filesystem lexical normalization alone is not a security boundary.
- HTTP URL parsing alone is not an SSRF boundary.
- Tool failures never become `success: true` evidence.
- Any compatibility escape hatch must be explicit, named unsafe, absent from production construction paths, and excluded from the qualified authority path.
