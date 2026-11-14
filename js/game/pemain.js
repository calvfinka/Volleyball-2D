// Pemain: gerak, lompat, dan titik sentuh tangan. Tanpa DOM.
import { K } from '../core/konstanta.js';

export function buatPemain(d) {
  return {
    id: d.id, nama: d.nama, tim: d.tim, peran: d.peran, manusia: d.manusia,
    stat: d.stat, kulit: d.kulit, rambut: d.rambut,
    x: d.x, y: K.LANTAI_Y, vx: 0, vy: 0,
    hadap: d.tim === 0 ? 1 : -1, dasar: d.x,
    diudara: false, cdSentuh: 0, angkat: 0, anim: 0,
  };
}

// Batas horizontal pemain: tidak boleh melewati jaring.
export function batasX(tim) {
  const jarak = K.NET_TEBAL / 2 + K.PEMAIN_L / 2 + 6;
  return tim === 0
    ? [K.PEMAIN_L / 2, K.NET_X - jarak]
    : [K.NET_X + jarak, K.LEBAR - K.PEMAIN_L / 2];
}

export function langkahPemain(p, niat, dt) {
  const [minX, maxX] = batasX(p.tim);
  const kec = K.PEMAIN_SPEED * (0.75 + p.stat.kecepatan / 400);
  p.vx = niat.arah * kec;

  if (niat.lompat && !p.diudara) {
    p.vy = -K.LONCAT * (0.85 + p.stat.kecepatan / 900);
    p.diudara = true;
  }
  if (p.diudara) {
    p.vy += K.GRAVITASI * dt;
    p.y += p.vy * dt;
    if (p.y >= K.LANTAI_Y) { p.y = K.LANTAI_Y; p.vy = 0; p.diudara = false; }
  }

  p.x = Math.max(minX, Math.min(maxX, p.x + p.vx * dt));
  p.hadap = niat.arah ? (niat.arah > 0 ? 1 : -1) : (p.tim === 0 ? 1 : -1);
  p.anim += dt;
}

// Pusat tangan: titik yang dipakai untuk mengecek jangkauan sentuh.
export function tangan(p) {
  return { x: p.x + p.hadap * 14, y: p.y - K.PEMAIN_T * 0.82 };
}
