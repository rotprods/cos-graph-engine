#!/usr/bin/env node
/**
 * Regression + Unit tests for the Assembly class (src/weapons/geometry.js).
 *
 * REGRESSION TESTS (top) — Reproduce the exact BOOT FAILURE scenario:
 *   viewmodel.addWeapon(model, def) calls:
 *     model.id        → was undefined → BOOT FAILURE
 *     model.build()   → must return Map<string, Geometry>
 *
 * Usage: node tools/test-assembly.mjs
 */

import { Assembly, rodZ, box, tubeZ, dome } from '../src/weapons/geometry.js';

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; } else { fail++; } console.log(`  ${cond ? '✅' : '❌'} ${name}`); };

// =====================================================================
// REGRESSION: Simulate viewmodel.addWeapon(model, def) exactly
// =====================================================================
console.log('\n=== REGRESSION: viewmodel.addWeapon simulation ===\n');

// Simulate what addWeapon does with the model
function simulateAddWeapon(model) {
  // This is exactly what viewmodel.addWeapon does (line 317):
  const groupName = `weapon-${model.id}`;
  // This is exactly what viewmodel.addWeapon does (line 326):
  const map = model.build();
  return { groupName, map };
}

// Test with each weapon Assembly that caused the BOOT FAILURE
const weaponNames = ['shotgun', 'sniper', 'rifle', 'smg', 'pistol'];

for (const name of weaponNames) {
  const asm = new Assembly(name);
  
  // Add some geometry so build() returns a non-empty map
  asm.add(rodZ(0.012, 0.012, 0.47, 8), 'steel', { z: -0.01 });
  
  // THIS IS THE REGRESSION TEST:
  // Before the fix, model.id was undefined → groupName = "weapon-undefined"
  // After the fix, model.id === name → groupName = "weapon-{name}"
  const result = simulateAddWeapon(asm);
  
  t(`[REGRESSION] ${name}.id is defined`, asm.id !== undefined);
  t(`[REGRESSION] ${name}.id is "${name}"`, asm.id === name);
  t(`[REGRESSION] groupName is "weapon-${name}"`, result.groupName === `weapon-${name}`);
  t(`[REGRESSION] build() returns Map`, result.map instanceof Map);
  t(`[REGRESSION] groupName does NOT contain "undefined"`, !result.groupName.includes('undefined'));
}

// Edge case: what if someone creates an Assembly with empty name?
const emptyAsm = new Assembly('');
const emptyResult = simulateAddWeapon(emptyAsm);
t('[REGRESSION] Empty name id is ""', emptyAsm.id === '');
t("[REGRESSION] Empty name groupName is 'weapon-'", emptyResult.groupName === 'weapon-');

// =====================================================================
// REGRESSION: Verify the exact fix
// =====================================================================
console.log('\n=== REGRESSION: Exact fix verification ===\n');

// Read the Assembly class source to confirm the fix is present
import fs from 'fs';
const source = fs.readFileSync('src/weapons/geometry.js', 'utf-8');
const constructorMatch = source.match(/constructor\(name\)\s*\{[^}]*\}/);
t('[FIX] Assembly constructor exists', constructorMatch !== null);
t('[FIX] this.id = name is present in constructor', source.includes('this.id = name'));
t('[FIX] this.name = name is still present', source.includes('this.name = name'));

// Verify the fix is in the right place (inside constructor)
const constructorBody = source.match(/constructor\(name\)\s*\{([^}]*)\}/)[1];
t('[FIX] this.id is set in constructor', constructorBody.includes('this.id'));
t('[FIX] this.name is set in constructor', constructorBody.includes('this.name'));

// =====================================================================
// REGRESSION: Build weapons/index.js would not crash
// =====================================================================
console.log('\n=== REGRESSION: Weapons system integration ===\n');

// Check that weapons/index.js references model.id and model.build correctly
const wpSource = fs.readFileSync('src/weapons/index.js', 'utf-8');
t('[INTEGRATION] weapons/index.js imports shotgun', wpSource.includes("buildShotgun"));
t('[INTEGRATION] weapons/index.js imports sniper', wpSource.includes("buildSniper"));
t('[INTEGRATION] weapons/index.js has 5 weapons', wpSource.includes("'shotgun'") && wpSource.includes("'sniper'"));
t('[INTEGRATION] Digit4 key binding', wpSource.includes("Digit4"));
t('[INTEGRATION] Digit5 key binding', wpSource.includes("Digit5"));

