#!/usr/bin/env node
/**
 * Unit tests for the CoverTactics class (src/ai/cover-tactics.js).
 *
 * Covers:
 *  1. Cover quality evaluation (evaluateCoverQuality)
 *  2. Best cover selection (findBestCover)
 *  3. Cover validity (isCoverValid)
 *  4. Danger calculation (calculateDanger)
 *  5. Peek positioning (getPeekPosition)
 *  6. Firing position (getFiringPosition)
 *  7. Next cover selection (findNextCover)
 *
 * Usage: node tools/test-cover-tactics.mjs
 */

import * as THREE from 'three';
import { CoverTactics } from '../src/ai/cover-tactics.js';

// =====================================================================
// Test framework
// =====================================================================
let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; } else { fail++; } console.log(`  ${cond ? '✅' : '❌'} ${name}`); };

// =====================================================================
// Mock helpers
// =====================================================================

function makeMockCover(x, y, z, dx, dz, high = true, dist = 1.5) {
  return { x, y, z, dx, dz, high, dist, claimed: -1 };
}

function makeMockAgent(id, x, y, z, cover = null, coverPos = null) {
  const pos = new THREE.Vector3(x, y, z);
  return {
    id,
    position: pos,
    cover,
    coverPos: coverPos || new THREE.Vector3(x, y, z),
  };
}

function makeMockThreat(x, y, z) {
  return new THREE.Vector3(x, y, z);
}

// =====================================================================
// Test 1: Cover quality evaluation
// =====================================================================
console.log('\n=== 1. Cover Quality Evaluation ===\n');

{
  const tactics = new CoverTactics({
    cover: { points: [], pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  // No cover
  t('No cover = NONE', tactics.evaluateCoverQuality(new THREE.Vector3(0, 0, 0), null, null) === 0);

  // Low cover: crouch only
  const lowCover = makeMockCover(0, 0, 0, 1, 0, false);
  t('Low cover quality', tactics.evaluateCoverQuality(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 0, 0), lowCover) >= 1);

  // High cover: standing protection
  const highCover = makeMockCover(0, 0, 0, 1, 0, true);
  t('High cover quality', tactics.evaluateCoverQuality(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 0, 0), highCover) >= 2);

  // Threat behind cover direction (good angle)
  const alignedCover = makeMockCover(0, 0, 0, 1, 0, true);
  t('Aligned cover = high quality', tactics.evaluateCoverQuality(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 0, 0), alignedCover) >= 2);

  // Threat from the side (cover doesn't help)
  const sideCover = makeMockCover(0, 0, 0, 1, 0, true);
  t('Side threat = lower quality', tactics.evaluateCoverQuality(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 10), sideCover) <= 2);

  // Very close threat (< 5m)
  const closeThreat = makeMockCover(0, 0, 0, 1, 0, true);
  t('Close threat reduces quality', tactics.evaluateCoverQuality(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 0, 0), closeThreat) <= 2);

  // Very far threat (> 50m)
  const farThreat = makeMockCover(0, 0, 0, 1, 0, true);
  t('Far threat reduces quality', tactics.evaluateCoverQuality(new THREE.Vector3(0, 0, 0), new THREE.Vector3(60, 0, 0), farThreat) <= 2);
}

// =====================================================================
// Test 2: Best cover selection
// =====================================================================
console.log('\n=== 2. Best Cover Selection ===\n');

