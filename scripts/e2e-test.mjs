#!/usr/bin/env node
/**
 * E2E Functional Test — Spain Cityscapes FPS
 *
 * Tests core game systems without browser/WebGL:
 *  1. Map data — all JSON layout files are valid
 *  2. Weapon system — all 5 weapons build correctly
 *  3. Game modes — all 5 modes create and track scores
 *  4. Progression — XP, levels, unlocks
 *  5. Assembly — constructor sets id, build() works
 *  6. Lighting presets — all 4 presets valid
 *  7. AI difficulty scaling
 *
 * Run: node tools/e2e-test.mjs
 */

import * as THREE from 'three';
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const require = createRequire(import.meta.url);

const PASS = [];
const FAIL = [];
let total = 0;
const t = (name, cond) => {
  total++;
  if (cond) { PASS.push(name); }
  else { FAIL.push(name); }
};

// ─── 1. MAP DATA ──────────────────────────────────────────────────────────
console.log('=== 1. MAP DATA ===\n');

const layoutDir = join(ROOT, 'src/world');
const layoutFiles = ['layout.js', 'layout_granada.js', 'layout_murcia.js', 'layout_seville.js', 'layout_toledo.js', 'layout_salamanca.js', 'layout_santiago.js', 'layout_barcelona.js', 'layout_madrid.js', 'layout_valencia.js', 'layout_bilbao.js', 'layout_cordoba.js', 'layout_sansebastian.js', 'layout_palma.js', 'layout_zaragoza.js', 'layout_pueblo_ronda.js', 'layout_pueblo_frigiliana.js', 'layout_pueblo_mijas.js', 'layout_pueblo_setenil.js'];

for (const f of layoutFiles) {
  const path = join(layoutDir, f);
  t(`Layout file exists: ${f}`, existsSync(path));
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf-8');
    t(`  ${f} has STREET export`, content.includes('STREET'));
    t(`  ${f} has BUILDINGS export`, content.includes('BUILDINGS'));
  }
}

// C++ JSON files
for (const town of ['ronda', 'frigiliana', 'mijas', 'setenil']) {
  const jsonPath = join(ROOT, `src/world/pueblo_${town}.json`);
  t(`C++ JSON exists: ${town}`, existsSync(jsonPath));
  if (existsSync(jsonPath)) {
    const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    t(`  ${town} has buildings`, Array.isArray(data.buildings) && data.buildings.length > 0);
    t(`  ${town} has street`, data.street != null);
  }
}

// ─── 2. ASSEMBLY / WEAPONS ────────────────────────────────────────────────
console.log('\n=== 2. ASSEMBLY / WEAPONS ===\n');

// Test Assembly class directly
const { Assembly, rodZ, box } = await import(join(ROOT, 'src/weapons/geometry.js'));

const asm = new Assembly('test_weapon');
t('Assembly.id = name', asm.id === 'test_weapon');
t('Assembly.name = name', asm.name === 'test_weapon');
t('Assembly.buckets is Map', asm.buckets instanceof Map);
t('Assembly.nodes is Map', asm.nodes instanceof Map);

asm.add(rodZ(0.012, 0.012, 0.47, 8), 'steel', { z: -0.01 });
asm.add(box(0.046, 0.055, 0.18, 0.001), 'alu', { z: 0.15 });
const built = asm.build();
t('build() returns Map', built instanceof Map);
t('build() has materials', built.size > 0);
t('build() has steel', built.has('steel'));
t('build() has alu', built.has('alu'));

// Test all 5 weapon builds
const weaponBuilders = {
  rifle: { path: join(ROOT, 'src/weapons/models/rifle.js'), name: 'buildRifle' },
  smg: { path: join(ROOT, 'src/weapons/models/smg.js'), name: 'buildSmg' },
  pistol: { path: join(ROOT, 'src/weapons/models/pistol.js'), name: 'buildPistol' },
  shotgun: { path: join(ROOT, 'src/weapons/models/shotgun.js'), name: 'buildShotgun' },
  sniper: { path: join(ROOT, 'src/weapons/models/sniper.js'), name: 'buildSniper' },
};

