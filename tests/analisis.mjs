// Quantitative AI-vs-AI match analysis harness
// Usage:
//   node tests/analisis.mjs --laga 60
//   node tests/analisis.mjs --laga 60 --ketat

import { COURT } from '../js/game/ball.js';
import { createMatchState, stepMatch } from '../js/game/rules.js';

const EMPTY_INPUT = {
  moveX: 0,
  jumpPressed: false,
  jumpHeld: false,
  smashPressed: false,
  receivePressed: false,
  actionPressed: false,
};

const TARGETS = {
  casual: {
    secPerPoint: [4.0, 7.0],
    smashPct: [15.0, 25.0],
    blockPct: [15.0, 30.0],
    serviceErrorPct: [5.0, 12.0],
    acePct: [1.0, 4.0],
  },
  pro: {
    secPerPoint: [4.0, 7.0],
    smashPct: [15.0, 25.0],
    blockPct: [15.0, 30.0],
    serviceErrorPct: [3.0, 8.0],
    acePct: [1.0, 4.0],
  },
};

function parseArgs(argv) {
  let laga = 60;
  let ketat = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--laga' && argv[i + 1]) {
      const n = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n > 0) laga = n;
      i++;
    } else if (argv[i] === '--ketat') {
      ketat = true;
    }
  }
  return { laga, ketat };
}

function classifyReason(calloutText, prevBall) {
  if (!calloutText) return 'FLOOR';
  if (calloutText.includes('SERVICE ERROR (NET)')) return 'SERVICE ERROR (NET)';
  if (calloutText.includes('SERVICE ERROR')) return 'SERVICE ERROR (OUT)';
  if (calloutText.includes('ACE')) return 'ACE';
  if (calloutText.includes('NET TOUCH FAULT')) return 'NET TOUCH FAULT';
  if (calloutText.includes('NET FAULT')) return 'NET FAULT';
  if (calloutText.includes('4 HITS FAULT')) return '4 HITS FAULT';
  if (calloutText.includes('DOUBLE TOUCH')) return 'DOUBLE TOUCH';
  if (calloutText.includes('OUT')) return 'OUT';
  if (calloutText.includes('WINS THE MATCH')) {
    // Fallback if final point overrode callout before lastPointReason existed
    if (prevBall.lastHitType === 'serve') {
      const landedIn =
        prevBall.lastHitByTeam === 'home'
          ? prevBall.x >= COURT.NET_X && prevBall.x <= COURT.RIGHT_X
          : prevBall.x >= COURT.LEFT_X && prevBall.x < COURT.NET_X;
      if (Math.abs(prevBall.x - COURT.NET_X) < 34) return 'SERVICE ERROR (NET)';
      return landedIn ? 'ACE' : 'SERVICE ERROR (OUT)';
    }
    if (prevBall.x < COURT.LEFT_X || prevBall.x > COURT.RIGHT_X) return 'OUT';
    if (Math.abs(prevBall.x - COURT.NET_X) < 34 && prevBall.y > COURT.NET_TOP_Y - 10) return 'NET FAULT';
    return 'FLOOR';
  }
  return 'FLOOR';
}

function runSuiteForDifficulty(difficulty, laga) {
  const dt = 1 / 60;
  const maxStepsPerMatch = 60 * 600; // 10 simulated minutes cap

  let completed = 0;
  let totalPoints = 0;
  let totalSeconds = 0;
  let smashPoints = 0;
  let blockPoints = 0;
  let serviceErrorPoints = 0;
  let acePoints = 0;
  let totalSmashes = 0;
  let totalBlocks = 0;

  const reasonCounts = {};
  const netFaultByHitType = {};
  let netFaultTopTape = 0;
  let netFaultBelowTop = 0;

  for (let m = 0; m < laga; m++) {
    const match = createMatchState(difficulty, { aiControlledHome: true, targetPoints: 15 });
    let steps = 0;
    let prevScoreSum = 0;
    let rallyElapsed = 0;
    let prevPhase = match.phase;

    while (match.phase !== 'match_over' && steps < maxStepsPerMatch) {
      const prevBall = {
        x: match.ball.x,
        y: match.ball.y,
        vx: match.ball.vx,
        vy: match.ball.vy,
        lastHitType: match.ball.lastHitType,
        lastHitByTeam: match.ball.lastHitByTeam,
      };
      const prevTotalSmashes = Object.values(match.playerStats).reduce((s, p) => s + p.smashes, 0);
      const prevTotalBlocks = Object.values(match.playerStats).reduce((s, p) => s + p.blocks, 0);

      if (match.phase === 'rally') {
        rallyElapsed += dt;
      }

      stepMatch(match, EMPTY_INPUT, dt);
      steps++;

      const curTotalSmashes = Object.values(match.playerStats).reduce((s, p) => s + p.smashes, 0);
      const curTotalBlocks = Object.values(match.playerStats).reduce((s, p) => s + p.blocks, 0);
      totalSmashes += curTotalSmashes - prevTotalSmashes;
      totalBlocks += curTotalBlocks - prevTotalBlocks;

      const scoreSum = match.score.home + match.score.away;
      if (scoreSum > prevScoreSum) {
        totalPoints += 1;
        totalSeconds += rallyElapsed;
        rallyElapsed = 0;

        const reason = match.lastPointReason || classifyReason(match.callout?.text, prevBall);
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;

        const hitType = match.lastPointHitType || prevBall.lastHitType || 'none';
        const impactY = match.lastPointNetImpactY ?? prevBall.y;

        if (reason === 'NET FAULT' || reason === 'SERVICE ERROR (NET)') {
          netFaultByHitType[hitType] = (netFaultByHitType[hitType] || 0) + 1;
          if (impactY <= COURT.NET_TOP_Y + 6) netFaultTopTape += 1;
          else netFaultBelowTop += 1;
        }

        if (reason.startsWith('SERVICE ERROR')) {
          serviceErrorPoints += 1;
        } else if (reason === 'ACE') {
          acePoints += 1;
        } else if (reason === 'FLOOR' && hitType === 'block') {
          blockPoints += 1;
        } else if (reason === 'FLOOR' && hitType === 'smash') {
          smashPoints += 1;
        } else if (reason === 'NET FAULT' && hitType === 'block') {
          blockPoints += 1;
        }

        prevScoreSum = scoreSum;
      }

      if (prevPhase !== 'serve_wait' && match.phase === 'serve_wait') {
        rallyElapsed = 0;
      }
      prevPhase = match.phase;
    }

    if (match.phase === 'match_over') {
      completed += 1;
    }
  }

  const pct = (n) => (totalPoints > 0 ? (n / totalPoints) * 100 : 0);
  return {
    difficulty,
    laga,
    completed,
    totalPoints,
    secPerPoint: totalPoints > 0 ? totalSeconds / totalPoints : 0,
    smashPct: pct(smashPoints),
    blockPct: pct(blockPoints),
    serviceErrorPct: pct(serviceErrorPoints),
    acePct: pct(acePoints),
    totalSmashes,
    totalBlocks,
    reasonCounts,
    netFaultByHitType,
    netFaultTopTape,
    netFaultBelowTop,
  };
}

