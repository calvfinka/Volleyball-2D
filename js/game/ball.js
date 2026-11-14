// Pure ball physics module with gravity, proportional air drag, and Magnus spin effect (no DOM dependencies)

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
  AIR_DRAG_K: 0.00016,  // proportional to speed: a_drag = -k * speed * v
  MAGNUS_K: 0.022,      // perpendicular spin force coefficient
  SPIN_DECAY: 0.65,     // exponential spin decay rate (1/s)
  MAX_SPEED: 1360,
  TRAIL_LENGTH: 10,
};

export function createBall() {
  return {
    x: 62,
    y: 520,
    vx: 0,
    vy: 0,
    spin: 0,
    angle: 0,
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
  ball.active = false;
  ball.lastHitByTeam = servingTeam;
  ball.lastHitById = null;
  ball.lastHitType = 'none';
  ball.isAutoFeed = false;
  ball.trail.length = 0;
  ball.x = servingTeam === 'home' ? COURT.LEFT_X - 24 : COURT.RIGHT_X + 24;
  ball.y = COURT.FLOOR_Y - 104;
}

export function stepBallPhysics(ball, dt) {
  if (!ball.active) return { hitFloor: false, hitNet: false };

  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > BALL_CFG.TRAIL_LENGTH) {
    ball.trail.shift();
  }

  const prevX = ball.x;
  const prevY = ball.y;

  // Speed-proportional air drag + Magnus spin force
  const speed = Math.hypot(ball.vx, ball.vy);
  const dragFactor = BALL_CFG.AIR_DRAG_K * speed;
  const axDrag = -dragFactor * ball.vx;
  const ayDrag = -dragFactor * ball.vy;

  const axMagnus = -ball.spin * ball.vy * BALL_CFG.MAGNUS_K * 0.35;
  const ayMagnus = ball.spin * ball.vx * BALL_CFG.MAGNUS_K;

  ball.vx += (axDrag + axMagnus) * dt;
  ball.vy += (BALL_CFG.GRAVITY + ayDrag + ayMagnus) * dt;

  // Spin decays gradually in flight
  ball.spin *= Math.exp(-BALL_CFG.SPIN_DECAY * dt);
  if (Math.abs(ball.spin) < 0.05) ball.spin = 0;

  // Clamp max speed
  const nextSpeed = Math.hypot(ball.vx, ball.vy);
  if (nextSpeed > BALL_CFG.MAX_SPEED) {
    const scale = BALL_CFG.MAX_SPEED / nextSpeed;
    ball.vx *= scale;
    ball.vy *= scale;
  }

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.angle += (ball.spin || ball.vx * 0.012) * dt;

  // Soft ceiling clamp
  if (ball.y - BALL_CFG.RADIUS < COURT.CEILING_Y) {
    ball.y = COURT.CEILING_Y + BALL_CFG.RADIUS;
    if (ball.vy < 0) ball.vy *= -0.35;
  }

  // Far outer stadium bounds
  if (ball.x - BALL_CFG.RADIUS < 12) {
    ball.x = 12 + BALL_CFG.RADIUS;
    ball.vx = Math.abs(ball.vx) * 0.5;
  } else if (ball.x + BALL_CFG.RADIUS > COURT.WIDTH - 12) {
    ball.x = COURT.WIDTH - 12 - BALL_CFG.RADIUS;
    ball.vx = -Math.abs(ball.vx) * 0.5;
  }

  // Net collision check
  let hitNet = false;
  const netLeft = COURT.NET_X - COURT.NET_HALF_W;
  const netRight = COURT.NET_X + COURT.NET_HALF_W;
  const netTop = COURT.NET_TOP_Y;

  if (ball.y + BALL_CFG.RADIUS > netTop && ball.y - BALL_CFG.RADIUS < COURT.FLOOR_Y) {
    const dxTop = ball.x - COURT.NET_X;
    const dyTop = ball.y - netTop;
    const distTop = Math.hypot(dxTop, dyTop);
    const topRadius = BALL_CFG.RADIUS + COURT.NET_HALF_W;

    if (distTop < topRadius && prevY <= netTop + 14) {
      hitNet = true;
      const nx = distTop > 0.001 ? dxTop / distTop : 0;
      const ny = distTop > 0.001 ? dyTop / distTop : -1;
      ball.x = COURT.NET_X + nx * (topRadius + 1);
      ball.y = netTop + ny * (topRadius + 1);
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx = (ball.vx - 2 * dot * nx) * 0.6;
        ball.vy = (ball.vy - 2 * dot * ny) * 0.6;
      }
      ball.spin *= 0.4;
    } else if (ball.x + BALL_CFG.RADIUS > netLeft && ball.x - BALL_CFG.RADIUS < netRight) {
      hitNet = true;
      if (prevX <= COURT.NET_X) {
        ball.x = netLeft - BALL_CFG.RADIUS - 1;
        ball.vx = -Math.abs(ball.vx) * 0.45;
      } else {
        ball.x = netRight + BALL_CFG.RADIUS + 1;
        ball.vx = Math.abs(ball.vx) * 0.45;
      }
      ball.vy *= 0.75;
      ball.spin *= 0.4;
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
  let spin = ball.spin;
  const dt = 1 / 60;
  for (let i = 0; i < 160; i++) {
    const speed = Math.hypot(vx, vy);
    const drag = BALL_CFG.AIR_DRAG_K * speed;
    vx += (-drag * vx - spin * vy * BALL_CFG.MAGNUS_K * 0.35) * dt;
    vy += (BALL_CFG.GRAVITY - drag * vy + spin * vx * BALL_CFG.MAGNUS_K) * dt;
    spin *= Math.exp(-BALL_CFG.SPIN_DECAY * dt);
    x += vx * dt;
    y += vy * dt;
    if (y + BALL_CFG.RADIUS >= COURT.FLOOR_Y) {
      return x;
    }
  }
  return x;
}
