# W1D.2 RED Evidence — FileSystemTool Root / Symlink Boundary

Status: RED reproduced before product repair
Date: 2026-09-11

## Bound parent and candidate

- qualified ROT-80 parent: `aadd8a1079f5acd2d3f0f9b00af3bd6c8bc83e0b`
- RED branch head: `9c765b6728cddac96aa9632b829070157ee8654d`
- synthetic PR #114 merge: `dd05912e93cdd541d3e933a5b0c503f40bc784d3`
- Actions run: `34629184257`
- job: `103361566135`
- artifact ID: `10274864547`
- artifact digest: `sha256:bbe29c44f08abcaea92ca69f6d7beabdd23229350cf551f2fa257a59d0d2d215`
- artifact size: `765` bytes

## Preconditions proven green

Before the filesystem contract failed:

1. exact parent/source binding passed;
2. Node `v22.12.0` exact passed;
3. exact lockfile install passed;
4. strict TypeScript passed;
5. qualified ROT-80 ToolRegistry capability contract remained `5/5 PASS`.

## Reproduced defect

The first W1D.2 invariant invokes a default `FileSystemTool` against an absolute file path outside a temporary workspace. Required behavior is `FS_AUTHORITY_UNBOUND`. The current implementation resolves and reads that host path and returns success:

```text
AssertionError [ERR_ASSERTION]: expected FS_AUTHORITY_UNBOUND to fail closed
true !== false
```

This proves direct construction currently carries ambient host filesystem authority.

## Repair target

The W1D.2 repair establishes one explicit-root authority path:

- default construction has zero filesystem authority;
- caller paths are relative only and canonicalized beneath a configured workspace root;
- absolute and parent-traversal inputs fail before I/O;
- symlink traversal is denied for reads, listings and mutations;
- write paths create/check directory components one segment at a time and refuse symlink components;
- ordinary permitted workspace operations remain available;
- returned paths are relative authority paths, never absolute host paths;
- destructive operations are constrained to the same root and revalidated immediately before mutation;
- coverage, full suite, audit and anti-bypass gates must pass on the product and evidence-binding heads.

Node's portable fs API does not expose POSIX `openat(2)`-style directory-fd-relative mutation for every operation. Therefore this slice will not claim protection from an attacker who can concurrently rename/replace workspace directory components between kernel path lookups. The qualified invariant is symlink/traversal confinement under the process's trusted workspace ownership model; stronger hostile-concurrent-filesystem mutation requires a broker/openat boundary and remains an explicit future hardening seam rather than an unstated guarantee.
