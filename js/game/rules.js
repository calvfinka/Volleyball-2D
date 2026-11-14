// Volleyball match state machine, explicit rules, rotation, per-player stats, and rally scoring (no DOM dependencies)

import { TEAMS, getServeProfile, getReceiveProfile, getSmashProfile, getBlockProfile } from '../data/stats.js';
import { COURT, BALL_CFG, createBall, resetBallForServe, stepBallPhysics } from './ball.js';
import { createPlayer, resetPlayerPosition, stepPlayerPhysics } from './player.js';
import { createAiMemory, computeTeammateControl, computeOpponentControl } from './ai.js';

export const DEFAULT_TARGET_POINTS = 15;
export const TARGET_POINTS = DEFAULT_TARGET_POINTS;

export function createMatchState(difficulty = 'casual', options = {}) {
  const targetPoints = [11, 15, 21].includes(options.targetPoints)
    ? options.targetPoints
    : DEFAULT_TARGET_POINTS;

  const homePlayers = TEAMS.home.players.map((tpl, i) => createPlayer(tpl, 'home', i));
  const awayPlayers = TEAMS.away.players.map((tpl, i) => createPlayer(tpl, 'away', i));

  if (options.aiControlledHome) {
    homePlayers[0].controlledBy = 'ai';
  }

  const playerStats = {};
  for (const p of [...homePlayers, ...awayPlayers]) {
    playerStats[p.id] = {
      id: p.id,
      name: p.name,
      number: p.number,
      teamId: p.teamId,
      points: 0,
      aces: 0,
      smashes: 0,
      blocks: 0,
      serviceErrors: 0,
    };
  }

  const state = {
    difficulty,
    targetPoints,
    aiControlledHome: Boolean(options.aiControlledHome),
    practiceMode: Boolean(options.practiceMode),
    phase: 'serve_wait', // 'serve_wait' | 'rally' | 'point_pause' | 'match_over'
    score: { home: 0, away: 0 },
    servingTeam: 'home',
    rotation: { home: 1, away: 1 }, // 1 or 2 in 2v2
    homeServerIndex: 0,
    awayServerIndex: 0,
    winner: null,

    // Rally touch tracking
    possessionSide: null, // 'home' | 'away' | null
    sideTouches: 0,
    lastTouchingPlayerId: null,
    lastTouchWasBlock: false,
    touchCooldown: 0,
    rallyNumber: 1,
    currentRallyVolleys: 0,
    bestRallyVolleys: 0,

    // Timers & juice
    aiServeTimer: options.aiControlledHome ? 0.15 : 0.85,
    pointPauseTimer: 0,
    hitstopTimer: 0,
    cameraShake: 0,
    elapsedSeconds: 0,

    // Aggregate & per-player stats
    stats: {
      rallies: 0,
      smashes: 0,
      perfectSmashes: 0,
      blocks: 0,
    },
    playerStats,

    // AI perception buffers (reaction lag)
    aiMemories: {
      home0: createAiMemory(),
      home1: createAiMemory(),
      away0: createAiMemory(),
      away1: createAiMemory(),
    },

    callout: { text: 'PRESS SPACE OR RECV TO SERVE', color: '#FFFDF8', timer: 2.5 },
    timingFeedback: { text: '', color: '#F29F05', x: 0, y: 0, timer: 0 },
    particles: createParticlePool(48),

    ball: createBall(),
    homePlayers,
    awayPlayers,
    events: [],
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

export function getActiveServer(match) {
  return match.servingTeam === 'home'
    ? match.homePlayers[match.homeServerIndex]
    : match.awayPlayers[match.awayServerIndex];
}

export function setupServePositions(match) {
  match.phase = 'serve_wait';
  match.possessionSide = null;
  match.sideTouches = 0;
  match.lastTouchingPlayerId = null;
  match.lastTouchWasBlock = false;
  match.touchCooldown = 0;
  match.currentRallyVolleys = 0;
  match.aiServeTimer = match.aiControlledHome ? 0.12 : 0.85;

  const isHomeServe = match.servingTeam === 'home';
  const homeRotOffset = match.rotation.home - 1;
  const awayRotOffset = match.rotation.away - 1;

  match.homePlayers.forEach((p, idx) =>
    resetPlayerPosition(p, isHomeServe && idx === match.homeServerIndex, match.servingTeam, homeRotOffset)
  );
  match.awayPlayers.forEach((p, idx) =>
    resetPlayerPosition(p, !isHomeServe && idx === match.awayServerIndex, match.servingTeam, awayRotOffset)
  );
  resetBallForServe(match.ball, match.servingTeam);

  const server = getActiveServer(match);
  if (isHomeServe && !match.aiControlledHome && server.controlledBy === 'human') {
    match.callout = { text: `R${match.rotation.home} · #${server.number} ${server.name.toUpperCase()} TO SERVE`, color: '#FFFDF8', timer: 99 };
  } else {
    const teamTag = isHomeServe ? TEAMS.home.shortName : TEAMS.away.shortName;
    match.callout = { text: `${teamTag} R${isHomeServe ? match.rotation.home : match.rotation.away} SERVING...`, color: isHomeServe ? '#FFB59E' : '#7EE3E1', timer: 1.5 };
  }
}

export function checkMatchWinner(homeScore, awayScore, target = DEFAULT_TARGET_POINTS) {
  if (homeScore >= target && homeScore - awayScore >= 2) return 'home';
  if (awayScore >= target && awayScore - homeScore >= 2) return 'away';
  return null;
}

export function isDoubleTouch(match, player) {
  return (
    match.possessionSide === player.teamId &&
    match.lastTouchingPlayerId === player.id &&
    !match.lastTouchWasBlock
  );
}

export function executeServe(match, serverPlayer) {
  const profile = getServeProfile(serverPlayer.stats);
  const isHome = serverPlayer.teamId === 'home';
  const dir = isHome ? 1 : -1;
  const jitter = (Math.random() - 0.5) * profile.spread;

  // Casual AI can occasionally overhit/underhit serves slightly
  const casualServeMistake =
    serverPlayer.controlledBy === 'ai' && match.difficulty === 'casual' && Math.random() < 0.08
      ? (Math.random() < 0.5 ? 160 : -230)
      : 0;

  match.ball.active = true;
  match.ball.x = serverPlayer.x + dir * 24;
  match.ball.y = serverPlayer.y - 90;

  const oppCourtStart = isHome ? COURT.NET_X + 115 : COURT.NET_X - 115;
  const oppCourtSpan = 370;
  const targetX = oppCourtStart + dir * (oppCourtSpan * profile.targetDepth) + jitter + dir * casualServeMistake;
  const targetY = COURT.FLOOR_Y - BALL_CFG.RADIUS;
  const flightTime = profile.flightTime;
  const spin = dir * profile.topspin;
  const vx = (targetX - match.ball.x) / flightTime;

  // Compensate initial vy for average Magnus topspin dip so legal serves clear the net
  const avgMagnusDip = spin * vx * BALL_CFG.MAGNUS_K * 0.65;
  const effG = BALL_CFG.GRAVITY + avgMagnusDip;
  const vy = (targetY - match.ball.y - 0.5 * effG * flightTime * flightTime) / flightTime;

  match.ball.vx = vx;
  match.ball.vy = vy;
  match.ball.spin = spin;
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
  match.lastTouchWasBlock = false;
  match.touchCooldown = 0.16;
  match.currentRallyVolleys = 1;
  match.callout = { text: '', color: '#FFFDF8', timer: 0 };

  spawnParticles(match.particles, match.ball.x, match.ball.y, 10, '#FFFDF8', 170);
  match.events.push({ type: 'serve' });
}

export function evaluateSmashTiming(player, ball) {
  const smashProfile = getSmashProfile(player.stats);
  const handY = player.y - 86;
  const dy = ball.y - handY;
  const nearApex = Math.abs(player.vy) < 250;

  if (Math.abs(dy) <= 28 + smashProfile.perfectWindowBonus && nearApex) {
    return 'PERFECT';
  }
  if (Math.abs(dy) <= 58) {
    return 'GOOD';
  }
  return dy < 0 ? 'EARLY' : 'LATE';
}

export function executeReceiveOrAutoFeed(match, player, isSetterAutoFeed = false) {
  const isHome = player.teamId === 'home';

  // Enforce no-double-touch rule (block is the sole exception)
  if (isDoubleTouch(match, player)) {
    awardPoint(match, isHome ? 'away' : 'home', 'DOUBLE TOUCH!');
    return;
  }

  const receiveProfile = getReceiveProfile(player.stats);
  const ball = match.ball;

  if (match.possessionSide !== player.teamId) {
    match.possessionSide = player.teamId;
    match.sideTouches = 1;
    match.currentRallyVolleys += 1;
  } else {
    match.sideTouches += 1;
  }

  if (match.sideTouches > 3) {
    awardPoint(match, isHome ? 'away' : 'home', '4 HITS FAULT!');
    return;
  }

  const isAutoFeedSet = isSetterAutoFeed || match.sideTouches === 2;
  let targetX;
  let flightTime;

  if (isHome) {
    if (match.sideTouches === 1) {
      const teammate = match.homePlayers.find((p) => p.id !== player.id);
      targetX = player.controlledBy === 'human' && teammate ? Math.max(330, Math.min(500, teammate.x)) : 495;
      flightTime = 0.72;
    } else if (match.sideTouches === 2) {
      targetX = 505 + (Math.random() - 0.5) * (1 - receiveProfile.setPrecision) * 65;
      flightTime = 1.05;
    } else {
      targetX = 860 + Math.random() * 140;
      flightTime = 1.15;
    }
  } else {
    if (match.sideTouches === 1) {
      targetX = 760 + (Math.random() - 0.5) * 55;
      flightTime = 0.74;
    } else if (match.sideTouches === 2) {
      targetX = 755;
      flightTime = 0.96;
    } else {
      targetX = 330 + Math.random() * 160;
      flightTime = 1.15;
    }
  }

  const targetY = match.sideTouches === 2 ? 315 : 390;
  const g = BALL_CFG.GRAVITY;
  ball.vx = (targetX - ball.x) / flightTime;
  ball.vy = (targetY - ball.y - 0.5 * g * flightTime * flightTime) / flightTime;
  // Soft set gets slight backspin for gentle float
  ball.spin = isAutoFeedSet ? (isHome ? -3 : 3) : (isHome ? 2 : -2);
  ball.lastHitByTeam = player.teamId;
  ball.lastHitById = player.id;
  ball.lastHitType = isAutoFeedSet ? 'set' : 'receive';
  ball.isAutoFeed = isHome && match.sideTouches === 2;

  player.pose = isAutoFeedSet ? 'set' : 'receive';
  player.poseTimer = 0.25;
  player.scaleX = 1.14;
  player.scaleY = 0.88;

  match.lastTouchingPlayerId = player.id;
  match.lastTouchWasBlock = false;
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
  const isHome = player.teamId === 'home';

  // Enforce no-double-touch rule
  if (isDoubleTouch(match, player)) {
    awardPoint(match, isHome ? 'away' : 'home', 'DOUBLE TOUCH!');
    return;
  }

  const ball = match.ball;
  const smashProfile = getSmashProfile(player.stats);

  if (match.possessionSide !== player.teamId) {
    match.possessionSide = player.teamId;
    match.sideTouches = 1;
    match.currentRallyVolleys += 1;
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
    vyDown = 360 * smashProfile.steepness * 2.05;
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
    vyDown = -130;
    feedbackColor = '#E2E8F0';
  }

  // Casual AI off-target smash variance (can occasionally smash out or low)
  const casualOffTarget =
    player.controlledBy === 'ai' && match.difficulty === 'casual' && Math.random() < 0.22
      ? (Math.random() < 0.5 ? 1.25 : 0.78)
      : 1.0;

  const distToNet = Math.abs(COURT.NET_X - ball.x);
  const speed = smashProfile.power * powerMult * casualOffTarget;
  const vx = dir * speed * (timing === 'PERFECT' ? 0.94 : 0.88);
  const timeToNet = Math.max(0.08, distToNet / Math.abs(vx));
  const projectedYAtNet = ball.y + vyDown * timeToNet + 0.5 * BALL_CFG.GRAVITY * timeToNet * timeToNet;

  if (projectedYAtNet > COURT.NET_TOP_Y - 24 && casualOffTarget <= 1.05) {
    const neededY = COURT.NET_TOP_Y - 28;
    vyDown = (neededY - ball.y - 0.5 * BALL_CFG.GRAVITY * timeToNet * timeToNet) / timeToNet;
  }

  ball.vx = vx;
  ball.vy = vyDown;
  ball.spin = dir * smashProfile.spin;
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
  match.lastTouchWasBlock = false;
  match.touchCooldown = 0.16;
  if (isHome) match.stats.smashes += 1;
  match.playerStats[player.id].smashes += 1;

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

  // Only a player jumping near the net can block
  if (Math.abs(blocker.x - COURT.NET_X) > 95) return false;

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
    match.hitstopTimer = 0.045;
    match.cameraShake = 0.45;
    match.timingFeedback = { text: 'STUFF BLOCK!', color: '#F29F05', x: ball.x, y: ball.y - 30, timer: 0.85 };
  } else {
    ball.vx = -dir * 180;
    ball.vy = -380;
    match.timingFeedback = { text: 'SOFT TOUCH', color: '#7EE3E1', x: ball.x, y: ball.y - 30, timer: 0.7 };
  }

  ball.spin = dir * 10;
  ball.lastHitByTeam = blocker.teamId;
  ball.lastHitById = blocker.id;
  ball.lastHitType = 'block';
  ball.isAutoFeed = false;

  // A block is NOT counted as one of the 3 team touches, and allows same player to follow up
  match.possessionSide = isStuff ? null : blocker.teamId;
  match.sideTouches = 0;
  match.lastTouchingPlayerId = blocker.id;
  match.lastTouchWasBlock = true;
  match.touchCooldown = 0.2;
  if (isHomeBlocker) match.stats.blocks += 1;
  match.playerStats[blocker.id].blocks += 1;

  blocker.pose = 'block';
  blocker.poseTimer = 0.28;
  blocker.hitFlash = 0.08;

  spawnParticles(match.particles, ball.x, ball.y, 14, '#FFFDF8', 240);
  match.events.push({ type: 'block' });
  return true;
}

export function awardPoint(match, scoringTeam, reasonText = '', creditPlayerId = null) {
  if (match.phase === 'point_pause' || match.phase === 'match_over') return;

  if (match.practiceMode) {
    // Practice mode resets ball smoothly without ending match
    match.phase = 'point_pause';
    match.pointPauseTimer = 0.65;
    match.ball.active = false;
    match.callout = { text: reasonText || 'NICE RALLY!', color: '#F29F05', timer: 0.65 };
    return;
  }

  const prevServingTeam = match.servingTeam;
  match.score[scoringTeam] += 1;
  match.stats.rallies += 1;
  match.rallyNumber += 1;
  if (match.currentRallyVolleys > match.bestRallyVolleys) {
    match.bestRallyVolleys = match.currentRallyVolleys;
  }
  match.ball.active = false;

  // Credit point to scoring player if applicable
  if (creditPlayerId && match.playerStats[creditPlayerId]?.teamId === scoringTeam) {
    match.playerStats[creditPlayerId].points += 1;
  }

  // Rotation rule: ONLY when the receiving team wins the rally, it wins the serve and rotates clockwise
  if (scoringTeam !== prevServingTeam) {
    match.servingTeam = scoringTeam;
    if (scoringTeam === 'home') {
      match.rotation.home = match.rotation.home === 1 ? 2 : 1;
      match.homeServerIndex = (match.homeServerIndex + 1) % match.homePlayers.length;
    } else {
      match.rotation.away = match.rotation.away === 1 ? 2 : 1;
      match.awayServerIndex = (match.awayServerIndex + 1) % match.awayPlayers.length;
    }
  }

  const winner = checkMatchWinner(match.score.home, match.score.away, match.targetPoints);
  if (winner) {
    match.winner = winner;
    match.phase = 'match_over';
    match.callout = {
      text: winner === 'home' ? `${TEAMS.home.shortName} WINS THE MATCH!` : `${TEAMS.away.shortName} WINS THE MATCH!`,
      color: winner === 'home' ? '#F29F05' : '#7EE3E1',
      timer: 5,
    };
    match.events.push({ type: 'match_over', winner });
    return;
  }

  match.phase = 'point_pause';
  match.pointPauseTimer = match.aiControlledHome ? 0.05 : 1.1;

  const isMatchPoint =
    (match.score.home >= match.targetPoints - 1 && match.score.home > match.score.away) ||
    (match.score.away >= match.targetPoints - 1 && match.score.away > match.score.home);

  const teamLabel = scoringTeam === 'home' ? TEAMS.home.shortName : TEAMS.away.shortName;
  const suffix = reasonText ? ` · ${reasonText}` : '';
  const prefix = isMatchPoint ? 'MATCH POINT · ' : '';
  match.callout = {
    text: `${prefix}POINT ${teamLabel}${suffix}`,
    color: scoringTeam === 'home' ? '#FFB59E' : '#7EE3E1',
    timer: 1.1,
  };

  match.events.push({ type: 'point', scoringTeam });
}

export function stepMatch(match, humanInput, dt) {
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

  if (match.phase === 'match_over') return;

  if (match.hitstopTimer > 0) {
    match.hitstopTimer = Math.max(0, match.hitstopTimer - dt);
    return;
  }

  match.elapsedSeconds += dt;
  if (match.touchCooldown > 0) {
    match.touchCooldown = Math.max(0, match.touchCooldown - dt);
  }

  const home0 = match.homePlayers[0];
  const home1 = match.homePlayers[1];
  const away0 = match.awayPlayers[0];
  const away1 = match.awayPlayers[1];

  if (match.phase === 'point_pause') {
    match.pointPauseTimer -= dt;
    if (match.pointPauseTimer <= 0) {
      setupServePositions(match);
    }
    return;
  }

  if (match.phase === 'serve_wait') {
    const isHomeServe = match.servingTeam === 'home';
    const server = getActiveServer(match);

    if (!match.aiControlledHome) {
      if (!isHomeServe || server.id !== home0.id) {
        const waitJump = humanInput.jumpPressed || (humanInput.actionPressed && home0.onGround);
        stepPlayerPhysics(home0, humanInput.moveX, waitJump, humanInput.jumpHeld || waitJump, dt, false);
      } else {
        stepPlayerPhysics(home0, 0, false, false, dt, true);
      }
    } else {
      stepPlayerPhysics(home0, 0, false, false, dt, true);
    }

    const mateCtrl = computeTeammateControl(home1, home0, match.ball, match, match.aiMemories.home1, dt);
    stepPlayerPhysics(home1, mateCtrl.moveX, false, false, dt, true);
    stepPlayerPhysics(away0, 0, false, false, dt, true);
    stepPlayerPhysics(away1, 0, false, false, dt, true);

    if (isHomeServe && !match.aiControlledHome && server.controlledBy === 'human') {
      if (humanInput.actionPressed || humanInput.receivePressed || humanInput.smashPressed) {
        executeServe(match, server);
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

  // 1. Update Players
  let home0AiCtrl = null;
  if (match.aiControlledHome) {
    home0AiCtrl = computeTeammateControl(home0, home1, match.ball, match, match.aiMemories.home0, dt, true);
    stepPlayerPhysics(home0, home0AiCtrl.moveX, home0AiCtrl.jumpPressed, home0AiCtrl.jumpHeld, dt);
  } else {
    const receiveProfile = getReceiveProfile(home0.stats);
    const ownServeHome = match.ball.lastHitType === 'serve' && match.ball.lastHitByTeam === 'home';
    const ballInReceiveReach =
      match.touchCooldown <= 0 &&
      match.ball.x < COURT.NET_X + 26 &&
      !ownServeHome &&
      Math.hypot(match.ball.x - home0.x, match.ball.y - (home0.y - 54)) <= 96 + receiveProfile.reachBonus;
    const spaceJump = humanInput.actionPressed && home0.onGround && !ballInReceiveReach;
    stepPlayerPhysics(
      home0,
      humanInput.moveX,
      humanInput.jumpPressed || spaceJump,
      humanInput.jumpHeld || spaceJump,
      dt
    );
  }

  const mateCtrl = computeTeammateControl(home1, home0, match.ball, match, match.aiMemories.home1, dt);
  stepPlayerPhysics(home1, mateCtrl.moveX, mateCtrl.jumpPressed, mateCtrl.jumpHeld, dt);

  const awayCtrl0 = computeOpponentControl(away0, away1, match.ball, match, match.difficulty, match.aiMemories.away0, dt);
  const awayCtrl1 = computeOpponentControl(away1, away0, match.ball, match, match.difficulty, match.aiMemories.away1, dt);
  stepPlayerPhysics(away0, awayCtrl0.moveX, awayCtrl0.jumpPressed, awayCtrl0.jumpHeld, dt, false, awayCtrl0.allowNetLunge);
  stepPlayerPhysics(away1, awayCtrl1.moveX, awayCtrl1.jumpPressed, awayCtrl1.jumpHeld, dt, false, awayCtrl1.allowNetLunge);

  // Check player net touch fault during rally
  for (const p of [home0, home1, away0, away1]) {
    if (p.touchedNet) {
      awardPoint(match, p.teamId === 'home' ? 'away' : 'home', 'NET TOUCH FAULT!');
      return;
    }
  }

  // 2. Ball Physics
  const { hitFloor, hitNet } = stepBallPhysics(match.ball, dt);
  if (hitNet) {
    match.events.push({ type: 'net' });
    const faultTeam = match.ball.lastHitByTeam || 'home';
    const pointTo = faultTeam === 'home' ? 'away' : 'home';
    if (match.ball.lastHitType === 'serve' && match.ball.lastHitById) {
      match.playerStats[match.ball.lastHitById].serviceErrors += 1;
      awardPoint(match, pointTo, 'SERVICE ERROR (NET)!');
    } else {
      awardPoint(match, pointTo, 'NET FAULT!');
    }
    return;
  }

  if (hitFloor) {
    const bx = match.ball.x;
    const isServe = match.ball.lastHitType === 'serve';
    const lastTeam = match.ball.lastHitByTeam;
    const lastPlayerId = match.ball.lastHitById;

    if (isServe) {
      const landedInOppCourt =
        lastTeam === 'home'
          ? bx >= COURT.NET_X && bx <= COURT.RIGHT_X
          : bx >= COURT.LEFT_X && bx < COURT.NET_X;

      if (landedInOppCourt) {
        if (lastPlayerId) match.playerStats[lastPlayerId].aces += 1;
        awardPoint(match, lastTeam, 'ACE!', lastPlayerId);
      } else {
        if (lastPlayerId) match.playerStats[lastPlayerId].serviceErrors += 1;
        awardPoint(match, lastTeam === 'home' ? 'away' : 'home', 'SERVICE ERROR!');
      }
      return;
    }

    if (bx < COURT.LEFT_X || bx > COURT.RIGHT_X) {
      const pointTo = lastTeam === 'home' ? 'away' : 'home';
      awardPoint(match, pointTo, 'OUT!');
    } else if (bx < COURT.NET_X) {
      awardPoint(match, 'away', '', lastTeam === 'away' ? lastPlayerId : null);
    } else {
      awardPoint(match, 'home', '', lastTeam === 'home' ? lastPlayerId : null);
    }
    return;
  }

  // 3. Net Blocks
  for (const p of [home0, home1, away0, away1]) {
    if (tryBlockCollision(match, p)) {
      return;
    }
  }

  // 4. Home Player 0 Action (Human OR AI-vs-AI)
  const ball = match.ball;
  const ownServeInFlightHome = ball.lastHitType === 'serve' && ball.lastHitByTeam === 'home';

  if (match.touchCooldown <= 0 && ball.x < COURT.NET_X + 26 && !ownServeInFlightHome) {
    if (match.aiControlledHome && home0AiCtrl) {
      if (home0AiCtrl.wantSmash && !home0.onGround && Math.hypot(ball.x - home0.x, ball.y - (home0.y - 84)) <= 92) {
        executeSmash(match, home0);
        return;
      }
      if (home0AiCtrl.wantAction && Math.hypot(ball.x - home0.x, ball.y - (home0.y - 54)) <= 94) {
        executeReceiveOrAutoFeed(match, home0, match.sideTouches === 1);
        return;
      }
    } else {
      const receiveProfile = getReceiveProfile(home0.stats);
      const smashProfile = getSmashProfile(home0.stats);

      const wantSmash = humanInput.smashPressed || (humanInput.actionPressed && !home0.onGround);
      const wantReceive = humanInput.receivePressed || (humanInput.actionPressed && home0.onGround);

      if (wantSmash && !home0.onGround) {
        const dist = Math.hypot(ball.x - home0.x, ball.y - (home0.y - 84));
        if (dist <= 98 + smashProfile.perfectWindowBonus) {
          executeSmash(match, home0);
          return;
        }
      }

      if (wantReceive) {
        const dist = Math.hypot(ball.x - home0.x, ball.y - (home0.y - 54));
        if (dist <= 96 + receiveProfile.reachBonus) {
          executeReceiveOrAutoFeed(match, home0, false);
          return;
        }
      }
    }
  }

  // 5. Home Teammate AI
  if (match.touchCooldown <= 0 && mateCtrl.wantAction && ball.x < COURT.NET_X && !ownServeInFlightHome) {
    if (!isDoubleTouch(match, home1)) {
      executeReceiveOrAutoFeed(match, home1, match.sideTouches === 1);
      return;
    }
  }

  // 6. Opponent AI
  const ownServeInFlightAway = ball.lastHitType === 'serve' && ball.lastHitByTeam === 'away';
  if (match.touchCooldown <= 0 && ball.x >= COURT.NET_X - 18 && !ownServeInFlightAway) {
    const pairs = [
      { player: away0, ctrl: awayCtrl0 },
      { player: away1, ctrl: awayCtrl1 },
    ];
    for (const { player, ctrl } of pairs) {
      if (isDoubleTouch(match, player)) continue;
      if (ctrl.wantSmash && !player.onGround) {
        const dist = Math.hypot(ball.x - player.x, ball.y - (player.y - 84));
        if (dist <= 92) {
          executeSmash(match, player);
          return;
        }
      }
      if (ctrl.wantReceive) {
        const dist = Math.hypot(ball.x - player.x, ball.y - (player.y - 54));
        if (dist <= 94) {
          executeReceiveOrAutoFeed(match, player, match.sideTouches === 1);
          return;
        }
      }
    }
  }
}
