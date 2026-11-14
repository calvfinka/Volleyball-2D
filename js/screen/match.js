// Active 2v2 Match screen, HUD updater, touch layout sync, pause/result modals, and event audio bridge

import { TEAMS } from '../data/stats.js';
import { createMatchState, getActiveServer, stepMatch } from '../game/rules.js';
import { recordMatchResult } from '../core/save.js';

const JOYSTICK_RADII = {
  compact: 26,
  normal: 34,
  large: 42,
};

export function createMatchScreen({
  screenManager,
  input,
  audio,
  onReturnToMenu,
  onOpenSettingsFromPause,
  onRecordUpdated,
}) {
  const hudHomeScore = document.getElementById('hud-score-home');
  const hudAwayScore = document.getElementById('hud-score-away');
  const hudServeHome = document.getElementById('hud-serve-home');
  const hudServeAway = document.getElementById('hud-serve-away');
  const hudTargetPoints = document.getElementById('hud-target-points');
  const hudRallyCounter = document.getElementById('hud-rally-counter');
  const hudRotationServer = document.getElementById('hud-rotation-server');
  const hudCallout = document.getElementById('hud-callout');
  const touchControlsEl = document.getElementById('touch-controls');
  const touchReceiveLabel = document.getElementById('touch-receive-label');

  const btnHudMute = document.getElementById('btn-hud-mute');
  const iconSoundWaves = document.getElementById('icon-sound-waves');
  const btnHudPause = document.getElementById('btn-hud-pause');

  const pauseScoreLine = document.getElementById('pause-score-line');
  const btnResume = document.getElementById('btn-resume');
  const btnRestartMatch = document.getElementById('btn-restart-match');
  const btnPauseSettings = document.getElementById('btn-pause-settings');
  const btnQuitMenu = document.getElementById('btn-quit-menu');

  const resultTitle = document.getElementById('result-title');
  const resultHomeScore = document.getElementById('result-home-score');
  const resultAwayScore = document.getElementById('result-away-score');
  const resultStatsRow = document.getElementById('result-stats-row');
  const resultPlayerTbody = document.getElementById('result-player-tbody');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const btnResultMenu = document.getElementById('btn-result-menu');

  let match = null;
  let paused = false;
  let resultRecorded = false;
  let forceShowTouchForTutorial = false;
  let currentSettings = {
    difficulty: 'casual',
    touchMode: 'auto',
    joystickSize: 'normal',
    buttonLayout: 'arc',
    targetPoints: 15,
  };
  let lastHudHome = -1;
  let lastHudAway = -1;
  let lastServeTeam = '';
  let lastCalloutText = '';
  let lastRallyText = '';
  let lastRotationText = '';

  function startMatch(settings, options = {}) {
    currentSettings = { ...currentSettings, ...(settings || {}) };
    match = createMatchState(currentSettings.difficulty || 'casual', {
      targetPoints: currentSettings.targetPoints || 15,
      practiceMode: Boolean(options.practiceMode),
    });
    paused = false;
    resultRecorded = false;
    lastHudHome = -1;
    lastHudAway = -1;
    lastServeTeam = '';
    lastCalloutText = '';
    lastRallyText = '';
    lastRotationText = '';

    if (hudTargetPoints) {
      hudTargetPoints.textContent = match.practiceMode ? 'PRACTICE' : `TO ${match.targetPoints}`;
    }

    input.clearAll();
    applyControlsSettings(currentSettings);
    syncMuteButton();
    syncHud();
    screenManager.showScreen('match');
    if (!options.silentWhistle) {
      audio.playWhistle();
    }
  }

  function applyControlsSettings(settings, forceTouch = forceShowTouchForTutorial) {
    if (settings) {
      currentSettings = { ...currentSettings, ...settings };
    }
    forceShowTouchForTutorial = Boolean(forceTouch);
    if (!touchControlsEl) return;

    const touchMode = currentSettings.touchMode || 'auto';
    const show = forceShowTouchForTutorial || touchMode === 'on' || (touchMode === 'auto' && input.hasTouchHardware());
    touchControlsEl.hidden = !show;

    const joySize = currentSettings.joystickSize || 'normal';
    const btnLayout = currentSettings.buttonLayout || 'arc';
    touchControlsEl.classList.remove('joy-compact', 'joy-normal', 'joy-large', 'layout-arc', 'layout-row');
    touchControlsEl.classList.add(`joy-${joySize}`, `layout-${btnLayout}`);
    input.setJoystickRadius(JOYSTICK_RADII[joySize] || 34);
  }

  function applyTouchVisibility(touchMode) {
    applyControlsSettings({ touchMode });
  }

  function syncMuteButton() {
    const muted = audio.isMuted();
    if (btnHudMute) {
      btnHudMute.classList.toggle('is-muted', muted);
      btnHudMute.setAttribute('aria-label', muted ? 'Unmute Sound' : 'Mute Sound');
    }
    if (iconSoundWaves) {
      iconSoundWaves.style.display = muted ? 'none' : '';
    }
  }

  function showPauseModal() {
    if (!match || match.phase === 'match_over') return;
    paused = true;
    input.clearAll();
    if (pauseScoreLine) {
      pauseScoreLine.textContent = `${TEAMS.home.shortName} ${match.score.home} — ${match.score.away} ${TEAMS.away.shortName}`;
    }
    screenManager.showScreen('match');
    screenManager.showModal('pause');
  }

  function togglePause() {
    if (!match || match.phase === 'match_over') return;
    if (screenManager.getCurrentScreen() !== 'match') return;

    paused = !paused;
    input.clearAll();
    if (paused) {
      showPauseModal();
    } else {
      screenManager.hideAllModals();
    }
  }

  function syncHud() {
    if (!match) return;

    if (match.score.home !== lastHudHome) {
      lastHudHome = match.score.home;
      if (hudHomeScore) hudHomeScore.textContent = String(lastHudHome);
    }
    if (match.score.away !== lastHudAway) {
      lastHudAway = match.score.away;
      if (hudAwayScore) hudAwayScore.textContent = String(lastHudAway);
    }
    if (match.servingTeam !== lastServeTeam) {
      lastServeTeam = match.servingTeam;
      if (hudServeHome) hudServeHome.hidden = lastServeTeam !== 'home';
      if (hudServeAway) hudServeAway.hidden = lastServeTeam !== 'away';
    }

    const rallyText = match.practiceMode ? 'Practice Serve' : `Rally ${match.rallyNumber}`;
    if (rallyText !== lastRallyText) {
      lastRallyText = rallyText;
      if (hudRallyCounter) hudRallyCounter.textContent = rallyText;
    }

    const server = getActiveServer(match);
    const rotNum = match.servingTeam === 'home' ? match.rotation.home : match.rotation.away;
    const rotText = `R${rotNum} · #${server.number} ${server.name}`;
    if (rotText !== lastRotationText) {
      lastRotationText = rotText;
      if (hudRotationServer) hudRotationServer.textContent = rotText;
    }

    const calloutVisible = match.callout.timer > 0 && Boolean(match.callout.text);
    const nextText = calloutVisible ? match.callout.text : '';
    if (nextText !== lastCalloutText) {
      lastCalloutText = nextText;
      if (hudCallout) {
        hudCallout.hidden = !calloutVisible;
        hudCallout.textContent = nextText;
        hudCallout.style.color = match.callout.color || '#FFFDF8';
      }
    }

    if (touchReceiveLabel) {
      touchReceiveLabel.textContent =
        match.phase === 'serve_wait' && match.servingTeam === 'home' ? 'SERVE' : 'RECV';
    }
  }

  function drainEvents() {
    if (!match || match.events.length === 0) return;
    while (match.events.length > 0) {
      const ev = match.events.shift();
      if (ev.type === 'serve') audio.playServe();
      else if (ev.type === 'receive') audio.playReceive();
      else if (ev.type === 'set') audio.playSet();
      else if (ev.type === 'smash') audio.playSmash(ev.isPerfect);
      else if (ev.type === 'block') audio.playBlock();
      else if (ev.type === 'net') audio.playNetHit();
      else if (ev.type === 'point') audio.playPoint(ev.scoringTeam === 'home');
      else if (ev.type === 'match_over') {
        if (ev.winner === 'home') audio.playVictory();
        else audio.playDefeat();
        showFinalResult();
      }
    }
  }

  function showFinalResult() {
    if (!match || resultRecorded) return;
    resultRecorded = true;
    const updatedSave = recordMatchResult(match.score.home, match.score.away, {
      bestRally: match.bestRallyVolleys,
      durationSeconds: match.elapsedSeconds,
    });
    onRecordUpdated?.(updatedSave);

    const won = match.winner === 'home';
    if (resultTitle) resultTitle.textContent = won ? 'Victory!' : 'Match Complete';
    if (resultHomeScore) resultHomeScore.textContent = String(match.score.home);
    if (resultAwayScore) resultAwayScore.textContent = String(match.score.away);
    if (resultStatsRow) {
      const mins = Math.floor(match.elapsedSeconds / 60);
      const secs = Math.floor(match.elapsedSeconds % 60);
      const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
      resultStatsRow.innerHTML = `
        <span>Best Rally: ${match.bestRallyVolleys}</span>
        <span>Smashes: ${match.stats.smashes} (${match.stats.perfectSmashes} Perfect)</span>
        <span>Blocks: ${match.stats.blocks}</span>
        <span>Time: ${timeStr}</span>
      `;
    }

    if (resultPlayerTbody) {
      const allStats = [...match.homePlayers, ...match.awayPlayers].map((p) => {
        const s = match.playerStats[p.id];
        const tag = p.teamId === 'home' ? TEAMS.home.shortName : TEAMS.away.shortName;
        return `
          <tr>
            <td>#${s.number} ${s.name} <span style="opacity:0.6;font-weight:600">(${tag})</span></td>
            <td>${s.points}</td>
            <td>${s.aces}</td>
            <td>${s.smashes}</td>
            <td>${s.blocks}</td>
            <td>${s.serviceErrors}</td>
          </tr>
        `;
      });
      resultPlayerTbody.innerHTML = allStats.join('');
    }

    screenManager.showModal('result');
  }

  function step(dt) {
    if (!match || paused || screenManager.getCurrentScreen() !== 'match') return;

    const snap = input.snapshot();
    if (snap.jumpPressed && match.homePlayers[0].onGround && match.phase === 'rally') {
      audio.playJump();
    }

    stepMatch(match, snap, dt);
    drainEvents();
    syncHud();
  }

  // Modal & HUD button listeners
  btnHudPause?.addEventListener('click', () => {
    btnHudPause.blur();
    togglePause();
  });

  btnHudMute?.addEventListener('click', () => {
    btnHudMute.blur();
    const nextMuted = !audio.isMuted();
    audio.setMuted(nextMuted);
    syncMuteButton();
  });

  btnResume?.addEventListener('click', () => {
    btnResume.blur();
    if (paused) togglePause();
  });

  btnRestartMatch?.addEventListener('click', () => {
    btnRestartMatch.blur();
    startMatch(currentSettings);
  });

  btnPauseSettings?.addEventListener('click', () => {
    btnPauseSettings.blur();
    onOpenSettingsFromPause?.();
  });

  btnQuitMenu?.addEventListener('click', () => {
    btnQuitMenu.blur();
    paused = false;
    match = null;
    onReturnToMenu?.();
  });

  btnPlayAgain?.addEventListener('click', () => {
    btnPlayAgain.blur();
    startMatch(currentSettings);
  });

  btnResultMenu?.addEventListener('click', () => {
    btnResultMenu.blur();
    paused = false;
    match = null;
    onReturnToMenu?.();
  });

  return {
    startMatch,
    togglePause,
    showPauseModal,
    applyTouchVisibility,
    applyControlsSettings,
    syncMuteButton,
    step,
    getMatchState: () => match,
    isPaused: () => paused,
    clearMatch: () => {
      paused = false;
      match = null;
    },
  };
}
