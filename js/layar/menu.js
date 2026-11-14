// Menu utama.
import { K } from '../inti/konstanta.js';
import { input } from '../inti/input.js';
import { gambarLapangan } from './gambar.js';
import { gambarTombol, diDalam, redupkan, teks } from './ui.js';

const R_MAIN = { x: K.LEBAR / 2 - 170, y: 340, w: 340, h: 74 };
const R_PENG = { x: K.LEBAR / 2 - 170, y: 440, w: 340, h: 74 };
// Tombol layar penuh ditangani langsung di main.js (harus dari gestur pengguna).
export const R_FULL = { x: K.LEBAR / 2 - 170, y: 540, w: 340, h: 74 };

export function buatMenu(nav) {
  let t = 0;
  return {
    nama: 'menu',
    update(dt) {
      t += dt;
      for (const p of input.ambilTap()) {
        if (diDalam(R_MAIN, p)) nav.laga();
        else if (diDalam(R_PENG, p)) nav.pengaturan();
      }
    },
    render(ctx) {
      gambarLapangan(ctx, t);
      redupkan(ctx, 0.25);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      teks(ctx, 'VOLLEYBALL', K.LEBAR / 2, 170, 92);
      teks(ctx, '2D', K.LEBAR / 2, 262, 58, '#ffd43b', 900);
      ctx.restore();
      teks(ctx, 'Laga 2 lawan 2 · Tahap 1', K.LEBAR / 2, 318, 22, '#e8f6ff', 600);
      gambarTombol(ctx, R_MAIN, 'Main', true);
      gambarTombol(ctx, R_PENG, 'Pengaturan');
      gambarTombol(ctx, R_FULL, nav.layarPenuhAktif() ? 'Keluar Layar Penuh' : 'Layar Penuh');
      teks(ctx, 'Keyboard: panah + Spasi/Z/X · HP: joystick + tombol', K.LEBAR / 2, 650, 16, '#e8f6ff', 500);
    },
  };
}
