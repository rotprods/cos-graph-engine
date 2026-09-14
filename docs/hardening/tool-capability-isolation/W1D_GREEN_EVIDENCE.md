# W1D GREEN Evidence — ROT-80 ToolRegistry Default-Deny Capability Boundary

Status: ROT-80 QUALIFIED / W1D REMAINS ACTIVE
Date: 2026-09-11

This evidence qualifies only the registry capability-gate slice (ROT-80). Filesystem confinement, HTTP egress isolation, SearchTool hardening and cross-tool E2E remain separate W1D nodes.

## Qualified product candidate

- W1C qualified parent: `f85fe66bce8079c0e3ec481bbeb3a88bf2c8184c`
- product head: `fb9b5ca0fe1a226d61a7e54895a44b39933b7b04`
- synthetic PR #111 merge checkout: `0b2a32fb68552775d5ddc165f3413e5943a9c5f1`
- Actions run: `34627514320`
- qualification job: `103356088535`
- artifact ID: `10275310543`
- artifact digest: `sha256:9dcc5aa9592c181ac4bb9d1feee9d27c6f798384e1828aa9c46103464f749b8d`
- artifact size: `8768` bytes

## Exact runtime floor

The qualification workflow binds the declared minimum Node runtime, not a newer substitute:

- Node `v22.12.0`
- exact lockfile install with `npm ci --ignore-scripts --no-audit --no-fund`

## Gate result

Every configured ROT-80 gate passed on the same synthetic merge candidate:

1. exact source/parent binding — PASS
2. exact Node 22.12.0 runtime assertion — PASS
3. strict TypeScript (`tsc --noEmit`) — PASS
4. immutable W1D ToolRegistry capability contract — PASS
5. full canonical `npm run test:all` — PASS
6. high-severity dependency audit — PASS
7. W1D scope + anti-bypass policy — PASS
8. qualification artifact preservation — PASS

## Proven invariants

The qualified registry path now establishes all of the following before privileged tool dispatch:

- missing authorization binding is deny-by-default;
- explicit policy denial causes zero tool invocations;
- authorization infrastructure exceptions fail closed and cause zero tool invocations;
- explicit allow executes exactly once;
- capability permissions come from the registered `ToolDefinition`, never caller-supplied input;
- side-effect classification is definition-derived (`write`, `execute`, `admin`);
- authorization and tool execution consume the same structured-cloned input/context snapshot;
- successful dispatches carry a registry-generated serialized authorization receipt in `ToolResult.metadata`, binding capability, tool id/version, trace id, permissions, side-effect class, decision reason and policy references.

## Repair history

- RED contract commit: `b74b73e3712eb4a364023ed51511402bd3fc6fab`
- RED evidence seal: `ef53dedd56531c4ab77199cf9cfe7acbd0273f1a`
- first product repair: `662868f80b844b6bbe51fdd9b942078944fea513`
- strict-type repair: `fb9b5ca0fe1a226d61a7e54895a44b39933b7b04`

The first product attempt was correctly rejected by strict TypeScript because nested authorization provenance did not match the existing scalar-only metadata contract. The repair preserved provenance by serializing the receipt rather than weakening `ToolResult`, adding casts, or relaxing compiler settings.

## Residual scope

This document is **not** a W1D completion seal. Remaining nodes:

- ROT-81 — canonical filesystem workspace confinement + symlink/TOCTOU safety
- ROT-82 — HTTP SSRF/private-network/DNS/redirect fail-closed policy
- ROT-83 — SearchTool traversal/error/authority hardening
- ROT-84 — denial => zero privileged side effects across built-ins
- ROT-85 — final integrated W1D minimum-runtime qualification after all slices compose
