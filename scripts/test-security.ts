/**
 * Tests de Seguridad y Validacion (Fase 10)
 * Prueba: InputSanitizer, GraphValidator, SecurityGuard, LevelSecurity
 */

import { InputSanitizer, GraphValidator, SecurityGuard, LevelSecurity } from '../packages/graph/src/security';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function section(name: string) { console.log(`\n=== ${name} ===`); }

// =============================================
// InputSanitizer
// =============================================
function testSanitizer() {
  section('InputSanitizer');
  const sanitizer = new InputSanitizer();
  assert(sanitizer.sanitizeId('valid-id_123') === 'valid-id_123', 'Valid ID unchanged');
  assert(sanitizer.sanitizeId('  spaces  ') === 'spaces', 'Trims spaces');
  assert(sanitizer.sanitizeId('<script>alert(1)</script>') !== '<script>alert(1)</script>', 'Strips HTML tags');
  assert(sanitizer.sanitizeId('a'.repeat(100)).length <= 64, 'Truncates long IDs to 64');
  assert(sanitizer.sanitizeId('') !== '', 'Empty ID gets fallback');
  assert(sanitizer.sanitizeId('hello world') === 'hello_world', 'Replaces spaces with underscore');
  assert(sanitizer.sanitizeId('../../../etc/passwd') === '../../../etc/passwd', 'Allows dots and slashes in IDs');
  assert(sanitizer.sanitizeLabel('  My Label  ') === 'My Label', 'Trims label');
  assert(sanitizer.sanitizeLabel('<b>bold</b>') === 'bold', 'Strips HTML from label');
  assert(sanitizer.sanitizeLabel('') === 'unnamed', 'Empty label gets fallback');
  assert(sanitizer.sanitizeLabel('x'.repeat(300)).length <= 256, 'Truncates long labels');
  assert(sanitizer.isValidId('valid_id'), 'Valid ID passes');
  assert(!sanitizer.isValidId(''), 'Empty ID fails');
  assert(sanitizer.isValidLabel('Hello'), 'Valid label passes');
  assert(!sanitizer.isValidLabel(''), 'Empty label fails');
  assert(sanitizer.sanitizePath('safe/path/file.txt') === 'safe/path/file.txt', 'Safe path unchanged');
  assert(sanitizer.sanitizePath('../../../etc/passwd') === 'etc/passwd', 'Removes path traversal');
  assert(sanitizer.sanitizePath('file|name<>:?"*') === 'file_name______', 'Strips special chars');
}

// =============================================
// GraphValidator
// =============================================
function testValidator() {
  section('GraphValidator');
  const validator = new GraphValidator();
  const validGraph = { id: 'test', title: 'Test Graph', nodes: [{ id: 'n1', label: 'Node 1' }, { id: 'n2', label: 'Node 2' }], edges: [{ id: 'e1', source: 'n1', target: 'n2' }] };
  assert(validator.validateVisualGraph(validGraph).valid, 'Valid graph passes');
  const duplicateGraph = { title: 'Dup', nodes: [{ id: 'n1', label: 'A' }, { id: 'n1', label: 'B' }], edges: [] };
  const dupResult = validator.validateVisualGraph(duplicateGraph);
  assert(!dupResult.valid, 'Duplicate nodes detected');
  assert(dupResult.errors.some(e => e.message.includes('Duplicate')), 'Duplicate error message');
  const danglingGraph = { title: 'Dangling', nodes: [{ id: 'n1', label: 'A' }], edges: [{ id: 'e1', source: 'n1', target: 'missing' }] };
  const dangResult = validator.validateVisualGraph(danglingGraph);
  assert(!dangResult.valid, 'Dangling edges detected');
  assert(dangResult.errors.some(e => e.message.includes('missing')), 'Dangling target error');
  const emptyGraph = { nodes: [], edges: [] };
  const emptyResult = validator.validateVisualGraph(emptyGraph);
  assert(!emptyResult.valid, 'No-id graph fails validation');
  assert(emptyResult.errors.some(e => e.field.includes('id')), 'No-id error detected');
  let mutResult = validator.validateMutationInput('addNode', { id: 'valid-id', label: 'test' });
  assert(mutResult.valid, 'Valid addNode passes');
  mutResult = validator.validateMutationInput('addNode', {});
  assert(!mutResult.valid, 'Empty addNode fails');
  mutResult = validator.validateMutationInput('addEdge', { source: 'a', target: 'b' });
  assert(mutResult.valid, 'Valid addEdge passes');
  mutResult = validator.validateMutationInput('addEdge', {});
  assert(!mutResult.valid, 'Empty addEdge fails');
  mutResult = validator.validateMutationInput('removeNode', { id: 'n1' });
  assert(mutResult.valid, 'Valid removeNode passes');
  mutResult = validator.validateMutationInput('removeNode', {});
  assert(!mutResult.valid, 'Empty removeNode fails');
  mutResult = validator.validateMutationInput('unknown', {});
  assert(!mutResult.valid, 'Unknown action fails');
}

