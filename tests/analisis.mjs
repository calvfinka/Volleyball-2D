// Harness analisis: menjalankan laga AI lawan AI dan mengukur kualitas permainan.
// Jalankan dari root repo:
//   node tests/analisis.mjs              -> laporan saja (exit 0)
//   node tests/analisis.mjs --ketat      -> exit 1 bila ada target yang tidak tercapai
//   node tests/analisis.mjs --laga 200   -> jumlah laga per tingkat kesulitan (default 60)
import { createMatchState, stepMatch } from '../js/game/rules.js';

const args = process.argv.slice(2);
const KETAT = args.includes('--ketat');
const idxLaga = args.indexOf('--laga');
const JUMLAH = idxLaga >= 0 ? Number(args[idxLaga + 1]) : 60;
const DT = 1 / 60;
const MAKS_LANGKAH = 60 * 180; // batas 3 menit simulasi per laga
const INPUT_KOSONG = { moveX: 0, jumpPressed: false, jumpHeld: false, smashPressed: false, receivePressed: false, actionPressed: false };

// Target kualitas (rentang). Ubah di sini bila ingin menyetel ulang.
const TARGET = {
  casual: {
    detikPerPoin: [4, 7],
    smashPersen: [15, 25],
    blokPersen: [15, 30],
    errorServisPersen: [5, 12],
    acePersen: [1, 4],
  },
  pro: {
    detikPerPoin: [4, 7],
    smashPersen: [15, 25],
    blokPersen: [15, 30],
    errorServisPersen: [3, 8],
    acePersen: [1, 4],
  },
};

const jumlahStat = (m, kunci) => Object.values(m.playerStats).reduce((a, p) => a + (p[kunci] || 0), 0);

function jalankanLaga(difficulty) {
  const m = createMatchState(difficulty, { aiControlledHome: true, targetPoints: 15 });
  const hasil = { selesai: false, detik: 0, poin: 0, poinSmash: 0, poinBlok: 0, poinErrorServis: 0, poinAce: 0, alasan: {} };
  let langkah = 0;
  let skorTerakhir = 0;
  let blokTerakhir = 0, smashTerakhir = 0, aceTerakhir = 0, errTerakhir = 0;
  let waktuPoinTerakhir = 0;

  while (m.phase !== 'match_over' && langkah < MAKS_LANGKAH) {
    stepMatch(m, INPUT_KOSONG, DT);
    langkah++;

    const total = m.score.home + m.score.away;
    if (total !== skorTerakhir) {
      // Satu poin baru selesai. Hitung kejadian yang terjadi sejak poin sebelumnya.
      const blok = jumlahStat(m, 'blocks'), smash = jumlahStat(m, 'smashes');
      const ace = jumlahStat(m, 'aces'), err = jumlahStat(m, 'serviceErrors');
      hasil.poin++;
      if (blok > blokTerakhir) hasil.poinBlok++;
      if (smash > smashTerakhir) hasil.poinSmash++;
      if (ace > aceTerakhir) hasil.poinAce++;
      if (err > errTerakhir) hasil.poinErrorServis++;
      blokTerakhir = blok; smashTerakhir = smash; aceTerakhir = ace; errTerakhir = err;

      const alasan = (m.callout && m.callout.text) || '(tanpa keterangan)';
      hasil.alasan[alasan] = (hasil.alasan[alasan] || 0) + 1;
      waktuPoinTerakhir = langkah;
      skorTerakhir = total;
    }
  }
  hasil.selesai = m.phase === 'match_over';
  hasil.detik = langkah / 60;
  return hasil;
}

function ringkas(hasilList) {
  const n = hasilList.length;
  const jumlah = (f) => hasilList.reduce((a, h) => a + f(h), 0);
  const totalPoin = jumlah((h) => h.poin);
  const persen = (x) => (totalPoin ? (100 * x) / totalPoin : 0);
  const alasan = {};
  for (const h of hasilList) for (const [k, v] of Object.entries(h.alasan)) alasan[k] = (alasan[k] || 0) + v;
  return {
    laga: n,
    selesai: hasilList.filter((h) => h.selesai).length,
    detikPerPoin: totalPoin ? jumlah((h) => h.detik) / totalPoin : 0,
    poinPerLaga: jumlah((h) => h.poin) / n,
    smashPersen: persen(jumlah((h) => h.poinSmash)),
    blokPersen: persen(jumlah((h) => h.poinBlok)),
    errorServisPersen: persen(jumlah((h) => h.poinErrorServis)),
    acePersen: persen(jumlah((h) => h.poinAce)),
    alasan,
  };
}

function cek(nilai, [min, maks]) {
  return nilai >= min && nilai <= maks;
}

const semua = { casual: [], pro: [] };
console.log(`Menjalankan ${JUMLAH} laga per tingkat kesulitan...\n`);
for (const diff of ['casual', 'pro']) {
  for (let i = 0; i < JUMLAH; i++) semua[diff].push(jalankanLaga(diff));
}

let gagal = 0;
for (const diff of ['casual', 'pro']) {
  const r = ringkas(semua[diff]);
  const t = TARGET[diff];
  const baris = [
    ['Laga selesai', `${r.selesai}/${r.laga}`, r.selesai === r.laga, 'semua laga harus selesai'],
    ['Detik per poin', r.detikPerPoin.toFixed(1), cek(r.detikPerPoin, t.detikPerPoin), `${t.detikPerPoin.join('–')}`],
    ['Smash (% poin)', r.smashPersen.toFixed(1), cek(r.smashPersen, t.smashPersen), `${t.smashPersen.join('–')}`],
    ['Blok (% poin)', r.blokPersen.toFixed(1), cek(r.blokPersen, t.blokPersen), `${t.blokPersen.join('–')}`],
    ['Error servis (% poin)', r.errorServisPersen.toFixed(1), cek(r.errorServisPersen, t.errorServisPersen), `${t.errorServisPersen.join('–')}`],
    ['Ace (% poin)', r.acePersen.toFixed(1), cek(r.acePersen, t.acePersen), `${t.acePersen.join('–')}`],
  ];
  console.log(`=== ${diff.toUpperCase()} (${r.laga} laga, ${r.poinPerLaga.toFixed(1)} poin/laga) ===`);
  console.log('Metrik'.padEnd(24), 'Nilai'.padEnd(10), 'Target'.padEnd(10), 'Status');
  for (const [nama, nilai, lolos, target] of baris) {
    console.log(nama.padEnd(24), String(nilai).padEnd(10), target.padEnd(10), lolos ? 'LOLOS' : 'GAGAL');
    if (!lolos) gagal++;
  }
  console.log('Alasan poin:', r.alasan, '\n');
}

console.log(gagal === 0 ? 'Semua target tercapai.' : `${gagal} target belum tercapai.`);
if (KETAT && gagal > 0) process.exit(1);
