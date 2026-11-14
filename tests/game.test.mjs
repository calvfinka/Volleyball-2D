import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TEAMS,
  getServeProfile,
  getSmashProfile,
  getBlockProfile,
  getReceiveProfile,
  getSpeedProfile,
} from '../js/data/stats.js';
import { COURT, BALL_CFG, createBall, resetBallForServe, stepBallPhysics } from '../js/game/ball.js';
import { createPlayer, stepPlayerPhysics } from '../js/game/player.js';
import {
  TARGET_POINTS,
  createMatchState,
  checkMatchWinner,
  isDoubleTouch,
  executeServe,
  executeReceiveOrAutoFeed,
  executeSmash,
  evaluateSmashTiming,
  tryBlockCollision,
  awardPoint,
  stepMatch,
} from '../js/game/rules.js';
import {
  CURRENT_SAVE_VERSION,
  migrateSave,
  loadSave,
  updateSettings,
  setOnboardingSeen,
  recordMatchResult,
} from '../js/core/save.js';

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

const EMPTY_INPUT = {
  moveX: 0,
  jumpPressed: false,
  jumpHeld: false,
  smashPressed: false,
  receivePressed: false,
  actionPressed: false,
};

test('player stats scale serve, receive, smash, block, and speed profiles meaningfully', () => {
  const highSmash = getSmashProfile({ smash: 95 });
  const lowSmash = getSmashProfile({ smash: 55 });
  assert.ok(highSmash.power > lowSmash.power);
  assert.ok(highSmash.perfectWindowBonus > lowSmash.perfectWindowBonus);

  const highServe = getServeProfile({ serve: 90 });
  const lowServe = getServeProfile({ serve: 60 });
  assert.ok(highServe.flightTime < lowServe.flightTime);
  assert.ok(highServe.targetDepth > lowServe.targetDepth);
  assert.ok(highServe.spread < lowServe.spread);

  const highBlock = getBlockProfile({ block: 92 });
  const lowBlock = getBlockProfile({ block: 55 });
  assert.ok(highBlock.reachHeight > lowBlock.reachHeight);
  assert.ok(highBlock.stuffChance > lowBlock.stuffChance);

  const highRecv = getReceiveProfile({ receive: 90 });
  const lowRecv = getReceiveProfile({ receive: 55 });
  assert.ok(highRecv.reachBonus > lowRecv.reachBonus);

  const fast = getSpeedProfile({ speed: 92 });
  const slow = getSpeedProfile({ speed: 55 });
  assert.ok(fast.maxSpeed > slow.maxSpeed);
  assert.ok(fast.jumpVy < slow.jumpVy); // more negative = higher jump
});

test('ball physics applies gravity, air drag, Magnus spin, spin decay, and net/floor collisions', () => {
  const ballA = createBall();
  const ballB = createBall();
  for (const b of [ballA, ballB]) {
    b.active = true;
    b.x = 300;
    b.y = 300;
    b.vx = 550;
    b.vy = -220;
  }
  ballA.spin = 22; // topspin dips faster
  ballB.spin = -10; // backspin lifts

  for (let i = 0; i < 20; i++) {
    stepBallPhysics(ballA, 1 / 60);
    stepBallPhysics(ballB, 1 / 60);
  }
  assert.ok(ballA.y > ballB.y, 'Topspin ball must dip lower than backspin ball');
  assert.ok(ballA.spin < 22, 'Spin must decay over flight');

  // Floor contact
  const floorBall = createBall();
  resetBallForServe(floorBall, 'home');
  floorBall.active = true;
  floorBall.x = 300;
  floorBall.y = COURT.FLOOR_Y - BALL_CFG.RADIUS - 2;
  floorBall.vy = 200;
  const res = stepBallPhysics(floorBall, 1 / 60);
  assert.equal(res.hitFloor, true);
  assert.equal(floorBall.y, COURT.FLOOR_Y - BALL_CFG.RADIUS);

  // Net collision
  floorBall.x = COURT.NET_X - BALL_CFG.RADIUS - 2;
  floorBall.y = COURT.NET_TOP_Y + 40;
  floorBall.vx = 400;
  floorBall.vy = 0;
  const netRes = stepBallPhysics(floorBall, 1 / 60);
  assert.equal(netRes.hitNet, true);
  assert.ok(floorBall.vx < 0);
});

