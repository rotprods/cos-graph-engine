# ROT Viral Content Engine — Execution Plan

## Program rule
Work units are guarantees, not feature volume. Each phase closes with acceptance evidence before the next authority boundary is crossed.

## Phase 00 — Control Plane & North Star
Goal: freeze mission, truth ownership, invariants and scoring semantics.

Deliverables:
- README_FIRST.md
- ARCHITECTURE.md
- DRIVE_CONTRACT.md
- GRAPH.md
- canonical entity/schema inventory
- lifecycle state machine spec
- risk taxonomy
- definition of done

Acceptance gates:
- every store has explicit truth ownership
- graph is declared projection-only
- no secret-bearing path in Git/Drive
- all lifecycle transitions defined

## Phase 01 — Drive Corpus Foundation
Goal: create a durable corpus with deterministic asset identity.

Drive structure:
00_CONTROL
01_BRAND_IDENTITY
02_AUDIENCES
03_OFFERS
04_RAW_SIGNALS
05_RESEARCH
06_PROOF_BANK
07_SCRIPTS
08_VISUAL_REFERENCES
09_PUBLISHED
10_ANALYTICS
11_EXPERIMENTS
12_HANDOFFS
99_ARCHIVE

Tasks:
- define naming convention and asset_id
- register file metadata and sensitivity
- migrate canonical brand/voice docs
- import proven scripts/posts
- import proof assets and case material
- create analytics import convention
- create README per top-level folder

Gate: selected asset can be resolved from canonical ID to Drive object and provenance without filename guessing.

## Phase 02 — Canonical Data Model & Event Log
Goal: authoritative transactional model for content lifecycle.

Tasks:
- content schema
- claim/evidence schema
- publication schema
- metric observation schema
- experiment schema
- lifecycle event schema
- idempotency and expected-version contract
- migration strategy

Gate: create → revise → approve → publish → observe can be replayed into identical state.

## Phase 03 — Research / Claim Integrity
Goal: make factual truth machine-auditable.

Tasks:
- source ingestion
- claim extraction
- source ranking
- primary-vs-secondary classification
- rumor/inference handling
- claim supersession/retraction
- research freshness windows
- factual risk policy

Gate: material claims cannot reach QA_PASSED without required evidence class.

## Phase 04 — Generation Engine
Goal: deterministic, versioned idea-to-script pipeline.

Modules:
- SignalScout
- OpportunityRouter
- AngleArchitect
- HookLab
- ScriptArchitect
- RetentionEditor
- VisualDirector
- PlatformAdapter

Tasks:
- prompt/config versioning
- bounded context compiler
- structured outputs
- hook family taxonomy
- duration constraints
- platform-native adapters
- generated output hashes

Gate: identical frozen inputs/config produce traceable comparable outputs and never silently overwrite prior versions.

## Phase 05 — Gauntlet & QA
Goal: adversarial quality control.

Judges:
- ScrollStopper
- Skeptic
- RetentionEditor
- CompressionEditor
- VisualDirector
- PlatformNativeEditor
- BrandGuardian
- ConversionStrategist
- AntiSlopEditor
- AudienceSimulator

Tasks:
- rubric per judge
- veto rules
- viral/strategic dual score
- disagreement capture
- revision loop
- human approval boundary

Gate: failed factual/brand/proof veto blocks approval irrespective of aggregate score.

## Phase 06 — COS Graph Projection
Goal: project content truth into graph primitives without promoting graph to source-of-truth.

Tasks:
- canonical node/edge IDs
- ContentGraph projector
- ProofGraph projector
- HookGraph projector
- PerformanceGraph projector
- AudienceGraph projector
- ExperimentGraph projector
- temporal/provenance metadata
- rebuild command
- snapshot hash
- parity tests

Gate: delete graph projection → rebuild from authoritative records → identical projection hash.

## Phase 07 — Retrieval & Context Compiler
Goal: use GraphRAG/evidence to generate better scripts safely.

Tasks:
- creator knowledge retrieval
- prior content similarity
- anti-duplication retrieval
- proof/evidence retrieval
- audience-specific priors
- bounded context packs
- stale projection fencing
- evidence hashes

Gate: context pack can be independently verified against projection version/hash and evidence refs.

## Phase 08 — Publication & Distribution Adapters
Goal: controlled multi-platform publishing workflow.

Initial mode: HUMAN_APPROVAL_REQUIRED.

Tasks:
- canonical platform variant
- scheduling state
- publication receipt
- platform post ID capture
- error/retry semantics
- duplicate-post prevention
- no autonomous publish by default

Gate: retries cannot duplicate a successful publication.

## Phase 09 — Analytics Ingestion
Goal: append-only performance observation.

Tasks:
- platform metric adapters/imports
- metric timestamping
- normalized ratios
- baseline calculation per platform
- metric revision semantics
- missing-data handling
- attribution fields

Gate: later metric snapshots extend history rather than erase prior observations.

## Phase 10 — Experiment Engine
Goal: move from intuition to controlled learning.

Tasks:
- hypothesis objects
- variable-under-test constraint
- A/B variant lineage
- minimum evidence thresholds
- effect size
- uncertainty/confidence
- experiment closure decision

Gate: no 'winner' label without declared comparison baseline, sample size and confidence metadata.

## Phase 11 — Learning Compiler
Goal: convert observations into evidence-weighted priors.

Tasks:
- topic × hook × audience × platform posterior
- first-frame priors
- duration priors
- CTA priors
- visual-pattern priors
- recency decay
- invalidation when later evidence conflicts

Gate: every learned recommendation links to supporting publications and can be retracted/recomputed.

## Phase 12 — Observability / Resilience / Cost
Goal: production operations.

Tasks:
- trace IDs across all workflows
- run dashboards
- cost/token ledger
- error taxonomy
- dead-letter queue
- replay
- snapshots
- cold-start recovery
- PII/sensitivity audit

Gate: simulated partial failures do not create false success or corrupt canonical state.

## Phase 13 — Product UI / Operator Console
Goal: one operator surface.

Views:
- Inbox / signals
- Research
- Hook lab
- Script editor
- Visual plan
- Gauntlet
- Approval
- Publishing
- Analytics
- Experiments
- Knowledge graph

Gate: Roberto can trace any published piece back to signal, sources, script version, proof, decisions and metrics.

## Phase 14 — Qualification Campaign
Goal: certify the system before automation authority.

Qualification suites:
- deterministic schema/tests
- replay
- projection rebuild
- idempotency
- publication retry
- factual veto
- private-asset leakage tests
- analytics history tests
- experiment lineage tests
- graph/context pack verification
- restore/cold start

Authority stages:
1. DESIGN_ONLY
2. SHADOW
3. ASSISTED
4. HUMAN_APPROVAL_REQUIRED
5. SELECTIVE_AUTOMATION

No phase advancement without evidence.

## Initial execution order
P0: Phase 00-02
P1: Phase 03-05
P2: Phase 06-07
P3: Phase 08-11
P4: Phase 12-14

## First concrete build slice
A vertical slice must prove:
Signal → Research → Claim/Evidence → 3 Hooks → Script → Gauntlet → Approved Variant → Manual Publication Record → Metric Snapshot → Learned Insight → COS Projection.

This slice is the minimum system worth expanding.