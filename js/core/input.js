// Unified keyboard + virtual touch input manager with safe pointer capture

export function createInputManager({ joystickEl, knobEl, btnJump, btnSmash, btnReceive, onPauseToggle, onMuteToggle }) {
  const keys = new Set();
  const held = {
    left: false,
    right: false,
    up: false,
    jump: false,
    smash: false,
    receive: false,
  };
  const justPressed = {
    jump: false,
    smash: false,
    receive: false,
    action: false, // unified Spacebar contextual action
  };

  let joyAxisX = 0;
  let joyJumpActive = false;
  let joyPointerId = null;
  let joyOriginX = 0;
  let joyOriginY = 0;
  let maxKnobDist = 34;

  function setJoystickRadius(px) {
    maxKnobDist = Math.max(24, Math.min(48, px));
  }

  function clearAll() {
    keys.clear();
    held.left = false;
    held.right = false;
    held.up = false;
    held.jump = false;
    held.smash = false;
    held.receive = false;
    justPressed.jump = false;
    justPressed.smash = false;
    justPressed.receive = false;
    justPressed.action = false;
    joyAxisX = 0;
    joyJumpActive = false;
    joyPointerId = null;
    if (knobEl) {
      knobEl.style.transform = 'translate(0px, 0px)';
    }
    btnJump?.classList.remove('is-pressed');
    btnSmash?.classList.remove('is-pressed');
    btnReceive?.classList.remove('is-pressed');
  }

  function updateDirectionalState() {
    held.left = keys.has('ArrowLeft') || keys.has('KeyA');
    held.right = keys.has('ArrowRight') || keys.has('KeyD');
    held.up = keys.has('ArrowUp') || keys.has('KeyW');
  }

  function onKeyDown(e) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.repeat) return;

    if (e.code === 'KeyP' || e.code === 'Escape') {
      onPauseToggle?.();
      return;
    }
    if (e.code === 'KeyM') {
      onMuteToggle?.();
      return;
    }

    keys.add(e.code);
    updateDirectionalState();

    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      held.jump = true;
      justPressed.jump = true;
    }
    if (e.code === 'Space') {
      justPressed.action = true;
      held.smash = true;
      held.receive = true;
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      held.receive = true;
      justPressed.receive = true;
    }
  }

  function onKeyUp(e) {
    keys.delete(e.code);
    updateDirectionalState();

    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      held.jump = false;
    }
    if (e.code === 'Space') {
      held.smash = false;
      held.receive = false;
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      held.receive = false;
    }
  }

  function safeSetPointerCapture(el, pointerId) {
    try {
      if (el?.setPointerCapture && pointerId !== undefined) {
        el.setPointerCapture(pointerId);
      }
    } catch {
      // Ignore synthetic or non-active pointerId errors
    }
  }

  function onJoyDown(e) {
    e.preventDefault();
    if (joyPointerId !== null) return;
    joyPointerId = e.pointerId;
    safeSetPointerCapture(joystickEl, e.pointerId);
    const rect = joystickEl.getBoundingClientRect();
    joyOriginX = rect.left + rect.width / 2;
    joyOriginY = rect.top + rect.height / 2;
    updateJoystick(e.clientX, e.clientY);
  }

  function onJoyMove(e) {
    if (e.pointerId !== joyPointerId) return;
    e.preventDefault();
    updateJoystick(e.clientX, e.clientY);
  }

  function onJoyUp(e) {
    if (e.pointerId !== joyPointerId) return;
    e.preventDefault();
    joyPointerId = null;
    joyAxisX = 0;
    joyJumpActive = false;
    if (knobEl) {
      knobEl.style.transform = 'translate(0px, 0px)';
    }
  }

  function updateJoystick(clientX, clientY) {
    const dx = clientX - joyOriginX;
    const dy = clientY - joyOriginY;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxKnobDist);
    const angle = Math.atan2(dy, dx);
    const kx = dist > 0 ? Math.cos(angle) * clampedDist : 0;
    const ky = dist > 0 ? Math.sin(angle) * clampedDist : 0;

    if (knobEl) {
      knobEl.style.transform = `translate(${kx.toFixed(1)}px, ${ky.toFixed(1)}px)`;
    }

    const normX = kx / maxKnobDist;
    joyAxisX = Math.abs(normX) < 0.16 ? 0 : normX;

    const normY = ky / maxKnobDist;
    if (normY < -0.68 && !joyJumpActive) {
      joyJumpActive = true;
      justPressed.jump = true;
      held.jump = true;
    } else if (normY >= -0.45 && joyJumpActive) {
      joyJumpActive = false;
      held.jump = false;
    }
  }

  function bindTouchButton(btn, keyName) {
    if (!btn) return;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      safeSetPointerCapture(btn, e.pointerId);
      btn.classList.add('is-pressed');
      held[keyName] = true;
      justPressed[keyName] = true;
    });
    const release = (e) => {
      e.preventDefault();
      btn.classList.remove('is-pressed');
      held[keyName] = false;
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', () => {
      btn.classList.remove('is-pressed');
      held[keyName] = false;
    });
  }

  function preventTouchDefaults(e) {
    if (e.target && (e.target.closest?.('button') || e.target.closest?.('#touch-joystick'))) {
      e.preventDefault();
    }
  }

  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearAll();
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('touchmove', preventTouchDefaults, { passive: false });

  if (joystickEl) {
    joystickEl.addEventListener('pointerdown', onJoyDown);
    joystickEl.addEventListener('pointermove', onJoyMove);
    joystickEl.addEventListener('pointerup', onJoyUp);
    joystickEl.addEventListener('pointercancel', onJoyUp);
    joystickEl.addEventListener('lostpointercapture', () => {
      joyPointerId = null;
      joyAxisX = 0;
      joyJumpActive = false;
      if (knobEl) knobEl.style.transform = 'translate(0px, 0px)';
    });
  }

  bindTouchButton(btnJump, 'jump');
  bindTouchButton(btnSmash, 'smash');
  bindTouchButton(btnReceive, 'receive');

  return {
    snapshot() {
      let moveX = joyAxisX;
      if (held.left && !held.right) moveX = -1;
      else if (held.right && !held.left) moveX = 1;

      const snap = {
        moveX,
        jumpPressed: justPressed.jump,
        jumpHeld: held.jump || held.up,
        smashPressed: justPressed.smash,
        receivePressed: justPressed.receive,
        actionPressed: justPressed.action,
      };
      justPressed.jump = false;
      justPressed.smash = false;
      justPressed.receive = false;
      justPressed.action = false;
      return snap;
    },
    setJoystickRadius,
    clearAll,
    hasTouchHardware() {
      return (
        'ontouchstart' in window ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
        window.matchMedia('(pointer: coarse)').matches
      );
    },
  };
}
