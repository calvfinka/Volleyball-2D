// Bootstrap: canvas 1280x720 diskalakan memenuhi layar, layar penuh, orientasi, dan loop utama.
import { K } from './inti/konstanta.js';
import { mulaiLoop } from './inti/loop.js';
import { layar } from './inti/layar.js';
import { input, pasangSentuh } from './inti/input.js';
import { pengaturan } from './inti/simpan.js';
import { setSuara } from './inti/audio.js';
import { buatMenu, R_FULL } from './layar/menu.js';
import { buatPengaturan } from './layar/pengaturan.js';
import { buatLayarLaga } from './layar/laga.js';
import { diDalam } from './layar/ui.js';

const kanvas = document.getElementById('kanvas');
const ctx = kanvas.getContext('2d');
const elPutar = document.getElementById('putar');
const elSentuh = document.getElementById('sentuh');
const elBtnTerima = document.getElementById('btn-terima');
const adaSentuh = matchMedia('(pointer: coarse)').matches;

kanvas.width = K.LEBAR;
kanvas.height = K.TINGGI;
setSuara(pengaturan.suara);

// Layar penuh dan orientasi. Harus dipanggil langsung dari gestur pengguna.
function layarPenuhAktif() {
  return !!document.fullscreenElement;
}

async function toggleLayarPenuh() {
  try {
    if (layarPenuhAktif()) {
      await document.exitFullscreen();
      screen.orientation?.unlock?.();
    } else {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      await screen.orientation?.lock?.('landscape');
    }
  } catch (e) {
    // Browser menolak (misalnya iOS Safari). Overlay "Putar HP" tetap sebagai cadangan.
    console.warn('Layar penuh tidak tersedia:', e);
  }
}

// Navigasi antar layar. Diisi setelah layar dibuat agar bisa saling memanggil.
const nav = { layarPenuhAktif };
const menu = buatMenu(nav);
const peng = buatPengaturan(nav);
const laga = buatLayarLaga(nav);
Object.assign(nav, {
  menu: () => layar.ganti(menu),
  laga: () => layar.ganti(laga),
  pengaturan: () => layar.ganti(peng),
  toggleLayarPenuh,
});

// Ukuran canvas mengikuti rasio 16:9 dan memenuhi layar.
function fitKanvas() {
  const s = Math.min(innerWidth / K.LEBAR, innerHeight / K.TINGGI);
  kanvas.style.width = `${K.LEBAR * s}px`;
  kanvas.style.height = `${K.TINGGI * s}px`;
}

// Klik atau sentuhan pada canvas dikonversi ke koordinat logis.
// Tombol layar penuh dipanggil langsung di sini agar tetap dalam gestur pengguna.
kanvas.addEventListener('pointerdown', (e) => {
  const r = kanvas.getBoundingClientRect();
  const p = { x: ((e.clientX - r.left) / r.width) * K.LEBAR, y: ((e.clientY - r.top) / r.height) * K.TINGGI };
  if (layar.aktif === menu && diDalam(R_FULL, p)) {
    toggleLayarPenuh();
    return;
  }
  input.pushTap(p.x, p.y);
});

// Layar portrait: tampilkan pesan putar dan jeda permainan.
function cekPutar() {
  const potret = innerHeight > innerWidth;
  elPutar.classList.toggle('tersembunyi', !potret);
  return potret;
}

// Cegah zoom, menu konteks, dan scroll.
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

window.addEventListener('resize', () => { fitKanvas(); cekPutar(); });
fitKanvas();
pasangSentuh();
layar.ganti(menu);

let labelSekarang = '';
mulaiLoop(
  (dt) => { if (!cekPutar()) layar.update(dt); },
  () => {
    layar.render(ctx);
    const aktif = layar.aktif;
    elSentuh.classList.toggle('tersembunyi', !(adaSentuh && aktif?.nama === 'laga'));
    if (aktif?.labelTerima) {
      const lbl = aktif.labelTerima();
      if (lbl !== labelSekarang) { labelSekarang = lbl; elBtnTerima.textContent = lbl; }
    }
  },
);
