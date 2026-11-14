// Canvas 2D renderer for Volleyball 2D (1280x720 logical space scaled cleanly with DPR & cached background)

import { COURT, BALL_CFG } from './ball.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = COURT.WIDTH;
  bgCanvas.height = COURT.HEIGHT;
  const bgCtx = bgCanvas.getContext('2d', { alpha: false });

  let viewW = 1280;
  let viewH = 720;
  let dpr = 1;
  let cachedSkyGrad = null;
  let cachedScale = 1;
  let cachedOffsetX = 0;
  let cachedOffsetY = 0;

  buildStaticBackdrop(bgCtx);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    viewW = Math.max(320, rect.width || window.innerWidth);
    viewH = Math.max(200, rect.height || window.innerHeight);
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);

    cachedScale = Math.min(viewW / COURT.WIDTH, viewH / COURT.HEIGHT);
    cachedOffsetX = (viewW - COURT.WIDTH * cachedScale) * 0.5;
    cachedOffsetY = (viewH - COURT.HEIGHT * cachedScale) * 0.5;

    const floorScreenY = Math.max(1, cachedOffsetY + COURT.FLOOR_Y * cachedScale);
    cachedSkyGrad = ctx.createLinearGradient(0, 0, 0, floorScreenY);
    cachedSkyGrad.addColorStop(0, '#CBE6F5');
    cachedSkyGrad.addColorStop(0.65, '#F5E9D3');
    cachedSkyGrad.addColorStop(1, '#E6D6BA');
  }

  function render(match, timeSec = 0) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scale = cachedScale;
    const offsetX = cachedOffsetX;
    const offsetY = cachedOffsetY;

    // Seamless sky & apron extension only on outer wings (avoids full-screen overdraw)
    drawWideArenaExtensions(ctx, viewW, viewH, offsetX, offsetY, scale, cachedSkyGrad);

    // Apply micro camera trauma shake
    const shakeMag = match ? match.cameraShake * match.cameraShake * 11 : 0;
    const shakeX = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;
    const shakeY = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;

    ctx.save();
    ctx.translate(offsetX + shakeX, offsetY + shakeY);
    ctx.scale(scale, scale);

    // 1. Blit pre-rendered static gymnasium/coastal court backdrop (fast 60fps mobile perf!)
    ctx.drawImage(bgCanvas, 0, 0);

    if (match) {
      // 2. Ground shadows for all 4 players & ball
      for (const p of [...match.homePlayers, ...match.awayPlayers]) {
        drawPlayerShadow(ctx, p);
      }
      drawBallShadow(ctx, match.ball);

      // 3. Auto-feed smash timing ring when ball enters player's strike zone
      const human = match.homePlayers[0];
      if (match.phase === 'rally' && match.ball.active && match.ball.x < COURT.NET_X && match.ball.y < COURT.FLOOR_Y - 110) {
        drawSmashTimingRing(ctx, match.ball, human, timeSec);
      }

      // 4. Touch count indicator pips above active side
      if (match.phase === 'rally' && match.possessionSide && match.sideTouches > 0) {
        drawTouchCounter(ctx, match.possessionSide, match.sideTouches);
      }

      // 5. Players (drawn back-to-front slightly, articulated from scratch)
      for (const p of [match.homePlayers[1], match.awayPlayers[1], match.homePlayers[0], match.awayPlayers[0]]) {
        drawPlayer(ctx, p, p.id === human.id);
      }

      // 6. Net (drawn over back players / behind foreground ball when in front)
      drawNet(ctx);

      // 7. Ball & smash motion trail
      drawBallTrail(ctx, match.ball);
      drawBall(ctx, match.ball);

      // 8. Pooled particles
      drawParticles(ctx, match.particles);

      // 9. Floating timing / block / auto-feed callout
      if (match.timingFeedback.timer > 0 && match.timingFeedback.text) {
        drawFloatingFeedback(ctx, match.timingFeedback);
      }
    } else {
      // Idle menu backdrop animation
      drawNet(ctx);
      const idleBall = {
        x: 640 + Math.sin(timeSec * 1.4) * 220,
        y: 260 + Math.abs(Math.sin(timeSec * 2.8)) * -95,
        angle: timeSec * 2.5,
        lastHitType: 'set',
      };
      drawBallShadow(ctx, idleBall);
      drawBall(ctx, idleBall);
    }

    ctx.restore();
  }

  resize();

  return {
    resize,
    render,
  };
}

