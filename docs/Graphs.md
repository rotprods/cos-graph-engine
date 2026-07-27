# COS Graph System

Every dimension of the system is a property graph with nodes, edges, metadata, timestamps, version, cost, and confidence.

## Graphs

### Knowledge Graph
Statements (subject-predicate-object) with confidence scores. Backed by the PropertyGraph engine. Supports queries, traversal, and bidirectional navigation.

### Runtime Graph
CogCells as nodes, event subscriptions and dependencies as edges. Real-time health and state on every node.

### Execution Graph
Tasks as nodes, dependency and data-flow as edges. Full execution trace with timing and cost per node.

### Memory Graph
Memory entries as nodes, cross-links and associations as edges. Supports importance-based traversal.

### Dependency Graph
Package-level dependencies between modules. Used for startup ordering and impact analysis.

### State Graph
Immutable state transitions for each CogCell. Full audit trail of every state change.

### Event Graph
Events as nodes, causality chains as edges. Full trace visualization.

### Semantic Graph
Concepts as nodes, semantic relationships as edges. Generated from embeddings and ontology.

### Ontology Graph
Classes and relations with inheritance hierarchy. Used for validation and type checking.

### Causal Graph
Causes and effects between events and state changes. Used for root cause analysis.

## Graph Operations

Every graph exposes:
- `addNode/Edge` — Create entities
- `getNode/Edge` — Retrieve by ID
- `queryNodes/Edges` — Filter by type, label, tags, properties
- `traverse` — Bidirectional BFS/DFS traversal
- `update` — Partial updates with versioning
- `delete` — Cascading delete
- `stats` — Type distribution and counts