// =============================================
// SecurityGuard
// =============================================
async function testGuard() {
  section('SecurityGuard');
  const guard = new SecurityGuard({ maxOpsPerWindow: 5, rateLimitWindowMs: 10_000, maxNodes: 10, maxEdges: 20, defaultTimeoutMs: 500, maxRecursionDepth: 10 });
  assert(guard.checkRateLimit('client1'), 'First op allowed');
  assert(guard.checkRateLimit('client1'), 'Second op allowed');
  assert(guard.checkRateLimit('client1'), 'Third op allowed');
  assert(guard.checkRateLimit('client1'), 'Fourth op allowed');
  assert(guard.checkRateLimit('client1'), 'Fifth op allowed');
  assert(!guard.checkRateLimit('client1'), 'Sixth op blocked (rate limit)');
  assert(guard.checkRateLimit('client2'), 'Different client unaffected');
  let sizeResult = guard.checkGraphSize(5, 10);
  assert(sizeResult.valid, 'Small graph passes');
  sizeResult = guard.checkGraphSize(100, 10);
  assert(!sizeResult.valid, 'Oversized nodes rejected');
  sizeResult = guard.checkGraphSize(5, 100);
  assert(!sizeResult.valid, 'Oversized edges rejected');
  let timedOut = false;
  try {
    await guard.withTimeout(async () => { await new Promise(resolve => setTimeout(resolve, 2000)); return 'done'; }, 100);
    timedOut = false;
  } catch { timedOut = true; }
  assert(timedOut, 'Timeout on slow operation');
  const fastResult = await guard.withTimeout(async () => 'fast', 1000);
  assert(fastResult === 'fast', 'Fast operation completes within timeout');
  assert(guard.checkDepth(5), 'Depth 5 allowed');
  assert(guard.checkDepth(10), 'Depth 10 (max) allowed');
  assert(!guard.checkDepth(11), 'Depth 11 rejected');
  guard.resetCounters();
  assert(guard.checkRateLimit('client1'), 'Rate limit resets after reset');
}

// =============================================
// LevelSecurity (Integrated)
// =============================================
function testLevelSecurity() {
  section('LevelSecurity (Integrated)');
  const levelSec = new LevelSecurity();
  const result = levelSec.preprocessMutation('addNode', { id: '  Hello World  ', label: '<b>Test</b>' });
  assert(result.sanitized.id === 'Hello_World', 'Sanitizes ID in pipeline');
  assert(result.sanitized.label === 'Test', 'Sanitizes label in pipeline');
  assert(result.errors.length === 0, 'No validation errors after sanitization');
  const result2 = levelSec.preprocessMutation('addNode', {});
  assert(result2.errors.length > 0, 'Validation error on missing data');
}

// =============================================
// Run
// =============================================
async function run() {
  testSanitizer();
  testValidator();
  await testGuard();
  testLevelSecurity();
  section('Summary');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

run();