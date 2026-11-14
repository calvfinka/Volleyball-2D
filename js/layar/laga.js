// Layar laga: menggabungkan state permainan, input manusia, suara, dan overlay (jeda, hasil).
import { K } from '../inti/konstanta.js';
import { input } from '../inti/input.js';
import { pengaturan } from '../inti/simpan.js';
import { sfx } from '../inti/audio.js';
import { Laga } from '../permainan/laga.js';
import { TIM } from '../data/tim.js';
import { gambarLapangan, gambarJaring, gambarPemain, gambarBola, gambarHud, gambarFlash } from './gambar.js';
import { gambarTombol, diDalam, redupkan, teks } from './ui.js';

const TOMBOL_JEDA = { x: K.LEBAR - 84, y: 14, w: 64, h: 64 };
const TINGKAT_AI = [0.6, 0.8, 1.0];
const btn = (y) => ({ x: K.LEBAR / 2 - 170, y, w: 340, h: 70 });
const SEBAB = { tanah: 'Bola jatuh!', jaring: 'Bola menyentuh jaring!', pelanggaran: 'Pelanggaran sentuhan!' };
const TEKS_AKSI = { smash: 'SMASH!', blok: 'BLOK!', terima: 'TERIMA', set: 'UMPAN' };

// Aksi manusia dari input. Smash dan terima di-buffer agar tidak hilang bila sedikit terlambat.
function niatManusia(lg) {
  let aksi = null;
  if (input.buffer('smash', 170)) aksi = 'smash';
  else if (input.buffer('terima', 170)) aksi = lg.fase === 'servis' ? 'servis' : 'terima';
  return {
    arah: input.arah(),
    lompat: input.lompatTahan(),
    aksi,
    habiskan() {
      if (aksi === 'servis') input.habiskan('terima');
      else if (aksi) input.habiskan(aksi);
    },
  };
}

export function buatLayarLaga(nav) {
  let lg = new Laga();
  let jeda = false;
  let flash = { teks: '', t: 0 };

  function ulang() {
    lg = new Laga();
    jeda = false;
    flash = { teks: '', t: 0 };
  }

  function efek(e) {
    if (e.jenis === 'smash') sfx.smash();
    else if (e.jenis === 'blok') sfx.pantul();
    else if (e.jenis === 'servis') sfx.peluit();
    else if (e.jenis === 'poin') sfx.poin();
    else sfx.pukul();

    if (e.jenis === 'poin') {
      flash = { teks: `Poin ${TIM[e.tim].nama}! ${SEBAB[e.sebab] ?? ''}`, t: 1.3 };
    } else if (TEKS_AKSI[e.jenis]) {
      flash = { teks: TEKS_AKSI[e.jenis], t: 0.9 };
    }
  }

  return {
    nama: 'laga',
    masuk: ulang,
    labelTerima() {
      return lg.fase === 'servis' && lg.server.manusia ? 'Servis' : 'Terima';
    },
    update(dt) {
      const taps = input.ambilTap();

      if (jeda) {
        for (const p of taps) {
          if (diDalam(btn(300), p)) jeda = false;
          else if (diDalam(btn(390), p)) ulang();
          else if (diDalam(btn(480), p)) nav.menu();
        }
        return;
      }

      if (lg.fase === 'selesai') {
        for (const p of taps) {
          if (diDalam(btn(430), p)) ulang();
          else if (diDalam(btn(520), p)) nav.menu();
        }
        return;
      }

      if (taps.some((p) => diDalam(TOMBOL_JEDA, p)) || input.ambilJeda()) {
        jeda = true;
        return;
      }

      lg.update(dt, niatManusia(lg), TINGKAT_AI[pengaturan.kesulitan] ?? 0.8);
      for (const e of lg.peristiwa) efek(e);
      lg.peristiwa.length = 0;
      flash.t = Math.max(0, flash.t - dt);
    },
    render(ctx) {
      gambarLapangan(ctx, lg.waktu);
      gambarJaring(ctx);
      for (const p of lg.pemain) gambarPemain(ctx, p);
      gambarBola(ctx, lg.bola);
      gambarHud(ctx, lg, TOMBOL_JEDA);
      if (flash.t > 0) gambarFlash(ctx, flash.teks, flash.t);

      if (jeda) {
        redupkan(ctx, 0.6);
        teks(ctx, 'JEDA', K.LEBAR / 2, 200, 72);
        gambarTombol(ctx, btn(300), 'Lanjut', true);
        gambarTombol(ctx, btn(390), 'Ulang');
        gambarTombol(ctx, btn(480), 'Menu');
      } else if (lg.fase === 'selesai') {
        redupkan(ctx, 0.6);
        const pemenang = TIM[lg.pemenang];
        teks(ctx, `${pemenang.nama} menang!`, K.LEBAR / 2, 230, 64, pemenang.warna);
        teks(ctx, `${lg.skor[0]} : ${lg.skor[1]}`, K.LEBAR / 2, 320, 56);
        gambarTombol(ctx, btn(430), 'Main Lagi', true);
        gambarTombol(ctx, btn(520), 'Menu');
      }
    },
  };
}
