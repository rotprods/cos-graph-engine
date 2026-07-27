# COS MVP Implementation Guide

## Objective
Build and verify the Cognitive Operating System MVP in 3 weeks.

The MVP is: a running CellHost with EventBus, Scheduler, one working CogCell that processes input through a reasoning step and returns output, observable via the API.

## Sprint 1 — Foundation & Core

### Day 1-2: Types
Implement `packages/core/src/types.ts` with:
- EntityId, Timestamp, Version, Metadata, Confidence, Cost
- All memory types (MemoryEntry, MemoryLayer, MemoryQuery, MemoryStoreStats)
- All graph types (GraphNode, GraphEdge, GraphQuery, GraphPath, GraphStats)
- Event types (CogEvent, EventHandler, SubscribeOptions)
- Cell types (CogCellDefinition, CogCellState, CellLifecycle, CellContext, CellOutput)
- Tool types (ToolDefinition, ToolResult)
- Policy types (PolicyRule, PolicyDecision)

### Day 3: Errors
Implement `packages/core/src/errors.ts`:
- CellError with code, message, severity, timestamp
- ValidationError, TimeoutError, PermissionDeniedError
- generateId() using timestamp + random + counter

### Day 4: BaseCell
Implement `packages/core/src/cell.ts`:
- Lifecycle state machine (created → initializing → ready → running → paused → terminated)
- process() with timing, error handling, metrics
- inspect() returning CellInspection
- Abstract onProcess() hook

### Day 5: Tests
- Unit test all 3 core modules
- Verify CellError serializes to/from JSON
- Verify BaseCell goes through all lifecycle states
- Test process() returns CellOutput with correct structure

## Sprint 2 — MVP Runtime

### Day 1-2: EventBus
Implement `packages/runtime/src/eventbus.ts`:
- publish() generates unique event with traceId, spanId
- subscribe() returns SubscriptionId
- Multiple handlers per event type
- Wildcard '*' subscriber
- Priority ordering
- Once-option
- History with configurable max
- unsubscribe()

### Day 3: StateManager
Implement `packages/runtime/src/state.ts`:
- get/set/update with immutability
- Snapshot on every state change
- History query by entity

### Day 4: Scheduler
Implement `packages/runtime/src/scheduler.ts`:
- enqueue() with priority ordering
- dequeue() by type and limit
- complete()/fail() with retry logic
- cancel()
- stats()
- Polling processor at configurable interval

### Day 5: CellHost + MVP Bootstrap
Implement `packages/runtime/src/cellhost.ts`:
- register() validates and initializes cells
- start() starts all cells and scheduler
- shutdown() stops everything gracefully
- getSystemHealth(), inspectCell()

Implement MVP bootstrap in `deployment/src/bootstrap.ts`:
- Create one cognitive cell that echoes input with a reasoning trace
- Register it with CellHost
- Define one default agent using this cell
- Define one policy allowing all
- Start, process one input, log output, shutdown

Verification:
```bash
npm run cos
# Output: "COS initialized. Cells: 1. Processed: [input]"
```

## Sprint 3 — Verification & Hardening

### Day 1-2: Integration test
- Write integration test that boots the full MVP
- Processes 10 different inputs
- Verifies EventBus events for each
- Verifies Scheduler stats
- Verifies State snapshots exist
- Verifies CellInspection

### Day 3-4: Crank inputs
- Test with empty input, null, large JSON (1MB), arrays, nested objects
- Test error recovery: make process() throw, verify retry works
- Test concurrent processing: 10 parallel inputs
- Benchmark: time from `process()` call to output delivery

### Day 5: Documentation + Packaging
- Architecture.md updated with MVP specifics
- README.md with quick start
- package.json scripts: build, test, cos

## MVP Verification Checklist

- [ ] `npm run build` compiles without errors
- [ ] `npm test` passes all unit + integration tests
- [ ] `npm run cos` boots the system
- [ ] Processing a string input returns a CellOutput with:
  - Valid id
  - result matching input
  - cost > 0
  - confidence > 0
  - latency > 0
- [ ] EventBus has recorded the event
- [ ] Scheduler stats show completed > 0
- [ ] State has snapshots
- [ ] Inspect returns full CellInspection
- [ ] System shuts down cleanly (no hanging processes)
- [ ] All 3 subsystems testable independently

## Post-MVP

After MVP verification, proceed to Phase 2a (Memory) following the roadmap in Roadmap.md. The MVP is the foundation everything else builds on — keep it clean and testable.