function drawWideArenaExtensions(ctx, viewW, viewH, offsetX, offsetY, scale, skyGrad) {
  const courtRight = offsetX + COURT.WIDTH * scale;
  if (offsetX <= 0.5 && offsetY <= 0.5) return;

  const floorScreenY = offsetY + COURT.FLOOR_Y * scale;
  const horizonY = offsetY + 440 * scale;
  const bleacherY = offsetY + 500 * scale;
  const band1Y = offsetY + 535 * scale;
  const band2Y = offsetY + 575 * scale;
  const wallY = offsetY + 588 * scale;

  const paintBands = (x, w) => {
    if (w <= 0) return;
    ctx.fillStyle = skyGrad || '#E6D6BA';
    ctx.fillRect(x, 0, w, horizonY);
    ctx.fillStyle = '#8FB7C7';
    ctx.fillRect(x, horizonY, w, bleacherY - horizonY + 1);
    ctx.fillStyle = '#C9B79C';
    ctx.fillRect(x, bleacherY, w, floorScreenY - bleacherY + 1);
    ctx.fillStyle = '#B7A283';
    ctx.fillRect(x, band1Y, w, 22 * scale);
    ctx.fillRect(x, band2Y, w, 24 * scale);
    ctx.fillStyle = '#18293E';
    ctx.fillRect(x, wallY, w, floorScreenY - wallY + 1);
    ctx.fillStyle = '#1D4D58';
    ctx.fillRect(x, floorScreenY, w, viewH - floorScreenY);
  };

  if (offsetX > 0.5) {
    paintBands(0, Math.ceil(offsetX) + 1);
    paintBands(Math.floor(courtRight), Math.ceil(viewW - courtRight) + 1);
  }
  if (offsetY > 0.5) {
    ctx.fillStyle = skyGrad || '#CBE6F5';
    ctx.fillRect(0, 0, viewW, Math.ceil(offsetY) + 1);
  }
  const courtBottom = offsetY + COURT.HEIGHT * scale;
  if (viewH - courtBottom > 0.5) {
    ctx.fillStyle = '#1D4D58';
    ctx.fillRect(0, Math.floor(courtBottom), viewW, Math.ceil(viewH - courtBottom) + 1);
  }
}

function buildStaticBackdrop(ctx) {
  // Sunlit coastal gymnasium sky / clerestory
  const skyGrad = ctx.createLinearGradient(0, 0, 0, COURT.FLOOR_Y);
  skyGrad.addColorStop(0, '#CBE6F5');
  skyGrad.addColorStop(0.55, '#F5E9D3');
  skyGrad.addColorStop(1, '#E5D3B3');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, COURT.WIDTH, COURT.FLOOR_Y);

  // Subtle architectural stadium trusses in ceiling
  ctx.strokeStyle = 'rgba(24, 41, 62, 0.08)';
  ctx.lineWidth = 4;
  for (let x = 80; x < COURT.WIDTH; x += 220) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 110, 68);
    ctx.lineTo(x + 220, 0);
    ctx.stroke();
  }

  // Distant coastal horizon & bleachers
  ctx.fillStyle = '#8FB7C7';
  ctx.fillRect(0, 440, COURT.WIDTH, 70);

  // Bleacher tiers
  ctx.fillStyle = '#C9B79C';
  ctx.fillRect(0, 500, COURT.WIDTH, 120);
  ctx.fillStyle = '#B7A283';
  ctx.fillRect(0, 535, COURT.WIDTH, 22);
  ctx.fillRect(0, 575, COURT.WIDTH, 24);

  // Advertising / court perimeter boards
  ctx.fillStyle = '#18293E';
  ctx.fillRect(36, 588, COURT.WIDTH - 72, 32);
  ctx.fillStyle = '#E84A27';
  ctx.fillRect(54, 594, 180, 20);
  ctx.fillStyle = '#0E7C7B';
  ctx.fillRect(1046, 594, 180, 20);

  // Floor apron (deep teal-slate)
  ctx.fillStyle = '#1D4D58';
  ctx.fillRect(0, COURT.FLOOR_Y, COURT.WIDTH, COURT.HEIGHT - COURT.FLOOR_Y);

  // Main Playing Court Surface (warm sunlit maple/terracotta)
  ctx.fillStyle = '#E69A52';
  ctx.fillRect(COURT.LEFT_X, COURT.FLOOR_Y, COURT.RIGHT_X - COURT.LEFT_X, 46);

  // Subtle perspective court depth shading
  ctx.fillStyle = 'rgba(24, 41, 62, 0.14)';
  ctx.fillRect(COURT.LEFT_X, COURT.FLOOR_Y + 46, COURT.RIGHT_X - COURT.LEFT_X, 12);

  // Crisp White Court Lines
  ctx.fillStyle = '#FFFDF8';
  ctx.fillRect(COURT.LEFT_X - 4, COURT.FLOOR_Y, 6, 46); // Left baseline
  ctx.fillRect(COURT.RIGHT_X - 2, COURT.FLOOR_Y, 6, 46); // Right baseline
  ctx.fillRect(COURT.NET_X - 3, COURT.FLOOR_Y, 6, 46); // Center line
  // 3-meter attack lines
  ctx.fillStyle = 'rgba(255, 253, 248, 0.65)';
  ctx.fillRect(COURT.NET_X - 180, COURT.FLOOR_Y, 4, 46);
  ctx.fillRect(COURT.NET_X + 176, COURT.FLOOR_Y, 4, 46);
  // Top baseline edge
  ctx.fillStyle = '#FFFDF8';
  ctx.fillRect(COURT.LEFT_X - 4, COURT.FLOOR_Y, COURT.RIGHT_X - COURT.LEFT_X + 8, 5);
}

