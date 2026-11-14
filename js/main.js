// Application bootstrap: wires core services, structured screens, onboarding, and 60fps loop

import { loadSave, updateSettings, setOnboardingSeen } from './core/save.js';
import { audio } from './core/audio.js';
import { createGameLoop } from './core/loop.js';
import { createInputManager } from './core/input.js';
import { createScreenManager } from './core/screen.js';
import { createRenderer } from './game/renderer.js';
import { createMenuScreen } from './screen/menu.js';
import { createSettingsScreen } from './screen/settings.js';
import { createRecordsScreen } from './screen/records.js';
import { createOnboardingScreen } from './screen/onboarding.js';
import { createMatchScreen } from './screen/match.js';

function init() {
  const canvas = document.getElementById('game-canvas');
  let saveState = loadSave();
  audio.setMuted(!saveState.settings.soundEnabled);
  audio.setVolume(saveState.settings.volume ?? 0.8);

  const screenManager = createScreenManager();
  const renderer = createRenderer(canvas);

  let matchScreen = null;
  let menuScreen = null;
  let settingsScreen = null;
  let recordsScreen = null;
  let onboardingScreen = null;
  let settingsReturnTarget = 'menu';

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
    onPauseToggle: () => {
      if (onboardingScreen?.isActive()) return;
      matchScreen?.togglePause();
    },
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
    onboardingScreen?.hide();
    matchScreen.applyControlsSettings(saveState.settings, false);
    matchScreen.startMatch(saveState.settings);
  }

  function launchOnboardingTutorial() {
    screenManager.tryLockLandscape();
    matchScreen.startMatch(saveState.settings, { practiceMode: true, silentWhistle: true });
    // Ensure touch controls are visible during tutorial so all highlighted buttons are shown
    matchScreen.applyControlsSettings(saveState.settings, true);
    onboardingScreen.start();
  }

  onboardingScreen = createOnboardingScreen({
    onComplete: ({ startRealMatch }) => {
      saveState = setOnboardingSeen(true);
      matchScreen.applyControlsSettings(saveState.settings, false);
      if (startRealMatch) {
        matchScreen.startMatch(saveState.settings);
      }
    },
  });

  menuScreen = createMenuScreen({
    onPlay: launchMatch,
    onHowToPlay: launchOnboardingTutorial,
    onOpenSettings: () => {
      settingsReturnTarget = 'menu';
      settingsScreen.syncUI(saveState);
      screenManager.showScreen('settings');
    },
    onOpenRecords: () => {
      saveState = loadSave();
      recordsScreen.render(saveState);
      screenManager.showScreen('records');
    },
  });

  recordsScreen = createRecordsScreen({
    onBack: () => {
      menuScreen.updateRecord(loadSave());
      screenManager.showScreen('menu');
    },
  });

  settingsScreen = createSettingsScreen({
    onBack: () => {
      if (settingsReturnTarget === 'pause' && matchScreen?.getMatchState()) {
        matchScreen.applyControlsSettings(saveState.settings, false);
        matchScreen.showPauseModal();
      } else {
        menuScreen.updateRecord(loadSave());
        screenManager.showScreen('menu');
      }
    },
    onSaveChanged: (updated) => {
      saveState = updated;
      audio.setMuted(!saveState.settings.soundEnabled);
      audio.setVolume(saveState.settings.volume ?? 0.8);
      menuScreen.updateRecord(saveState);
      recordsScreen.render(saveState);
      matchScreen?.applyControlsSettings(saveState.settings);
      matchScreen?.syncMuteButton();
    },
    onShowTutorial: () => {
      launchOnboardingTutorial();
    },
  });

  matchScreen = createMatchScreen({
    screenManager,
    input,
    audio,
    onReturnToMenu: () => {
      onboardingScreen?.hide();
      matchScreen.applyControlsSettings(saveState.settings, false);
      menuScreen.updateRecord(loadSave());
      screenManager.showScreen('menu');
    },
    onOpenSettingsFromPause: () => {
      settingsReturnTarget = 'pause';
      settingsScreen.syncUI(saveState);
      screenManager.showScreen('settings');
    },
    onRecordUpdated: (updated) => {
      saveState = updated;
      menuScreen.updateRecord(saveState);
      recordsScreen.render(saveState);
    },
  });

  menuScreen.updateRecord(saveState);
  recordsScreen.render(saveState);
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

  // Launch logic: ?autostart=1 jumps straight to match; first-time visitors see non-blocking onboarding over practice court
  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') {
    matchScreen.startMatch(saveState.settings);
  } else if (!saveState.onboardingSeen) {
    launchOnboardingTutorial();
  } else {
    screenManager.showScreen('menu');
  }
}

init();
