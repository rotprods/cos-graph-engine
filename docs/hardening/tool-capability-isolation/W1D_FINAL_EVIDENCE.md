# W1D Final Evidence — Canonical Tool Capability Isolation

Status: canonical GREEN candidate / documentation-bound requalification required
Date: 2026-09-11

This document binds the integrated W1D authority result to the canonical branch `fix/tool-capability-isolation-w1d` / PR #111. It is intentionally written only after all child slices and the composed W1D.5 candidate qualified independently.

## Canonical ancestry

- qualified W1C parent: `f85fe66bce8079c0e3ec481bbeb3a88bf2c8184c`
- W1D.1 / ROT-80 evidence: `aadd8a1079f5acd2d3f0f9b00af3bd6c8bc83e0b`
- W1D.2 / ROT-81 evidence: `74f06d489aafd844d480eb5392d73039c69d3b54`
- W1D.3 / ROT-82 evidence: `16388346a07593c82817525efb920b3b8a63216c`
- W1D.4 / ROT-83 evidence: `37172869e1f38e24cb035b7031cf1fcc2cca2f78`
- W1D.5 / ROT-84+85 final composed head: `1a602709f3c0697ee47efebebaeb3d7b8e1a80ef`

The canonical branch was fast-forwarded non-forced from W1D.1 to `1a602709f3c0697ee47efebebaeb3d7b8e1a80ef`; GitHub accepted the update as a strict fast-forward. No force push or history rewrite was used.

## Canonical qualification run

- canonical branch head tested: `1a602709f3c0697ee47efebebaeb3d7b8e1a80ef`
- workflow: `Tool Capability Isolation W1D`
- run: `34633077257`

### Node 22.12.0

- exact runtime: `v22.12.0`
- job: `103374310608`
- artifact ID: `10277460913`
- artifact: `tool-capability-isolation-w1d-node22-1a602709f3c0697ee47efebebaeb3d7b8e1a80ef`
- digest: `sha256:983e77e55028709114246790414060319b44518463e5563311e5babfe01b9ade`
- size: `16,715,792` bytes

Same-head gates:

1. exact source/W1C parent binding — PASS
2. exact Node 22.12.0 — PASS
3. pinned W1C Docker sandbox TCB pull/inspect — PASS
4. strict TypeScript — PASS
5. ToolRegistry default-deny contract — PASS
6. filesystem root/symlink confinement contract — PASS
7. HTTP egress SSRF/DNS-pinning/redirect contract — PASS
8. SearchTool provider authority/error/bounds contract — PASS
9. cross-tool denial => zero-side-effect composition — PASS
10. portable W1C sandbox semantic regression — PASS
11. full canonical suite — PASS
12. integrated c8 coverage + immutable W1C ratchet — PASS
13. high-severity dependency audit — PASS
14. canonical W1D scope + anti-bypass — PASS
15. evidence artifact preservation — PASS

Canonical measured coverage:

| metric | immutable W1C floor | canonical W1D | delta |
|---|---:|---:|---:|
| statements | 78.22% | 80.05% | +1.83 pp |
| branches | 78.93% | 80.04% | +1.11 pp |
| functions | 84.99% | 85.80% | +0.81 pp |
| lines | 78.22% | 80.05% | +1.83 pp |

Raw branch coverage: `4,781 / 5,973`.

### Node 26.8.2

- exact runtime: `v26.8.2`
- job: `103374310933`
- artifact ID: `10277973461`
- artifact: `tool-capability-isolation-w1d-node26-1a602709f3c0697ee47efebebaeb3d7b8e1a80ef`
- digest: `sha256:fb5299126dc7ad100541f026a5db1ff2aa5857328387c2c5b3064d516763401e`
- size: `7,726` bytes

Node26 passed strict TypeScript, every W1D authority contract, the cross-tool composition contract, the portable W1C sandbox regression and the full canonical suite.

## Final authority invariants

### Registry

- registration never implies execution authority;
- missing policy binding denies by default;
- policy deny or policy-backend failure occurs before tool execution;
- authorization and execution consume the same structured-cloned snapshot;
- permissions/side-effect classification derive from the registered tool definition;
- allowed dispatch emits deterministic serialized authorization provenance.

### Filesystem

- default instance has zero filesystem authority;
- explicit canonical workspace root required;
- absolute/drive/file-URI/NUL/backslash/encoded traversal inputs fail closed;
- symlink traversal/final symlink mutation denied;
- reads use no-follow final open;
- writes use exclusive no-follow temp + fsync + atomic rename + revalidation;
- destructive paths are revalidated before mutation;
- read/write/list resources are bounded;
- returned created paths are authority-relative, not host-absolute.

### HTTP

- default instance has zero egress authority;
- public egress requires explicit resolver + inner egress policy + pinned transport;
- credentials-in-URL denied before DNS;
- whole DNS answer set classified and mixed public/private answers fail closed;
- private/special/local IPv4 and IPv6 classes are non-overridable deny;
- redirects are reparsed, re-resolved and reauthorized per hop;
- transport receives an already-authorized pinned address plus original hostname semantics;
- redirect/timeout/response-byte budgets are enforced.

### Search

- default instance has zero ambient filesystem search authority;
- file-backed search requires explicit authority-scoped provider;
- provider failures are real failures, never success-with-error;
- provider-returned paths/file classes are validated;
- query/provider-work/result/snippet resources are bounded.

### Composition

Outer registry denial is proven to produce all of the following simultaneously:

- zero filesystem writes;
- zero DNS calls;
- zero HTTP inner-policy calls;
- zero HTTP transport calls;
- zero Search provider calls.

An outer allow does not bypass inner boundaries. Inner FS/HTTP/Search failures remain `success:false`; registry provenance is additive and never converts failure to success.

## Runtime compatibility

The same composed authority semantics and sandbox regression pass on both the declared minimum Node runtime `22.12.0` and comparison runtime `26.8.2`.

The earlier W1D.5 RED cycle also found and repaired two evidence defects before qualification:

- a `tee` pipeline without `pipefail` that could mask a non-zero test exit;
- a Node22 module-loading incompatibility in the historical W1C subprocess harness.

Both were fixed in the evidence harness without weakening sandbox product code.

## Explicit residual seam

W1D does not claim protection against a hostile same-user actor concurrently replacing workspace directory components between kernel path lookups. Portable Node lacks a general directory-fd/openat-style primitive for all mutations. Stronger hostile-concurrent-filesystem isolation requires a broker/openat boundary and remains explicitly outside this slice rather than being silently assumed.

## Final binding rule

Creating this file changes the canonical branch SHA. Therefore the W1D parent issue and PR #111 are not declared fully qualified until the new documentation-bound head repeats the canonical dual-runtime workflow successfully. No global CGEV11 seal is authorized by this document.
