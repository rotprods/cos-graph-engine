---
authority: PROJECTION
scope: COS V2 defensive security architecture and residual-risk model
owner: CISO / Security Architect
last_updated: 2026-08-30T17:30:00.000Z
source_revision: 1bc137eb6e635f55db293b402f561e420dc83c4f
supersedes: informal security assumptions
status: PROPOSED
---

# COS Graph Engine V2 — Security Model

## 1. Security objective

Prevent untrusted or stale actors, data and providers from:

- reading data outside authorized project/sensitivity scope;
- writing canonical state without the selected authority path;
- causing duplicate or stale external side effects;
- escalating authority through documentation, prompt, cache or model output;
- crossing filesystem or network boundaries;
- poisoning memory, GraphRAG, evidence or recovery state;
- leaking credentials, secrets or PII;
- suppressing or forging test/evidence outcomes;
- converting an unknown provider result into false success or safe retry.

Security is fail-closed at authority boundaries and failure-isolated at observation boundaries.

## 2. Assets

| Asset | Required property |
|---|---|
| exact repository and release bytes | integrity, provenance, review binding |
| append-only event and revision history | integrity, ordering, replayability |
| project memory and knowledge | confidentiality, provenance, temporal truth |
| credentials and connector grants | confidentiality, least privilege, revocation |
| agent claims and leases | authenticity, freshness, non-overlap |
| provider operations | idempotent convergence, reconciliation, auditability |
| ContextPacks | scope, freshness, integrity, provenance |
| tests and evidence | exact-artifact binding, result honesty |
| snapshots and backups | integrity, schema compatibility, recoverability |
| scorecard and promotion events | authorization, non-repudiation, evidence linkage |

## 3. Trust boundaries

```text
UNTRUSTED EXTERNAL INPUT
web · email · Slack · Drive docs · issues/comments · provider payloads
media · archives · prompts · URLs · paths · package dependencies
        │ validate / canonicalize / classify
        ▼
INGESTION BOUNDARY
schema · size · type · content policy · provenance · sensitivity
        │
        ▼
POLICY BOUNDARY
principal · project · action · capability · resource · sensitivity · time
        │
        ▼
EXECUTION BOUNDARY
claim · lease · fencing · idempotency · isolation · provider adapter
        │
        ▼
AUTHORITY BOUNDARY
append-only event/revision/outcome at exact source revision
        │
        ▼
PROJECTION BOUNDARY
graph · index · memory view · ContextPack · docs · telemetry
```

No boundary is implied by naming. It must intercept the real call/data path.

## 4. Threat model

### T01 — Prompt and provider-content injection

**Attack surface:** imported prompts, issues, comments, webpages, Drive, Slack, email and provider text.

**Threat:** untrusted content attempts to redefine authority, reveal secrets, call tools or alter policy.

**Mitigations:**

- classify imported content as `UNTRUSTED_DATA`;
- separate content from control instructions;
- typed schemas and canonical provenance;
- policy checks on every capability;
- tool allowlists and bounded inputs;
- no authority from text claiming to be a system message or approval;
- ContextPack sensitivity and source filtering.

**Detection:** injection corpus, unexpected tool-attempt signals, policy denials.

**Recovery:** discard poisoned projection, replay from authority, revoke compromised ContextPack.

### T02 — Secret or PII leakage

**Attack surface:** logs, telemetry, evidence, prompts, artifacts and generated docs.

**Mitigations:**

- never persist raw credentials;
- secret references instead of values;
- redaction at telemetry/evidence boundaries;
- project/sensitivity labels;
- least-privilege connector permissions;
- repository secret scanning;
- deny copying raw provider inputs/results into generic telemetry.

**Residual risk:** provider payloads can contain unexpected PII; validation and review remain required.

### T03 — SSRF and DNS rebinding

**Attack surface:** HTTP tools, webhook callbacks and provider URLs.

**Mitigations:**

