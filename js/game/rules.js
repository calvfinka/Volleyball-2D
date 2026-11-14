// Volleyball match state machine, rules, serve/receive/auto-feed/smash-timing/block, and scoring (no DOM dependencies)

import { TEAMS, getServeProfile, getReceiveProfile, getSmashProfile, getBlockProfile } from '../data/stats.js';
import { COURT, BALL_CFG, createBall, resetBallForServe, stepBallPhysics } from './ball.js';
import { createPlayer, resetPlayerPosition, stepPlayerPhysics } from './player.js';
import { computeTeammateControl, computeOpponentControl } from './ai.js';

export const TARGET_POINTS = 15;

export function createMatchState(difficulty = 'casual') {
  const homePlayers = TEAMS.home.players.map((tpl, i) => createPlayer(tpl, 'home', i));
  const awayPlayers = TEAMS.away.players.map((tpl, i) => createPlayer(tpl, 'away', i));

  const state = {
    difficulty,
    phase: 'serve_wait', // 'serve_wait' | 'rally' | 'point_pause' | 'match_over'
    score: { home: 0, away: 0 },
    targetPoints: TARGET_POINTS,
    servingTeam: 'home',
    homeServerIndex: 0,
    awayServerIndex: 0,
    winner: null,

    // Rally touch tracking (max 3 touches per side)
    possessionSide: null, // 'home' | 'away' | null
    sideTouches: 0,
    lastTouchingPlayerId: null,
    touchCooldown: 0,

    // Serve / point timers
    aiServeTimer: 0.9,
    pointPauseTimer: 0,
    hitstopTimer: 0,
    cameraShake: 0,
    elapsedSeconds: 0,

    // Match telemetry for result screen
    stats: {
      rallies: 0,
      smashes: 0,
      perfectSmashes: 0,
      blocks: 0,
    },

    // Active floating feedback & particles (ring buffer for zero-GC)
    callout: { text: 'PRESS SPACE OR RECV TO SERVE', color: '#FFFDF8', timer: 2.5 },
    timingFeedback: { text: '', color: '#F29F05', x: 0, y: 0, timer: 0 },
    particles: createParticlePool(48),

    ball: createBall(),
    homePlayers,
    awayPlayers,
    events: [], // sound/UI events drained by screen controller each frame
  };

  setupServePositions(state);
  return state;
}

function createParticlePool(capacity) {
  const pool = [];
  for (let i = 0; i < capacity; i++) {
    pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0.4, size: 4, color: '#FFFDF8' });
  }
  return pool;
}

function spawnParticles(pool, x, y, count, color, speed = 190) {
  let spawned = 0;
  for (let i = 0; i < pool.length && spawned < count; i++) {
    const p = pool[i];
    if (!p.active) {
      const ang = (Math.PI * 2 * spawned) / count + (Math.random() - 0.5) * 0.4;
      const spd = speed * (0.45 + Math.random() * 0.75);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd - 45;
      p.life = 0.28 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.size = 3 + Math.random() * 4;
      p.color = color;
      spawned++;
    }
  }
}

export function setupServePositions(match) {
  match.phase = 'serve_wait';
  match.possessionSide = null;
  match.sideTouches = 0;
  match.lastTouchingPlayerId = null;
  match.touchCooldown = 0;
  match.aiServeTimer = 0.85;

  const isHomeServe = match.servingTeam === 'home';
  match.homePlayers.forEach((p, idx) => resetPlayerPosition(p, isHomeServe && idx === match.homeServerIndex, match.servingTeam));
  match.awayPlayers.forEach((p, idx) => resetPlayerPosition(p, !isHomeServe && idx === match.awayServerIndex, match.servingTeam));
  resetBallForServe(match.ball, match.servingTeam);

  if (isHomeServe) {
    match.callout = { text: 'YOUR SERVE — SPACE OR RECV', color: '#FFFDF8', timer: 99 };
  } else {
    match.callout = { text: 'APEX SERVING...', color: '#7EE3E1', timer: 1.5 };
  }
}

export function checkMatchWinner(homeScore, awayScore, target = TARGET_POINTS) {
  if (homeScore >= target && homeScore - awayScore >= 2) return 'home';
  if (awayScore >= target && awayScore - homeScore >= 2) return 'away';
  return null;
}

