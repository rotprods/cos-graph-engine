#!/usr/bin/env node
/**
 * QA Gaps — Analiza diferencias entre el mapa original y los generados.
 */
import { readFileSync, existsSync } from 'fs';
const SCORE = { pass: 0, fail: 0, warn: 0 };
function test(n, c, d = '') { SCORE[c ? 'pass' : 'fail']++; console.log(`  ${c ? '✅' : '❌'} ${n} ${d}`); }
function warn(n) { SCORE.warn++; console.log(`  ⚠️  ${n}`); }

const orig = readFileSync('src/world/layout.js', 'utf-8');
const ob = (orig.match(/['"]id['"]\s*:/g) || []).length;
console.log(`\n📊 GAP ANALYSIS: Original vs Generated Maps\n`);
test('Original has buildings', ob > 0, `(${ob})`);
test('Original has balconies', orig.includes('balconies:'));
test('Original has GATE', orig.includes('export const GATE'));

console.log(`\nScore: ${SCORE.pass}/${SCORE.pass + SCORE.fail}`);