- HTTPS/method/host/port allowlist;
- resolve and reject private, loopback, link-local and special-purpose addresses;
- reject mixed public/private answer sets;
- pin accepted IP set;
- connect directly to pinned IP;
- preserve original TLS SNI and HTTP `Host`;
- validate certificate against original hostname;
- no second DNS resolution;
- no automatic redirect following; reauthorize each redirect;
- bounded decision TTL and response size.

**P0 residual:** controlled TLS fixture has not yet empirically proved the candidate transport.

### T04 — Filesystem traversal, symlink and TOCTOU

**Attack surface:** file paths, archives, temporary paths and tool payloads.

**Mitigations:**

- root and operation allowlists;
- reject absolute paths, NULs, encoded/plain traversal and prefix escapes;
- canonical URI containment;
- symlink deny-by-default;
- trusted broker atomically opens under a directory handle;
- authority executor consumes opaque handle and never reopens a path;
- validate broker, root, inode/device and handle decision.

**P0 residual:** native `openat`/`dirfd` or platform-equivalent broker is not implemented/proven.

### T05 — Shell/code injection

**Attack surface:** commands, scripts, code-evaluation utilities and CI inputs.

**Mitigations:**

- no shell construction from untrusted strings;
- argument arrays and allowlisted commands;
- code sandbox explicitly not treated as a security boundary;
- OS/container isolation for untrusted code;
- resource/time/output limits;
- manual workflow input validation;
- no automatic deployment from generated code.

### T06 — Authority escalation

**Attack surface:** stale documents, model output, moving branches, deep imports and compatibility paths.

**Mitigations:**

- exact commit/release authority;
- `Authority=min(Build,Assurance)`;
- selected export allowlist;
- one authority writer per capability;
- startup duplicate-owner assertion;
- exact-operation policy and approval;
- promotion event authorized only by owner after CP13.

### T07 — Stale or duplicate writer

**Attack surface:** concurrent agents, workers and retries.

**Mitigations:**

- unique session and claim IDs;
- exclusive scope collision check;
- bounded leases;
- monotonic fencing tokens;
- expected-revision CAS;
- payload-bound idempotency;
- commit-boundary fence validation;
- duplicate transition keys converge or conflict fail closed.

### T08 — Provider timeout after acceptance

**Attack surface:** network partition or process crash after external provider accepts work.

**Mitigations:**

- `executing → reconciliation_required`;
- no blind retry;
- read-only provider/resource inspection;
- canonical evidence content hash and operation binding;
- `not_applied` requires authoritative absence;
- new attempt requires newer fence and provider key;
- partial outcome requires compensation.

**P0 residual:** provider-specific adapters are incomplete, and PR #54 evidence content is not yet independently recomputed by the wrapper.

### T09 — Replay attack and historical reinterpretation

**Attack surface:** duplicated commands/events, changed reducer rules and stale provider evidence.

**Mitigations:**

- command and accepted/rejected outcome stored separately;
- replay applies recorded outcomes, not current command rules;
- event IDs and payload-bound logical hashes;
- temporal validity and recorded time;
- provider evidence includes operation identity and observation time;
- stale ContextPack and stale approval rejection.

### T10 — Memory, knowledge or GraphRAG poisoning

**Attack surface:** external content, inferred facts, conflicting sources and embeddings.

**Mitigations:**

- epistemic type and confidence;
- required provenance;
- append-only revisions;
- contradiction and supersession relations;
- project/sensitivity filtering before ranking;
- explicit validAt/knownAt;
- embeddings never become authority;
- gold-query and adversarial retrieval corpus.

### T11 — Evidence forgery or mismatch

**Attack surface:** logs, screenshots, test summaries, PR comments and generated reports.

**Mitigations:**

- exact source SHA;
- raw command and toolchain manifest;
- evidence/content hashes recomputed, not trusted;
- PASS/FAIL/SKIPPED/NOT_RUN separation;
- artifact-to-test-to-dimension graph;
- head changes invalidate approval;
- independent review.

### T12 — Dependency compromise

**Attack surface:** npm packages, actions, containers and transitive dependencies.

**Mitigations:**

- clean lockfile;
- pinned toolchain;
- package integrity verification;
- SBOM and vulnerability scan;
- least-privilege workflow token;
- no unreviewed action versions;
- manual execution during convergence.

