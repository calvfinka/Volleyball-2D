// Main Menu screen controller

import { TEAMS } from '../data/stats.js';

export function createMenuScreen({ onPlay, onOpenSettings }) {
  const btnPlay = document.getElementById('btn-play');
  const btnSettings = document.getElementById('btn-settings');
  const matchupCard = document.getElementById('menu-matchup-card');
  const recordLine = document.getElementById('menu-record-line');

  function renderRoster() {
    if (!matchupCard) return;
    matchupCard.innerHTML = `
      <div class="matchup-header">
        <span>2v2 Matchup</span>
        <span>Rally to 15</span>
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
    if (!recordLine || !save?.record) return;
    const { matchesPlayed, wins, losses } = save.record;
    if (matchesPlayed === 0) {
      recordLine.textContent = 'First Match Ready';
    } else {
      recordLine.textContent = `Record: ${wins}W · ${losses}L (${matchesPlayed} Played)`;
    }
  }

  btnPlay?.addEventListener('click', () => {
    btnPlay.blur();
    onPlay();
  });

  btnSettings?.addEventListener('click', () => {
    btnSettings.blur();
    onOpenSettings();
  });

  renderRoster();

  return {
    updateRecord,
  };
}
