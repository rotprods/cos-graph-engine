# W1D.3 GREEN Evidence — HTTP Egress / SSRF Boundary

Status: GREEN candidate / evidence-binding requalification pending
Date: 2026-09-11

## Qualified product candidate

- qualified ROT-80 parent: `aadd8a1079f5acd2d3f0f9b00af3bd6c8bc83e0b`
- HTTP product head: `a729dd8625e1e64e96f259f7e3e12412e0b8605e`
- synthetic PR #113 merge: `5ed75599445be4e78e0763b723740e28c50d6014`
- Actions run: `34628947727`
- job: `103360788110`
- artifact ID: `10274973842`
- artifact digest: `sha256:0a0e42766ea1467f50b8a13e899234ea0de435e756a39e2a8e4deb35f54c6d41`
- artifact size: `13230` bytes

## Same-candidate gates

1. exact parent/source binding — PASS
2. exact Node `v22.12.0` — PASS
3. strict TypeScript — PASS
4. qualified ROT-80 ToolRegistry regression — PASS (`5/5`)
5. W1D.3 HTTP egress SSRF/pinning/redirect/budget contract — PASS
6. full canonical `npm run test:all` — PASS
7. high-severity dependency audit — PASS
8. scope + anti-bypass policy — PASS
9. evidence artifact preservation — PASS

## Qualified HTTP authority model

The default `HTTPTool` now carries zero ambient egress authority. A network operation requires all three dependencies to be explicitly bound: resolver, authorization policy and pinned transport.

Per request/redirect hop, the tool:

- accepts only HTTP/HTTPS and denies credentials embedded in URLs before DNS;
- resolves once through the bound resolver (or recognizes an IP literal);
- normalizes the whole DNS answer set and fails closed if any member is invalid/non-public;
- applies a non-overridable address classifier before policy;
- invokes explicit egress policy only after the address set is proven public;
- fails closed if the policy backend throws or denies;
- deterministically pins one already-authorized address into the transport request while preserving the original hostname for TLS/Host semantics;
- does not permit implicit transport redirects; each redirect is reparsed, re-resolved and reauthorized;
- strips credential-bearing headers across origin-changing redirects;
- enforces redirect, timeout and response-byte budgets inside the tool;
- returns scalar pinned-address/policy/redirect provenance.

## Adversarial address coverage

The contract denies transport for 19 special/local address classes across IPv4 and IPv6, including unspecified, loopback, RFC1918, CGNAT, IPv4/IPv6 link-local, cloud-metadata address space, IPv6 ULA, multicast, benchmarking/documentation ranges and IPv4-mapped IPv6 local/metadata forms. It also proves mixed public/private DNS answers fail closed.

## Residual W1D scope

This document qualifies the ROT-82 product candidate only. An evidence-binding documentation head must re-run the same gate before ROT-82 is closed. ROT-81 filesystem confinement and ROT-84 cross-tool zero-side-effect composition remain open, followed by final integrated ROT-85 qualification.
