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
          speed: 84,
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
          speed: 82,
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
          speed: 78,
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
          speed: 86,
        },
      },
    ],
  },
};

function normStat(val) {
  return Math.max(0, Math.min(1, ((val ?? 75) - 50) / 50));
}

export function getServeProfile(stats) {
  const t = normStat(stats.serve);
  return {
    flightTime: 1.5 - t * 0.22,
    targetDepth: 0.45 + t * 0.42,
    topspin: 8 + t * 14, // rad/s spin applied to ball for Magnus dip
    spread: (1 - t) * 58,
  };
}

export function getReceiveProfile(stats) {
  const t = normStat(stats.receive);
  return {
    reachBonus: t * 18,
    dampFactor: 0.42 + (1 - t) * 0.14,
    setPrecision: 0.72 + t * 0.28,
  };
}

export function getSmashProfile(stats) {
  const t = normStat(stats.smash);
  return {
    power: 780 + t * 240,
    perfectWindowBonus: t * 14,
    steepness: 0.38 + t * 0.18,
    spin: 18 + t * 14,
  };
}

export function getBlockProfile(stats) {
  const t = normStat(stats.block);
  return {
    reachHeight: 14 + t * 24,
    stuffChance: 0.42 + t * 0.45,
    deflectSpeed: 420 + t * 180,
  };
}

export function getSpeedProfile(stats) {
  const t = normStat(stats.speed);
  return {
    maxSpeed: 315 + t * 95,      // px/s horizontal move speed
    accel: 1800 + t * 900,       // px/s^2 ground acceleration
    jumpVy: -610 - t * 75,       // jump height from speed/agility stat
  };
}
