// 60 FPS requestAnimationFrame loop with clamped delta time

export function createGameLoop(onFrame) {
  let rafId = 0;
  let running = false;
  let lastTime = 0;

  function tick(now) {
    if (!running) return;
    const rawDt = lastTime ? (now - lastTime) / 1000 : 1 / 60;
    lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    onFrame(dt, now);
    rafId = window.requestAnimationFrame(tick);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = 0;
      rafId = window.requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    },
  };
}