export function executeServe(match, serverPlayer) {
  const profile = getServeProfile(serverPlayer.stats);
  const isHome = serverPlayer.teamId === 'home';
  const dir = isHome ? 1 : -1;
  const jitter = (Math.random() - 0.5) * profile.spread;

  match.ball.active = true;
  match.ball.x = serverPlayer.x + dir * 24;
  match.ball.y = serverPlayer.y - 88;

  const oppCourtStart = isHome ? COURT.NET_X + 110 : COURT.NET_X - 110;
  const oppCourtSpan = 390;
  const targetX = oppCourtStart + dir * (oppCourtSpan * profile.targetDepth) + jitter;
  const targetY = COURT.FLOOR_Y - BALL_CFG.RADIUS;
  const flightTime = profile.flightTime;
  const g = BALL_CFG.GRAVITY + profile.topspin;

  match.ball.vx = (targetX - match.ball.x) / flightTime;
  match.ball.vy = (targetY - match.ball.y - 0.5 * g * flightTime * flightTime) / flightTime;
  match.ball.topspinAccel = profile.topspin;
  match.ball.spin = dir * 11;
  match.ball.lastHitByTeam = serverPlayer.teamId;
  match.ball.lastHitById = serverPlayer.id;
  match.ball.lastHitType = 'serve';
  match.ball.isAutoFeed = false;

  serverPlayer.pose = 'serve';
  serverPlayer.poseTimer = 0.28;
  serverPlayer.scaleX = 0.9;
  serverPlayer.scaleY = 1.12;

  match.phase = 'rally';
  match.possessionSide = null;
  match.sideTouches = 0;
  match.lastTouchingPlayerId = serverPlayer.id;
  match.touchCooldown = 0.16;
  match.callout = { text: '', color: '#FFFDF8', timer: 0 };

  spawnParticles(match.particles, match.ball.x, match.ball.y, 10, '#FFFDF8', 170);
  match.events.push({ type: 'serve' });
}

export function evaluateSmashTiming(player, ball) {
  const smashProfile = getSmashProfile(player.stats);
  const handY = player.y - 86;
  const dy = ball.y - handY;
  const nearApex = Math.abs(player.vy) < 260;

  if (Math.abs(dy) <= 28 + smashProfile.perfectWindowBonus && nearApex) {
    return 'PERFECT';
  }
  if (Math.abs(dy) <= 58) {
    return 'GOOD';
  }
  return dy < 0 ? 'EARLY' : 'LATE';
}

export function executeReceiveOrAutoFeed(match, player, isSetterAutoFeed = false) {
  const receiveProfile = getReceiveProfile(player.stats);
  const isHome = player.teamId === 'home';
  const ball = match.ball;

  // Determine touch count on this side
  if (match.possessionSide !== player.teamId) {
    match.possessionSide = player.teamId;
    match.sideTouches = 1;
  } else {
    match.sideTouches += 1;
  }

  if (match.sideTouches > 3) {
    awardPoint(match, isHome ? 'away' : 'home', '4 HITS FAULT!');
    return;
  }

  // Touch 1 (Receive) or Touch 2 (Auto-Feed)
  const isAutoFeedSet = isSetterAutoFeed || match.sideTouches === 2;
  let targetX;
  let flightTime;

  if (isHome) {
    if (match.sideTouches === 1) {
      // First contact: pop cleanly to teammate's set lane or directly into attack lane if teammate initiated
      const teammate = match.homePlayers.find((p) => p.id !== player.id);
      targetX = player.controlledBy === 'human' && teammate ? Math.max(340, Math.min(500, teammate.x)) : 495;
      flightTime = 0.72;
    } else if (match.sideTouches === 2) {
      // Touch 2 Auto-Feed: Loft a high, juicy smashable set toward the front attack zone!
      targetX = 505 + (Math.random() - 0.5) * (1 - receiveProfile.setPrecision) * 70;
      flightTime = 1.05;
    } else {
      // Touch 3 safe free-ball over the net
      targetX = 860 + Math.random() * 140;
      flightTime = 1.15;
    }
  } else {
    if (match.sideTouches === 1) {
      targetX = 760 + (Math.random() - 0.5) * 60;
      flightTime = 0.74;
    } else if (match.sideTouches === 2) {
      targetX = 740;
      flightTime = 0.96;
    } else {
      targetX = 330 + Math.random() * 160;
      flightTime = 1.15;
    }
  }

  const targetY = match.sideTouches === 2 ? 320 : 390;
  const g = BALL_CFG.GRAVITY;
  ball.vx = (targetX - ball.x) / flightTime;
  ball.vy = (targetY - ball.y - 0.5 * g * flightTime * flightTime) / flightTime;
  ball.topspinAccel = 0;
  ball.spin = isHome ? 4 : -4;
  ball.lastHitByTeam = player.teamId;
  ball.lastHitById = player.id;
  ball.lastHitType = isAutoFeedSet ? 'set' : 'receive';
  ball.isAutoFeed = isHome && match.sideTouches === 2;

  player.pose = isAutoFeedSet ? 'set' : 'receive';
  player.poseTimer = 0.24;
  player.scaleX = 1.14;
  player.scaleY = 0.88;

  match.lastTouchingPlayerId = player.id;
  match.touchCooldown = 0.16;

  if (ball.isAutoFeed) {
    match.timingFeedback = {
      text: 'AUTO-FEED!',
      color: '#F29F05',
      x: ball.x,
      y: ball.y - 30,
      timer: 0.75,
    };
    match.events.push({ type: 'set' });
  } else {
    match.events.push({ type: 'receive' });
  }

  spawnParticles(match.particles, ball.x, ball.y, 7, '#FFFDF8', 130);
}

