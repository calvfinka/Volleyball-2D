// Settings screen controller

import { updateSettings, resetMatchRecord } from '../core/save.js';

export function createSettingsScreen({ onBack, onSaveChanged }) {
  const btnBack = document.getElementById('btn-settings-back');
  const btnSound = document.getElementById('toggle-sound');
  const btnReset = document.getElementById('btn-reset-save');
  const statusEl = document.getElementById('settings-save-status');
  const touchButtons = Array.from(document.querySelectorAll('[data-touch-mode]'));
  const diffButtons = Array.from(document.querySelectorAll('[data-difficulty]'));

  function syncUI(save) {
    const { soundEnabled, touchMode, difficulty } = save.settings;
    if (btnSound) {
      btnSound.setAttribute('aria-pressed', String(soundEnabled));
      btnSound.textContent = soundEnabled ? 'On' : 'Off';
    }
    touchButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.touchMode === touchMode);
    });
    diffButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.difficulty === difficulty);
    });
  }

  btnBack?.addEventListener('click', () => {
    if (statusEl) statusEl.textContent = '';
    onBack();
  });

  btnSound?.addEventListener('click', () => {
    const next = btnSound.getAttribute('aria-pressed') !== 'true';
    const save = updateSettings({ soundEnabled: next });
    syncUI(save);
    onSaveChanged(save);
  });

  touchButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const save = updateSettings({ touchMode: btn.dataset.touchMode });
      syncUI(save);
      onSaveChanged(save);
    });
  });

  diffButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const save = updateSettings({ difficulty: btn.dataset.difficulty });
      syncUI(save);
      onSaveChanged(save);
    });
  });

  btnReset?.addEventListener('click', () => {
    const save = resetMatchRecord();
    if (statusEl) {
      statusEl.textContent = 'Record cleared';
    }
    onSaveChanged(save);
  });

  return {
    syncUI,
  };
}
