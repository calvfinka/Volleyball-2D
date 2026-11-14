// Pure ball physics module (no DOM dependencies)

export const COURT = {
  WIDTH: 1280,
  HEIGHT: 720,
  FLOOR_Y: 620,
  CEILING_Y: 36,
  LEFT_X: 90,
  RIGHT_X: 1190,
  NET_X: 640,
  NET_TOP_Y: 380,
  NET_HALF_W: 8,
};

export const BALL_CFG = {
  RADIUS: 20,
  GRAVITY: 1080,
  AIR_DRAG: 0.999,
  MAX_SPEED: 1380,
  TRAIL_LENGTH: 10,
};

export function createBall() {
  return {
    x: 160,
    y: 490,
    vx: 0,
    vy: 0,
    spin: 0,
    angle: 0,
    topspinAccel: 0,
    active: false,
    lastHitByTeam: null, // 'home' | 'away'
    lastHitById: null,
    lastHitType: 'none', // 'serve' | 'receive' | 'set' | 'smash' | 'block'
    isAutoFeed: false,
    trail: [],
  };
}

export function resetBallForServe(ball, servingTeam) {
  ball.vx = 0;
  ball.vy = 0;
  ball.spin = 0;
  ball.topspinAccel = 0;
  ball.active = false;
  ball.lastHitByTeam = servingTeam;
  ball.lastHitById = null;
  ball.lastHitType = 'none';
  ball.isAutoFeed = false;
  ball.trail.length = 0;
  ball.x = servingTeam === 'home' ? COURT.LEFT_X + 68 : COURT.RIGHT_X - 68;
  ball.y = COURT.FLOOR_Y - 108;
}

export function stepBallPhysics(ball, dt) {
  if (!ball.active) return { hitFloor: false, hitNet: false };

  // Save trail point for smash/fast shots
  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > BALL_CFG.TRAIL_LENGTH) {
    ball.trail.shift();
  }

  const prevX = ball.x;
  const prevY = ball.y;

  // Apply gravity + optional serve/smash topspin dip
  ball.vy += (BALL_CFG.GRAVITY + ball.topspinAccel) * dt;
  ball.vx *= Math.pow(BALL_CFG.AIR_DRAG, dt * 60);

  // Clamp max velocity
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > BALL_CFG.MAX_SPEED) {
    const scale = BALL_CFG.MAX_SPEED / speed;
    ball.vx *= scale;
    ball.vy *= scale;
  }

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.angle += ball.spin * dt;

  // Soft ceiling clamp
  if (ball.y - BALL_CFG.RADIUS < COURT.CEILING_Y) {
    ball.y = COURT.CEILING_Y + BALL_CFG.RADIUS;
    if (ball.vy < 0) ball.vy *= -0.35;
  }

  // Stadium side walls (far outside court lines so out-of-bounds still triggers cleanly)
  if (ball.x - BALL_CFG.RADIUS < 16) {
    ball.x = 16 + BALL_CFG.RADIUS;
    ball.vx = Math.abs(ball.vx) * 0.55;
  } else if (ball.x + BALL_CFG.RADIUS > COURT.WIDTH - 16) {
    ball.x = COURT.WIDTH - 16 - BALL_CFG.RADIUS;
    ball.vx = -Math.abs(ball.vx) * 0.55;
  }

  // Net collision check
  let hitNet = false;
  const netLeft = COURT.NET_X - COURT.NET_HALF_W;
  const netRight = COURT.NET_X + COURT.NET_HALF_W;
  const netTop = COURT.NET_TOP_Y;

  if (ball.y + BALL_CFG.RADIUS > netTop && ball.y - BALL_CFG.RADIUS < COURT.FLOOR_Y) {
    // Check top tape collision first
    const dxTop = ball.x - COURT.NET_X;
    const dyTop = ball.y - netTop;
    const distTop = Math.hypot(dxTop, dyTop);
    const topRadius = BALL_CFG.RADIUS + COURT.NET_HALF_W;

    if (distTop < topRadius && prevY <= netTop + 12) {
      hitNet = true;
      const nx = distTop > 0.001 ? dxTop / distTop : 0;
      const ny = distTop > 0.001 ? dyTop / distTop : -1;
      ball.x = COURT.NET_X + nx * (topRadius + 1);
      ball.y = netTop + ny * (topRadius + 1);
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx = (ball.vx - 2 * dot * nx) * 0.65;
        ball.vy = (ball.vy - 2 * dot * ny) * 0.65;
      }
      ball.topspinAccel = 0;
    } else if (ball.x + BALL_CFG.RADIUS > netLeft && ball.x - BALL_CFG.RADIUS < netRight) {
      // Side of net mesh
      hitNet = true;
      if (prevX <= COURT.NET_X) {
        ball.x = netLeft - BALL_CFG.RADIUS - 1;
        ball.vx = -Math.abs(ball.vx) * 0.48;
      } else {
        ball.x = netRight + BALL_CFG.RADIUS + 1;
        ball.vx = Math.abs(ball.vx) * 0.48;
      }
      ball.vy *= 0.8;
      ball.topspinAccel = 0;
    }
  }

  // Floor contact check
  let hitFloor = false;
  if (ball.y + BALL_CFG.RADIUS >= COURT.FLOOR_Y) {
    ball.y = COURT.FLOOR_Y - BALL_CFG.RADIUS;
    hitFloor = true;
  }

  return { hitFloor, hitNet };
}

export function predictBallLandingX(ball) {
  if (!ball.active) return ball.x;
  let x = ball.x;
  let y = ball.y;
  let vx = ball.vx;
  let vy = ball.vy;
  const g = BALL_CFG.GRAVITY + ball.topspinAccel;
  const dt = 1 / 60;
  for (let i = 0; i < 180; i++) {
    vy += g * dt;
    x += vx * dt;
    y += vy * dt;
    if (y + BALL_CFG.RADIUS >= COURT.FLOOR_Y) {
      return x;
    }
  }
  return x;
}
