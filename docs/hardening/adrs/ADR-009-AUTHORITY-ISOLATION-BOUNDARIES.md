# ADR-009 — Authority HTTP and Filesystem Isolation Boundaries

Status: `ACCEPTED_FOR_HARDENING`  
Phase: `05 — Security / Concurrency / Agent Runtime`  
Authority status: `SHADOW_ONLY / IMPLEMENTED_UNVERIFIED`

## Context

URL parsing and lexical path normalization are useful defenses, but they do not close the authority boundary:

- a hostname accepted at parse time can resolve to a private/link-local address later;
- DNS can change between validation and connection;
- redirects can cross into a forbidden host or address class;
- IPv4-mapped IPv6 and other transition mechanisms can bypass naive string checks;
- a filesystem path accepted before open can be redirected through symlinks, mount changes or TOCTOU races;
- reopening a canonicalized path after validation discards the guarantee created by the validation step.

Treating these checks as complete security would create a false defense and a latent failure condition.

## Decision

### HTTP

Authority HTTP execution requires two separate components:

1. `AuthorityHttpEgressGuard` creates a deterministic, time-bounded decision that:
   - applies exact/wildcard host policy;
   - applies protocol, method and port policy;
   - resolves the hostname through an injected resolver;
   - rejects loopback, private, link-local, carrier-grade NAT, multicast, reserved, documentation and transition-address classes;
   - rejects the entire resolution when any answer is forbidden;
   - pins the sorted resolved-address set;
   - requires every redirect to be resolved and authorized again;
   - binds the decision to a policy hash and decision hash.
2. A deployment transport consumes the pinned address set directly while preserving the original hostname for TLS SNI and HTTP Host semantics.

Calling ordinary `fetch(url)` after the guard is not authority-safe because it performs a new DNS resolution outside the pinned decision.

### Filesystem

Authority filesystem execution requires:

1. `AuthorityFileSandbox` for root, operation, lexical traversal and decision integrity;
2. a trusted `AuthorityFileSystemBroker` that resolves and opens the target atomically using `openat`/directory handles or an equivalent platform primitive;
3. an opaque handle token returned to authority code.

Authority code must operate on the broker-opened handle. It may not reopen `canonicalTargetUri` by path. Symlink traversal is denied unless enabled explicitly per root.

### Shared rule

Decision hashes are integrity/equivalence evidence, not bearer authorization tokens. The trusted transport/broker remains part of the security boundary.

## Alternatives rejected

- URL parsing plus private-IP string checks only: vulnerable to DNS rebinding and incomplete address classification.
- Resolve once, then call normal fetch: the actual connection can use a different DNS answer.
- Disable redirects globally: safe but unnecessarily restrictive; explicit reauthorization provides a bounded alternative.
- `path.resolve()` plus prefix check: vulnerable to symlink and TOCTOU behavior.
- Return a canonical path to callers: callers could reopen a different object later.
- Assume container isolation alone is enough: deployment isolation is necessary but should be reinforced by application-level evidence and policy.

## Consequences

Positive:

- the code states precisely which layer owns DNS and file-handle truth;
- redirects and DNS fan-out become explicit evidence-bearing transitions;
- authority decisions are deterministic and replayable;
- obvious SSRF, path traversal and prefix-escape classes fail closed;
- the deployment contract becomes testable without performing real network or filesystem side effects.

Costs:

- an authority HTTP transport must support pinned-address connection with correct SNI/Host behavior;
- a filesystem broker must be implemented per deployment platform;
- applications cannot transparently use ordinary fetch/path APIs for authority mutations;
- policy TTLs and redirect budgets require explicit configuration.

## Failure semantics

- empty or oversized DNS results fail closed;
- one forbidden address invalidates the full answer set;
- expired or tampered decisions fail closed;
- redirect targets are independent authorization requests;
- broker identity, root identity, canonical containment, operation and handle hash must all match;
- any broker-reported symlink traversal fails unless explicitly allowed;
- observer/telemetry failure must not turn a denied operation into an allowed one.

## Evidence required before Authority promotion

- strict typecheck of the isolation surface;
- negative tests for private/special-use IPv4 and IPv6, mapped addresses, mixed answer sets, redirects, expiry and tampering;
- negative tests for encoded traversal, absolute paths, prefix escapes, symlinks and broker mismatch;
- integration test proving the HTTP transport connects only to the pinned address;
- integration test proving filesystem operations use the opened handle and do not reopen by path;
- container/namespace egress and filesystem policy evidence;
- threat-model review and independent approval.

## Rollback

The isolation surface is additive during hardening. Rollback removes authority use of the new facade and returns to `SHADOW_ONLY`; it must not promote the legacy parse-only guard as equivalent security. No data migration is required.
