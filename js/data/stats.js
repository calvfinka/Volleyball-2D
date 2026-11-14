// Player and team rosters + stat-to-gameplay modifier math (no DOM dependencies)

export const TEAMS = {
  home: {
    id: 'home',
    name: 'SOLARIS DUO',
    shortName: 'SOLARIS',
    primaryColor: '#E84A27',
    secondaryColor: '#18293E',
    accentColor: '#F29F05',
    players: [
      {
        id: 'kai',
        name: 'Kai',
        number: 7,
        role: 'Striker',
        controlledBy: 'human',
        skinColor: '#E5A97C',
        hairColor: '#1F2A38',
        hairStyle: 'spiky',
        stats: {
          smash: 86,
          receive: 74,
          block: 76,
          serve: 80,
        },
      },
      {
        id: 'mina',
        name: 'Mina',
        number: 4,
        role: 'Setter',
        controlledBy: 'ai',
        skinColor: '#F2C3A0',
        hairColor: '#4A2C2A',
        hairStyle: 'ponytail',
        stats: {
          smash: 68,
          receive: 88,
          block: 72,
          serve: 78,
        },
      },
    ],
  },
  away: {
    id: 'away',
    name: 'COASTAL APEX',
    shortName: 'APEX',
    primaryColor: '#0E7C7B',
    secondaryColor: '#153243',
    accentColor: '#E6A126',
    players: [
      {
        id: 'ren',
        name: 'Ren',
        number: 11,
        role: 'Blocker',
        controlledBy: 'ai',
        skinColor: '#DFB08C',
        hairColor: '#25313E',
        hairStyle: 'sweep',
        stats: {
          smash: 82,
          receive: 72,
          block: 85,
          serve: 78,
        },
      },
      {
        id: 'sora',
        name: 'Sora',
        number: 2,
        role: 'Defender',
        controlledBy: 'ai',
        skinColor: '#F0C09B',
        hairColor: '#6B3E26',
        hairStyle: 'bob',
        stats: {
          smash: 74,
          receive: 84,
          block: 70,
          serve: 76,
        },
      },
    ],
  },
};

function normStat(val) {
  return Math.max(0, Math.min(1, (val - 50) / 50));
}

export function getServeProfile(stats) {
  const t = normStat(stats.serve);
  return {
    flightTime: 1.50 - t * 0.20,   // faster serve with higher serve stat while clearing net cleanly
    targetDepth: 0.45 + t * 0.42,  // deeper toward backcourt line
    topspin: 55 + t * 95,          // downward dip acceleration
    spread: (1 - t) * 55,          // slight variance for low serve stat
  };
}

export function getReceiveProfile(stats) {
  const t = normStat(stats.receive);
  return {
    reachBonus: t * 16,            // extra ground receive reach in px
    dampFactor: 0.42 + (1 - t) * 0.14,
    setPrecision: 0.72 + t * 0.28, // higher = cleaner auto-feed target
  };
}

export function getSmashProfile(stats) {
  const t = normStat(stats.smash);
  return {
    power: 780 + t * 240,          // peak smash velocity
    perfectWindowBonus: t * 14,    // wider sweet spot
    steepness: 0.38 + t * 0.16,    // sharper downward angle
  };
}

export function getBlockProfile(stats) {
  const t = normStat(stats.block);
  return {
    reachHeight: 14 + t * 22,      // extra vertical hand reach above head
    stuffChance: 0.42 + t * 0.45,  // probability of hard downward stuff vs soft touch
    deflectSpeed: 420 + t * 180,
  };
}
