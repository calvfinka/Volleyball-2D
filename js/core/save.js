// Versioned localStorage persistence with migrations (injectable storage for tests)

export const SAVE_KEY = 'volleyball_2d_save';
export const CURRENT_SAVE_VERSION = 1;

export function createDefaultSave() {
  return {
    version: CURRENT_SAVE_VERSION,
    settings: {
      soundEnabled: true,
      touchMode: 'auto', // 'auto' | 'on' | 'off'
      difficulty: 'casual', // 'casual' | 'pro'
    },
    record: {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsScored: 0,
      bestMargin: 0,
    },
  };
}

export function migrateSave(raw) {
  const fallback = createDefaultSave();
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  // Version 0 -> Version 1 migration example (flat keys or missing version)
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version === 0) {
    return {
      version: CURRENT_SAVE_VERSION,
      settings: {
        soundEnabled: typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : fallback.settings.soundEnabled,
        touchMode: ['auto', 'on', 'off'].includes(raw.touchMode) ? raw.touchMode : fallback.settings.touchMode,
        difficulty: ['casual', 'pro'].includes(raw.difficulty) ? raw.difficulty : fallback.settings.difficulty,
      },
      record: {
        matchesPlayed: Number.isFinite(raw.matchesPlayed) ? raw.matchesPlayed : 0,
        wins: Number.isFinite(raw.wins) ? raw.wins : 0,
        losses: Number.isFinite(raw.losses) ? raw.losses : 0,
        pointsScored: Number.isFinite(raw.pointsScored) ? raw.pointsScored : 0,
        bestMargin: Number.isFinite(raw.bestMargin) ? raw.bestMargin : 0,
      },
    };
  }

  return {
    version: CURRENT_SAVE_VERSION,
    settings: {
      soundEnabled:
        typeof raw.settings?.soundEnabled === 'boolean'
          ? raw.settings.soundEnabled
          : fallback.settings.soundEnabled,
      touchMode: ['auto', 'on', 'off'].includes(raw.settings?.touchMode)
        ? raw.settings.touchMode
        : fallback.settings.touchMode,
      difficulty: ['casual', 'pro'].includes(raw.settings?.difficulty)
        ? raw.settings.difficulty
        : fallback.settings.difficulty,
    },
    record: {
      matchesPlayed: Number.isFinite(raw.record?.matchesPlayed) ? raw.record.matchesPlayed : 0,
      wins: Number.isFinite(raw.record?.wins) ? raw.record.wins : 0,
      losses: Number.isFinite(raw.record?.losses) ? raw.record.losses : 0,
      pointsScored: Number.isFinite(raw.record?.pointsScored) ? raw.record.pointsScored : 0,
      bestMargin: Number.isFinite(raw.record?.bestMargin) ? raw.record.bestMargin : 0,
    },
  };
}

function getStorage(customStorage) {
  if (customStorage) return customStorage;
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadSave(customStorage) {
  const storage = getStorage(customStorage);
  if (!storage) return createDefaultSave();

  try {
    const rawText = storage.getItem(SAVE_KEY);
    if (!rawText) return createDefaultSave();
    const parsed = JSON.parse(rawText);
    const migrated = migrateSave(parsed);
    if (parsed?.version !== CURRENT_SAVE_VERSION) {
      storage.setItem(SAVE_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return createDefaultSave();
  }
}

export function writeSave(data, customStorage) {
  const storage = getStorage(customStorage);
  if (!storage) return;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota / private browsing storage errors gracefully
  }
}

export function updateSettings(patch, customStorage) {
  const save = loadSave(customStorage);
  save.settings = { ...save.settings, ...patch };
  writeSave(save, customStorage);
  return save;
}

export function recordMatchResult(homeScore, awayScore, customStorage) {
  const save = loadSave(customStorage);
  const won = homeScore > awayScore;
  const margin = homeScore - awayScore;
  save.record.matchesPlayed += 1;
  if (won) {
    save.record.wins += 1;
    if (margin > save.record.bestMargin) {
      save.record.bestMargin = margin;
    }
  } else {
    save.record.losses += 1;
  }
  save.record.pointsScored += Math.max(0, homeScore);
  writeSave(save, customStorage);
  return save;
}

export function resetMatchRecord(customStorage) {
  const save = loadSave(customStorage);
  save.record = createDefaultSave().record;
  writeSave(save, customStorage);
  return save;
}
