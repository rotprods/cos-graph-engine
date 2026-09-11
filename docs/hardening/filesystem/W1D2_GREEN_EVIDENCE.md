# W1D.2 GREEN Evidence — FileSystemTool Root / Symlink Boundary

Status: GREEN candidate / evidence-binding requalification pending
Date: 2026-09-11

## Qualified product candidate

- qualified ROT-80 parent: `aadd8a1079f5acd2d3f0f9b00af3bd6c8bc83e0b`
- filesystem product head: `8b2bcd372bcda50af9b079f9457b1a46799911ef`
- synthetic PR #114 merge: `835b5058a6e9973e8307fda683eabd40979d83c8`
- Actions run: `34629650774`
- job: `103363070542`
- artifact ID: `10275349589`
- artifact digest: `sha256:38a84402704ad0eeff8e4b244ef0a6bb4121e775815fe35603d62dba7bbc1f47`
- artifact size: `28478` bytes

## Same-candidate gates

1. exact parent/source binding — PASS
2. exact Node `v22.12.0` — PASS
3. strict TypeScript — PASS
4. qualified ROT-80 ToolRegistry regression — PASS (`5/5`)
5. W1D.2 filesystem confinement/symlink contract — PASS
6. full canonical `npm run test:all` — PASS
7. full c8 coverage threshold gate — PASS
8. high-severity dependency audit — PASS
9. scope + anti-bypass policy — PASS
10. evidence artifact preservation — PASS

## Qualified filesystem authority model

The default `FileSystemTool` now has zero ambient host filesystem authority. An explicitly configured root is required before I/O.

For an authorized root, the tool:

- canonicalizes the configured workspace root and rejects a symlink root;
- accepts relative authority paths only; absolute, drive, file-URI, empty-segment, NUL, backslash and parent-traversal encodings fail closed;
- walks existing path components with `lstat` + `realpath`, rejecting symlink traversal and validating containment beneath the canonical root;
- uses `O_NOFOLLOW` for final read opens;
- creates missing write-directory components one segment at a time and refuses symlink components;
- writes through an exclusive `O_NOFOLLOW` temporary file followed by atomic rename, with parent/target revalidation around mutation;
- revalidates destructive paths immediately before delete;
- keeps `list`, `exists`, `delete`, `write`, `read` and `mkdtemp` within the explicit root;
- returns relative authority paths for created temporary directories rather than absolute host paths;
- enforces read/write/list resource bounds;
- preserves the qualified default-deny ToolRegistry boundary.

## Explicit threat-model seam

Portable Node.js does not expose a general `openat(2)`/directory-fd-relative API for every filesystem mutation. This slice therefore does **not** claim protection against an attacker with concurrent authority to rename/replace workspace directory components between kernel path lookups. That stronger adversary requires an OS broker/openat-style boundary. The qualified invariant here is traversal/symlink confinement under trusted workspace ownership, with repeated canonical revalidation and no ambient filesystem root.

## Residual W1D scope

This qualifies the ROT-81 product candidate only. The documentation/evidence head must re-run the same gate before ROT-81 closes. ROT-84 cross-tool zero-side-effect composition and final integrated ROT-85 remain open.
