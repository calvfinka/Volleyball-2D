// Bootstrap: canvas 1280x720 diskalakan memenuhi layar, orientasi landscape, dan loop utama.
import { K } from './inti/konstanta.js';
import { mulaiLoop } from './inti/loop.js';
import { layar } from './inti/layar.js';
import { input, pasangSentuh } from './inti/input.js';
import { pengaturan } from './inti/simpan.js';
import { setSuara } from './inti/audio.js';
import { buatMenu } from './layar/menu.js';
import { buatPengaturan } from './layar/pengaturan.js';
import { buatLayarLaga } from './layar/laga.js';

const kanvas = document.getElementById('kanvas');
const ctx = kanvas.getContext('2d');
const elPutar = document.getElementById('putar');
const elSentuh = document.getElementById('sentuh');
const elBtnTerima = document.getElementById('btn-terima');
const adaSentuh = matchMedia('(pointer: coarse)').matches;

kanvas.width = K.LEBAR;
kanvas.height = K.TINGGI;
setSuara(pengaturan.suara);

// Navigasi antar layar. Diisi setelah layar dibuat agar bisa saling memanggil.
const nav = {};
const menu = buatMenu(nav);
const peng = buatPengaturan(nav);
const laga = buatLayarLaga(nav);
Object.assign(nav, {
  menu: () => layar.ganti(menu),
  laga: () => layar.ganti(laga),
  pengaturan: () => layar.ganti(peng),
});

// Ukuran canvas mengikuti rasio 16:9 dan memenuhi layar.
function fitKanvas() {
  const s = Math.min(innerWidth / K.LEBAR, innerHeight / K.TINGGI);
  kanvas.style.width = `${K.LEBAR * s}px`;
  kanvas.style.height = `${K.TINGGI * s}px`;
}

// Klik atau sentuhan pada canvas dikonversi ke koordinat logis.
kanvas.addEventListener('pointerdown', (e) => {
  const r = kanvas.getBoundingClientRect();
  input.pushTap(((e.clientX - r.left) / r.width) * K.LEBAR, ((e.clientY - r.top) / r.height) * K.TINGGI);
});

// Layar portrait: tampilkan pesan putar dan jeda permainan.
function cekPutar() {
  const potret = innerHeight > innerWidth;
  elPutar.classList.toggle('tersembunyi', !potret);
  return potret;
}

// Coba fullscreen dan kunci landscape pada sentuhan pertama (butuh gestur pengguna).
let fsDicoba = false;
window.addEventListener('pointerdown', () => {
  if (fsDicoba) return;
  fsDicoba = true;
  const el = document.documentElement;
  const req = el.requestFullscreen ? el.requestFullscreen() : Promise.reject(new Error('no fullscreen'));
  req.then(() => screen.orientation?.lock?.('landscape')).catch(() => { /* fallback: overlay putar */ });
}, { once: true });

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