export function executeSmash(match, player) {
  const ball = match.ball;
  const smashProfile = getSmashProfile(player.stats);
  const isHome = player.teamId === 'home';

  if (match.possessionSide !== player.teamId) {
    match.possessionSide = player.teamId;
    match.sideTouches = 1;
  } else {
    match.sideTouches += 1;
  }

  if (match.sideTouches > 3) {
    awardPoint(match, isHome ? 'away' : 'home', '4 HITS FAULT!');
    return;
  }

  const timing = evaluateSmashTiming(player, ball);
  const dir = isHome ? 1 : -1;

  let powerMult = 1.0;
  let vyDown = 260;
  let feedbackColor = '#FFFDF8';

  if (timing === 'PERFECT') {
    powerMult = 1.14;
    vyDown = 360 * smashProfile.steepness * 2.1;
    feedbackColor = '#F29F05';
    match.hitstopTimer = 0.05;
    match.cameraShake = 0.55;
    if (isHome) match.stats.perfectSmashes += 1;
  } else if (timing === 'GOOD') {
    powerMult = 0.96;
    vyDown = 240;
    feedbackColor = '#38BDF8';
    match.hitstopTimer = 0.025;
    match.cameraShake = 0.28;
  } else {
    powerMult = 0.74;
    vyDown = -140; // Early/Late goes in a flatter/higher arc
    feedbackColor = '#E2E8F0';
  }

  // Ensure ball clears the net cleanly from player's current X/Y
  const distToNet = Math.abs(COURT.NET_X - ball.x);
  const speed = smashProfile.power * powerMult;
  const vx = dir * speed * (timing === 'PERFECT' ? 0.94 : 0.88);
  const timeToNet = Math.max(0.08, distToNet / Math.abs(vx));
  const projectedYAtNet = ball.y + vyDown * timeToNet + 0.5 * BALL_CFG.GRAVITY * timeToNet * timeToNet;

  // Lift vy slightly if trajectory would clip below net tape
  if (projectedYAtNet > COURT.NET_TOP_Y - 22) {
    const neededY = COURT.NET_TOP_Y - 26;
    vyDown = (neededY - ball.y - 0.5 * BALL_CFG.GRAVITY * timeToNet * timeToNet) / timeToNet;
  }

  ball.vx = vx;
  ball.vy = vyDown;
  ball.topspinAccel = timing === 'PERFECT' ? 240 : 120;
  ball.spin = dir * 24;
  ball.lastHitByTeam = player.teamId;
  ball.lastHitById = player.id;
  ball.lastHitType = 'smash';
  ball.isAutoFeed = false;

  player.pose = 'smash';
  player.poseTimer = 0.3;
  player.hitFlash = timing === 'PERFECT' ? 0.09 : 0;
  player.scaleX = 0.88;
  player.scaleY = 1.15;

  match.lastTouchingPlayerId = player.id;
  match.touchCooldown = 0.16;
  if (isHome) match.stats.smashes += 1;

  match.timingFeedback = {
    text: timing === 'PERFECT' ? 'PERFECT SMASH!' : timing,
    color: feedbackColor,
    x: ball.x,
    y: ball.y - 34,
    timer: 0.8,
  };

  spawnParticles(match.particles, ball.x, ball.y, timing === 'PERFECT' ? 18 : 11, feedbackColor, 280);
  match.events.push({ type: 'smash', isPerfect: timing === 'PERFECT' });
}

