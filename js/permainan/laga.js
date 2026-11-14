// Orkestrasi satu laga 2v2: servis, rally, sentuhan, dan poin. Tanpa DOM.
import { K } from '../inti/konstanta.js';
import { TIM } from '../data/tim.js';
import { PEMAIN } from '../data/statistik.js';
import { buatBola, langkahBola, waktuKe } from './fisika.js';
import { buatPemain, langkahPemain, tangan } from './pemain.js';
import { cekSentuhan, menangPoin } from './aturan.js';
import { niatAI } from './ai.js';

const acak = (a, b) => a + Math.random() * (b - a);
const jepit = (v, a, b) => Math.max(a, Math.min(b, v));
const LANTAI = K.LANTAI_Y - K.BOLA_R;

function dalamJangkauan(p, b) {
  const t = tangan(p);
  return Math.hypot(b.x - t.x, b.y - t.y) < K.JANGKAUAN + K.BOLA_R;
}

// Jenis sentuhan yang mungkin dilakukan pemain ini pada frame ini.
function jenisKontak(p, niat, lg) {
  const b = lg.bola;
  const sisiBola = b.x < K.NET_X ? 0 : 1;
  if (sisiBola !== p.tim) return null; // tidak bisa menyentuh bola di sisi lawan
  if (niat.aksi === 'smash' && p.diudara) return 'smash';
  if (niat.aksi === 'terima') return 'terima';
  if (niat.aksi === 'set') return 'set';
  const menujuKu = p.tim === 0 ? b.vx <= 60 : b.vx >= -60;
  const blokBisa = p.diudara && Math.abs(p.x - K.NET_X) < K.BLOK_JARAK
    && b.lastTim >= 0 && b.lastTim !== p.tim && menujuKu;
  return blokBisa ? 'blok' : null;
}

// Menghitung kecepatan bola setelah sentuhan. Statistik pemain dipakai di sini.
function hitung(p, jenis, lg) {
  const b = lg.bola;
  const s = p.stat;
  const q = jepit(1 - Math.abs(p.vy) / 380, 0, 1); // kualitas timing: makin dekat puncak lompatan makin baik

  if (jenis === 'terima') {
    const tx = (p.tim === 0 ? K.NET_X - 150 : K.NET_X + 150) + acak(-1, 1) * (1 - s.terima / 100) * 140;
    const vy = -560;
    return { vx: (tx - b.x) / waktuKe(b.y, vy, b.y), vy };
  }
  if (jenis === 'set') {
    const tx = (p.tim === 0 ? K.NET_X - 90 : K.NET_X + 90) + acak(-1, 1) * (1 - s.terima / 100) * 80;
    const vy = -980;
    return { vx: (tx - b.x) / waktuKe(b.y, vy, b.y), vy };
  }
  if (jenis === 'smash') {
    const daya = s.smash / 100;
    const lawan = lg.pemain.filter((o) => o.tim !== p.tim);
    const tgt = lawan[Math.random() < 0.5 ? 0 : 1];
    const err = (1 - q) * 240 + (1 - daya) * 70;
    const [minX, maxX] = p.tim === 0 ? [K.NET_X + 40, K.LEBAR - 30] : [30, K.NET_X - 40];
    const tx = jepit(tgt.x + acak(-1, 1) * err, minX, maxX);
    const vy = 160 + 260 * daya * (0.4 + 0.6 * q);
    return { vx: (tx - b.x) / waktuKe(b.y, vy, LANTAI), vy };
  }
  // blok: pantulkan kembali ke sisi lawan
  const dir = p.tim === 0 ? 1 : -1;
  return { vx: dir * (120 + 300 * (s.blok / 100)), vy: 120 };
}

export class Laga {
  constructor() {
    this.pemain = [];
    TIM.forEach((t, ti) => t.pemain.forEach((id, k) => {
      const d = PEMAIN[id];
      this.pemain.push(buatPemain({
        id, nama: d.nama, tim: ti,
        peran: k === 0 ? 'penyerang' : 'pengumpan',
        manusia: ti === 0 && k === 0,
        stat: d.stat, kulit: d.kulit, rambut: d.rambut,
        x: ti === 0 ? (k === 0 ? 400 : 260) : (k === 0 ? 880 : 1020),
      }));
    }));
    this.bola = buatBola(K.LEBAR / 2, 200);
    this.skor = [0, 0];
    this.servisTim = 0;
    this.servIdx = [0, 0];       // pemain yang servis per tim (0 atau 1)
    this.fase = 'servis';        // 'servis' | 'main' | 'poin' | 'selesai'
    this.timer = 0;
    this.waktu = 0;
    this.sentuhTim = -1;
    this.sentuhCount = 0;
    this.sisi = 0;
    this.pemenang = -1;
    this.peristiwa = [];
  }

