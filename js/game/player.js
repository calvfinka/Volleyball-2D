// Player entity state, acceleration/deceleration physics, stat-driven jump height, landing recovery, and poses (no DOM dependencies)

import { COURT } from './ball.js';
import { getSpeedProfile } from '../data/stats.js';

export const PLAYER_CFG = {
  WIDTH: 44,
  HEIGHT: 96,
  GRAVITY: 1760,
  NET_BUFFER: 26,
  NET_FAULT_ZONE: 18,
  AIR_CONTROL_MULT: 0.45,
  LANDING_RECOVERY_DURATION: 0.11,
};

export function createPlayer(template, teamId, slotIndex) {
  const isHome = teamId === 'home';
  const homePositions = [270, 465];
  const awayPositions = [815, 1010];
  const startX = isHome ? homePositions[slotIndex] : awayPositions[slotIndex];

  return {
    id: template.id,
    name: template.name,
    number: template.number,
    role: template.role,
    teamId,
    slotIndex,
    controlledBy: template.controlledBy,
    skinColor: template.skinColor,
    hairColor: template.hairColor,
    hairStyle: template.hairStyle,
    stats: { ...template.stats },

    x: startX,
    y: COURT.FLOOR_Y,
    vx: 0,
    vy: 0,
    facing: isHome ? 1 : -1,
    onGround: true,

    // Action & animation state
    pose: 'ready', // 'ready' | 'run' | 'jump' | 'receive' | 'set' | 'smash' | 'block' | 'serve'
    poseTimer: 0,
    actionCooldown: 0,
    landingRecoveryTimer: 0,
    jumpBuffer: 0,
    touchedNet: false,

    // Visual squash/stretch & stride
    scaleX: 1,
    scaleY: 1,
    stridePhase: 0,
    hitFlash: 0,
  };
}

export function resetPlayerPosition(player, isServingPlayer, servingTeam, rotationIndex = 0) {
  const isHome = player.teamId === 'home';
  if (isServingPlayer && player.teamId === servingTeam) {
    // Behind the baseline!
    player.x = isHome ? COURT.LEFT_X - 32 : COURT.RIGHT_X + 32;
  } else {
    // Rotate front/back court positions clockwise based on rotation index (0 or 1)
    const effectiveSlot = (player.slotIndex + rotationIndex) % 2;
    if (isHome) {
      player.x = effectiveSlot === 0 ? 305 : 490;
    } else {
      player.x = effectiveSlot === 0 ? 790 : 975;
    }
  }
  player.y = COURT.FLOOR_Y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.facing = isHome ? 1 : -1;
  player.pose = 'ready';
  player.poseTimer = 0;
  player.actionCooldown = 0;
  player.landingRecoveryTimer = 0;
  player.jumpBuffer = 0;
  player.touchedNet = false;
  player.scaleX = 1;
  player.scaleY = 1;
}

export function stepPlayerPhysics(
  player,
  moveX,
  jumpPressed,
  jumpHeld,
  dt,
  canCrossBaseline = false,
  allowNetLunging = false
) {
  const speedProfile = getSpeedProfile(player.stats);
  const clampedInput = Math.max(-1, Math.min(1, moveX));

  if (player.landingRecoveryTimer > 0) {
    player.landingRecoveryTimer = Math.max(0, player.landingRecoveryTimer - dt);
  }

  // Smooth acceleration/deceleration on ground, reduced control in air, damped during landing recovery
  const recoveryMult = player.landingRecoveryTimer > 0 ? 0.35 : 1.0;
  const targetVx = clampedInput * speedProfile.maxSpeed * recoveryMult;
  const accelRate = player.onGround
    ? (Math.abs(clampedInput) > 0.05 ? speedProfile.accel : speedProfile.accel * 1.25)
    : speedProfile.accel * PLAYER_CFG.AIR_CONTROL_MULT;

  const dv = targetVx - player.vx;
  const maxDv = accelRate * dt;
  if (Math.abs(dv) <= maxDv) {
    player.vx = targetVx;
  } else {
    player.vx += Math.sign(dv) * maxDv;
  }

  if (Math.abs(player.vx) > 25) {
    player.facing = player.vx > 0 ? 1 : -1;
  } else {
    player.facing = player.teamId === 'home' ? 1 : -1;
  }

  // Jump buffering + stat-driven jump height
  if (jumpPressed) {
    player.jumpBuffer = 0.12;
  } else if (player.jumpBuffer > 0) {
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
  }

  if (player.jumpBuffer > 0 && player.onGround && player.landingRecoveryTimer <= 0) {
    player.vy = speedProfile.jumpVy;
    player.onGround = false;
    player.jumpBuffer = 0;
    player.scaleX = 0.84;
    player.scaleY = 1.18;
    player.pose = 'jump';
  }

  // Variable jump cut when jump button released early
  if (!jumpHeld && !player.onGround && player.vy < -220) {
    player.vy *= Math.pow(0.45, dt * 12);
  }

  // Vertical integration + landing recovery
  if (!player.onGround) {
    player.vy += PLAYER_CFG.GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y >= COURT.FLOOR_Y) {
      player.y = COURT.FLOOR_Y;
      player.vy = 0;
      player.onGround = true;
      player.landingRecoveryTimer = PLAYER_CFG.LANDING_RECOVERY_DURATION;
      player.vx *= 0.55;
      player.scaleX = 1.22;
      player.scaleY = 0.78;
    }
  }

  player.x += player.vx * dt;

  // Court & Net boundaries
  const netMargin = allowNetLunging ? 10 : PLAYER_CFG.NET_BUFFER;
  const minX =
    player.teamId === 'home'
      ? (canCrossBaseline ? 30 : COURT.LEFT_X + 18)
      : COURT.NET_X + netMargin;
  const maxX =
    player.teamId === 'home'
      ? COURT.NET_X - netMargin
      : (canCrossBaseline ? COURT.WIDTH - 30 : COURT.RIGHT_X - 18);

  if (player.x < minX) {
    player.x = minX;
    player.vx = 0;
  } else if (player.x > maxX) {
    player.x = maxX;
    player.vx = 0;
  }

  // Net touch detection if player crosses into the net fault zone while active
  player.touchedNet = Math.abs(player.x - COURT.NET_X) < PLAYER_CFG.NET_FAULT_ZONE && !player.onGround;

  // Timers & spring-back squash/stretch
  if (player.actionCooldown > 0) {
    player.actionCooldown = Math.max(0, player.actionCooldown - dt);
  }
  if (player.hitFlash > 0) {
    player.hitFlash = Math.max(0, player.hitFlash - dt);
  }
  if (player.poseTimer > 0) {
    player.poseTimer = Math.max(0, player.poseTimer - dt);
  } else {
    if (!player.onGround) {
      player.pose = 'jump';
    } else if (Math.abs(player.vx) > 35) {
      player.pose = 'run';
      player.stridePhase += Math.abs(player.vx) * dt * 0.042;
    } else {
      player.pose = 'ready';
    }
  }

  player.scaleX += (1 - player.scaleX) * Math.min(1, 14 * dt);
  player.scaleY += (1 - player.scaleY) * Math.min(1, 14 * dt);
}
