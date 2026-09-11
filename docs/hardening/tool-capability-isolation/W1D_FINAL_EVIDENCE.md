# W1D Final Evidence — Canonical Repair and Qualification

Status: PRODUCT QUALIFIED — documentation-binding successor must requalify

Date: 2026-09-11

## Why this ledger exists

Live GitHub reconciliation found that the former PR #111 head `eb1e56fd0522155f0442d856ff729814fa9f02b1` contained W1D.1 plus a final-evidence document but did not contain the independently qualified W1D.2–W1D.5 product composition. Earlier records referring to synthetic heads `1a602709...` or `c54749ad...` are not repository qualification authority.

The canonical history was repaired without force rewriting. Merge head `48206d4a2b7090655a7a5e878d69dd39b47c3fce` has two explicit parents:

- prior live #111 head `eb1e56fd0522155f0442d856ff729814fa9f02b1`;
- last existing composed dual-runtime GREEN head `a6f32b5a31ec5854111adfaa31be3e6a5ce1135c`.

Its tree is based on the composed W1D product and carries the strong canonical dual-runtime qualification workflow. No force-push or history deletion was used.

## Canonical repaired product qualification

Canonical PR workflow run: `34639377856`.

PR synthetic merge checkout: `59575977dfa2270aaca8ffb907c4ed4402bdb6bd`.

### Node 22.12.0

- job: `103396900544`
- artifact: `10279990344`
- artifact digest: `sha256:0edfebaba7234c8cf2e5582144b5c8b09690fdfe5b40a51a8fdc188180905956`
- result: PASS

The Node 22 job passed:

- exact source and W1C ancestry binding;
- exact Node `22.12.0` runtime binding;
- Docker availability plus digest-pinned W1C sandbox TCB pull/inspect;
- strict TypeScript;
- W1D.1 ToolRegistry default-deny contract;
- W1D.2 filesystem root/traversal/symlink/resource-bound contract;
- W1D.3 HTTP egress SSRF/DNS-pinning/redirect/policy/budget contract;
- W1D.4 Search provider authority/error/bounds contract;
- W1D.5 cross-tool deny => zero privileged side effects;
- portable W1C sandbox regression;
- full canonical suite;
- integrated c8 corpus plus immutable coverage ratchet;
- high-severity dependency audit;
- canonical scope/anti-bypass policy;
- artifact preservation.

### Node 26.8.2

- job: `103396900665`
- artifact: `10279596945`
- artifact digest: `sha256:c7e4851fd5d1b1f46511ac17567b223dc3151e74c78391d5537baf07e91eabed`
- result: PASS

The Node 26 job passed exact runtime binding, W1C ancestry, pinned sandbox TCB, strict TypeScript, every W1D child authority contract, cross-tool composition, portable W1C sandbox regression and the full canonical suite.

## Coverage ratchet

The preserved Node22 artifact reports:

| Metric | Immutable floor | Repaired W1D | Delta |
| --- | ---: | ---: | ---: |
| statements | 78.22% | 80.05% | +1.83 pp |
| branches | 78.93% | 80.05% | +1.12 pp |
| functions | 84.99% | 85.80% | +0.81 pp |
| lines | 78.22% | 80.05% | +1.83 pp |

No threshold lowering, executable-code exclusion, compiler relaxation, `continue-on-error`, dynamic-code bypass or type-safety bypass was used to obtain GREEN.

## Qualified authority model

The repaired product proves these composition invariants:

1. missing registry authorization, explicit deny, or authorization-backend failure prevents tool execution;
2. default built-in filesystem, HTTP and Search instances carry zero ambient privileged authority;
3. filesystem authority requires an explicit canonical workspace root and rejects absolute/traversal/encoded-traversal and symlink escapes;
4. HTTP authority requires an explicit resolver, inner egress authorization and pinned transport, and rejects private/special or mixed DNS address sets;
5. Search authority comes only from explicit scoped providers; provider failures remain failures;
6. outer registry denial produces zero filesystem writes, DNS resolutions, HTTP policy calls, HTTP transport calls and Search-provider calls;
7. outer allow never converts an inner authority failure into success;
8. allowed registry dispatch records deterministic serialized authorization provenance.

## Explicit residual seam

Portable Node does not provide a general `openat(2)`-style directory-fd primitive for every filesystem mutation. W1D therefore does not claim protection against a hostile same-user actor that can concurrently replace workspace directory components between kernel path lookups. Stronger protection for that adversary requires a native broker/openat-style authority boundary.

## Documentation-binding rule

This file is intentionally committed only after the repaired product head `48206d4a...` passed the canonical gauntlet. Because this documentation commit creates a new branch SHA, that successor is not automatically qualified by the run above.

The successor containing this ledger must repeat the same canonical Node22/Node26 workflow. Repository-level W1D qualification authority is restored only when that documentation-bound successor is GREEN. The exact successor SHA, final workflow run, jobs and artifact digests are recorded in PR #111 and Linear after that requalification, avoiding an infinite evidence-document commit loop.

Until then, ROT-79 / ROT-84 / ROT-85 remain In Progress.