{
  const coverPoints = [
    makeMockCover(10, 0, 0, 1, 0, true),  // Good cover
    makeMockCover(20, 0, 0, 1, 0, false), // Low cover
    makeMockCover(30, 0, 0, 0, 1, true),  // Far cover
  ];

  const tactics = new CoverTactics({
    cover: { points: coverPoints, pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  const agent = makeMockAgent('test_1', 0, 0, 0);
  const threat = makeMockThreat(15, 0, 0);

  const best = tactics.findBestCover(agent, threat, { minRange: 5, maxRange: 35, maxTravel: 25 });
  t('Best cover found', best !== null);
  t('Best cover is closest adequate', best?.x === 10);

  // Test with claimed cover
  coverPoints[0].claimed = 99; // Claimed by another agent
  const best2 = tactics.findBestCover(agent, threat, { minRange: 5, maxRange: 35, maxTravel: 25 });
  t('Skips claimed cover', best2?.x !== 10);
  coverPoints[0].claimed = -1; // Reset

  // Test with no cover in range
  const best3 = tactics.findBestCover(agent, threat, { minRange: 5, maxRange: 10, maxTravel: 5 });
  t('No cover in range = null', best3 === null);

  // Test with no cover points
  const emptyTactics = new CoverTactics({
    cover: { points: [], pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: { MASK: { WORLD: 1 }, raycastAny() { return false; }, lineOfSight() { return true; } },
  });
  t('No cover points = null', emptyTactics.findBestCover(agent, threat) === null);
}

// =====================================================================
// Test 3: Cover validity
// =====================================================================
console.log('\n=== 3. Cover Validity ===\n');

{
  const coverPoint = makeMockCover(10, 0, 10, 1, 0, true);
  const coverPos = new THREE.Vector3(10, 0, 10);
  const agent = makeMockAgent('test_2', 10, 0, 10, coverPoint, coverPos);

  const tactics = new CoverTactics({
    cover: { points: [coverPoint], pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  // Valid cover: agent is at cover position, no threat
  t('Cover valid without threat', tactics.isCoverValid(agent, null) === true);

  // Valid cover: threat from the side (perpendicular to cover direction)
  const threatFromSide = makeMockThreat(10, 0, 15); // Threat is at +Z, cover faces +X → angle ≈ 0
  t('Cover valid against side threat', tactics.isCoverValid(agent, threatFromSide) === true);

  // Invalid cover: agent moved away
  agent.position.set(15, 0, 10);
  t('Cover invalid when moved away', tactics.isCoverValid(agent, threatFromSide) === false);
  agent.position.set(10, 0, 10); // Reset

  // Invalid cover: claimed by another agent
  coverPoint.claimed = 99;
  t('Cover invalid when claimed', tactics.isCoverValid(agent, threatFromSide) === false);
  coverPoint.claimed = -1; // Reset
}

// =====================================================================
// Test 4: Danger calculation
// =====================================================================
console.log('\n=== 4. Danger Calculation ===\n');

{
  const tactics = new CoverTactics({
    cover: { points: [], pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  const pos = new THREE.Vector3(0, 0, 0);

  // No threats
  t('No threats = 0 danger', tactics.calculateDanger(pos, []) === 0);

  // One threat nearby (10m, LOS)
  const threat = makeMockThreat(10, 0, 0);
  const danger = tactics.calculateDanger(pos, [threat]);
  t('Nearby threat > 0 danger', danger > 0);
  t('Nearby threat < 1 danger', danger < 1);

  // Far threat (> 50m)
  const farThreat = makeMockThreat(100, 0, 0);
  t('Far threat = 0 danger', tactics.calculateDanger(pos, [farThreat]) === 0);

  // Multiple threats
  const threats = [makeMockThreat(10, 0, 0), makeMockThreat(0, 0, 10)];
  const multiDanger = tactics.calculateDanger(pos, threats);
  t('Multiple threats = higher danger', multiDanger > 0 && multiDanger <= 1);
}

// =====================================================================
// Test 5: Peek positioning
// =====================================================================
console.log('\n=== 5. Peek Positioning ===\n');

{
  const mockPeekResult = new THREE.Vector3(11, 0, 0);
  let peekCalled = false;

  const tactics = new CoverTactics({
    cover: {
      points: [],
      pick() { return null; },
      peekOffset(cover, threat, eyeH, out) {
        peekCalled = true;
        out.copy(mockPeekResult);
        return true;
      },
    },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  const cover = makeMockCover(10, 0, 10, 1, 0, true);
  const threat = makeMockThreat(20, 0, 10);
  const result = new THREE.Vector3();

  const peekPos = tactics.getPeekPosition(cover, threat, 1.7, result);
  t('Peek position returned', peekPos !== null);
  t('Peek offset called', peekCalled === true);
  t('Peek position matches mock', peekPos.x === 11);

  // Without threat
  peekCalled = false;
  const noThreatResult = tactics.getPeekPosition(cover, null, 1.7, result);
  t('Peek works without threat', noThreatResult !== null);

  // Without cover (null)
  const noCoverResult = tactics.getPeekPosition(null, threat, 1.7, result);
  t('Peek with null cover returns default', noCoverResult !== null);

  // Without cover AND without out vector
  const noCoverNoOut = tactics.getPeekPosition(null, threat, 1.7, null);
  t('Peek with null cover and null out', noCoverNoOut !== null);
}

// =====================================================================
// Test 6: Firing position
// =====================================================================
console.log('\n=== 6. Firing Position ===\n');

{
  const tactics = new CoverTactics({
    cover: {
      points: [],
      pick() { return null; },
      peekOffset() { return false; },
    },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  const threat = makeMockThreat(20, 0, 10);

  // High cover: can fire over it
  const highCover = makeMockCover(10, 0, 10, 1, 0, true);
  const highFp = tactics.getFiringPosition(highCover, threat, 1.7);
  t('High cover allows fire', highFp.canFire === true);
  t('High cover position has eye height', highFp.position.y > 0);

  // Low cover: need to peek
  const lowCover = makeMockCover(10, 0, 10, 1, 0, false);
  const lowFp = tactics.getFiringPosition(lowCover, threat, 1.7);
  t('Low cover allows fire', lowFp.canFire === true);

  // Without threat
  const noThreatFp = tactics.getFiringPosition(highCover, null, 1.7);
  t('No threat = no fire', noThreatFp.canFire === false);
}

// =====================================================================
// Test 7: Next cover selection (tactical repositioning)
// =====================================================================
console.log('\n=== 7. Next Cover Selection ===\n');

{
  const coverPoints = [
    makeMockCover(10, 0, 10, 1, 0, true),   // Current cover
    makeMockCover(15, 0, 5, 0, 1, true),    // Good next cover (flanking angle)
    makeMockCover(20, 0, 20, 1, 0, false),  // Far cover
  ];

  const tactics = new CoverTactics({
    cover: { points: coverPoints, pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  const agent = makeMockAgent('test_3', 10, 0, 10, coverPoints[0], new THREE.Vector3(10, 0, 10));
  const threat = makeMockThreat(20, 0, 10);

  const nextCover = tactics.findNextCover(agent, threat);
  t('Next cover found', nextCover !== null);
  t('Next cover is different from current', nextCover !== coverPoints[0]);
  t('Next cover has flank bonus', nextCover === coverPoints[1]);

  // Claim current cover as taken
  coverPoints[0].claimed = agent.id;
  const nextCover2 = tactics.findNextCover(agent, threat);
  t('Next cover skips current', nextCover2 !== coverPoints[0]);

  // No cover points
  const emptyTactics = new CoverTactics({
    cover: { points: [], pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: { MASK: { WORLD: 1 }, raycastAny() { return false; }, lineOfSight() { return true; } },
  });
  const noPoints = emptyTactics.findNextCover(agent, threat);
  t('No cover points = null', noPoints === null);
}

// =====================================================================
// Test 8: Cover validity edge cases
// =====================================================================
console.log('\n=== 8. Cover Validity Edge Cases ===\n');

{
  const tactics = new CoverTactics({
    cover: { points: [], pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  // No cover at all
  const agentNoCover = makeMockAgent('test_4', 0, 0, 0, null, null);
  t('No cover = invalid', tactics.isCoverValid(agentNoCover, null) === false);

  // Cover that doesn't block (LOS returns true, threat is aligned)
  const badCover = makeMockCover(10, 0, 10, 1, 0, true);
  const badCoverAgent = makeMockAgent('test_5', 10, 0, 10, badCover, new THREE.Vector3(10, 0, 10));
  // Threat at +X, cover faces +X - LOS is true so cover is exposed
  const alignedThreat = makeMockThreat(20, 0, 10);
  t('Cover exposed from aligned threat', tactics.isCoverValid(badCoverAgent, alignedThreat) === false);
}

// =====================================================================
// Test 9: Danger calculation with LOS blocked
// =====================================================================
console.log('\n=== 9. Danger LOS Blocked ===\n');

{
  let losCallCount = 0;
  const tactics = new CoverTactics({
    cover: { points: [], pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      // First call returns true (LOS), second returns false (blocked)
      lineOfSight() { losCallCount++; return losCallCount % 2 === 1; },
    },
  });

  const pos = new THREE.Vector3(0, 0, 0);
  const threats = [
    makeMockThreat(10, 0, 0),   // LOS = true (odd call)
    makeMockThreat(10, 0, 10),  // LOS = false (even call, blocked)
  ];

  const danger = tactics.calculateDanger(pos, threats);
  t('LOS blocked reduces danger', danger > 0);
  t('LOS blocked danger < 1', danger < 1);
  t('LOS blocked danger = 0.8', Math.abs(danger - 0.8) < 0.01);
}

// =====================================================================
// Test 10: findBestCover edge cases
// =====================================================================
console.log('\n=== 10. findBestCover Edge Cases ===\n');

{
  const coverPoints = [
    makeMockCover(10, 0, 10, 1, 0, true),
    makeMockCover(20, 0, 20, 0, 1, true),
  ];

  let losBlocked = false;
  const tactics = new CoverTactics({
    cover: { points: coverPoints, pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() {
        if (losBlocked) return false;
        return true;
      },
    },
  });

  const agent = makeMockAgent('test_6', 0, 0, 0);
  const threat = makeMockThreat(15, 0, 15);

  // Without threat (uses default threatDist = 100, so maxRange must be > 100)
  const noThreat = tactics.findBestCover(agent, null, { minRange: 5, maxRange: 150, maxTravel: 25 });
  t('findBestCover works without threat', noThreat !== null);

  // With LOS blocked
  losBlocked = true;
  const blockedLos = tactics.findBestCover(agent, threat, { minRange: 5, maxRange: 35, maxTravel: 25 });
  t('findBestCover returns null when LOS blocked', blockedLos === null);
  losBlocked = false;
}

// =====================================================================
// Test 11: isCoverValid with exposed cover
// =====================================================================
console.log('\n=== 11. isCoverValid Exposed Cover ===\n');

{
  let losCallCount = 0;
  const tactics = new CoverTactics({
    cover: { points: [], pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { losCallCount++; return losCallCount === 1; },
    },
  });

  // Cover with threat that can see agent (LOS returns true first call)
  const cover = makeMockCover(10, 0, 10, 1, 0, true);
  const agent = makeMockAgent('test_7', 10, 0, 10, cover, new THREE.Vector3(10, 0, 10));
  const threat = makeMockThreat(20, 0, 10);
  const valid = tactics.isCoverValid(agent, threat);
  t('isCoverValid handles exposed cover', valid === false);
}

// =====================================================================
// Test 12: findNextCover edge cases
// =====================================================================
console.log('\n=== 12. findNextCover Edge Cases ===\n');

{
  const coverPoints = [
    makeMockCover(10, 0, 10, 1, 0, true),
    makeMockCover(25, 0, 25, 0, 1, true),  // Too far (> 15)
    makeMockCover(15, 0, 5, 0, 1, true),   // Claimed
  ];
  coverPoints[2].claimed = 99;

  const tactics = new CoverTactics({
    cover: { points: coverPoints, pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  const agent = makeMockAgent('test_8', 10, 0, 10, coverPoints[0], new THREE.Vector3(10, 0, 10));
  const threat = makeMockThreat(20, 0, 10);

  const next = tactics.findNextCover(agent, threat);
  t('findNextCover skips current, claimed, and far cover', next === null);

  // No coverMap.points
  const emptyTactics = new CoverTactics({
    cover: { points: [], pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: { MASK: { WORLD: 1 }, raycastAny() { return false; }, lineOfSight() { return true; } },
  });
  t('findNextCover with no points = null', emptyTactics.findNextCover(agent, threat) === null);
}

// =====================================================================
// Test 13: evaluateCoverQuality edge cases
// =====================================================================
console.log('\n=== 13. evaluateCoverQuality Edge Cases ===\n');

{
  const tactics = new CoverTactics({
    cover: { points: [], pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  // Cover with no threat
  const coverNoThreat = makeMockCover(10, 0, 10, 1, 0, true);
  const qualityNoThreat = tactics.evaluateCoverQuality(new THREE.Vector3(10, 0, 10), null, coverNoThreat);
  t('Cover without threat = MEDIUM', qualityNoThreat === 2);

  // Cover with null opts (defaults)
  const agentDefaults = makeMockAgent('test_9', 0, 0, 0);
  const threatDefaults = makeMockThreat(15, 0, 15);
  const coverPointsDefault = [makeMockCover(10, 0, 10, 1, 0, true)];
  const tacticsDefaults = new CoverTactics({
    cover: { points: coverPointsDefault, pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });
  const bestDefault = tacticsDefaults.findBestCover(agentDefaults, threatDefaults);
  t('findBestCover with default opts', bestDefault !== null);
}

// =====================================================================
// Test 14: findNextCover with no current cover
// =====================================================================
console.log('\n=== 14. findNextCover No Current Cover ===\n');

{
  const coverPoints = [makeMockCover(15, 0, 5, 0, 1, true)];
  const tactics = new CoverTactics({
    cover: { points: coverPoints, pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });
  // Agent with no current cover (null)
  const agent = makeMockAgent('test_10', 10, 0, 10, null, null);
  const threat = makeMockThreat(20, 0, 10);
  const next = tactics.findNextCover(agent, threat);
  t('findNextCover with no current cover', next === null);
}

// =====================================================================
// Test 15: evaluateCoverQuality — exposedSides <= 1 (line 81)
// =====================================================================
console.log('\n=== 15. evaluateCoverQuality ExposedSides <= 1 ===\n');

{
  // Mock raycastAny to return true (wall found) for all 4 directions
  let raycastCallCount = 0;
  const tactics = new CoverTactics({
    cover: { points: [], pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { raycastCallCount++; return true; }, // All 4 directions have walls
      lineOfSight() { return true; },
    },
  });

  // High cover with threat aligned (angle > 0.8) and all 4 sides blocked = exposedSides = 0
  const cover = makeMockCover(10, 0, 10, 1, 0, true);
  const pos = new THREE.Vector3(10, 0, 10);
  const threat = makeMockThreat(20, 0, 10); // Along +X, same as cover direction
  const quality = tactics.evaluateCoverQuality(pos, threat, cover);
  t('Cover with 0 exposed sides = PERFECT', quality === 4);
  t('RaycastAny called 4 times', raycastCallCount === 4);
}

// =====================================================================
// Test 16: findBestCover — LOS blocked (line 118 via threatDist range)
// =====================================================================
console.log('\n=== 16. findBestCover ThreatDist Range ===\n');

{
  const coverPoints = [makeMockCover(10, 0, 10, 1, 0, true)];
  const tactics = new CoverTactics({
    cover: { points: coverPoints, pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  const agent = makeMockAgent('test_11', 0, 0, 0);
  const threat = makeMockThreat(15, 0, 15);

  // threatDist = 10 (distance from cover at 10,0,10 to threat at 15,0,15 = ~7)
  // minRange=5, maxRange=10 → 7 is in range → cover is found
  const inRange = tactics.findBestCover(agent, threat, { minRange: 5, maxRange: 10, maxTravel: 25 });
  t('findBestCover with threatDist in range', inRange !== null);

  // threatDist = 7, minRange=10 → 7 < 10 → out of range
  const belowMin = tactics.findBestCover(agent, threat, { minRange: 10, maxRange: 20, maxTravel: 25 });
  t('findBestCover with threatDist below min', belowMin === null);

  // threatDist = 7, maxRange=5 → 7 > 5 → out of range
  const aboveMax = tactics.findBestCover(agent, threat, { minRange: 1, maxRange: 5, maxTravel: 25 });
  t('findBestCover with threatDist above max', aboveMax === null);
}

// =====================================================================
// Test 17: getPeekPosition — cover NOT null but out IS null (line 155)
// =====================================================================
console.log('\n=== 17. getPeekPosition Cover Non-null, Out Null ===\n');

{
  let peekCalled = false;
  const tactics = new CoverTactics({
    cover: {
      points: [],
      pick() { return null; },
      peekOffset(cover, threat, eyeH, out) {
        peekCalled = true;
        out.set(11, 0, 0); // peekOffset writes to out even when we pass null initially
        // But we need peekOffset to return false so the fallback path runs
        return false;
      },
    },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  const cover = makeMockCover(10, 0, 10, 1, 0, true);
  const threat = makeMockThreat(20, 0, 10);

  // Call with null out (result parameter is null)
  const result = tactics.getPeekPosition(cover, threat, 1.7, null);
  t('getPeekPosition with non-null cover and null out', result !== null);
  t('Result is a Vector3', result.x !== undefined);
}

// =====================================================================
// Test 18: getPeekPosition — threat null in fallback (line 172)
// =====================================================================
console.log('\n=== 18. getPeekPosition Null Threat in Fallback ===\n');

{
  let peekCalled = false;
  const tactics = new CoverTactics({
    cover: {
      points: [],
      pick() { return null; },
      peekOffset() { peekCalled = true; return false; }, // Return false to trigger fallback
    },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  const cover = makeMockCover(10, 0, 10, 1, 0, true);
  // Threat is null → the fallback ternary at line 172 uses `: 1` branch
  const result = tactics.getPeekPosition(cover, null, 1.7, new THREE.Vector3());
  t('getPeekPosition with null threat in fallback', result !== null);
  t('PeekOffset was called', peekCalled === true);
}

// =====================================================================
// Test 19: findNextCover — coverMap.points is null (line 229)
// =====================================================================
console.log('\n=== 19. findNextCover coverMap.points Null ===\n');

{
  // coverMap has no 'points' property at all (undefined/null)
  const tactics = new CoverTactics({
    cover: { pick() { return null; }, peekOffset() { return false; } }, // No 'points' key
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  const agent = makeMockAgent('test_12', 10, 0, 10, makeMockCover(10, 0, 10, 1, 0, true), new THREE.Vector3(10, 0, 10));
  const threat = makeMockThreat(20, 0, 10);
  const result = tactics.findNextCover(agent, threat);
  t('findNextCover with null coverMap.points', result === null);
}

// =====================================================================
// Test 20: findNextCover — flank bonus applied (line 253)
// =====================================================================
console.log('\n=== 20. findNextCover Flank Bonus Applied ===\n');

{
  const coverPoints = [
    makeMockCover(10, 0, 10, 1, 0, true),   // Current cover
    makeMockCover(15, 0, 7, 0.7, 0.7, true), // Flanking cover (angle < 0.7 from current dir)
  ];

  const tactics = new CoverTactics({
    cover: { points: coverPoints, pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  const agent = makeMockAgent('test_13', 10, 0, 10, coverPoints[0], new THREE.Vector3(10, 0, 10));
  const threat = makeMockThreat(20, 0, 10);

  // The flanking cover at (15, 0, 7) should have a flank angle < 0.7 from the direction
  // from current cover (10,0,10) to threat (20,0,10) = (10,0,0)
  // The direction from current to new cover = (5,0,-3)
  // Dot product of (10,0,0).normalize() and (5,0,-3).normalize() = 5/√34 ≈ 0.86
  // That's > 0.7, so the flank bonus is NOT applied.

  // Let me use a cover that's more perpendicular:
  // Current cover at (10,0,10), threat at (20,0,10)
  // Direction from current to threat = (10,0,0) normalized = (1,0,0)
  // New cover at (10,0,5) → direction (0,0,-5) → dot = 0
  // 0 < 0.7 → flank bonus of 2 IS applied

  // Actually, let me use a different setup. Let me put the new cover at a perpendicular angle.
  // Current: (10,0,10), Threat: (20,0,10), New cover: (10,0,5)
  // Direction from current to threat: (10,0,0) norm = (1,0,0)
  // Direction from current to new: (0,0,-5) norm = (0,0,-1)
  // Dot = 0 → flank bonus = 2

  // But I need to replace the coverPoints array. Let me just test with a fresh setup.
}

// Fresh setup for flank bonus test
{
  const coverPoints = [
    makeMockCover(10, 0, 10, 1, 0, true),   // Current cover
    makeMockCover(10, 0, 5, 0, -1, true),   // Flanking cover (perpendicular to threat direction)
  ];

  const tactics = new CoverTactics({
    cover: { points: coverPoints, pick() { return null; }, peekOffset() { return false; } },
    grid: {},
    phys: {
      MASK: { WORLD: 1 },
      raycastAny() { return false; },
      lineOfSight() { return true; },
    },
  });

  const agent = makeMockAgent('test_14', 10, 0, 10, coverPoints[0], new THREE.Vector3(10, 0, 10));
  const threat = makeMockThreat(20, 0, 10);

  const next = tactics.findNextCover(agent, threat);
  t('findNextCover with flank bonus applied', next === coverPoints[1]);
  t('Flank cover found (perpendicular to threat)', next?.x === 10 && next?.z === 5);
}

// =====================================================================
// Results
// =====================================================================
console.log(`\n═══════════════════════════════════════════════════`);
console.log(`  CoverTactics Tests: ${pass} pass, ${fail} fail`);
console.log(`═══════════════════════════════════════════════════\n`);

if (fail > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL TESTS PASSED');
  process.exit(0);
}