test('player physics uses acceleration, reduced air control, landing recovery, and net touch detection', () => {
  const p = createPlayer(TEAMS.home.players[0], 'home', 0);
  stepPlayerPhysics(p, 1, false, false, 1 / 60);
  assert.ok(p.vx > 0 && p.vx < 100, 'Ground speed ramps gradually via acceleration');

  // Jump height & air control
  stepPlayerPhysics(p, 1, true, true, 1 / 60);
  assert.equal(p.onGround, false);
  const airVxBefore = p.vx;
  stepPlayerPhysics(p, -1, false, true, 1 / 60);
  const airDelta = Math.abs(p.vx - airVxBefore);

  const groundP = createPlayer(TEAMS.home.players[0], 'home', 0);
  groundP.vx = airVxBefore;
  stepPlayerPhysics(groundP, -1, false, false, 1 / 60);
  const groundDelta = Math.abs(groundP.vx - airVxBefore);
  assert.ok(airDelta < groundDelta, 'Air control acceleration must be lower than ground acceleration');

  // Landing recovery
  p.y = COURT.FLOOR_Y - 2;
  p.vy = 300;
  p.onGround = false;
  stepPlayerPhysics(p, 0, false, false, 1 / 60);
  assert.equal(p.onGround, true);
  assert.ok(p.landingRecoveryTimer > 0);
});

test('serve starts behind baseline, clears net, and follows receive -> auto-feed -> smash flow', () => {
  const match = createMatchState('casual');
  assert.equal(match.phase, 'serve_wait');
  assert.equal(match.servingTeam, 'home');
  assert.ok(match.homePlayers[0].x < COURT.LEFT_X, 'Home server must stand behind left baseline');

  executeServe(match, match.homePlayers[0]);
  assert.equal(match.phase, 'rally');
  assert.equal(match.ball.active, true);
  let crossedNet = false;
  for (let i = 0; i < 120; i++) {
    const prevX = match.ball.x;
    const { hitNet, hitFloor } = stepBallPhysics(match.ball, 1 / 60);
    assert.equal(hitNet, false, 'Legal home serve must clear the net cleanly');
    assert.equal(hitFloor, false, 'Legal home serve must not hit own floor');
    if (prevX < COURT.NET_X && match.ball.x >= COURT.NET_X) {
      crossedNet = true;
      break;
    }
  }
  assert.equal(crossedNet, true);

  // Touch 1: Home Receive
  match.ball.x = 340;
  match.ball.y = 540;
  match.ball.vx = -100;
  match.ball.vy = 180;
  match.touchCooldown = 0;
  executeReceiveOrAutoFeed(match, match.homePlayers[0], false);
  assert.equal(match.sideTouches, 1);

  // Touch 2: Teammate Auto-Feed
  match.touchCooldown = 0;
  executeReceiveOrAutoFeed(match, match.homePlayers[1], true);
  assert.equal(match.sideTouches, 2);
  assert.equal(match.ball.isAutoFeed, true);

  // Touch 3: Human Jump Smash
  const striker = match.homePlayers[0];
  striker.onGround = false;
  striker.y = 500;
  striker.vy = -40;
  match.ball.x = striker.x + 12;
  match.ball.y = striker.y - 86;
  match.touchCooldown = 0;
  assert.equal(evaluateSmashTiming(striker, match.ball), 'PERFECT');

  executeSmash(match, striker);
  assert.equal(match.sideTouches, 3);
  assert.equal(match.ball.lastHitType, 'smash');
  assert.ok(match.ball.vx > 500);
});

test('3-touch limit awards fault on 4th touch and forbids double touch', () => {
  const match = createMatchState('casual');
  match.phase = 'rally';
  match.ball.active = true;
  match.ball.x = 400;
  match.ball.y = 480;

  // Touch 1 by Kai
  executeReceiveOrAutoFeed(match, match.homePlayers[0], false);
  assert.equal(match.sideTouches, 1);

  // Double touch by Kai immediately faults to Away
  assert.equal(isDoubleTouch(match, match.homePlayers[0]), true);
  executeReceiveOrAutoFeed(match, match.homePlayers[0], false);
  assert.equal(match.score.away, 1);

  // Reset for 4th touch test (alternating Kai -> Mina -> Kai -> Mina)
  match.phase = 'rally';
  match.possessionSide = null;
  match.sideTouches = 0;
  match.lastTouchingPlayerId = null;
  match.ball.active = true;
  match.ball.x = 420;
  match.ball.y = 460;

  executeReceiveOrAutoFeed(match, match.homePlayers[0], false); // 1
  executeReceiveOrAutoFeed(match, match.homePlayers[1], true);  // 2
  executeReceiveOrAutoFeed(match, match.homePlayers[0], false); // 3
  assert.equal(match.sideTouches, 3);
  executeReceiveOrAutoFeed(match, match.homePlayers[1], false); // 4 -> Fault!
  assert.equal(match.score.away, 2);
});