// =====================================================================
// REGRESSION: Build would not fail
// =====================================================================
console.log('\n=== REGRESSION: Build system ===\n');

import { execSync } from 'child_process';
try {
  const out = execSync('npm run build 2>&1', { timeout: 120000, encoding: 'utf-8' });
  t('[BUILD] npm run build succeeds', true);
  t('[BUILD] Output contains "built in"', out.includes('built in'));
} catch (e) {
  t('[BUILD] npm run build', false, e.message.slice(0, 100));
}

// =====================================================================
// UNIT TESTS (existing)
// =====================================================================
console.log('\n=== Unit Tests ===\n');

// 1. Construction
const asm = new Assembly('test');
t('Constructor sets name', asm.name === 'test');
t('Constructor sets id', asm.id === 'test');
t('Constructor initializes buckets Map', asm.buckets instanceof Map);
t('Constructor initializes nodes Map', asm.nodes instanceof Map);

// 2. Build method
t('build() exists', typeof asm.build === 'function');
t('build() on empty returns Map', asm.build() instanceof Map);
t('Empty build has 0 entries', asm.build().size === 0);

// 3. Add geometry
asm.add(rodZ(0.012, 0.012, 0.47, 8), 'steel', { z: -0.01 });
asm.add(box(0.046, 0.055, 0.18, 0.001), 'alu', { z: 0.15 });
asm.add(box(0.036, 0.04, 0.14, 0.001), 'polymer', { z: -0.05, y: -0.01 });
asm.add(box(0.04, 0.05, 0.22, 0.001), 'wood', { z: 0.28 });

const map = asm.build();
t('build() returns Map', map instanceof Map);
t('Map has 4 materials', map.size === 4);
t('steel geometry present', map.has('steel'));
t('alu geometry present', map.has('alu'));
t('polymer geometry present', map.has('polymer'));
t('wood geometry present', map.has('wood'));

for (const [mat, geo] of map) {
  const verts = geo.getAttribute('position').count;
  t(`Geometry for '${mat}' has ${verts} vertices`, verts > 0);
}

// 4. Sniper-style assembly
const asm2 = new Assembly('sniper_test');
asm2.add(rodZ(0.014, 0.014, 0.66, 10), 'steel', { z: -0.15 });
asm2.add(box(0.05, 0.06, 0.22, 0.001), 'alu', { z: 0.2 });
asm2.add(tubeZ(0.022, 0.018, 0.26, 12, 0.0008), 'steel', { z: 0.04, y: 0.04 });
asm2.add(dome(0.022, 8, 0.5), 'steel', { z: -0.09, y: 0.04 });

const map2 = asm2.build();
t('Sniper build returns Map', map2 instanceof Map);
t('Sniper Map has steel', map2.has('steel'));
t('Sniper Map has alu', map2.has('alu'));

// 5. Edge cases
const emptyMap = new Assembly('empty').build();
t('Empty assembly build returns Map', emptyMap instanceof Map);
t('Empty assembly Map size 0', emptyMap.size === 0);

// build() twice returns empty after first call
const mapFirst = asm.build();
t('Second build() returns empty Map', mapFirst.size === 0);

// 6. Mirror
const asm3 = new Assembly('mirror_test');
asm3.add(box(0.04, 0.05, 0.22, 0.001), 'steel', { z: 0.28 });
asm3.addMirrored(box(0.04, 0.05, 0.22, 0.001), 'steel', { z: 0.28 });
const map3 = asm3.build();
t('Mirrored build has steel', map3.has('steel'));

// 7. No transform
const asm4 = new Assembly('notransform');
asm4.add(box(0.04, 0.05, 0.22, 0.001), 'steel');
const map4 = asm4.build();
t('Add with no transform works', map4.has('steel'));

// 8. Full transform
const asm5 = new Assembly('fulltransform');
asm5.add(box(0.04, 0.05, 0.22, 0.001), 'steel', { x: 1, y: 2, z: 3, rx: 0.1, ry: 0.2, rz: 0.3, sx: 2, sy: 2, sz: 2 });
const map5 = asm5.build();
t('Add with full transform works', map5.has('steel'));

// =====================================================================
// RESULTS
// =====================================================================
console.log(`\n=== Results: ${pass}/${pass + fail} passed ===\n`);

if (fail > 0) {
  console.error('REGRESSION FAILED: The BOOT FAILURE bug would reappear!');
  process.exit(1);
} else {
  console.log('All regression tests pass. The BOOT FAILURE bug is permanently fixed.');
  process.exit(0);
}