// Versioned localStorage persistence with v0->v1->v2 migrations (injectable storage for tests)

export const SAVE_KEY = 'volleyball_2d_save';
export const CURRENT_SAVE_VERSION = 2;

export function createDefaultSave() {
  return {
    version: CURRENT_SAVE_VERSION,
    onboardingSeen: false,
    settings: {
      soundEnabled: true,
      volume: 0.8,           // 0.0 .. 1.0
      touchMode: 'auto',     // 'auto' | 'on' | 'off'
      joystickSize: 'normal',// 'compact' | 'normal' | 'large'
      buttonLayout: 'arc',   // 'arc' | 'row'
      difficulty: 'casual',  // 'casual' | 'pro'
      targetPoints: 15,      // 11 | 15 | 21
    },
    record: {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsScored: 0,
      bestMargin: 0,
      bestRally: 0,
      longestMatchSeconds: 0,
    },
  };
}

export function migrateSave(raw) {
  const fallback = createDefaultSave();
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version === 0) {
    return {
      version: CURRENT_SAVE_VERSION,
      onboardingSeen: Boolean(raw.onboardingSeen),
      settings: {
        ...fallback.settings,
        soundEnabled: typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : fallback.settings.soundEnabled,
        touchMode: ['auto', 'on', 'off'].includes(raw.touchMode) ? raw.touchMode : fallback.settings.touchMode,
        difficulty: ['casual', 'pro'].includes(raw.difficulty) ? raw.difficulty : fallback.settings.difficulty,
      },
      record: {
        ...fallback.record,
        matchesPlayed: Number.isFinite(raw.matchesPlayed) ? raw.matchesPlayed : 0,
        wins: Number.isFinite(raw.wins) ? raw.wins : 0,
        losses: Number.isFinite(raw.losses) ? raw.losses : 0,
        pointsScored: Number.isFinite(raw.pointsScored) ? raw.pointsScored : 0,
        bestMargin: Number.isFinite(raw.bestMargin) ? raw.bestMargin : 0,
      },
    };
  }

  const s = raw.settings || {};
  const r = raw.record || {};

  return {
    version: CURRENT_SAVE_VERSION,
    onboardingSeen: typeof raw.onboardingSeen === 'boolean' ? raw.onboardingSeen : false,
    settings: {
      soundEnabled: typeof s.soundEnabled === 'boolean' ? s.soundEnabled : fallback.settings.soundEnabled,
      volume: Number.isFinite(s.volume) ? Math.max(0, Math.min(1, s.volume)) : fallback.settings.volume,
      touchMode: ['auto', 'on', 'off'].includes(s.touchMode) ? s.touchMode : fallback.settings.touchMode,
      joystickSize: ['compact', 'normal', 'large'].includes(s.joystickSize)
        ? s.joystickSize
        : fallback.settings.joystickSize,
      buttonLayout: ['arc', 'row'].includes(s.buttonLayout) ? s.buttonLayout : fallback.settings.buttonLayout,
      difficulty: ['casual', 'pro'].includes(s.difficulty) ? s.difficulty : fallback.settings.difficulty,
      targetPoints: [11, 15, 21].includes(s.targetPoints) ? s.targetPoints : fallback.settings.targetPoints,
    },
    record: {
      matchesPlayed: Number.isFinite(r.matchesPlayed) ? r.matchesPlayed : 0,
      wins: Number.isFinite(r.wins) ? r.wins : 0,
      losses: Number.isFinite(r.losses) ? r.losses : 0,
      pointsScored: Number.isFinite(r.pointsScored) ? r.pointsScored : 0,
      bestMargin: Number.isFinite(r.bestMargin) ? r.bestMargin : 0,
      bestRally: Number.isFinite(r.bestRally) ? r.bestRally : 0,
      longestMatchSeconds: Number.isFinite(r.longestMatchSeconds) ? r.longestMatchSeconds : 0,
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
    // Ignore storage quota or private-mode restrictions
  }
}

export function updateSettings(patch, customStorage) {
  const save = loadSave(customStorage);
  save.settings = { ...save.settings, ...patch };
  writeSave(save, customStorage);
  return save;
}

export function setOnboardingSeen(seen, customStorage) {
  const save = loadSave(customStorage);
  save.onboardingSeen = Boolean(seen);
  writeSave(save, customStorage);
  return save;
}

export function recordMatchResult(homeScore, awayScore, extras = {}, customStorage) {
  const save = loadSave(customStorage);
  const won = homeScore > awayScore;
  const margin = homeScore - awayScore;
  const bestRally = extras.bestRally || 0;
  const durationSeconds = Math.round(extras.durationSeconds || 0);

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
  if (bestRally > save.record.bestRally) {
    save.record.bestRally = bestRally;
  }
  if (durationSeconds > save.record.longestMatchSeconds) {
    save.record.longestMatchSeconds = durationSeconds;
  }

  writeSave(save, customStorage);
  return save;
}

export function resetMatchRecord(customStorage) {
  const save = loadSave(customStorage);
  save.record = createDefaultSave().record;
  writeSave(save, customStorage);
  return save;
}