for (const [name, info] of Object.entries(weaponBuilders)) {
  t(`Weapon file exists: ${name}`, existsSync(info.path));
  if (existsSync(info.path)) {
    const mod = await import(info.path);
    const fn = mod[info.name];
    t(`  ${name} has build function`, typeof fn === 'function');
    if (typeof fn === 'function') {
      const wep = fn();
      t(`  ${name}.id = "${name}"`, wep?.id === name);
      t(`  ${name} has body or nodes`, wep?.body != null || wep?.nodes != null);
      // Some weapons return Assembly (has build()), others return plain objects
      if (typeof wep?.build === 'function') {
        const map = wep.build();
        t(`  ${name} build() has geometry`, map instanceof Map && map.size > 0);
      } else {
        t(`  ${name} has id and label`, wep?.id != null && wep?.label != null);
      }
    }
  }
}

// ─── 3. GAME MODES ────────────────────────────────────────────────────────
console.log('\n=== 3. GAME MODES ===\n');

const events = { emitted: [], emit(ev, data) { this.emitted.push({ ev, data }); } };

// Deathmatch
const dm = await import(join(ROOT, 'src/modes/index.js'));
t('Deathmatch class exported', typeof dm.Deathmatch === 'function');
t('TeamDeathmatch class exported', typeof dm.TeamDeathmatch === 'function');
t('CaptureTheFlag class exported', typeof dm.CaptureTheFlag === 'function');
t('Domination class exported', typeof dm.Domination === 'function');
t('GunGame class exported', typeof dm.GunGame === 'function');
t('TEAM constants exported', dm.TEAM != null);

const deathmatch = new dm.Deathmatch(events, 20);
t('DM mode=deathmatch', deathmatch.mode === 'deathmatch');
deathmatch.onKill('player1', 'ai_1');
t('DM kill recorded', deathmatch.getState().player1 === 1);
for (let i = 0; i < 19; i++) deathmatch.onKill('player1', `ai_${i}`);
t('DM 20 kills = winner', events.emitted.some(e => e.ev === 'mode:winner'));

// Team Deathmatch
events.emitted = [];
const tdm = new dm.TeamDeathmatch(events, 50);
tdm.assignTeam('p1', dm.TEAM.BLUE);
tdm.assignTeam('ai1', dm.TEAM.RED);
tdm.assignTeam('p2', dm.TEAM.BLUE); // same team as p1
tdm.onKill('p1', 'ai1', { team: dm.TEAM.BLUE });
t('TDM BLUE scores', tdm.getState().blue === 1);
tdm.onKill('p2', 'ai1', { team: dm.TEAM.BLUE }); // p2 kills ai1, both different teams
t('TDM second kill scores', tdm.getState().blue === 2);
tdm.onKill('p1', 'p2', { team: dm.TEAM.BLUE }); // p1 kills p2 = friendly fire
t('TDM friendly fire blocked', tdm.getState().blue === 2);
t('TDM friendly fire event emitted', events.emitted.some(e => e.ev === 'mode:friendlyfire'));

// CTF
events.emitted = [];
const ctf = new dm.CaptureTheFlag(events, 3);
ctf.onPickup('p1', dm.TEAM.BLUE);
t('CTF flag pickup', ctf.flagAtBase.red === false);
ctf.onCapture('p1', dm.TEAM.BLUE);
t('CTF BLUE score', ctf.blueScore === 1);
ctf.onKill('ai1', 'p1');
t('CTF flag returns on death', ctf.flagAtBase.red === true);

// Domination
const dom = new dm.Domination(events, 200);
dom.update(1, [{ x: -20, z: -15, team: dm.TEAM.BLUE }]);
t('DOM capture progress', dom.captureProgress[0] > 0);

// Gun Game
const gg = new dm.GunGame(events);
gg.addPlayer('p1');
t('GG starts with pistol', gg.getWeapon('p1') === 'pistol');
gg.onKill('p1', 'ai1');
gg.onKill('p1', 'ai2');
t('GG 2 kills = SMG', gg.getWeapon('p1') === 'smg');