function inRange(val, [min, max]) {
  return val >= min && val <= max;
}

function formatTable(results) {
  const [casual, pro] = results;
  const rows = [
    [
      'Matches completed',
      `${casual.completed}/${casual.laga}`,
      `${pro.completed}/${pro.laga}`,
      'all',
      casual.completed === casual.laga && pro.completed === pro.laga,
    ],
    [
      'Seconds per point',
      casual.secPerPoint.toFixed(1),
      pro.secPerPoint.toFixed(1),
      '4-7',
      inRange(casual.secPerPoint, TARGETS.casual.secPerPoint) && inRange(pro.secPerPoint, TARGETS.pro.secPerPoint),
    ],
    [
      'Smash (% of points)',
      casual.smashPct.toFixed(1),
      pro.smashPct.toFixed(1),
      '15-25',
      inRange(casual.smashPct, TARGETS.casual.smashPct) && inRange(pro.smashPct, TARGETS.pro.smashPct),
    ],
    [
      'Block (% of points)',
      casual.blockPct.toFixed(1),
      pro.blockPct.toFixed(1),
      '15-30',
      inRange(casual.blockPct, TARGETS.casual.blockPct) && inRange(pro.blockPct, TARGETS.pro.blockPct),
    ],
    [
      'Service error (% of points)',
      casual.serviceErrorPct.toFixed(1),
      pro.serviceErrorPct.toFixed(1),
      '5-12 (Cas), 3-8 (Pro)',
      inRange(casual.serviceErrorPct, TARGETS.casual.serviceErrorPct) &&
        inRange(pro.serviceErrorPct, TARGETS.pro.serviceErrorPct),
    ],
    [
      'Ace (% of points)',
      casual.acePct.toFixed(1),
      pro.acePct.toFixed(1),
      '1-4',
      inRange(casual.acePct, TARGETS.casual.acePct) && inRange(pro.acePct, TARGETS.pro.acePct),
    ],
  ];

  console.log(`\n=== Volleyball 2D AI-vs-AI Analysis (${casual.laga} matches/difficulty) ===`);
  console.log(
    `${'Metric'.padEnd(28)} | ${'Casual'.padStart(8)} | ${'Pro'.padStart(8)} | ${'Target'.padEnd(22)} | Status`
  );
  console.log('-'.repeat(84));
  let allPass = true;
  for (const [label, cVal, pVal, tgt, ok] of rows) {
    if (!ok) allPass = false;
    console.log(
      `${label.padEnd(28)} | ${String(cVal).padStart(8)} | ${String(pVal).padStart(8)} | ${tgt.padEnd(22)} | ${
        ok ? 'PASS' : 'MISS'
      }`
    );
  }

  for (const r of results) {
    console.log(`\n[${r.difficulty.toUpperCase()}] Total points: ${r.totalPoints} | Smashes executed: ${r.totalSmashes} | Blocks executed: ${r.totalBlocks}`);
    const sortedReasons = Object.entries(r.reasonCounts).sort((a, b) => b[1] - a[1]);
    console.log('  Point conclusions:');
    for (const [reason, count] of sortedReasons) {
      const p = ((count / r.totalPoints) * 100).toFixed(1);
      console.log(`    - ${reason.padEnd(22)}: ${String(count).padStart(5)} (${p}%)`);
    }
    const netEntries = Object.entries(r.netFaultByHitType).sort((a, b) => b[1] - a[1]);
    if (netEntries.length > 0) {
      console.log(`  Net impacts by last contact (top-tape <=386px: ${r.netFaultTopTape}, below-tape >386px: ${r.netFaultBelowTop}):`);
      for (const [hit, count] of netEntries) {
        console.log(`    - ${hit.padEnd(10)}: ${count}`);
      }
    }
  }

  return allPass;
}

const { laga, ketat } = parseArgs(process.argv.slice(2));
const casual = runSuiteForDifficulty('casual', laga);
const pro = runSuiteForDifficulty('pro', laga);
const ok = formatTable([casual, pro]);

if (ketat && !ok) {
  process.exit(1);
}
