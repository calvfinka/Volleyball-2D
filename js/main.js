// Application bootstrap: wires core services, screens, and 60fps loop

import { loadSave, updateSettings } from './core/save.js';
import { audio } from './core/audio.js';
import { createGameLoop } from './core/loop.js';
import { createInputManager } from './core/input.js';
import { createScreenManager } from './core/screen.js';
import { createRenderer } from './game/renderer.js';
import { createMenuScreen } from './screen/menu.js';
import { createSettingsScreen } from './screen/settings.js';
import { createMatchScreen } from './screen/match.js';

function init() {
  const canvas = document.getElementById('game-canvas');
  let saveState = loadSave();
  audio.setMuted(!saveState.settings.soundEnabled);

  const screenManager = createScreenManager();
  const renderer = createRenderer(canvas);

  let matchScreen = null;
  let menuScreen = null;
  let settingsScreen = null;

  const unlockOnce = () => {
    audio.unlock();
    window.removeEventListener('pointerdown', unlockOnce);
    window.removeEventListener('keydown', unlockOnce);
  };
  window.addEventListener('pointerdown', unlockOnce, { passive: true });
  window.addEventListener('keydown', unlockOnce, { passive: true });

  const input = createInputManager({
    joystickEl: document.getElementById('touch-joystick'),
    knobEl: document.getElementById('joystick-knob'),
    btnJump: document.getElementById('touch-btn-jump'),
    btnSmash: document.getElementById('touch-btn-smash'),
    btnReceive: document.getElementById('touch-btn-receive'),
    onPauseToggle: () => matchScreen?.togglePause(),
    onMuteToggle: () => {
      const nextSound = audio.isMuted();
      audio.setMuted(!nextSound);
      saveState = updateSettings({ soundEnabled: nextSound });
      settingsScreen?.syncUI(saveState);
      matchScreen?.syncMuteButton();
    },
  });

  function launchMatch() {
    screenManager.tryLockLandscape();
    matchScreen.startMatch(saveState.settings);
  }

  menuScreen = createMenuScreen({
    onPlay: launchMatch,
    onOpenSettings: () => {
      settingsScreen.syncUI(saveState);
      screenManager.showScreen('settings');
    },
  });

  settingsScreen = createSettingsScreen({
    onBack: () => screenManager.showScreen('menu'),
    onSaveChanged: (updated) => {
      saveState = updated;
      audio.setMuted(!saveState.settings.soundEnabled);
      menuScreen.updateRecord(saveState);
      matchScreen?.applyTouchVisibility(saveState.settings.touchMode);
      matchScreen?.syncMuteButton();
    },
  });

  matchScreen = createMatchScreen({
    screenManager,
    input,
    audio,
    onReturnToMenu: () => {
      menuScreen.updateRecord(loadSave());
      screenManager.showScreen('menu');
    },
    onRecordUpdated: (updated) => {
      saveState = updated;
      menuScreen.updateRecord(saveState);
    },
  });

  menuScreen.updateRecord(saveState);
  settingsScreen.syncUI(saveState);

  // Title keyboard shortcut (Enter / Space starts match when on title screen)
  window.addEventListener('keydown', (e) => {
    if (screenManager.getCurrentScreen() === 'menu' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      launchMatch();
    }
  });

  // Responsive canvas sizing
  window.addEventListener('resize', () => renderer.resize());
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => renderer.resize()).observe(document.getElementById('app'));
  }

  // Main 60 FPS loop
  const loop = createGameLoop((dt, nowMs) => {
    if (screenManager.getCurrentScreen() === 'match') {
      matchScreen.step(dt);
      renderer.render(matchScreen.getMatchState(), nowMs / 1000);
    } else {
      renderer.render(null, nowMs / 1000);
    }
  });
  loop.start();

  // Support ?autostart=1 for automated testing and quick launch
  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') {
    matchScreen.startMatch(saveState.settings);
  } else {
    screenManager.showScreen('menu');
  }
}

init();
