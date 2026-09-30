// Ciberseguridad extrema — tests adversarios sobre el modulo de seguridad:
// XSS, inyeccion (SQL/Cypher/shell), path traversal, prototype pollution,
// null bytes, DoS por tamano/longitud, rate limiting y bypass de validacion.
import { InputSanitizer, GraphValidator, SecurityGuard, LevelSecurity } from '../packages/graph/src/security';
import { VisualGraph } from '../packages/graph/src/level0-visual';

let p = 0;
let f = 0;
function assert(cond: boolean, msg: string) { if (cond) { p++; } else { f++; console.error(`  ❌ ${msg}`); } }

const DANGEROUS = /[<>"'`;\\{}]|\u0000/;

// ---------- XSS ----------
(function xss() {
  const s = new InputSanitizer();
  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '"><svg/onload=alert(1)>',
    'javascript:alert(document.cookie)',
    '<iframe src="javascript:alert(1)">',
  ];
  for (const pl of payloads) {
    const id = s.sanitizeId(pl);
    const label = s.sanitizeLabel(pl);
    assert(!/[<>]/.test(id) && !/<\/?[a-zA-Z]/.test(id), `XSS id limpio: ${pl.slice(0, 24)}`);
    assert(!/[<>]/.test(label) || label === 'unnamed', `XSS label limpio: ${pl.slice(0, 24)}`);
  }
})();

// ---------- Inyeccion (SQL / Cypher / shell) ----------
(function injection() {
  const s = new InputSanitizer();
  const payloads = [
    "a'; DROP TABLE users; --",
    "' OR '1'='1",
    'MATCH (n) DETACH DELETE n RETURN n',
    '`rm -rf /`',
    '$(whoami)',
    '${process.env.SECRET}',
    'a"||"b',
  ];
  for (const pl of payloads) {
    const id = s.sanitizeId(pl);
    assert(!DANGEROUS.test(id), `sin caracteres peligrosos en id: ${pl.slice(0, 22)}`);
    // el payload puede dejar palabras, pero sin delimitadores de sintaxis es inerte
    assert(!/['";`\\]/.test(id), `sin delimitadores de inyeccion: ${pl.slice(0, 22)}`);
  }
  // el pattern de id valido no admite comillas, punto y coma ni backslash
  assert(!s.isValidId("a';--"), 'isValidId rechaza comillas/punto y coma');
})();

// ---------- Path traversal ----------
(function traversal() {
  const s = new InputSanitizer();
  for (const pl of ['../../etc/passwd', '..\\..\\windows\\system32', '....//....//etc', 'a/../../b']) {
    const out = s.sanitizePath(pl);
    assert(!out.includes('..'), `sin '..' tras sanitizePath: ${pl}`);
    assert(!/[<>:"|?*]/.test(out), `sin chars de path peligrosos: ${pl}`);
  }
})();

// ---------- Prototype pollution ----------
(function proto() {
  const s = new InputSanitizer();
  const key = s.sanitizeId('__proto__');
  const obj: Record<string, unknown> = {};
  obj[key] = { polluted: true };
  assert(({} as Record<string, unknown>)['polluted'] === undefined, 'no contamina Object.prototype');
  assert((Object.prototype as Record<string, unknown>)['polluted'] === undefined, 'Object.prototype intacto');
})();

// ---------- Null bytes / control chars / longitud (DoS) ----------
(function dos() {
  const s = new InputSanitizer();
  const withNull = s.sanitizeId('abc\u0000def');
  assert(!withNull.includes('\u0000'), 'null byte eliminado del id');
  const long = s.sanitizeId('x'.repeat(100000));
  assert(long.length <= 64, `id truncado a maxIdLength (got ${long.length})`);
  const longLabel = s.sanitizeLabel('y'.repeat(100000));
  assert(longLabel.length <= 256, `label truncado a maxLabelLength (got ${longLabel.length})`);
  assert(!s.isValidId('z'.repeat(65)), 'isValidId rechaza id demasiado largo');
  assert(s.isValidId('ok-id_1:sub/path@host#frag'), 'isValidId acepta id valido');
  assert(!s.isValidId(''), 'isValidId rechaza vacio');
})();

// ---------- Rate limiting + limites de tamano/depth ----------
(function guard() {
  const g = new SecurityGuard({ maxOpsPerWindow: 3, rateLimitWindowMs: 60000, maxNodes: 100, maxEdges: 200, maxRecursionDepth: 5 });
  assert(g.checkRateLimit('k'), 'rate limit: 1a op permitida');
  assert(g.checkRateLimit('k'), 'rate limit: 2a op permitida');
  assert(g.checkRateLimit('k'), 'rate limit: 3a op permitida');
  assert(!g.checkRateLimit('k'), 'rate limit: 4a op BLOQUEADA');
  assert(g.checkRateLimit('otro'), 'rate limit por clave independiente');
  assert(g.getRateLimitStats().activeKeys === 2, 'stats: 2 claves activas');
  g.resetCounters();
  assert(g.checkRateLimit('k'), 'tras reset, permitida de nuevo');
  assert(g.getRateLimitStats().activeKeys === 1, 'stats tras reset: 1 clave');

  assert(!g.checkGraphSize(101, 1).valid, 'grafo sobre maxNodes -> invalido');
  assert(!g.checkGraphSize(1, 201).valid, 'grafo sobre maxEdges -> invalido');
  assert(g.checkGraphSize(50, 100).valid, 'grafo dentro de limites -> valido');
  assert(!g.checkDepth(6), 'depth sobre maxRecursionDepth -> false');
  assert(g.checkDepth(5), 'depth dentro de limite -> true');
})();

// ---------- Validacion de grafo (esquema) ----------
(function validation() {
  const v = new GraphValidator();
  const clean: VisualGraph = {
    id: 'g', title: 'ok',
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    edges: [{ id: 'e', source: 'a', target: 'b' }],
  };
  assert(v.validateVisualGraph(clean).valid, 'grafo limpio -> valido');

  const dangling = JSON.parse(JSON.stringify(clean)) as VisualGraph;
  dangling.edges.push({ id: 'e2', source: 'a', target: 'ghost' });
  const r = v.validateVisualGraph(dangling);
  assert(!r.valid && r.errors.length > 0, 'edge colgante -> invalido con errores');

  const dup = JSON.parse(JSON.stringify(clean)) as VisualGraph;
  dup.nodes.push({ id: 'a', label: 'Dup' });
  const rd = v.validateVisualGraph(dup);
  assert(!rd.valid && rd.errors.length > 0, 'nodos duplicados -> invalido con errores');
})();

// ---------- LevelSecurity: preprocessMutation sanitiza ----------
(function levelSafety() {
  const ls = new LevelSecurity();
  const out = ls.preprocessMutation('addNode', { id: '<script>x</script>', label: '<img onerror=1>' });
  assert(out.sanitized && typeof out.sanitized['id'] === 'string', 'preprocess devuelve sanitized.id');
  assert(!/[<>]/.test(String(out.sanitized['id'])), 'preprocess: id sanitizado sin < >');
  assert(Array.isArray(out.errors), 'preprocess devuelve lista de errores');
})();

console.log(`\n📊 SEGURIDAD-HARDENING: ${p} tests, ${p + f} total, ${f} failed`);
process.exit(f > 0 ? 1 : 0);
