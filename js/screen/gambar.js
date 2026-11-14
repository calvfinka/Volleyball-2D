// Semua gambar dunia: latar pantai, jaring, pemain, bola, dan HUD. Karakter dan seni dibuat dengan kode.
import { K } from '../core/konstanta.js';
import { TIM } from '../data/tim.js';
import { rr, teks } from './ui.js';

function awan(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.beginPath();
  ctx.ellipse(x, y, 60 * s, 22 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 40 * s, y + 6 * s, 36 * s, 18 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 40 * s, y + 6 * s, 36 * s, 18 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function gambarLapangan(ctx, t = 0) {
  const L = K.LEBAR;
  let g = ctx.createLinearGradient(0, 0, 0, 430);
  g.addColorStop(0, '#4fb8f0');
  g.addColorStop(1, '#d6f1ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L, 430);

  ctx.fillStyle = '#ffe58a';
  ctx.beginPath();
  ctx.arc(1130, 110, 44, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    awan(ctx, ((i * 360 + t * 16) % (L + 260)) - 130, 80 + (i % 2) * 60, 0.9 + (i % 3) * 0.15);
  }

  g = ctx.createLinearGradient(0, 430, 0, 520);
  g.addColorStop(0, '#2a9dd6');
  g.addColorStop(1, '#1a78b3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 430, L, 90);
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= L; x += 20) {
    const y = 470 + Math.sin(x * 0.02 + t * 2) * 5;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  g = ctx.createLinearGradient(0, 520, 0, K.TINGGI);
  g.addColorStop(0, '#f7e0a6');
  g.addColorStop(1, '#e0b26a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 520, L, K.TINGGI - 520);

  // Lapangan: pasir yang lebih gelap dengan garis batas
  ctx.fillStyle = '#e9bf7a';
  ctx.fillRect(60, K.LANTAI_Y, L - 120, K.TINGGI - K.LANTAI_Y);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillRect(60, K.LANTAI_Y, L - 120, 5);
  ctx.fillRect(60, K.LANTAI_Y, 5, K.TINGGI - K.LANTAI_Y);
  ctx.fillRect(L - 65, K.LANTAI_Y, 5, K.TINGGI - K.LANTAI_Y);
}

export function gambarJaring(ctx) {
  const x = K.NET_X;
  ctx.fillStyle = '#e9ecef';
  ctx.fillRect(x - 4, K.NET_ATAS - 26, 8, K.LANTAI_Y - K.NET_ATAS + 26);
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.fillRect(x - K.NET_TEBAL / 2, K.NET_ATAS, K.NET_TEBAL, K.LANTAI_Y - K.NET_ATAS);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - 24, K.NET_ATAS - 6, 48, 10);
}

export function gambarPemain(ctx, p) {
  const h = K.PEMAIN_T;
  const baju = TIM[p.tim].warna;
  const ayun = !p.diudara && Math.abs(p.vx) > 20 ? Math.sin(p.anim * 16) : 0;
  const tekuk = p.diudara ? 10 : 0;

  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath();
  ctx.ellipse(p.x, K.LANTAI_Y + 3, 20 - (p.diudara ? 8 : 0), 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.hadap, 1);
  ctx.lineCap = 'round';

  // Kaki
  ctx.strokeStyle = p.kulit;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-5, -h * 0.4); ctx.lineTo(-10 + ayun * 8, -tekuk);
  ctx.moveTo(5, -h * 0.4); ctx.lineTo(12 - ayun * 8, -tekuk);
  ctx.stroke();

  // Celana
  ctx.fillStyle = '#1f2d3d';
  rr(ctx, -15, -h * 0.5, 30, 18, 6);
  ctx.fill();

  // Kaos dengan warna tim
  ctx.fillStyle = baju;
  rr(ctx, -16, -h * 0.82, 32, 36, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(-16, -h * 0.66, 32, 5);

  // Kepala dan rambut
  ctx.fillStyle = p.kulit;
  ctx.beginPath();
  ctx.arc(0, -h * 0.92, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.rambut;
  ctx.beginPath();
  ctx.arc(0, -h * 0.94, 12.5, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();

  // Lengan: belakang tetap, depan terangkat saat memukul
  ctx.strokeStyle = p.kulit;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-12, -h * 0.76); ctx.lineTo(-22, -h * 0.6);
  const angkat = p.angkat > 0;
  ctx.moveTo(12, -h * 0.76);
  ctx.lineTo(angkat ? 22 : 26, angkat ? -h * 1.08 : -h * 0.56);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(p.nama, p.x, p.y - h - 22);
}

export function gambarBola(ctx, b) {
  const r = K.BOLA_R;
  const warna = ['#ff6b35', '#ffffff', '#1c7ed6', '#ffffff'];
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.spin);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = warna[i];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, (i * Math.PI) / 2, ((i + 1) * Math.PI) / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function gambarHud(ctx, lg, tombolJeda) {
  const cx = K.LEBAR / 2;
  rr(ctx, cx - 210, 14, 420, 84, 18);
  ctx.fillStyle = 'rgba(6,24,43,.55)';
  ctx.fill();

  for (let i = 0; i < 2; i++) {
    const x = i === 0 ? cx - 120 : cx + 120;
    teks(ctx, TIM[i].nama, x, 34, 20, TIM[i].warna);
    if (lg.servisTim === i && lg.fase !== 'selesai') {
      // penanda tim yang sedang servis: bulat kuning di kiri nama (font sudah diset oleh teks)
      const lebar = ctx.measureText(TIM[i].nama).width;
      ctx.fillStyle = '#ffd43b';
      ctx.beginPath();
      ctx.arc(x - lebar / 2 - 12, 34, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    teks(ctx, String(lg.skor[i]), x, 66, 44);
  }
  teks(ctx, ':', cx, 64, 40);

  rr(ctx, tombolJeda.x, tombolJeda.y, tombolJeda.w, tombolJeda.h, 14);
  ctx.fillStyle = 'rgba(6,24,43,.55)';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(tombolJeda.x + 20, tombolJeda.y + 16, 8, 28);
  ctx.fillRect(tombolJeda.x + 34, tombolJeda.y + 16, 8, 28);
}

export function gambarFlash(ctx, s, sisa, warna = '#ffd43b') {
  ctx.save();
  ctx.globalAlpha = Math.min(1, sisa * 2);
  teks(ctx, s, K.LEBAR / 2, 190, 46, warna, 900);
  ctx.restore();
}