test('block requires jumping near net, does not count as team touch, and allows follow-up', () => {
  const match = createMatchState('casual');
  match.phase = 'rally';
  match.ball.active = true;
  match.ball.lastHitByTeam = 'away';
  match.ball.lastHitType = 'smash';

  const blocker = match.homePlayers[0];
  // Far from net -> cannot block
  blocker.onGround = false;
  blocker.x = 400;
  blocker.y = 520;
  match.ball.x = blocker.x + 15;
  match.ball.y = blocker.y - 80;
  assert.equal(tryBlockCollision(match, blocker), false);

  // Jumping near net -> valid block
  blocker.x = COURT.NET_X - 34;
  blocker.y = 510;
  match.ball.x = blocker.x + 18;
  match.ball.y = blocker.y - 85;
  match.touchCooldown = 0;
  assert.equal(tryBlockCollision(match, blocker), true);
  assert.equal(match.sideTouches, 0, 'Block must NOT count as one of 3 team touches');
  assert.equal(match.lastTouchWasBlock, true);
  assert.equal(isDoubleTouch(match, blocker), false, 'Blocker may legally play follow-up ball');
});

test('serve landing inside opponent court scores ace; serve out or into net is service error', () => {
  // Ace
  const aceMatch = createMatchState('casual');
  aceMatch.phase = 'rally';
  aceMatch.ball.active = true;
  aceMatch.ball.lastHitType = 'serve';
  aceMatch.ball.lastHitByTeam = 'home';
  aceMatch.ball.lastHitById = aceMatch.homePlayers[0].id;
  aceMatch.ball.x = 950;
  aceMatch.ball.y = COURT.FLOOR_Y - BALL_CFG.RADIUS - 1;
  aceMatch.ball.vx = 100;
  aceMatch.ball.vy = 500;
  stepMatch(aceMatch, EMPTY_INPUT, 1 / 60);
  assert.equal(aceMatch.score.home, 1);
  assert.equal(aceMatch.playerStats.kai.aces, 1);

  // Serve out (beyond RIGHT_X)
  const outMatch = createMatchState('casual');
  outMatch.phase = 'rally';
  outMatch.ball.active = true;
  outMatch.ball.lastHitType = 'serve';
  outMatch.ball.lastHitByTeam = 'home';
  outMatch.ball.lastHitById = outMatch.homePlayers[0].id;
  outMatch.ball.x = COURT.RIGHT_X + 25;
  outMatch.ball.y = COURT.FLOOR_Y - BALL_CFG.RADIUS - 1;
  outMatch.ball.vy = 500;
  stepMatch(outMatch, EMPTY_INPUT, 1 / 60);
  assert.equal(outMatch.score.away, 1);
  assert.equal(outMatch.playerStats.kai.serviceErrors, 1);

  // Serve into net
  const netMatch = createMatchState('casual');
  netMatch.phase = 'rally';
  netMatch.ball.active = true;
  netMatch.ball.lastHitType = 'serve';
  netMatch.ball.lastHitByTeam = 'home';
  netMatch.ball.lastHitById = netMatch.homePlayers[0].id;
  netMatch.ball.x = COURT.NET_X - BALL_CFG.RADIUS - 1;
  netMatch.ball.y = COURT.NET_TOP_Y + 45;
  netMatch.ball.vx = 420;
  netMatch.ball.vy = 0;
  stepMatch(netMatch, EMPTY_INPUT, 1 / 60);
  assert.equal(netMatch.score.away, 1);
  assert.equal(netMatch.playerStats.kai.serviceErrors, 1);
});