  get server() {
    return this.pemain[this.servisTim * 2 + this.servIdx[this.servisTim]];
  }

  update(dt, niatH, tingkat) {
    if (this.fase === 'selesai') return;
    this.waktu += dt;
    const niat = this.pemain.map((p) => (p.manusia ? niatH : niatAI(p, this, tingkat)));
    this.pemain.forEach((p, i) => {
      langkahPemain(p, niat[i], dt);
      p.cdSentuh -= dt;
      p.angkat -= dt;
    });

    if (this.fase === 'poin') {
      this.timer -= dt;
      if (this.timer <= 0) { this.fase = 'servis'; this.timer = 0; }
      return;
    }

    if (this.fase === 'servis') {
      const s = this.server;
      const h = tangan(s);
      this.bola.x = h.x;
      this.bola.y = h.y - 14;
      this.bola.vx = 0;
      this.bola.vy = 0;
      this.timer += dt;
      const i = this.pemain.indexOf(s);
      if (niat[i].aksi === 'servis') this.servis(s, niat[i]);
      return;
    }

    // Fase main: rally
    const ev = langkahBola(this.bola, dt);
    const sisiBaru = this.bola.x < K.NET_X ? 0 : 1;
    if (sisiBaru !== this.sisi) {
      this.sisi = sisiBaru;
      this.sentuhTim = -1;
      this.sentuhCount = 0;
    }
    if (ev === 'tanah') { this.angkatPoin(sisiBaru === 0 ? 1 : 0, 'tanah'); return; }
    if (ev === 'jaring') {
      this.angkatPoin(this.bola.lastTim >= 0 ? 1 - this.bola.lastTim : 1, 'jaring');
      return;
    }

    for (let i = 0; i < this.pemain.length; i++) {
      const p = this.pemain[i];
      if (p.cdSentuh > 0) continue;
      const jenis = jenisKontak(p, niat[i], this);
      if (!jenis || !dalamJangkauan(p, this.bola)) continue;
      this.kontak(p, jenis, niat[i]);
      break; // satu sentuhan per frame
    }
  }

  servis(s, niat) {
    const h = tangan(s);
    const b = this.bola;
    const vy = -620;
    const yAwal = h.y - 14;
    b.x = h.x;
    b.y = yAwal;
    b.lastTim = s.tim;
    b.lastId = s.id;

    const lawan = this.pemain.filter((o) => o.tim !== s.tim);
    const tgt = lawan[Math.random() < 0.5 ? 0 : 1];
    const err = (1 - s.stat.servis / 100) * 260;
    const [minX, maxX] = s.tim === 0 ? [K.NET_X + 40, K.LEBAR - 30] : [30, K.NET_X - 40];
    const tx = jepit(tgt.x + acak(-1, 1) * err, minX, maxX);
    b.vy = vy;
    b.vx = (tx - b.x) / waktuKe(yAwal, vy, LANTAI);

    this.sentuhTim = -1;
    this.sentuhCount = 0;
    this.sisi = b.x < K.NET_X ? 0 : 1;
    this.fase = 'main';
    this.timer = 0;
    if (niat.habiskan) niat.habiskan();
    this.peristiwa.push({ jenis: 'servis', tim: s.tim });
  }

  kontak(p, jenis, niat) {
    const b = this.bola;
    const pelanggar = cekSentuhan(this, p, jenis);
    if (pelanggar >= 0) { this.angkatPoin(1 - pelanggar, 'pelanggaran'); return; }

    const hasil = hitung(p, jenis, this);
    b.vx = jepit(hasil.vx, -K.BOLA_MAKS * 0.9, K.BOLA_MAKS * 0.9);
    b.vy = hasil.vy;

    if (jenis === 'blok') {
      this.sentuhTim = p.tim;
      this.sentuhCount = 0;
    } else {
      if (this.sentuhTim !== p.tim) { this.sentuhTim = p.tim; this.sentuhCount = 0; }
      this.sentuhCount++;
    }
    b.lastId = p.id;
    b.lastTim = p.tim;
    p.cdSentuh = K.SENTUH_JEDA;
    p.angkat = 0.25;
    if (niat.habiskan && p.manusia) niat.habiskan();
    this.peristiwa.push({ jenis, tim: p.tim, x: b.x, y: b.y });
  }

  angkatPoin(tim, sebab) {
    this.skor[tim]++;
    this.servisTim = tim;
    this.servIdx[tim] = (this.servIdx[tim] + 1) % 2;
    this.bola.lastTim = -1;
    this.bola.lastId = null;
    this.peristiwa.push({ jenis: 'poin', tim, sebab });
    this.pemenang = menangPoin(this.skor);
    if (this.pemenang >= 0) {
      this.fase = 'selesai';
    } else {
      this.fase = 'poin';
      this.timer = K.JEDA_POIN;
    }
  }
}
