// Pengaturan: suara dan tingkat kesulitan AI.
import { K } from '../inti/konstanta.js';
import { input } from '../inti/input.js';
import { pengaturan, simpanData } from '../inti/simpan.js';
import { setSuara } from '../inti/audio.js';
import { gambarLapangan } from './gambar.js';
import { gambarTombol, diDalam, redupkan, teks } from './ui.js';

const LABEL_KESULITAN = ['Mudah', 'Normal', 'Sulit'];
const R_SUARA = { x: K.LEBAR / 2 - 200, y: 230, w: 400, h: 70 };
const R_KES = { x: K.LEBAR / 2 - 200, y: 320, w: 400, h: 70 };
const R_KEMBALI = { x: K.LEBAR / 2 - 200, y: 450, w: 400, h: 70 };

export function buatPengaturan(nav) {
  return {
    nama: 'pengaturan',
    update() {
      for (const p of input.ambilTap()) {
        if (diDalam(R_SUARA, p)) {
          pengaturan.suara = !pengaturan.suara;
          setSuara(pengaturan.suara);
          simpanData(pengaturan);
        } else if (diDalam(R_KES, p)) {
          pengaturan.kesulitan = (pengaturan.kesulitan + 1) % 3;
          simpanData(pengaturan);
        } else if (diDalam(R_KEMBALI, p)) {
          nav.menu();
        }
      }
    },
    render(ctx) {
      gambarLapangan(ctx, 0);
      redupkan(ctx, 0.35);
      teks(ctx, 'Pengaturan', K.LEBAR / 2, 130, 60);
      gambarTombol(ctx, R_SUARA, `Suara: ${pengaturan.suara ? 'Nyala' : 'Mati'}`);
      gambarTombol(ctx, R_KES, `Kesulitan: ${LABEL_KESULITAN[pengaturan.kesulitan] ?? 'Normal'}`);
      gambarTombol(ctx, R_KEMBALI, 'Kembali', true);
    },
  };
}
