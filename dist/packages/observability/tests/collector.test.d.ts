/**
 * Tests for Trace Collector — T-3.2
 *
 * 16 tests covering:
 *  - CircularBuffer: push, overflow, getAll, getLast, clear, edge cases
 *  - TraceCollectorImpl: record, recordDirect, getAll, getLast, findById, filter
 *  - JSON export: exportJSON, exportJSONPretty, exportSummaryJSON
 *  - NoopTraceCollector: singleton, zero overhead
 *  - Integration: collect TracesSessions from CSR
 *  - Edge cases: empty collector, overflow, single session
 *  - mergeCollectorsExport
 */
export {};
//# sourceMappingURL=collector.test.d.ts.map