// 2v2 AI for both Home Teammate (Setter/Support) and Away Opponents (no DOM dependencies)

import { COURT, BALL_CFG, predictBallLandingX } from './ball.js';

export function computeTeammateControl(teammate, humanPlayer, ball, match) {
  let targetX = 450;
  let wantJump = false;
  let wantAction = false;

  if (match.phase === 'serve_wait') {
    targetX = 460;
    return { moveX: steerToward(teammate.x, targetX), jumpPressed: false, jumpHeld: false, wantAction: false };
  }

  const landingX = predictBallLandingX(ball);
  const ownServeInFlight = ball.lastHitType === 'serve' && ball.lastHitByTeam === 'home';
  const ballOnHomeSide = ball.x < COURT.NET_X && !ownServeInFlight;

  if (ballOnHomeSide) {
    if (match.sideTouches === 1 && ball.lastHitById === humanPlayer.id) {
      // Human just received Touch 1 -> Teammate moves under ball to execute Auto-Feed Set
      targetX = clampHomeX(landingX);
      const dist = Math.hypot(ball.x - teammate.x, ball.y - (teammate.y - 68));
      if (dist < 92 && ball.vy > -120) {
        wantAction = true;
      }
    } else if (match.sideTouches === 0 && Math.abs(landingX - teammate.x) < Math.abs(landingX - humanPlayer.x) - 30) {
      // Teammate is clearly closer to incoming serve/attack -> cover the dig!
      targetX = clampHomeX(landingX);
      const dist = Math.hypot(ball.x - teammate.x, ball.y - (teammate.y - 54));
      if (dist < 90 && ball.vy > 0) {
        wantAction = true;
      }
    } else {
      // Support position behind human attacker to cover tips/blocks
      targetX = humanPlayer.x > 420 ? 270 : 480;
    }
  } else {
    // Ball on Away side: Teammate guards back-mid court while Human can guard net/mid
    targetX = 285;
  }

  return {
    moveX: steerToward(teammate.x, targetX),
    jumpPressed: wantJump,
    jumpHeld: wantJump,
    wantAction,
  };
}

export function computeOpponentControl(player, partner, ball, match, difficulty = 'casual') {
  const isPro = difficulty === 'pro';
  const speedScale = isPro ? 1.0 : 0.82;
  let targetX = player.slotIndex === 0 ? 790 : 980;
  let jumpPressed = false;
  let wantReceive = false;
  let wantSmash = false;

  if (match.phase === 'serve_wait') {
    if (match.servingTeam === 'away' && player.slotIndex === match.awayServerIndex) {
      targetX = COURT.RIGHT_X - 42;
    } else {
      targetX = player.slotIndex === 0 ? 780 : 960;
    }
    return {
      moveX: steerToward(player.x, targetX) * speedScale,
      jumpPressed: false,
      jumpHeld: false,
      wantReceive: false,
      wantSmash: false,
    };
  }

  const landingX = predictBallLandingX(ball);
  const ballHeadingRight = ball.vx > 0 || ball.x >= COURT.NET_X;

  if (ballHeadingRight) {
    // Decide which opponent covers the ball
    const distSelf = Math.abs(landingX - player.x);
    const distPartner = Math.abs(landingX - partner.x);
    const isCloser = distSelf <= distPartner + (player.slotIndex === 0 ? -10 : 10);

    // Block check if Home just smashed or set high near net
    const homeAttackingAtNet =
      ball.x < COURT.NET_X &&
      ball.x > COURT.NET_X - 240 &&
      ball.y < COURT.NET_TOP_Y + 40 &&
      player.slotIndex === 0;

    if (homeAttackingAtNet) {
      targetX = COURT.NET_X + 46;
      const netDanger = ball.x > COURT.NET_X - 135 && ball.vx > 160 && ball.y < 390;
      if (netDanger && player.onGround && (isPro || Math.random() < 0.55)) {
        jumpPressed = true;
      }
    } else if (isCloser || ball.x >= COURT.NET_X) {
      if (match.possessionSide === 'away' && match.sideTouches === 2) {
        // Opponent Touch 3: Jump & Smash!
        targetX = clampAwayX(ball.x + 18);
        const horizClose = Math.abs(ball.x - player.x) < 62;
        if (horizClose && player.onGround && ball.y > 160 && ball.y < 410 && ball.vy > -180) {
          jumpPressed = true;
        }
        if (!player.onGround && Math.hypot(ball.x - player.x, ball.y - (player.y - 84)) < 88) {
          wantSmash = true;
        }
      } else {
        // Opponent Touch 1 or 2: Move under ball and Receive/Set
        targetX = clampAwayX(landingX);
        const dist = Math.hypot(ball.x - player.x, ball.y - (player.y - 54));
        if (ball.x >= COURT.NET_X - 10 && dist < 88 && ball.vy > -60) {
          wantReceive = true;
        }
      }
    } else {
      // Back-court / net support when partner covers
      targetX = player.slotIndex === 0 ? 765 : 1010;
    }
  } else {
    // Ball on Home side: Blocker tracks net, Defender tracks mid-backcourt
    if (player.slotIndex === 0) {
      targetX = COURT.NET_X + 54;
      if (ball.lastHitType === 'smash' && ball.vx > 240 && ball.x > 460 && player.onGround) {
        if (isPro || Math.random() < 0.5) {
          jumpPressed = true;
        }
      }
    } else {
      targetX = isPro ? 960 : 990;
    }
  }

  return {
    moveX: steerToward(player.x, targetX) * speedScale,
    jumpPressed,
    jumpHeld: jumpPressed || !player.onGround,
    wantReceive,
    wantSmash,
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
