# ROT Viral Content Engine — Graph Specification

## Graph purpose
The graph is a rebuildable reasoning/projection layer over authoritative content, evidence, publication and metric records.

## Primary subgraphs

### 1. ContentGraph
Nodes: Content, Script, Scene, Publication, PlatformVariant.
Purpose: lineage from canonical idea to every derivative and publication.

### 2. KnowledgeGraph
Nodes: Topic, Claim, Evidence, Source, Insight.
Purpose: factual grounding and provenance.

### 3. PerformanceGraph
Nodes: Publication, MetricObservation, Baseline, Insight.
Purpose: learn which creative and distribution features correlate with outcomes.

### 4. AudienceGraph
Nodes: Audience, Topic, Pain, Desire, LanguagePattern, Platform.
Purpose: route ideas and framing to the right audience.

### 5. HookGraph
Nodes: Hook, HookFamily, Topic, Audience, Publication.
Purpose: learn hook performance under context rather than globally.

### 6. VisualPatternGraph
Nodes: VisualPattern, FirstFrame, EditPattern, Scene, Publication.
Purpose: model visual retention mechanics.

### 7. ExperimentGraph
Nodes: Experiment, Hypothesis, Variant, Variable, Observation, Decision.
Purpose: preserve causal-learning lineage.

### 8. OfferGraph
Nodes: Offer, Audience, Content, CTA, FunnelStage.
Purpose: connect content performance to strategic/commercial outcomes.

### 9. WorkflowGraph
Nodes: Run, Agent, Tool, Gate, Error, Artifact.
Purpose: runtime observability and debugging.

## Canonical edge contract
Each material edge includes where applicable:
- edge_id
- edge_type
- source_id
- target_id
- valid_from
- valid_until
- observed_at
- recorded_at
- source_revision
- provenance_ref
- confidence
- sensitivity
- project_scope

## Example content lineage
Signal
  -> PRODUCES_TOPIC -> Topic
  -> SUPPORTED_BY -> Source
Topic
  -> FRAMED_AS -> Angle
Angle
  -> REALIZED_BY -> Hook
Hook
  -> USED_BY -> Script
Script
  -> HAS_VARIANT -> PlatformVariant
PlatformVariant
  -> PUBLISHED_AS -> Publication
Publication
  -> OBSERVED_BY -> MetricObservation
MetricObservation
  -> SUPPORTS -> Insight
Insight
  -> UPDATES_PRIOR -> HookFamily/Audience/Topic prior

## Example evidence lineage
Claim
  -> SUPPORTED_BY -> Evidence
Evidence
  -> EXTRACTED_FROM -> Source
Claim
  -> SUPERSEDES -> Claim
Claim
  -> RETRACTED_BY -> Claim

## Example learning query
Question: Which hook families should be preferred for AI-video launch content aimed at creators on Instagram?

Traversal constraints:
- audience=CREATORS
- topic family=AI_VIDEO
- platform=INSTAGRAM
- publication date within configured recency window
- minimum sample threshold
- exclude low-confidence/missing-metric observations
- normalize against Roberto's Instagram baseline

Return:
- candidate hook families
- effect estimate vs baseline
- sample size
- uncertainty
- top supporting publications
- contradicting examples
- last-updated timestamp

## Rebuild invariant
Given the same authoritative event-log boundary and database snapshot, a full graph rebuild must produce the same canonical nodes, edges and projection hash.

## Temporal rule
Content performance is not timeless. Priors must support recency windows and temporal supersession. A pattern that worked 12 months ago cannot silently retain the same authority as current evidence.

## Anti-leakage rule
Private/client-sensitive nodes and edges must be filtered before context compilation. Graph traversal does not bypass policy.

## Anti-circularity rule
Model-generated ratings cannot be treated as performance evidence. Only external observations, human approvals, deterministic checks and declared experiments can update empirical priors.

## Initial projection MVP
Implement first:
1. ContentGraph
2. Knowledge/ProofGraph
3. HookGraph
4. PerformanceGraph
5. ExperimentGraph

Defer richer Audience/Visual/Offer projection until the vertical slice is proven.