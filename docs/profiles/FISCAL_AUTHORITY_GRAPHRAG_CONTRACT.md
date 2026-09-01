# Authority-Aware Fiscal GraphRAG — PR-D

## Problem
Native COS L11 already performs vector retrieval + graph traversal + hybrid re-ranking, but fiscal/legal questions require additional gates. A semantically relevant spreadsheet template must not answer `was this filed?` as truth, and a payment instruction must not answer `was this paid?`.

## Solution
`FiscalAuthorityGraphRAG` uses native `GraphRAGEngine` for candidate generation and adds a domain context compiler with:

- source-authority score;
- temporal validity;
- provenance completeness;
- entity-resolution confidence;
- sensitivity clearance;
- centrality signal;
- staleness penalty;
- contradiction tracking;
- truth-confidence separate from retrieval score;
- evidence paths;
- answerability gates.

## Query intents

### GENERAL
Broad evidence retrieval. No special legal-state authority requirement.

### FILED_STATUS
- requires official/filed evidence;
- forbids `TEMPLATE_NOT_FILING` and `PREPARED_NOT_FILED` evidence classes;
- returns `answerable=false` when official evidence is absent.

### PAYMENT_STATUS
- requires official/bank-statement-grade payment evidence;
- forbids payment instruction/letter classes that do not prove settlement.

### DEDUCTIBILITY
Requires stronger evidence than general semantic relevance and should feed a downstream professional/legal rule evaluator.

### TAX_CALCULATION
Allows reconstructed inputs but keeps calculation truth separate from filed-return truth.

## Context pack

```ts
{
  query,
  intent,
  selected: [{
    chunk,
    retrievalScore,
    truthConfidence,
    authorityScore,
    temporalScore,
    provenanceScore,
    entityResolutionScore,
    reasons
  }],
  contradictions,
  entities,
  relationships,
  evidencePaths,
  unresolvedGaps,
  answerable,
  answerabilityReason,
  retrievalTrace
}
```

## Critical semantic distinction

```text
retrieval confidence != truth confidence != legal conclusion
```

GraphRAG prepares an evidence-bound context pack. It does not itself file returns, mark payments, or authorize legal truth mutations.

## Adversarial requirements

- template cannot satisfy FILED_STATUS;
- old/out-of-validity evidence cannot satisfy current query;
- restricted evidence cannot leak through lower clearance;
- contradictions remain visible;
- no-evidence or low-authority query becomes explicitly unanswerable;
- payment letter cannot substitute for bank/authority settlement evidence.

## Stack
This PR is stacked on PR-C (`feat/fiscal-knowledge-graphql`). It should target that branch until PR-C is merged/rebased.

Repository-wide CI remains blocked by issue #71 until workflow root paths are repaired.