test('rotation happens clockwise ONLY when receiving team wins the rally', () => {
  const match = createMatchState('casual');
  assert.equal(match.servingTeam, 'home');
  assert.equal(match.rotation.home, 1);
  assert.equal(match.homeServerIndex, 0);

  // Home wins while serving -> Home keeps serve and does NOT rotate
  match.phase = 'rally';
  awardPoint(match, 'home');
  assert.equal(match.servingTeam, 'home');
  assert.equal(match.rotation.home, 1);
  assert.equal(match.homeServerIndex, 0);

  // Away wins while receiving -> Away gains serve and rotates clockwise
  match.phase = 'rally';
  awardPoint(match, 'away');
  assert.equal(match.servingTeam, 'away');
  assert.equal(match.rotation.away, 2);
  assert.equal(match.awayServerIndex, 1);

  // Home wins while receiving -> Home gains serve and rotates to player 1
  match.phase = 'rally';
  awardPoint(match, 'home');
  assert.equal(match.servingTeam, 'home');
  assert.equal(match.rotation.home, 2);
  assert.equal(match.homeServerIndex, 1);
});

test('rally point rule to 15 requires win by 2 and supports custom targetPoints', () => {
  assert.equal(checkMatchWinner(14, 10, TARGET_POINTS), null);
  assert.equal(checkMatchWinner(15, 13, TARGET_POINTS), 'home');
  assert.equal(checkMatchWinner(15, 14, TARGET_POINTS), null);
  assert.equal(checkMatchWinner(16, 14, TARGET_POINTS), 'home');
  assert.equal(checkMatchWinner(13, 15, TARGET_POINTS), 'away');
  assert.equal(checkMatchWinner(11, 9, 11), 'home');
  assert.equal(checkMatchWinner(21, 19, 21), 'home');

  const match = createMatchState('casual', { targetPoints: 15 });
  match.score.home = 14;
  match.score.away = 10;
  match.phase = 'rally';
  awardPoint(match, 'home');
  assert.equal(match.score.home, 15);
  assert.equal(match.winner, 'home');
  assert.equal(match.phase, 'match_over');
});

test('40 AI-vs-AI matches simulate to completion cleanly with valid winners and finite coordinates', () => {
  for (let i = 0; i < 40; i++) {
    const difficulty = i % 2 === 0 ? 'casual' : 'pro';
    const match = createMatchState(difficulty, { aiControlledHome: true, targetPoints: 15 });
    const dt = 1 / 60;
    const maxSteps = 60 * 180; // up to 3 simulated minutes per match
    let steps = 0;

    while (match.phase !== 'match_over' && steps < maxSteps) {
      stepMatch(match, EMPTY_INPUT, dt);
      steps++;
    }

    assert.equal(match.phase, 'match_over', `Match ${i + 1} (${difficulty}) should finish cleanly`);
    assert.ok(match.winner === 'home' || match.winner === 'away');
    const maxScore = Math.max(match.score.home, match.score.away);
    const minScore = Math.min(match.score.home, match.score.away);
    assert.ok(maxScore >= 15 && maxScore - minScore >= 2);
    assert.ok(Number.isFinite(match.ball.x) && Number.isFinite(match.ball.y));
  }
});

test('save system migrates v0->v2, persists onboardingSeen, and records match stats', () => {
  const v0 = {
    soundEnabled: false,
    touchMode: 'on',
    difficulty: 'pro',
    wins: 3,
    losses: 1,
    matchesPlayed: 4,
  };
  const migrated = migrateSave(v0);
  assert.equal(migrated.version, CURRENT_SAVE_VERSION);
  assert.equal(migrated.onboardingSeen, false);
  assert.equal(migrated.settings.soundEnabled, false);
  assert.equal(migrated.settings.volume, 0.8);
  assert.equal(migrated.settings.targetPoints, 15);
  assert.equal(migrated.record.wins, 3);

  const mem = createMemoryStorage();
  updateSettings({ difficulty: 'pro', volume: 0.6, targetPoints: 21 }, mem);
  setOnboardingSeen(true, mem);
  const afterResult = recordMatchResult(21, 16, { bestRally: 9, durationSeconds: 142 }, mem);
  assert.equal(afterResult.onboardingSeen, true);
  assert.equal(afterResult.record.matchesPlayed, 1);
  assert.equal(afterResult.record.wins, 1);
  assert.equal(afterResult.record.bestMargin, 5);
  assert.equal(afterResult.record.bestRally, 9);
  assert.equal(afterResult.record.longestMatchSeconds, 142);

  const loaded = loadSave(mem);
  assert.equal(loaded.settings.difficulty, 'pro');
  assert.equal(loaded.settings.volume, 0.6);
  assert.equal(loaded.settings.targetPoints, 21);
});

