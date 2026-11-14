// Match Records screen controller

export function createRecordsScreen({ onBack }) {
  const gridEl = document.getElementById('records-grid');
  const btnBack = document.getElementById('btn-records-back');

  function formatDuration(totalSec) {
    const sec = Math.max(0, Math.round(totalSec || 0));
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${String(rem).padStart(2, '0')}`;
  }

  function render(save) {
    if (!gridEl) return;
    const rec = save?.record || {};
    const played = rec.matchesPlayed || 0;
    const wins = rec.wins || 0;
    const losses = rec.losses || 0;
    const winRate = played > 0 ? `${Math.round((wins / played) * 100)}%` : '—';
    const bestRally = rec.bestRally || 0;
    const longest = formatDuration(rec.longestMatchSeconds || 0);
    const pointsScored = rec.pointsScored || 0;

    const tiles = [
      { label: 'Wins', value: String(wins) },
      { label: 'Losses', value: String(losses) },
      { label: 'Win Rate', value: winRate },
      { label: 'Best Rally', value: `${bestRally} hits` },
      { label: 'Longest Match', value: longest },
      { label: 'Matches Played', value: `${played} (${pointsScored} pts)` },
    ];

    gridEl.innerHTML = tiles
      .map(
        (t) => `
      <div class="record-tile">
        <span class="record-tile-label">${t.label}</span>
        <span class="record-tile-value">${t.value}</span>
      </div>`
      )
      .join('');
  }

  btnBack?.addEventListener('click', () => {
    btnBack.blur();
    onBack?.();
  });

  return {
    render,
  };
}
