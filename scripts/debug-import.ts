import { CallGraphEngine } from '../packages/graph/src/level4-call';
import { ExecutionGraph } from '../packages/graph/src/level1-execution';
console.log('CallGraphEngine:', typeof CallGraphEngine, CallGraphEngine?.name);
console.log('ExecutionGraph:', typeof ExecutionGraph, ExecutionGraph?.name);
const e = new CallGraphEngine();
console.log('metrics:', typeof e.metrics, e.metrics?.length);
console.log('buildDemo:', typeof e.buildDemo);
console.log('validate:', typeof e.validate);
console.log('toJSON:', typeof e.toJSON);