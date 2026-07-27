"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const level4_call_1 = require("../packages/graph/src/level4-call");
console.log('CallGraphEngine:', typeof level4_call_1.CallGraphEngine, level4_call_1.CallGraphEngine?.name);
console.log('ExecutionGraph:', typeof level1_execution_1.ExecutionGraph, level1_execution_1.ExecutionGraph?.name);
const e = new level4_call_1.CallGraphEngine();
console.log('metrics:', typeof e.metrics, e.metrics?.length);
console.log('buildDemo:', typeof e.buildDemo);
console.log('validate:', typeof e.validate);
console.log('toJSON:', typeof e.toJSON);
//# sourceMappingURL=debug-import.js.map