test('blocking a serve is disallowed by volleyball rules', () => {
  const match = createMatchState('pro');
  match.phase = 'rally';
  match.ball.active = true;
  match.ball.lastHitByTeam = 'away';
  match.ball.lastHitType = 'serve';

  const blocker = match.homePlayers[0];
  blocker.onGround = false;
  blocker.x = COURT.NET_X - 42;
  blocker.y = 505;
  match.ball.x = blocker.x + 16;
  match.ball.y = blocker.y - 80;
  match.ball.vx = -600;
  match.touchCooldown = 0;

  assert.equal(tryBlockCollision(match, blocker), false, 'Serve must never be blocked');
});

test('block deflection touching net does not trigger NET FAULT while inbound attack net contact still faults', () => {
  // Block deflection hitting net -> rally continues, no immediate NET FAULT
  const blockMatch = createMatchState('pro');
  blockMatch.phase = 'rally';
  blockMatch.ball.active = true;
  blockMatch.ball.lastHitType = 'block';
  blockMatch.ball.lastHitByTeam = 'home';
  blockMatch.ball.lastHitById = blockMatch.homePlayers[0].id;
  blockMatch.ball.x = COURT.NET_X - BALL_CFG.RADIUS - 1;
  blockMatch.ball.y = COURT.NET_TOP_Y + 35;
  blockMatch.ball.vx = 300;
  blockMatch.ball.vy = 0;
  stepMatch(blockMatch, EMPTY_INPUT, 1 / 60);
  assert.equal(blockMatch.score.away, 0, 'Block deflection grazing net must not award immediate fault');
  assert.equal(blockMatch.phase, 'rally');

  // Direct smash hitting net -> immediate NET FAULT for opposing team
  const smashMatch = createMatchState('pro');
  smashMatch.phase = 'rally';
  smashMatch.ball.active = true;
  smashMatch.ball.lastHitType = 'smash';
  smashMatch.ball.lastHitByTeam = 'home';
  smashMatch.ball.lastHitById = smashMatch.homePlayers[0].id;
  smashMatch.ball.x = COURT.NET_X - BALL_CFG.RADIUS - 1;
  smashMatch.ball.y = COURT.NET_TOP_Y + 35;
  smashMatch.ball.vx = 520;
  smashMatch.ball.vy = 0;
  stepMatch(smashMatch, EMPTY_INPUT, 1 / 60);
  assert.equal(smashMatch.score.away, 1, 'Inbound smash hitting net must award NET FAULT point');
  assert.equal(smashMatch.lastPointReason, 'NET FAULT');
});

test('light top-cord net graze keeps ball live without triggering hitNet fault', () => {
  const ball = createBall();
  ball.active = true;
  ball.x = COURT.NET_X - 3;
  ball.y = COURT.NET_TOP_Y - 18;
  ball.vx = 480;
  ball.vy = 20;
  const res = stepBallPhysics(ball, 1 / 60);
  assert.equal(res.hitNet, false, 'Light top-tape graze with forward speed must remain playable');
  assert.ok(ball.vx > 0, 'Ball must continue forward over the net tape');
});

test('Pro AI servers commit realistic non-zero service errors while staying more accurate than Casual', () => {
  const sampleServes = (difficulty, count) => {
    let errors = 0;
    for (let i = 0; i < count; i++) {
      const m = createMatchState(difficulty, { aiControlledHome: true });
      const server = m.homePlayers[0];
      executeServe(m, server);
      // Step ball up to 2.5s until floor/net without defenders
      for (let f = 0; f < 150; f++) {
        const { hitFloor, hitNet } = stepBallPhysics(m.ball, 1 / 60);
        if (hitNet) {
          errors++;
          break;
        }
        if (hitFloor) {
          if (m.ball.x < COURT.NET_X || m.ball.x > COURT.RIGHT_X) {
            errors++;
          }
          break;
        }
      }
    }
    return errors / count;
  };

  const proErrRate = sampleServes('pro', 2000);
  const casualErrRate = sampleServes('casual', 2000);
  assert.ok(proErrRate > 0.015 && proErrRate < 0.12, `Pro service error rate (${proErrRate.toFixed(3)}) must be realistic & non-zero`);
  assert.ok(casualErrRate > proErrRate, `Casual error rate (${casualErrRate.toFixed(3)}) should exceed Pro (${proErrRate.toFixed(3)})`);
});
