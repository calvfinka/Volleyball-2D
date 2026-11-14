// Tes logika laga tanpa browser. Jalankan dari root repo: node tests/game.test.mjs
import assert from 'node:assert/strict';
import { Laga } from '../js/game/laga.js';
import { menangPoin } from '../js/game/aturan.js';
import { waktuKe } from '../js/game/fisika.js';
import { K } from '../js/core/konstanta.js';

// Pemain manusia yang diam, tetapi menekan Servis saat fase servis (seperti pemain sungguhan)
const manusiaDiam = (lg) => ({ arah: 0, lompat: false, aksi: lg.fase === 'servis' ? 'servis' : null });
let lulus = 0;
function tes(nama, fn) {
  try { fn(); lulus++; console.log('  OK   ', nama); }
  catch (e) { console.log('  GAGAL', nama, '\n       ', e.message); process.exitCode = 1; }
}

tes('aturan menang: 15 dengan selisih minimal 2', () => {
  assert.equal(menangPoin([15, 13]), 0);
  assert.equal(menangPoin([13, 15]), 1);
  assert.equal(menangPoin([15, 14]), -1);      // belum selisih 2
  assert.equal(menangPoin([16, 14]), 0);       // deuce dimenangkan
});

tes('waktuKe: bola kembali ke tinggi awal setelah 2|vy|/g', () => {
  const t = waktuKe(500, -560, 500);
  assert.ok(Math.abs(t - (2 * 560) / K.GRAVITASI) < 1e-6);
});

tes('laga AI lawan AI selalu selesai tanpa macet (40 laga)', () => {
  let totalFrame = 0;
  for (let i = 0; i < 40; i++) {
    const lg = new Laga();
    let f = 0;
    while (lg.fase !== 'selesai' && f < 60 * 60 * 40) {
      lg.update(1 / 60, manusiaDiam(lg), 1.0);
      lg.peristiwa.length = 0;
      f++;
    }
    assert.equal(lg.fase, 'selesai', `laga ${i} macet di fase ${lg.fase}, skor ${lg.skor}`);
    assert.ok(menangPoin(lg.skor) >= 0);
    totalFrame += f;
  }
  console.log('        rata-rata detik per laga:', (totalFrame / 40 / 60).toFixed(0));
});

tes('sentuhan keempat pada satu sisi dihitung pelanggaran', () => {
  const lg = new Laga();
  lg.fase = 'main';
  lg.sentuhTim = 0;
  lg.sentuhCount = K.SENTUH_MAKS;
  lg.bola.lastId = 'budi';
  const skorSebelum = lg.skor[1];
  lg.kontak(lg.pemain[0], 'terima', { arah: 0, lompat: false, aksi: 'terima' });
  assert.equal(lg.skor[1], skorSebelum + 1, 'tim lawan harus dapat poin');
});

console.log(`\n${lulus} tes lulus${process.exitCode ? ', ada yang gagal' : ''}`);
