import test from 'node:test';
import assert from 'node:assert/strict';

import { TEAMS, getServeProfile, getSmashProfile, getBlockProfile, getReceiveProfile } from '../js/data/stats.js';
import { COURT, BALL_CFG, createBall, resetBallForServe, stepBallPhysics } from '../js/game/ball.js';
import {
  TARGET_POINTS,
  createMatchState,
  checkMatchWinner,
  executeServe,
  executeReceiveOrAutoFeed,
  executeSmash,
  evaluateSmashTiming,
  awardPoint,
  stepMatch,
} from '../js/game/rules.js';
import { CURRENT_SAVE_VERSION, migrateSave, loadSave, updateSettings, recordMatchResult } from '../js/core/save.js';

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('player stats scale serve, receive, smash, and block profiles meaningfully', () => {
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
});

test('ball physics applies gravity, hits floor, and bounces off net', () => {
  const ball = createBall();
  resetBallForServe(ball, 'home');
  ball.active = true;
  ball.x = 300;
  ball.y = COURT.FLOOR_Y - BALL_CFG.RADIUS - 2;
  ball.vy = 200;

  const res = stepBallPhysics(ball, 1 / 60);
  assert.equal(res.hitFloor, true);
  assert.equal(ball.y, COURT.FLOOR_Y - BALL_CFG.RADIUS);

  // Net collision
  ball.x = COURT.NET_X - BALL_CFG.RADIUS - 2;
  ball.y = COURT.NET_TOP_Y + 40;
  ball.vx = 400;
  ball.vy = 0;
  const netRes = stepBallPhysics(ball, 1 / 60);
  assert.equal(netRes.hitNet, true);
  assert.ok(ball.vx < 0);
});

test('volleyball rally flow: serve -> receive -> auto-feed -> smash timing -> rally point to 15', () => {
  const match = createMatchState('casual');
  assert.equal(match.phase, 'serve_wait');
  assert.equal(match.servingTeam, 'home');

  // Serve and simulate flight to net to verify net clearance
  executeServe(match, match.homePlayers[0]);
  assert.equal(match.phase, 'rally');
  assert.equal(match.ball.active, true);
  assert.ok(match.ball.vx > 0);
  let crossedNet = false;
  for (let i = 0; i < 120; i++) {
    const prevX = match.ball.x;
    const { hitNet, hitFloor } = stepBallPhysics(match.ball, 1 / 60);
    assert.equal(hitNet, false, 'Home serve must clear the net cleanly');
    assert.equal(hitFloor, false, 'Home serve must not hit own floor before crossing net');
    if (prevX < COURT.NET_X && match.ball.x >= COURT.NET_X) {
      assert.ok(match.ball.y + BALL_CFG.RADIUS < COURT.NET_TOP_Y + 5, 'Ball must clear net top');
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
  assert.equal(match.ball.isAutoFeed, false);

  // Touch 2: Teammate Auto-Feed
  match.touchCooldown = 0;
  executeReceiveOrAutoFeed(match, match.homePlayers[1], true);
  assert.equal(match.sideTouches, 2);
  assert.equal(match.ball.isAutoFeed, true);
  assert.equal(match.timingFeedback.text, 'AUTO-FEED!');

  // Touch 3: Human Jump Smash with PERFECT timing
  const striker = match.homePlayers[0];
  striker.onGround = false;
  striker.y = 500;
  striker.vy = -40; // near jump apex
  match.ball.x = striker.x + 12;
  match.ball.y = striker.y - 86; // aligned with hand sweet spot
  match.touchCooldown = 0;
  assert.equal(evaluateSmashTiming(striker, match.ball), 'PERFECT');

  executeSmash(match, striker);
  assert.equal(match.sideTouches, 3);
  assert.equal(match.ball.lastHitType, 'smash');
  assert.ok(match.ball.vx > 500);
});

test('rally point rule up to 15 requires win by 2', () => {
  assert.equal(checkMatchWinner(14, 10, TARGET_POINTS), null);
  assert.equal(checkMatchWinner(15, 13, TARGET_POINTS), 'home');
  assert.equal(checkMatchWinner(15, 14, TARGET_POINTS), null);
  assert.equal(checkMatchWinner(16, 14, TARGET_POINTS), 'home');
  assert.equal(checkMatchWinner(13, 15, TARGET_POINTS), 'away');

  const match = createMatchState('casual');
  match.score.home = 14;
  match.score.away = 10;
  match.phase = 'rally';
  awardPoint(match, 'home');
  assert.equal(match.score.home, 15);
  assert.equal(match.winner, 'home');
  assert.equal(match.phase, 'match_over');
});

test('match survives initial frames without user input', () => {
  const match = createMatchState('casual');
  const emptyInput = {
    moveX: 0,
    jumpPressed: false,
    jumpHeld: false,
    smashPressed: false,
    receivePressed: false,
    actionPressed: false,
  };
  for (let i = 0; i < 120; i++) {
    stepMatch(match, emptyInput, 1 / 60);
  }
  assert.equal(match.phase, 'serve_wait');
  assert.ok(Number.isFinite(match.ball.x));
});

test('save system migrates v0 flat schema to v1 and records results', () => {
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
  assert.equal(migrated.settings.soundEnabled, false);
  assert.equal(migrated.settings.touchMode, 'on');
  assert.equal(migrated.settings.difficulty, 'pro');
  assert.equal(migrated.record.wins, 3);

  const mem = createMemoryStorage();
  updateSettings({ difficulty: 'pro' }, mem);
  const afterResult = recordMatchResult(15, 9, mem);
  assert.equal(afterResult.record.matchesPlayed, 1);
  assert.equal(afterResult.record.wins, 1);
  assert.equal(afterResult.record.bestMargin, 6);
  const loaded = loadSave(mem);
  assert.equal(loaded.settings.difficulty, 'pro');
  assert.equal(loaded.record.pointsScored, 15);
  assert.ok(TEAMS.home.players.length === 2 && TEAMS.away.players.length === 2);
});
