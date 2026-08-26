# ROT Viral Content Engine — Architecture

## 1. System planes

### A. Experience plane
Interfaces used by Roberto and agents:
- /viral command parser
- research ingest
- script studio
- visual planning
- approval queue
- analytics review
- experiment review

### B. Orchestration plane
Workflow/state machines:
- ContentLifecycle
- ResearchWorkflow
- GenerationWorkflow
- GauntletWorkflow
- PublicationWorkflow
- MetricIngestionWorkflow
- LearningWorkflow

Canonical lifecycle:
DRAFT_SIGNAL → RESEARCHED → FACT_CHECKED → SCORED → SCRIPTED → QA_PASSED → APPROVED → PUBLISHED → OBSERVED → LEARNED

Every transition emits an immutable event with actor, inputs, expected version, result, timestamp and evidence refs.

### C. Domain plane
Core entities:
- Signal
- Topic
- Audience
- Brand
- Offer
- Claim
- Evidence
- Source
- Angle
- Hook
- Script
- Scene
- VisualPattern
- PlatformVariant
- Publication
- MetricObservation
- Experiment
- Hypothesis
- Insight
- Asset
- CTA
- ContentRun

### D. Data / truth plane
Recommended authoritative store: Postgres/Supabase-compatible relational schema plus durable event log.

Core tables:
- content_items
- content_versions
- generation_runs
- claims
- evidence
- source_observations
- publications
- metric_observations
- experiments
- experiment_variants
- lifecycle_events
- assets
- audiences
- offers
- platform_accounts

### E. Corpus plane — Google Drive
Human-readable and media-heavy durable corpus. Files are indexed by canonical asset IDs and linked into content records.

### F. Compute/projection plane — COS Graph Engine
Derived graph projections:
1. ContentGraph
2. TopicGraph
3. AudienceGraph
4. HookGraph
5. VisualPatternGraph
6. ProofGraph
7. PerformanceGraph
8. ExperimentGraph
9. DistributionGraph
10. OfferGraph
11. CreatorKnowledgeGraph
12. WorkflowGraph

These projections must be rebuildable from truth-plane events and records.

### G. Intelligence plane
Agents/components:
- SignalScout
- Researcher
- FactChecker
- OpportunityRouter
- AngleArchitect
- HookArchitect
- ScriptArchitect
- RetentionEditor
- VisualDirector
- PlatformAdapter
- BrandGuardian
- GauntletJudge
- GrowthAnalyst
- LearningCompiler

Each agent receives bounded context and capabilities. No agent writes directly to all stores.

## 2. Graph model

### Important node types
Content, Topic, Claim, Evidence, Source, Audience, HookPattern, VisualPattern, Script, Publication, Platform, Experiment, MetricObservation, Offer, Asset, Insight.

### Important edge types
- CONTENT_ABOUT_TOPIC
- CONTENT_TARGETS_AUDIENCE
- SCRIPT_USES_HOOK
- SCRIPT_USES_VISUAL_PATTERN
- CLAIM_SUPPORTED_BY_EVIDENCE
- EVIDENCE_FROM_SOURCE
- PUBLICATION_VARIANT_OF_CONTENT
- PUBLICATION_ON_PLATFORM
- METRIC_OBSERVES_PUBLICATION
- EXPERIMENT_TESTS_HYPOTHESIS
- VARIANT_USES_HOOK
- INSIGHT_DERIVED_FROM_EXPERIMENT
- CONTENT_SUPPORTS_OFFER
- ASSET_USED_IN_CONTENT
- TOPIC_RELATED_TO_TOPIC
- HOOK_OUTPERFORMS_HOOK_FOR_AUDIENCE

All edge identity must be canonical and typed. Temporal edges carry valid_from / valid_until / observed_at / recorded_at where relevant.

## 3. Content object contract

Every canonical content item should include:
- content_id
- version
- status
- account
- primary_platform
- objective
- audience_id
- pillar
- topic_ids
- source_signal_ids
- claim_ids
- proof_asset_ids
- hook_family
- selected_hook
- script
- scenes
- visual_plan
- CTA
- factual_risk
- brand_risk
- viral_score
- strategic_score
- approval_state
- created_at
- updated_at
- provenance

## 4. Research and factual integrity

Claims are first-class objects, not strings hidden inside scripts.

Claim states:
- UNVERIFIED
- VERIFIED_PRIMARY
- VERIFIED_SECONDARY
- CONFLICTING
- RUMOR
- INFERENCE
- RETRACTED
- SUPERSEDED

A script referencing a material claim cannot reach QA_PASSED unless the policy for its risk class is satisfied.

## 5. Performance memory

Metric observations are append-only. A normalized performance feature vector is derived per publication:
- hold_1s / hold_3s if available
- avg_watch_time
- completion_rate
- rewatch_rate
- shares_per_view
- saves_per_view
- comments_per_view
- profile_visits_per_view
- follows_per_view
- dm_leads
- qualified_leads
- attributed_revenue

Never compare raw metrics across platforms without normalization and confidence intervals/baselines.

## 6. Learning model

Learning is evidence-weighted, not prompt folklore.

Example learned prior:
(topic=AI_VIDEO, audience=CREATORS, hook_family=CONSEQUENCE, first_frame=RESULT_FIRST)
→ posterior uplift vs Roberto baseline.

Every prior stores:
- sample_size
- platform scope
- date window
- confidence
- effect estimate
- uncertainty
- supporting publications
- invalidating evidence

## 7. Observability

Trace every run across:
input → research → claims → selected angle → hook candidates → script revisions → gauntlet decisions → publication → metric snapshots → learned insight.

Required trace fields:
- trace_id
- run_id
- agent
- model/config
- input refs
- output hash
- duration
- token/cost estimate when available
- status
- error category
- evidence refs

## 8. Security and privacy

- Secrets never stored in Drive or Git.
- Platform credentials live in secret manager/environment.
- Drive permissions remain source-scoped.
- Client/private proof assets carry sensitivity labels.
- Public-script generation must not leak private/client material.
- Tool access defaults to deny and is granted per agent capability.

## 9. Resilience

Every critical workflow must support:
- idempotency keys
- retry policy
- partial-failure recording
- replay
- snapshotting
- dead-letter/error queue
- manual override with provenance
- cold-start reconstruction

## 10. Deployment strategy

Stage 0: documentation + schemas only.
Stage 1: local/manual generation with Drive corpus.
Stage 2: shadow graph projection from content records.
Stage 3: analytics ingestion + learning engine.
Stage 4: assisted approval/publishing.
Stage 5: selective automation with human approval.

No autonomous publishing in the initial authority stage.