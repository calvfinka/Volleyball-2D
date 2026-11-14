// Role-based 2v2 AI (Setter & Attacker) with reaction delay, no future-cheating, and Casual mistakes (no DOM dependencies)

import { COURT, predictBallLandingX } from './ball.js';

export function createAiMemory() {
  return {
    reactionTimer: 0,
    estimatedLandingX: COURT.NET_X + 240,
    noiseOffset: 0,
    wantNetMistake: false,
  };
}

function updateEstimate(aiMem, ball, difficulty, dt) {
  const isPro = difficulty === 'pro';
  const interval = isPro ? 0.07 : 0.24;
  aiMem.reactionTimer -= dt;
  if (aiMem.reactionTimer <= 0) {
    aiMem.reactionTimer = interval;
    const rawEst = predictBallLandingX(ball);
    const maxNoise = isPro ? 12 : 44;
    aiMem.noiseOffset = (Math.random() - 0.5) * 2 * maxNoise;
    aiMem.estimatedLandingX = rawEst + aiMem.noiseOffset;
    aiMem.wantNetMistake = !isPro && Math.random() < 0.06;
  }
}

// Home Teammate AI (acts as Setter / Support for human player, or full 2v2 AI in AI-vs-AI tests)
export function computeTeammateControl(teammate, partner, ball, match, aiMem, dt, isFullAiSlot0 = false) {
  if (aiMem) updateEstimate(aiMem, ball, match.difficulty, dt);
  const estLandingX = aiMem ? aiMem.estimatedLandingX : predictBallLandingX(ball);

  let targetX = isFullAiSlot0 ? 310 : 455;
  let jumpPressed = false;
  let wantAction = false;
  let wantSmash = false;

  if (match.phase === 'serve_wait') {
    const isHomeServer = match.servingTeam === 'home' && teammate.slotIndex === match.homeServerIndex;
    targetX = isHomeServer ? COURT.LEFT_X - 32 : 455;
    return {
      moveX: steerToward(teammate.x, targetX),
      jumpPressed: false,
      jumpHeld: false,
      wantAction: false,
      wantSmash: false,
    };
  }

  const ownServeInFlight = ball.lastHitType === 'serve' && ball.lastHitByTeam === 'home';
  const ballOnHomeSide = ball.x < COURT.NET_X && !ownServeInFlight;
  const canTouch =
    match.possessionSide !== 'home' ||
    match.lastTouchingPlayerId !== teammate.id ||
    match.lastTouchWasBlock;

  if (ballOnHomeSide && canTouch) {
    if (match.sideTouches === 1 && match.lastTouchingPlayerId === partner.id) {
      // Touch 2: Teammate who did NOT receive Touch 1 sets the Auto-Feed!
      targetX = clampHomeX(estLandingX);
      const dist = Math.hypot(ball.x - teammate.x, ball.y - (teammate.y - 68));
      if (dist < 96 && ball.vy > -140) {
        wantAction = true;
      }
    } else if (isFullAiSlot0 && match.sideTouches === 2) {
      // AI-vs-AI Touch 3: Striker jumps and smashes!
      targetX = clampHomeX(ball.x - 16);
      if (Math.abs(ball.x - teammate.x) < 62 && teammate.onGround && ball.y > 150 && ball.y < 410 && ball.vy > -180) {
        jumpPressed = true;
      }
      if (!teammate.onGround && Math.hypot(ball.x - teammate.x, ball.y - (teammate.y - 84)) < 90) {
        wantSmash = true;
      }
    } else if (
      match.sideTouches === 0 &&
      (isFullAiSlot0
        ? Math.abs(estLandingX - teammate.x) <= Math.abs(estLandingX - partner.x)
        : Math.abs(estLandingX - teammate.x) < Math.abs(estLandingX - partner.x) - 24)
    ) {
      // Touch 1: Cover incoming serve/attack
      targetX = clampHomeX(estLandingX);
      const dist = Math.hypot(ball.x - teammate.x, ball.y - (teammate.y - 54));
      if (dist < 92 && ball.vy > 0) {
        wantAction = true;
      }
    } else {
      targetX = partner.x > 420 ? 275 : 475;
    }
  } else if (isFullAiSlot0 && ball.x >= COURT.NET_X) {
    // AI-vs-AI Front player guards net for block
    targetX = COURT.NET_X - 48;
    if (ball.lastHitType === 'smash' && ball.vx < -220 && ball.x < 780 && teammate.onGround) {
      jumpPressed = true;
    }
  } else {
    targetX = isFullAiSlot0 ? 480 : 285;
  }

  return {
    moveX: steerToward(teammate.x, targetX),
    jumpPressed,
    jumpHeld: jumpPressed || !teammate.onGround,
    wantAction,
    wantSmash,
  };
}