export function tryBlockCollision(match, blocker) {
  const ball = match.ball;
  if (!ball.active || match.touchCooldown > 0) return false;
  if (ball.lastHitByTeam === blocker.teamId) return false;
  if (blocker.onGround) return false;

  const isNearNet = Math.abs(blocker.x - COURT.NET_X) <= 95;
  if (!isNearNet) return false;

  const blockProfile = getBlockProfile(blocker.stats);
  const blockX = blocker.x + blocker.facing * 18;
  const blockY = blocker.y - 78 - blockProfile.reachHeight * 0.5;
  const dist = Math.hypot(ball.x - blockX, ball.y - blockY);

  if (dist > BALL_CFG.RADIUS + 34 + blockProfile.reachHeight * 0.35) {
    return false;
  }

  const isHomeBlocker = blocker.teamId === 'home';
  const dir = isHomeBlocker ? 1 : -1;
  const isStuff = Math.random() < blockProfile.stuffChance || ball.lastHitType !== 'smash';

  if (isStuff) {
    ball.vx = dir * blockProfile.deflectSpeed;
    ball.vy = 230;
    ball.topspinAccel = 80;
    match.hitstopTimer = 0.045;
    match.cameraShake = 0.45;
    match.timingFeedback = { text: 'STUFF BLOCK!', color: '#F29F05', x: ball.x, y: ball.y - 30, timer: 0.85 };
  } else {
    // Soft block slows smash onto blocker's own side so defender can receive
    ball.vx = -dir * 180;
    ball.vy = -380;
    ball.topspinAccel = 0;
    match.timingFeedback = { text: 'SOFT TOUCH', color: '#7EE3E1', x: ball.x, y: ball.y - 30, timer: 0.7 };
  }

  ball.spin = dir * 14;
  ball.lastHitByTeam = blocker.teamId;
  ball.lastHitById = blocker.id;
  ball.lastHitType = 'block';
  ball.isAutoFeed = false;

  // A block touch does NOT count against the team's 3 hits in volleyball rules!
  match.possessionSide = isStuff ? null : blocker.teamId;
  match.sideTouches = 0;
  match.lastTouchingPlayerId = blocker.id;
  match.touchCooldown = 0.2;
  if (isHomeBlocker) match.stats.blocks += 1;

  blocker.pose = 'block';
  blocker.poseTimer = 0.28;
  blocker.hitFlash = 0.08;

  spawnParticles(match.particles, ball.x, ball.y, 14, '#FFFDF8', 240);
  match.events.push({ type: 'block' });
  return true;
}

export function awardPoint(match, scoringTeam, reasonText = '') {
  if (match.phase === 'point_pause' || match.phase === 'match_over') return;

  match.score[scoringTeam] += 1;
  match.stats.rallies += 1;
  match.servingTeam = scoringTeam;
  match.ball.active = false;

  // Rotate server index for the scoring team
  if (scoringTeam === 'home') {
    match.homeServerIndex = (match.homeServerIndex + 1) % match.homePlayers.length;
  } else {
    match.awayServerIndex = (match.awayServerIndex + 1) % match.awayPlayers.length;
  }

  const winner = checkMatchWinner(match.score.home, match.score.away, match.targetPoints);
  if (winner) {
    match.winner = winner;
    match.phase = 'match_over';
    match.callout = {
      text: winner === 'home' ? 'SOLARIS WINS THE MATCH!' : 'APEX WINS THE MATCH!',
      color: winner === 'home' ? '#F29F05' : '#7EE3E1',
      timer: 5,
    };
    match.events.push({ type: 'match_over', winner });
    return;
  }

  match.phase = 'point_pause';
  match.pointPauseTimer = 1.15;

  const isMatchPoint =
    (match.score.home >= match.targetPoints - 1 && match.score.home > match.score.away) ||
    (match.score.away >= match.targetPoints - 1 && match.score.away > match.score.home);

  const teamLabel = scoringTeam === 'home' ? TEAMS.home.shortName : TEAMS.away.shortName;
  const suffix = reasonText ? ` · ${reasonText}` : '';
  const prefix = isMatchPoint ? 'MATCH POINT · ' : '';
  match.callout = {
    text: `${prefix}POINT ${teamLabel}${suffix}`,
    color: scoringTeam === 'home' ? '#FFB59E' : '#7EE3E1',
    timer: 1.15,
  };

  match.events.push({ type: 'point', scoringTeam });
}