function drawNet(ctx) {
  const nx = COURT.NET_X;
  const topY = COURT.NET_TOP_Y;
  const meshBottom = topY + 128;

  // Center pole
  ctx.fillStyle = '#243447';
  ctx.fillRect(nx - 4, topY - 12, 8, COURT.FLOOR_Y - topY + 18);

  // Net mesh shadow & grid lines
  ctx.fillStyle = 'rgba(24, 41, 62, 0.24)';
  ctx.fillRect(nx - 6, topY + 14, 12, meshBottom - topY - 14);

  ctx.strokeStyle = 'rgba(255, 253, 248, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let y = topY + 22; y < meshBottom; y += 16) {
    ctx.moveTo(nx - 6, y);
    ctx.lineTo(nx + 6, y);
  }
  ctx.stroke();

  // Crisp white top tape
  ctx.fillStyle = '#FFFDF8';
  ctx.fillRect(nx - 8, topY, 16, 16);
  ctx.strokeStyle = '#18293E';
  ctx.lineWidth = 2;
  ctx.strokeRect(nx - 8, topY, 16, 16);

  // Antenna tip
  ctx.fillStyle = '#E84A27';
  ctx.fillRect(nx - 2, topY - 34, 4, 34);
  ctx.fillStyle = '#FFFDF8';
  ctx.fillRect(nx - 2, topY - 24, 4, 8);
}

