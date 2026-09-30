// Gate de verificacion (anti-regresion XSS): el dashboard de packages/api
// inyecta datos del servidor/LLM via innerHTML. Este test asegura que TODA
// interpolacion dinamica pasa por esc() y que los mensajes de chat usan
// textContent (no innerHTML).
import { readFileSync } from 'fs';
import { join } from 'path';

let p = 0, f = 0;
function assert(cond: boolean, msg: string) { if (cond) { p++; } else { f++; console.error(`  ❌ ${msg}`); } }

const src = readFileSync(join(__dirname, '..', 'packages', 'api', 'src', 'http-server.ts'), 'utf8');

// 1) helper de escape presente con el mapa completo
assert(/function esc\(s\)/.test(src), 'esc(): helper definido');
for (const ch of ['&amp;', '&lt;', '&gt;', '&quot;', '&#39;']) {
  assert(src.includes(ch), `esc(): mapea ${ch}`);
}

// 2) addMessage: sin innerHTML, con textContent
assert(/div\.textContent = text/.test(src), 'addMessage usa textContent');
assert(!/div\.innerHTML = text/.test(src), 'addMessage ya NO usa innerHTML');

// 3) interpolaciones peligrosas: ninguna debe quedar sin esc()
const BAD = [
  '<span class="key">${k.subject',
  '${k.predicate || ',
  '${k.object || ',
  '${data.report?.title',
  '${data.report?.summary',
  '${(data.report?.summary',
  '🤖 LLM: ${(data.llmTrace.content',
  '${step.output?.substring',
  'Error: ${e.message}',
  '</span>${data.selfImprovement.trend}',
  '"margin:2px 0">${c}</li>',
];
for (const bad of BAD) {
  assert(!src.includes(bad), `sin interpolacion sin escapar: ${bad.slice(0, 40)}`);
}

// 4) los campos dinamicos SI aparecen escapados (positivo)
for (const good of ['esc(data.report?.title', 'esc(k.subject', 'esc(c)', 'esc(e.message)', 'esc(step.output?.substring', 'esc(data.selfImprovement.trend)']) {
  assert(src.includes(good), `interpolacion escapada presente: ${good}`);
}

console.log(`\n📊 XSS-HARDENING: ${p} tests, ${p + f} total, ${f} failed`);
process.exit(f > 0 ? 1 : 0);