// Opponent Away AI with explicit Setter (slot 1 / non-receiver) and Attacker (slot 0) roles
export function computeOpponentControl(player, partner, ball, match, difficulty = 'casual', aiMem = null, dt = 1 / 60) {
  if (aiMem) updateEstimate(aiMem, ball, difficulty, dt);

  const isPro = difficulty === 'pro';
  const speedScale = isPro ? 1.0 : 0.82;
  const estLandingX = aiMem ? aiMem.estimatedLandingX : predictBallLandingX(ball);
  const netFaultLunge = Boolean(aiMem?.wantNetMistake);

  let targetX = player.slotIndex === 0 ? 780 : 980;
  let jumpPressed = false;
  let wantReceive = false;
  let wantSmash = false;

  if (match.phase === 'serve_wait') {
    if (match.servingTeam === 'away' && player.slotIndex === match.awayServerIndex) {
      targetX = COURT.RIGHT_X + 32;
    } else {
      targetX = player.slotIndex === 0 ? 785 : 965;
    }
    return {
      moveX: steerToward(player.x, targetX) * speedScale,
      jumpPressed: false,
      jumpHeld: false,
      wantReceive: false,
      wantSmash: false,
      allowNetLunge: false,
    };
  }

  const ownServeInFlight = ball.lastHitType === 'serve' && ball.lastHitByTeam === 'away';
  const ballOnAwaySide = (ball.vx > 0 || ball.x >= COURT.NET_X) && !ownServeInFlight;
  const canTouch =
    match.possessionSide !== 'away' ||
    match.lastTouchingPlayerId !== player.id ||
    match.lastTouchWasBlock;

  if (ballOnAwaySide) {
    const homeAttackingAtNet =
      ball.x < COURT.NET_X &&
      ball.x > COURT.NET_X - 230 &&
      ball.y < COURT.NET_TOP_Y + 45 &&
      player.slotIndex === 0;

    if (homeAttackingAtNet) {
      // Attacker/Blocker moves to net for block
      targetX = netFaultLunge ? COURT.NET_X + 12 : COURT.NET_X + 46;
      const netDanger = ball.x > COURT.NET_X - 135 && ball.vx > 150 && ball.y < 395;
      const blockProb = isPro ? 0.85 : 0.45;
      if (netDanger && player.onGround && Math.random() < blockProb) {
        jumpPressed = true;
      }
    } else if (match.possessionSide === 'away' && match.sideTouches === 1) {
      // Touch 2: The teammate who did NOT touch Touch 1 acts as Setter!
      if (canTouch) {
        targetX = clampAwayX(estLandingX);
        const dist = Math.hypot(ball.x - player.x, ball.y - (player.y - 68));
        if (ball.x >= COURT.NET_X - 10 && dist < 94 && ball.vy > -120) {
          wantReceive = true;
        }
      } else {
        // First toucher drifts to attack zone (near net/3m line) ready for set
        targetX = 760;
      }
    } else if (match.possessionSide === 'away' && match.sideTouches === 2) {
      // Touch 3: Eligible attacker jumps for Smash!
      if (canTouch) {
        targetX = clampAwayX(ball.x + (isPro ? 16 : 30));
        const horizClose = Math.abs(ball.x - player.x) < 66;
        // Casual AI occasionally jumps late
        const lateWindow = isPro ? 410 : 450;
        if (horizClose && player.onGround && ball.y > 150 && ball.y < lateWindow && ball.vy > -180) {
          jumpPressed = true;
        }
        if (!player.onGround && Math.hypot(ball.x - player.x, ball.y - (player.y - 84)) < 90) {
          wantSmash = true;
        }
      } else {
        targetX = 960;
      }
    } else {
      // Touch 0 / Receive incoming ball: closer defender takes Touch 1
      const distSelf = Math.abs(estLandingX - player.x);
      const distPartner = Math.abs(estLandingX - partner.x);
      const isCloser = distSelf <= distPartner + (player.slotIndex === 1 ? -12 : 12);
      if (isCloser && canTouch) {
        targetX = clampAwayX(estLandingX);
        const dist = Math.hypot(ball.x - player.x, ball.y - (player.y - 54));
        if (ball.x >= COURT.NET_X - 10 && dist < 92 && ball.vy > -40) {
          wantReceive = true;
        }
      } else {
        targetX = player.slotIndex === 0 ? 770 : 1005;
      }
    }
  } else {
    // Ball on Home side: Blocker tracks net, Defender tracks backcourt
    if (player.slotIndex === 0) {
      targetX = COURT.NET_X + 52;
      if (ball.lastHitType === 'smash' && ball.vx > 240 && ball.x > 460 && player.onGround) {
        if (isPro || Math.random() < 0.48) {
          jumpPressed = true;
        }
      }
    } else {
      targetX = isPro ? 955 : 990;
    }
  }

  return {
    moveX: steerToward(player.x, targetX) * speedScale,
    jumpPressed,
    jumpHeld: jumpPressed || !player.onGround,
    wantReceive,
    wantSmash,
    allowNetLunge: netFaultLunge,
  };
}

function steerToward(currentX, targetX) {
  const diff = targetX - currentX;
  if (Math.abs(diff) < 10) return 0;
  return Math.max(-1, Math.min(1, diff / 42));
}

function clampHomeX(x) {
  return Math.max(COURT.LEFT_X + 24, Math.min(COURT.NET_X - 36, x));
}

function clampAwayX(x) {
  return Math.max(COURT.NET_X + 36, Math.min(COURT.RIGHT_X - 24, x));
}
