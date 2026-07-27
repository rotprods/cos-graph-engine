# Edge Convention Design Document

**Status:** Canonical specification
**Applies to:** COS Graph Engine — all levels (L0–L19) that implement graph semantics

---

## 1. Purpose

This document defines the **single, invariant edge convention** that every graph level in the COS engine must obey. It governs how edges are interpreted, how traversal methods behave, and how graph-level properties (roots, leaves, cycles) are defined.

---

## 2. The Edge Convention (Arrow Rule)

For every directed edge `source → target` in the graph engine:

| Graph Type | Interpretation of `source → target` |
|---|---|
| **Dependency graph** | `source` **depends on** `target` |
| **Execution graph** | `source` **precedes** `target` (i.e., `source` runs before `target`) |
| **Dataflow graph** | Data **flows from** `source` to `target` |

### 2.1 Rationale

- **Dependency:** If A depends on B, the edge goes A → B. This means "to resolve A, you first need B." Topological ordering produces a sequence where each node appears *after* its dependencies.
- **Execution:** If A precedes B, the edge goes A → B. This means A must execute before B. A topological sort of an execution graph yields a valid schedule.
- **Dataflow:** If data flows from A to B, the edge goes A → B. This means A produces data consumed by B.

The three interpretations are **consistent with each other**: the arrow always points from the "earlier/requiring" node toward the "later/required" node.

---

## 3. Level-Level Consistency Rule

> **Within each level, ALL methods that traverse edges MUST traverse in the SAME direction.**

This is the single most important invariant in the graph engine. It means:

- If a method walks "forward" (following `source → target`), every other method that walks edges must also walk forward.
- If a method walks "backward" (following `target → source`), every other method must also walk backward.
- **No method may mix directions** — topologicalSort going forward while findRoots goes backward — unless the method's documented semantics explicitly require reversal (e.g., `ancestors` vs `descendants`).

### 3.1 Methods covered by the consistency rule

The following methods MUST all agree on direction at a given level:

| Method | Direction |
|---|---|
| `topologicalSort()` | Follows `source → target` |
| `computeDepth()` | Follows `source → target` (depth increases away from root) |
| `findRoots()` | Nodes with **zero outgoing edges** |
| `findLeaves()` | Nodes with **zero incoming edges** |
| `subgraph(node, ...)` | Follows `source → target` from `node` |
| `detectCycle()` | Searches along `source → target` |

### 3.2 The one required reversal

- `ancestors(node)` — follows edges **backward** (target → source)
- `descendants(node)` — follows edges **forward** (source → target)

These are intentionally opposite, and both are correct.

---

## 4. Root and Leaf Definitions

### 4.1 Root

> **Root** = a node with **no outgoing edges** (it depends on nothing).

In dependency terms: a root requires no other node to be resolved first. It is the starting point for topological sorts.

- `findRoots()` returns all nodes with `outdegree == 0`.
- In a dependency graph, roots are "primitives" or "base cases."
- In an execution graph, roots are the first steps in a schedule.
- In a dataflow graph, roots are data sources (no upstream producers).

### 4.2 Leaf

> **Leaf** = a node with **no incoming edges** (nothing depends on it).

- `findLeaves()` returns all nodes with `indegree == 0`.
- In a dependency graph, leaves are "final consumers" or "top-level outputs."
- In an execution graph, leaves are terminal steps.
- In a dataflow graph, leaves are sinks (no downstream consumers).

### 4.3 Verification

For a graph with nodes A → B → C:
- Roots: A (outdegree = 0, depends on nothing)
- Leaves: C (indegree = 0, nothing depends on it)
- Topological order: [A, B, C] (each node after its dependencies)

---

## 5. Level-Specific Notes

### 5.1 Levels that implement topological sort (L1, L3, L15)

These levels MUST use the edge convention as defined above. Their `topologicalSort()` MUST return a list where each node appears **after** all nodes it depends on (following `source → target`).

### 5.2 Levels without topological sort (e.g., L19 molecular, L18 biological)

Levels with non-DAG semantics (molecular bonds, friendships, neurons) are exempt from topological ordering. However, they **must still** obey the edge convention for any direction-sensitive methods they do implement (e.g., `detectCycle`, `findRoots`, `findLeaves`).

### 5.3 Diamond pattern (L1)

When a node has two outgoing edges to different targets, or two nodes both connect to the same target, the accepted behavior is **last-write-wins** for single-value dataflow. This is a documented design choice, not a bug. The execution engine guarantees all upstream nodes complete before the downstream node runs.

---

## 6. Summary

```
Convention:  source → target
Dependency:  source depends on target
Execution:   source precedes target
Dataflow:    data flows from source to target
Root:        node with outdegree == 0 (depends on nothing)
Leaf:        node with indegree == 0 (nothing depends on it)
Rule:        ALL traversal methods at a given level agree on direction
```