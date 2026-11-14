// Grouped Settings screen controller with inline confirm-reset and tutorial replay

import { updateSettings, resetMatchRecord } from '../core/save.js';

export function createSettingsScreen({ onBack, onSaveChanged, onShowTutorial }) {
  const btnBack = document.getElementById('btn-settings-back');
  const btnSound = document.getElementById('toggle-sound');
  const rangeVolume = document.getElementById('range-volume');
  const volumeLabel = document.getElementById('volume-value-label');

  const touchButtons = Array.from(document.querySelectorAll('[data-touch-mode]'));
  const joystickSizeButtons = Array.from(document.querySelectorAll('[data-joystick-size]'));
  const buttonLayoutButtons = Array.from(document.querySelectorAll('[data-button-layout]'));
  const diffButtons = Array.from(document.querySelectorAll('[data-difficulty]'));
  const targetButtons = Array.from(document.querySelectorAll('[data-target-points]'));

  const btnShowTutorial = document.getElementById('btn-show-tutorial');
  const btnReset = document.getElementById('btn-reset-save');
  const resetConfirmGroup = document.getElementById('reset-confirm-group');
  const btnResetConfirm = document.getElementById('btn-reset-confirm');
  const btnResetCancel = document.getElementById('btn-reset-cancel');
  const statusEl = document.getElementById('settings-save-status');

  function hideResetConfirm() {
    if (btnReset) btnReset.hidden = false;
    if (resetConfirmGroup) resetConfirmGroup.hidden = true;
  }

  function syncUI(save) {
    const {
      soundEnabled,
      volume,
      touchMode,
      joystickSize,
      buttonLayout,
      difficulty,
      targetPoints,
    } = save.settings;

    if (btnSound) {
      btnSound.setAttribute('aria-pressed', String(soundEnabled));
      btnSound.textContent = soundEnabled ? 'On' : 'Off';
    }

    const pct = Math.round((volume ?? 0.8) * 100);
    if (rangeVolume) rangeVolume.value = String(pct);
    if (volumeLabel) volumeLabel.textContent = `${pct}%`;

    touchButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.touchMode === touchMode);
    });
    joystickSizeButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.joystickSize === joystickSize);
    });
    buttonLayoutButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.buttonLayout === buttonLayout);
    });
    diffButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.difficulty === difficulty);
    });
    targetButtons.forEach((btn) => {
      btn.classList.toggle('is-active', Number(btn.dataset.targetPoints) === targetPoints);
    });
  }

  btnBack?.addEventListener('click', () => {
    if (statusEl) statusEl.textContent = '';
    hideResetConfirm();
    onBack?.();
  });

  btnSound?.addEventListener('click', () => {
    const next = btnSound.getAttribute('aria-pressed') !== 'true';
    const save = updateSettings({ soundEnabled: next });
    syncUI(save);
    onSaveChanged?.(save);
  });

  rangeVolume?.addEventListener('input', () => {
    const pct = Math.max(0, Math.min(100, Number(rangeVolume.value)));
    if (volumeLabel) volumeLabel.textContent = `${pct}%`;
    const save = updateSettings({ volume: pct / 100 });
    onSaveChanged?.(save);
  });

  touchButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const save = updateSettings({ touchMode: btn.dataset.touchMode });
      syncUI(save);
      onSaveChanged?.(save);
    });
  });

  joystickSizeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const save = updateSettings({ joystickSize: btn.dataset.joystickSize });
      syncUI(save);
      onSaveChanged?.(save);
    });
  });

  buttonLayoutButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const save = updateSettings({ buttonLayout: btn.dataset.buttonLayout });
      syncUI(save);
      onSaveChanged?.(save);
    });
  });

  diffButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const save = updateSettings({ difficulty: btn.dataset.difficulty });
      syncUI(save);
      onSaveChanged?.(save);
    });
  });

  targetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = Number(btn.dataset.targetPoints);
      const save = updateSettings({ targetPoints: target });
      syncUI(save);
      onSaveChanged?.(save);
    });
  });

  btnShowTutorial?.addEventListener('click', () => {
    btnShowTutorial.blur();
    hideResetConfirm();
    onShowTutorial?.();
  });

  btnReset?.addEventListener('click', () => {
    btnReset.hidden = true;
    if (resetConfirmGroup) resetConfirmGroup.hidden = false;
    if (statusEl) statusEl.textContent = '';
  });

  btnResetCancel?.addEventListener('click', () => {
    hideResetConfirm();
  });

  btnResetConfirm?.addEventListener('click', () => {
    const save = resetMatchRecord();
    hideResetConfirm();
    if (statusEl) statusEl.textContent = 'Records cleared';
    onSaveChanged?.(save);
  });

  return {
    syncUI,
    hideResetConfirm,
  };
}
