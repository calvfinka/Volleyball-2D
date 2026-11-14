// Fisika bola: gravitasi, pantulan dinding, jaring, dan lantai. Tanpa DOM.
import { K } from '../inti/konstanta.js';

export function buatBola(x, y) {
  return { x, y, vx: 0, vy: 0, spin: 0, lastTim: -1, lastId: null };
}

// Mengembalikan 'tanah' saat menyentuh lantai, 'jaring' saat menabrak jaring, atau null.
export function langkahBola(b, dt) {
  b.vy += K.GRAVITASI * dt;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > K.BOLA_MAKS) { const s = K.BOLA_MAKS / sp; b.vx *= s; b.vy *= s; }
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.spin += (b.vx * dt) / K.BOLA_R;

  if (b.x < K.BOLA_R) { b.x = K.BOLA_R; b.vx = Math.abs(b.vx) * 0.8; }
  if (b.x > K.LEBAR - K.BOLA_R) { b.x = K.LEBAR - K.BOLA_R; b.vx = -Math.abs(b.vx) * 0.8; }
  if (b.y < K.BOLA_R) { b.y = K.BOLA_R; b.vy = Math.abs(b.vy) * 0.5; }

  // Jaring: menyentuh badan jaring di bawah puncaknya
  const dekat = Math.abs(b.x - K.NET_X) < K.NET_TEBAL / 2 + K.BOLA_R;
  if (dekat && b.y > K.NET_ATAS - K.BOLA_R * 0.5) return 'jaring';

  if (b.y >= K.LANTAI_Y - K.BOLA_R) {
    b.y = K.LANTAI_Y - K.BOLA_R;
    return 'tanah';
  }
  return null;
}

// Waktu bola (dengan kecepatan awal vy0 dari y0) mencapai ketinggian yt.
// Dipakai untuk menghitung kecepatan horizontal agar bola tepat di target.
export function waktuKe(y0, vy0, yt) {
  const disk = vy0 * vy0 - 2 * K.GRAVITASI * (y0 - yt);
  if (disk <= 0) return 0.05;
  return Math.max(0.05, (-vy0 + Math.sqrt(disk)) / K.GRAVITASI);
}