export function stepMatch(match, humanInput, dt) {
  // Real-time visual timers (particles, shake, feedback) tick even during brief hitstop
  if (match.cameraShake > 0) {
    match.cameraShake = Math.max(0, match.cameraShake - dt * 2.8);
  }
  if (match.timingFeedback.timer > 0) {
    match.timingFeedback.timer = Math.max(0, match.timingFeedback.timer - dt);
    match.timingFeedback.y -= 28 * dt;
  }
  for (let i = 0; i < match.particles.length; i++) {
    const p = match.particles[i];
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    p.vy += 420 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  if (match.phase === 'match_over') {
    return;
  }

  if (match.hitstopTimer > 0) {
    match.hitstopTimer = Math.max(0, match.hitstopTimer - dt);
    return;
  }

  match.elapsedSeconds += dt;

  if (match.touchCooldown > 0) {
    match.touchCooldown = Math.max(0, match.touchCooldown - dt);
  }

  const humanPlayer = match.homePlayers[0];
  const teammate = match.homePlayers[1];
  const away0 = match.awayPlayers[0];
  const away1 = match.awayPlayers[1];

  // Phase: Point Pause
  if (match.phase === 'point_pause') {
    match.pointPauseTimer -= dt;
    if (match.pointPauseTimer <= 0) {
      setupServePositions(match);
    }
    return;
  }

  // Phase: Waiting for Serve
  if (match.phase === 'serve_wait') {
    const isHomeServe = match.servingTeam === 'home';
    const server = isHomeServe
      ? match.homePlayers[match.homeServerIndex]
      : match.awayPlayers[match.awayServerIndex];

    // Allow human movement slightly while waiting, keep server anchored until serve
    if (!isHomeServe || match.homeServerIndex !== 0) {
      stepPlayerPhysics(humanPlayer, humanInput.moveX, humanInput.jumpPressed, humanInput.jumpHeld, dt, false);
    } else {
      stepPlayerPhysics(humanPlayer, 0, false, false, dt, true);
    }

    const mateCtrl = computeTeammateControl(teammate, humanPlayer, match.ball, match);
    stepPlayerPhysics(teammate, mateCtrl.moveX, false, false, dt, true);
    stepPlayerPhysics(away0, 0, false, false, dt, true);
    stepPlayerPhysics(away1, 0, false, false, dt, true);

    if (isHomeServe) {
      if (match.homeServerIndex === 0) {
        if (humanInput.actionPressed || humanInput.receivePressed || humanInput.smashPressed) {
          executeServe(match, server);
        }
      } else {
        match.aiServeTimer -= dt;
        if (match.aiServeTimer <= 0) {
          executeServe(match, server);
        }
      }
    } else {
      match.aiServeTimer -= dt;
      if (match.aiServeTimer <= 0) {
        executeServe(match, server);
      }
    }
    return;
  }

  // Phase: Live Rally
  if (match.callout.timer > 0) {
    match.callout.timer = Math.max(0, match.callout.timer - dt);
  }

  // 1. Update Human & AI Players
  stepPlayerPhysics(humanPlayer, humanInput.moveX, humanInput.jumpPressed, humanInput.jumpHeld, dt);

  const mateCtrl = computeTeammateControl(teammate, humanPlayer, match.ball, match);
  stepPlayerPhysics(teammate, mateCtrl.moveX, mateCtrl.jumpPressed, mateCtrl.jumpHeld, dt);

  const awayCtrl0 = computeOpponentControl(away0, away1, match.ball, match, match.difficulty);
  const awayCtrl1 = computeOpponentControl(away1, away0, match.ball, match, match.difficulty);
  stepPlayerPhysics(away0, awayCtrl0.moveX, awayCtrl0.jumpPressed, awayCtrl0.jumpHeld, dt);
  stepPlayerPhysics(away1, awayCtrl1.moveX, awayCtrl1.jumpPressed, awayCtrl1.jumpHeld, dt);

  // 2. Step Ball Physics
  const { hitFloor, hitNet } = stepBallPhysics(match.ball, dt);
  if (hitNet) {
    match.events.push({ type: 'net' });
  }

  if (hitFloor) {
    const bx = match.ball.x;
    if (bx < COURT.LEFT_X || bx > COURT.RIGHT_X) {
      // Out of bounds: point to the opposing team of whoever touched last
      const pointTo = match.ball.lastHitByTeam === 'home' ? 'away' : 'home';
      awardPoint(match, pointTo, 'OUT!');
    } else if (bx < COURT.NET_X) {
      awardPoint(match, 'away');
    } else {
      awardPoint(match, 'home');
    }
    return;
  }

  // 3. Check Net Blocks (both human at net and AI blockers)
  for (const p of [humanPlayer, away0, away1]) {
    if (tryBlockCollision(match, p)) {
      return;
    }
  }

  // 4. Human Action Handling (Contextual Spacebar OR explicit Smash / Receive buttons)
  const ball = match.ball;
  const ownServeInFlightHome = ball.lastHitType === 'serve' && ball.lastHitByTeam === 'home';
  if (match.touchCooldown <= 0 && ball.x < COURT.NET_X + 26 && !ownServeInFlightHome) {
    const receiveProfile = getReceiveProfile(humanPlayer.stats);
    const smashProfile = getSmashProfile(humanPlayer.stats);

    const wantSmash = humanInput.smashPressed || (humanInput.actionPressed && !humanPlayer.onGround);
    const wantReceive = humanInput.receivePressed || (humanInput.actionPressed && humanPlayer.onGround);

    if (wantSmash && !humanPlayer.onGround) {
      const dist = Math.hypot(ball.x - humanPlayer.x, ball.y - (humanPlayer.y - 84));
      if (dist <= 98 + smashProfile.perfectWindowBonus) {
        executeSmash(match, humanPlayer);
        return;
      }
    }

    if (wantReceive) {
      const dist = Math.hypot(ball.x - humanPlayer.x, ball.y - (humanPlayer.y - 54));
      if (dist <= 96 + receiveProfile.reachBonus) {
        executeReceiveOrAutoFeed(match, humanPlayer, false);
        return;
      }
    }
  }

  // 5. Teammate AI Auto-Receive / Auto-Feed
  if (match.touchCooldown <= 0 && mateCtrl.wantAction && ball.x < COURT.NET_X && !ownServeInFlightHome) {
    if (match.lastTouchingPlayerId !== teammate.id || match.possessionSide !== 'home') {
      executeReceiveOrAutoFeed(match, teammate, match.sideTouches === 1);
      return;
    }
  }

  // 6. Opponent AI Receive / Set / Smash
  const ownServeInFlightAway = ball.lastHitType === 'serve' && ball.lastHitByTeam === 'away';
  if (match.touchCooldown <= 0 && ball.x >= COURT.NET_X - 18 && !ownServeInFlightAway) {
    const pairs = [
      { player: away0, ctrl: awayCtrl0 },
      { player: away1, ctrl: awayCtrl1 },
    ];
    for (const { player, ctrl } of pairs) {
      if (match.possessionSide === 'away' && match.lastTouchingPlayerId === player.id) {
        continue;
      }
      if (ctrl.wantSmash && !player.onGround) {
        const dist = Math.hypot(ball.x - player.x, ball.y - (player.y - 84));
        if (dist <= 92) {
          executeSmash(match, player);
          return;
        }
      }
      if (ctrl.wantReceive) {
        const dist = Math.hypot(ball.x - player.x, ball.y - (player.y - 54));
        if (dist <= 90) {
          executeReceiveOrAutoFeed(match, player, match.sideTouches === 1);
          return;
        }
      }
    }
  }
}