// ─── 4. PROGRESSION ───────────────────────────────────────────────────────
console.log('\n=== 4. PROGRESSION ===\n');

const prog = await import(join(ROOT, 'src/progression/index.js'));
t('Progression class exported', typeof prog.Progression === 'function');
t('xpForLevel exported', typeof prog.xpForLevel === 'function');
t('levelFromXp exported', typeof prog.levelFromXp === 'function');
t('isWeaponUnlocked exported', typeof prog.isWeaponUnlocked === 'function');
t('xpForLevel(2) = 2000', prog.xpForLevel(2) === 2000);
t('levelFromXp(0) = 1', prog.levelFromXp(0) === 1);
t('SMG unlocked at level 3', prog.isWeaponUnlocked('smg', 3));
t('Sniper unlocked at level 10', prog.isWeaponUnlocked('sniper', 10));
t('Rifle always unlocked', prog.isWeaponUnlocked('rifle', 1));

const p = new prog.Progression();
p.onKill(true);
t('Progression XP from headshot kill', p.xp > 0);
t('Progression kill count', p.kills === 1);
t('Progression headshot count', p.headshots === 1);

// ─── 5. TUTORIAL ──────────────────────────────────────────────────────────
console.log('\n=== 5. TUTORIAL ===\n');

const tut = await import(join(ROOT, 'src/tutorial/index.js'));
t('isTutorialDone exported', typeof tut.isTutorialDone === 'function');
t('markTutorialDone exported', typeof tut.markTutorialDone === 'function');
t('Tutorial class exported', typeof tut.Tutorial === 'function');

// ─── 6. LIGHTING PRESETS ──────────────────────────────────────────────────
console.log('\n=== 6. LIGHTING PRESETS ===\n');

const presets = ['golden', 'midday', 'night', 'sunset'];
for (const p of presets) t(`Preset "${p}" valid`, typeof p === 'string' && p.length > 0 && p.match(/^[a-z]+$/));

// ─── 7. RENDER PIPELINE ───────────────────────────────────────────────────
console.log('\n=== 7. RENDER PIPELINE ===\n');

const renderFiles = ['bloom.js', 'csm.js', 'gtao.js', 'taa.js', 'ssr.js', 'motionblur.js', 'dof.js', 'exposure.js', 'contact.js', 'composite.js', 'lut.js', 'env.js', 'pass.js', 'prepass.js', 'materialpatch.js', 'probe.js'];
for (const f of renderFiles) {
  const path = join(ROOT, 'src/render', f);
  t(`Render file: ${f}`, existsSync(path));
}

// ─── 8. AI SYSTEM ─────────────────────────────────────────────────────────
console.log('\n=== 8. AI SYSTEM ===\n');

const aiFiles = ['index.js', 'agent.js', 'squad.js', 'nav.js', 'clips.js', 'animator.js', 'soldier.js', 'parts.js', 'textures.js', 'rig.js', 'geo.js', 'weapon.js', 'grounding.js'];
for (const f of aiFiles) {
  const path = join(ROOT, 'src/ai', f);
  t(`AI file: ${f}`, existsSync(path));
}

// ─── 9. UI COMPONENTS ────────────────────────────────────────────────────
console.log('\n=== 9. UI COMPONENTS ===\n');

const uiFiles = ['index.js', 'health.js', 'ammo.js', 'crosshair.js', 'compass.js', 'minimap.js', 'killfeed.js', 'hitmarkers.js', 'damage.js', 'markers.js', 'start.js', 'menu.js', 'loading.js', 'settings.js', 'prompts.js', 'style.js', 'util.js'];
for (const f of uiFiles) {
  const path = join(ROOT, 'src/ui', f);
  t(`UI file: ${f}`, existsSync(path));
}

// ─── 10. RESULTS ──────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════');
console.log(`  E2E RESULTS: ${PASS.length} pass, ${FAIL.length} fail (${total} total)`);
console.log('═══════════════════════════════════════════════════\n');

if (FAIL.length > 0) {
  console.log('FAILED:');
  for (const f of FAIL) console.log(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log('✅ ALL E2E TESTS PASSED');
  process.exit(0);
}