function drawPlayerShadow(ctx, p) {
  const heightAboveFloor = Math.max(0, COURT.FLOOR_Y - p.y);
  const scale = Math.max(0.4, 1 - heightAboveFloor / 260);
  ctx.fillStyle = `rgba(17, 29, 44, ${0.26 * scale})`;
  ctx.beginPath();
  ctx.ellipse(p.x, COURT.FLOOR_Y + 12, 26 * scale, 7 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBallShadow(ctx, ball) {
  const heightAboveFloor = Math.max(0, COURT.FLOOR_Y - ball.y);
  const scale = Math.max(0.28, 1 - heightAboveFloor / 520);
  ctx.fillStyle = `rgba(17, 29, 44, ${0.25 * scale})`;
  ctx.beginPath();
  ctx.ellipse(ball.x, COURT.FLOOR_Y + 12, 20 * scale, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, p, isControlled) {
  const isHome = p.teamId === 'home';
  const jerseyColor = isHome ? (p.slotIndex === 0 ? '#E84A27' : '#F4845F') : (p.slotIndex === 0 ? '#0E7C7B' : '#2A9D8F');
  const shortsColor = '#18293E';

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.scaleX, p.scaleY);

  // Controlled player subtle floor ring marker
  if (isControlled && p.onGround) {
    ctx.strokeStyle = '#F29F05';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 8, 22, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Slight forward lean while running or smashing
  const lean = p.pose === 'smash' ? p.facing * 0.16 : p.vx * 0.00035;
  ctx.rotate(lean);

  // Legs (animated stride)
  const stride = p.pose === 'run' ? Math.sin(p.stridePhase) * 12 : 0;
  const kneeBend = !p.onGround ? -6 : 0;
  ctx.lineCap = 'round';
  ctx.lineWidth = 9;
  ctx.strokeStyle = p.skinColor;

  // Back leg
  ctx.beginPath();
  ctx.moveTo(-6, -34);
  ctx.lineTo(-8 - stride, -16 + kneeBend);
  ctx.lineTo(-10 - stride * 1.1, -3 + kneeBend);
  ctx.stroke();

  // Front leg
  ctx.beginPath();
  ctx.moveTo(6, -34);
  ctx.lineTo(8 + stride, -16 + kneeBend);
  ctx.lineTo(10 + stride * 1.1, -3 + kneeBend);
  ctx.stroke();

  // Athletic shoes
  ctx.fillStyle = '#FFFDF8';
  ctx.fillRect(-15 - stride * 1.1, -6 + kneeBend, 14, 7);
  ctx.fillRect(3 + stride * 1.1, -6 + kneeBend, 14, 7);

  // Shorts
  ctx.fillStyle = shortsColor;
  ctx.beginPath();
  ctx.roundRect(-15, -44, 30, 16, 4);
  ctx.fill();

  // Torso / Jersey
  ctx.fillStyle = p.hitFlash > 0 ? '#FFFDF8' : jerseyColor;
  ctx.beginPath();
  ctx.roundRect(-16, -74, 32, 34, 7);
  ctx.fill();
  ctx.strokeStyle = '#18293E';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Jersey Number
  ctx.fillStyle = '#FFFDF8';
  ctx.font = '900 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(p.number), 0, -56);

  // Head
  ctx.fillStyle = p.skinColor;
  ctx.beginPath();
  ctx.arc(0, -86, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#18293E';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Expressive Eyes facing direction
  ctx.fillStyle = '#18293E';
  ctx.beginPath();
  ctx.arc(p.facing * 5, -87, 2.1, 0, Math.PI * 2);
  ctx.fill();

  // Distinct Hair / Headband silhouettes
  ctx.fillStyle = p.hairColor;
  if (p.hairStyle === 'spiky') {
    ctx.beginPath();
    ctx.moveTo(-12, -90);
    ctx.lineTo(-6, -104);
    ctx.lineTo(2, -98);
    ctx.lineTo(9, -104);
    ctx.lineTo(13, -89);
    ctx.closePath();
    ctx.fill();
    // Headband
    ctx.fillStyle = '#F29F05';
    ctx.fillRect(-13, -93, 26, 4);
  } else if (p.hairStyle === 'ponytail') {
    ctx.beginPath();
    ctx.arc(0, -90, 13, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-p.facing * 14, -85, 6, 10, p.facing * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.hairStyle === 'sweep') {
    ctx.beginPath();
    ctx.moveTo(-13, -88);
    ctx.quadraticCurveTo(0, -106, 14, -90);
    ctx.lineTo(10, -96);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, -89, 13.5, Math.PI * 0.9, Math.PI * 0.1);
    ctx.fill();
  }

  // Articulated Arms anchored at shoulders so jersey numbers stay crisp & legible
  ctx.strokeStyle = p.skinColor;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();

  if (p.pose === 'receive') {
    // Classic joined-forearm bump platform extended forward
    ctx.moveTo(p.facing * 12, -62);
    ctx.lineTo(p.facing * 30, -48);
  } else if (p.pose === 'set') {
    // Two hands overhead
    ctx.moveTo(-12, -68);
    ctx.lineTo(-6, -98);
    ctx.moveTo(12, -68);
    ctx.lineTo(6, -98);
  } else if (p.pose === 'smash' || p.pose === 'serve') {
    // Dynamic high-arc spike swing
    ctx.moveTo(p.facing * 12, -68);
    ctx.lineTo(p.facing * 24, -96);
  } else if (p.pose === 'block') {
    // Wall block hands high above net
    ctx.moveTo(-10, -68);
    ctx.lineTo(p.facing * 8, -108);
    ctx.moveTo(10, -68);
    ctx.lineTo(p.facing * 14, -108);
  } else if (!p.onGround) {
    // Airborne ready arms
    ctx.moveTo(-13, -68);
    ctx.lineTo(-20, -86);
    ctx.moveTo(13, -68);
    ctx.lineTo(22, -88);
  } else {
    // Athletic ready stance clear of chest number
    ctx.moveTo(-13, -66);
    ctx.lineTo(-19, -48);
    ctx.moveTo(13, -66);
    ctx.lineTo(p.facing * 24, -52);
  }
  ctx.stroke();

  ctx.restore();
}

function drawSmashTimingRing(ctx, ball, human, timeSec) {
  const handY = human.y - 86;
  const dist = Math.hypot(ball.x - human.x, ball.y - handY);
  if (dist > 180) return;

  const isSweetSpot = Math.abs(ball.y - handY) <= 40 && !human.onGround;
  const pulse = 1 + Math.sin(timeSec * 12) * 0.08;
  const ringRadius = (BALL_CFG.RADIUS + 14) * pulse;

  ctx.save();
  ctx.strokeStyle = isSweetSpot ? '#F29F05' : 'rgba(255, 253, 248, 0.72)';
  ctx.lineWidth = isSweetSpot ? 3.5 : 2;
  ctx.setLineDash(isSweetSpot ? [] : [6, 5]);
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ringRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTouchCounter(ctx, side, touches) {
  const baseX = side === 'home' ? 360 : 920;
  const y = 112;
  ctx.save();
  for (let i = 1; i <= 3; i++) {
    const cx = baseX + (i - 2) * 20;
    ctx.beginPath();
    ctx.arc(cx, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = i <= touches ? (side === 'home' ? '#E84A27' : '#0E7C7B') : 'rgba(24, 41, 62, 0.22)';
    ctx.fill();
    ctx.strokeStyle = '#FFFDF8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawBallTrail(ctx, ball) {
  if (!ball.trail || ball.trail.length < 2) return;
  const isSmash = ball.lastHitType === 'smash';
  if (!isSmash && !ball.isAutoFeed) return;

  const color = isSmash ? '232, 74, 39' : '242, 159, 5';
  for (let i = 0; i < ball.trail.length; i++) {
    const pt = ball.trail[i];
    const ratio = (i + 1) / ball.trail.length;
    ctx.fillStyle = `rgba(${color}, ${ratio * (isSmash ? 0.34 : 0.18)})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, BALL_CFG.RADIUS * ratio * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBall(ctx, ball) {
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.angle);

  // Cream base sphere
  ctx.fillStyle = '#FFFDF8';
  ctx.beginPath();
  ctx.arc(0, 0, BALL_CFG.RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // Classic 3-stripe curved athletic volleyball panels
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, BALL_CFG.RADIUS, 0, Math.PI * 2);
  ctx.clip();

  ctx.strokeStyle = '#18293E';
  ctx.lineWidth = 2.6;

  // Gold & Coral panel accents
  ctx.fillStyle = '#F29F05';
  ctx.beginPath();
  ctx.moveTo(-20, -6);
  ctx.quadraticCurveTo(0, -18, 20, -4);
  ctx.quadraticCurveTo(0, -4, -20, -6);
  ctx.fill();

  ctx.fillStyle = '#E84A27';
  ctx.beginPath();
  ctx.moveTo(-18, 8);
  ctx.quadraticCurveTo(2, -2, 18, 10);
  ctx.quadraticCurveTo(0, 20, -18, 8);
  ctx.fill();

  // Seam lines
  ctx.beginPath();
  ctx.moveTo(-20, -5);
  ctx.quadraticCurveTo(0, -14, 20, -3);
  ctx.moveTo(-18, 9);
  ctx.quadraticCurveTo(0, -1, 18, 10);
  ctx.moveTo(0, -20);
  ctx.quadraticCurveTo(-6, 0, 2, 20);
  ctx.stroke();

  ctx.restore();

  // Crisp outer stroke
  ctx.strokeStyle = '#18293E';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, BALL_CFG.RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawParticles(ctx, pool) {
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    if (!p.active) continue;
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloatingFeedback(ctx, fb) {
  const alpha = Math.min(1, fb.timer * 2.2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '900 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#18293E';
  ctx.strokeText(fb.text, fb.x, fb.y);
  ctx.fillStyle = fb.color;
  ctx.fillText(fb.text, fb.x, fb.y);
  ctx.restore();
}
