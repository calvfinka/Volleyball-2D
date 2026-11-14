// Player entity state, movement, jumping, and animation timers (no DOM dependencies)

import { COURT } from './ball.js';

export const PLAYER_CFG = {
  WIDTH: 44,
  HEIGHT: 96,
  SPEED: 370,
  AI_SPEED: 335,
  JUMP_VY: -650,
  GRAVITY: 1760,
  NET_BUFFER: 30,
};

export function createPlayer(template, teamId, slotIndex) {
  const isHome = teamId === 'home';
  const homePositions = [260, 460];
  const awayPositions = [820, 1020];
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
    pose: 'idle', // 'idle' | 'run' | 'jump' | 'receive' | 'set' | 'smash' | 'block' | 'serve'
    poseTimer: 0,
    actionCooldown: 0,
    jumpBuffer: 0,
    smashBuffer: 0,
    receiveBuffer: 0,

    // Visual squash/stretch & stride
    scaleX: 1,
    scaleY: 1,
    stridePhase: 0,
    hitFlash: 0,
  };
}

export function resetPlayerPosition(player, isServingPlayer, servingTeam) {
  const isHome = player.teamId === 'home';
  if (isServingPlayer && player.teamId === servingTeam) {
    player.x = isHome ? COURT.LEFT_X + 42 : COURT.RIGHT_X - 42;
  } else if (isHome) {
    player.x = player.slotIndex === 0 ? 310 : 485;
  } else {
    player.x = player.slotIndex === 0 ? 795 : 970;
  }
  player.y = COURT.FLOOR_Y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.facing = isHome ? 1 : -1;
  player.pose = 'idle';
  player.poseTimer = 0;
  player.actionCooldown = 0;
  player.jumpBuffer = 0;
  player.smashBuffer = 0;
  player.receiveBuffer = 0;
  player.scaleX = 1;
  player.scaleY = 1;
}

export function stepPlayerPhysics(player, moveX, jumpPressed, jumpHeld, dt, canCrossBaseline = false) {
  const maxSpeed = player.controlledBy === 'human' ? PLAYER_CFG.SPEED : PLAYER_CFG.AI_SPEED;
  const targetVx = Math.max(-1, Math.min(1, moveX)) * maxSpeed;

  // Responsive ground accel, slight air control damping
  const accel = player.onGround ? 18 : 11;
  player.vx += (targetVx - player.vx) * Math.min(1, accel * dt);
  if (Math.abs(player.vx) < 4 && Math.abs(targetVx) < 0.05) {
    player.vx = 0;
  }

  if (Math.abs(player.vx) > 25) {
    player.facing = player.vx > 0 ? 1 : -1;
  } else {
    player.facing = player.teamId === 'home' ? 1 : -1;
  }

  // Input buffer for jump
  if (jumpPressed) {
    player.jumpBuffer = 0.12;
  } else if (player.jumpBuffer > 0) {
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
  }

  if (player.jumpBuffer > 0 && player.onGround) {
    player.vy = PLAYER_CFG.JUMP_VY;
    player.onGround = false;
    player.jumpBuffer = 0;
    player.scaleX = 0.84;
    player.scaleY = 1.18;
    player.pose = 'jump';
  }

  // Variable jump height cut if jump released early while rising
  if (!jumpHeld && !player.onGround && player.vy < -220) {
    player.vy *= Math.pow(0.45, dt * 12);
  }

  // Vertical integration
  if (!player.onGround) {
    player.vy += PLAYER_CFG.GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y >= COURT.FLOOR_Y) {
      player.y = COURT.FLOOR_Y;
      player.vy = 0;
      player.onGround = true;
      player.scaleX = 1.2;
      player.scaleY = 0.8;
    }
  }

  player.x += player.vx * dt;

  // Keep player on their side of the net
  const minX =
    player.teamId === 'home'
      ? (canCrossBaseline ? 42 : COURT.LEFT_X + 18)
      : COURT.NET_X + PLAYER_CFG.NET_BUFFER;
  const maxX =
    player.teamId === 'home'
      ? COURT.NET_X - PLAYER_CFG.NET_BUFFER
      : (canCrossBaseline ? COURT.WIDTH - 42 : COURT.RIGHT_X - 18);

  if (player.x < minX) {
    player.x = minX;
    player.vx = 0;
  } else if (player.x > maxX) {
    player.x = maxX;
    player.vx = 0;
  }

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
      player.pose = 'idle';
    }
  }

  player.scaleX += (1 - player.scaleX) * Math.min(1, 14 * dt);
  player.scaleY += (1 - player.scaleY) * Math.min(1, 14 * dt);
}
