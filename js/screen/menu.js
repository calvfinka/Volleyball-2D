// Main Menu screen controller

import { TEAMS } from '../data/stats.js';

export function createMenuScreen({ onPlay, onHowToPlay, onOpenSettings, onOpenRecords }) {
  const btnPlay = document.getElementById('btn-play');
  const btnHowToPlay = document.getElementById('btn-how-to-play');
  const btnSettings = document.getElementById('btn-settings');
  const btnRecords = document.getElementById('btn-records');
  const subtitleEl = document.getElementById('menu-subtitle');
  const matchupCard = document.getElementById('menu-matchup-card');
  const recordLine = document.getElementById('menu-record-line');

  function renderRoster(targetPoints = 15) {
    if (!matchupCard) return;
    matchupCard.innerHTML = `
      <div class="matchup-header">
        <span>2v2 Matchup</span>
        <span>Rally to ${targetPoints} · Win by 2</span>
      </div>
      <div class="team-columns">
        ${renderTeamBlock(TEAMS.home, 'home')}
        ${renderTeamBlock(TEAMS.away, 'away')}
      </div>
    `;
  }

  function renderTeamBlock(team, side) {
    const playersHtml = team.players
      .map(
        (p) => `
      <div class="player-mini">
        <div class="player-mini-top">
          <span>#${p.number} ${p.name}</span>
          <span class="player-role">${p.controlledBy === 'human' ? 'You' : p.role}</span>
        </div>
        <div class="stat-grid">
          <div class="stat-item"><span>SMASH</span><span>${p.stats.smash}</span></div>
          <div class="stat-item"><span>RECV</span><span>${p.stats.receive}</span></div>
          <div class="stat-item"><span>BLOCK</span><span>${p.stats.block}</span></div>
          <div class="stat-item"><span>SERVE</span><span>${p.stats.serve}</span></div>
          <div class="stat-item"><span>SPD</span><span>${p.stats.speed}</span></div>
        </div>
      </div>`
      )
      .join('');

    return `
      <div class="team-block">
        <div class="team-heading ${side}">${team.name}</div>
        ${playersHtml}
      </div>
    `;
  }

  function updateRecord(save) {
    const targetPoints = save?.settings?.targetPoints || 15;
    if (subtitleEl) {
      subtitleEl.textContent = `2v2 Side-View Rally · First to ${targetPoints}`;
    }
    renderRoster(targetPoints);

    if (!recordLine || !save?.record) return;
    const { matchesPlayed, wins, losses, bestRally } = save.record;
    if (matchesPlayed === 0) {
      recordLine.textContent = 'First Match Ready';
    } else {
      recordLine.textContent = `Record: ${wins}W · ${losses}L · Best Rally ${bestRally || 0}`;
    }
  }

  btnPlay?.addEventListener('click', () => {
    btnPlay.blur();
    onPlay?.();
  });

  btnHowToPlay?.addEventListener('click', () => {
    btnHowToPlay.blur();
    onHowToPlay?.();
  });

  btnSettings?.addEventListener('click', () => {
    btnSettings.blur();
    onOpenSettings?.();
  });

  btnRecords?.addEventListener('click', () => {
    btnRecords.blur();
    onOpenRecords?.();
  });

  renderRoster();

  return {
    updateRecord,
  };
}