### T13 — Recovery widens access or restores corrupted state

**Attack surface:** snapshots, migrations, backups and replay tooling.

**Mitigations:**

- SHA-256 snapshot integrity;
- schema/version compatibility;
- scope-preserving migrations;
- empty-database restore drill;
- gold queries including negative permission cases;
- isolate corrupt artifact and replay trusted tail.

### T14 — Denial of service and resource exhaustion

**Attack surface:** graph size, ContextPack size, recursive traversal, HTTP bodies and repair retries.

**Mitigations:**

- input and output bounds;
- traversal depth and budget;
- token budgets;
- bounded retries and repair attempts;
- queue/backpressure metrics;
- timeouts;
- explicit degraded states.

## 5. Security invariants

1. No untrusted text can grant authority or approval.
2. Unknown policy/action defaults to deny.
3. A principal cannot access another project or sensitivity above clearance.
4. A side-effecting capability cannot bypass policy, durable operation history, lease/fence and isolation.
5. A stale fencing token cannot be accepted at the resource commit boundary.
6. A provider timeout after `executing` cannot trigger blind retry.
7. Provider evidence is canonicalized, independently hashed and bound to the operation.
8. HTTP authority execution performs no second DNS resolution.
9. Filesystem authority execution never reopens a path after authorization.
10. Telemetry/evidence failure cannot change the protected outcome.
11. Recovery cannot widen project or sensitivity scope.
12. Qualification evidence must belong to the exact candidate SHA.

## 6. Required security tests

```text
prompt/provider injection corpus
secret and PII leakage scan
SSRF special-range and mixed-answer tests
controlled DNS rebinding test
TLS SNI/Host/certificate pinning fixture
path traversal and encoded traversal corpus
symlink/rename/TOCTOU race fixture
shell/argument injection tests
policy default-deny and approval expiry
stale claim/lease/fence contention
provider timeout-after-acceptance
provider evidence tamper/swap/replay
GraphRAG cross-project and restricted-data leakage
snapshot corruption and scope-preserving restore
dependency/SBOM and workflow-permission review
```

## 7. Security review gates

- **CP5:** contracts and selected surface frozen.
- **CP6:** security-relevant unit/contract/property tests pass.
- **CP9:** concurrency/fencing proven.
- **CP10:** physical isolation and provider gauntlet pass; no open P0/P1 security defect.
- **CP12:** evidence corpus complete.
- **CP13:** independent exact-head review.
- **CP14:** owner-authorized promotion.

## 8. Current residual risks

| ID | Residual risk | Severity | Owner | Safe posture |
|---|---|---:|---|---|
| G005 | provider evidence not independently recomputed | P0 | Security Architect | remain reconciliation-required |
| G006 | native atomic filesystem broker missing | P0 | Security Architect | disable authority FS mutation |
| G007 | TLS pinning not physically proven | P0 | Security Architect | disable external authority HTTP |
| G008 | provider-specific reconciliation incomplete | P0 | Adapter Engineer | manual reconciliation; no retry |
| G015 | no independent exact-head review | P0 | Roberto | keep PRs draft/unmerged |
| G018 | single writer not yet enforced after root promotion | P0 | Principal Architect | no package-root promotion |

## 9. Credential and connector policy

- Request only the permissions needed for the current operation.
- Never copy connector tokens into repository, logs or prompts.
- Treat connector outputs as provider data until validated.
- Writes use explicit user intent and reversible operations where possible.
- High-impact or irreversible operations require owner approval and exact target identity.
- Revocation and rotation procedures must be documented before production authority.

## 10. Incident response

```text
DETECT
→ contain capability / revoke claim / disable provider path
→ preserve exact events, logs and artifacts
→ classify known vs unknown provider outcome
→ reconcile or compensate
→ restore projections from authority
→ create incident + bug escape graph
→ add permanent regression and adjacent-family campaign
→ review residual risk and promotion status
```

A security incident may trigger an explicit `AUTHORITY_DEMOTED` event even after merge.
