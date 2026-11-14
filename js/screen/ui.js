// Helper UI canvas: tombol, teks, dan redup latar.
import { K } from '../core/konstanta.js';

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function teks(ctx, s, x, y, ukuran = 30, warna = '#fff', tebal = 800) {
  ctx.font = `${tebal} ${ukuran}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = warna;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

export function gambarTombol(ctx, r, label, utama = false) {
  rr(ctx, r.x, r.y, r.w, r.h, 18);
  ctx.fillStyle = utama ? '#ff8a3d' : 'rgba(20,50,90,.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  teks(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, 26);
}

export function diDalam(r, p) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function redupkan(ctx, a = 0.55) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.fillRect(0, 0, K.LEBAR, K.TINGGI);
}
