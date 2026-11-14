// Input keyboard dan sentuh. Aksi tekan dicatat waktunya agar bisa di-buffer
// (tekan sedikit sebelum bola tiba tetap dihitung).
const peta = {
  ArrowLeft: 'kiri', KeyA: 'kiri', ArrowRight: 'kanan', KeyD: 'kanan',
  Space: 'lompat', ArrowUp: 'lompat', KeyW: 'lompat',
  KeyZ: 'smash', KeyK: 'smash',
  KeyX: 'terima', KeyJ: 'terima', Enter: 'terima',
  Escape: 'jeda', KeyP: 'jeda',
};
const tahan = { kiri: false, kanan: false, lompat: false };
const SUDAH_DIPAKAI = -1e9;
const jejak = {};     // waktu (ms) aksi terakhir ditekan
let joyX = 0;
const taps = [];

function tekan(nama) {
  jejak[nama] = performance.now();
  if (nama in tahan) tahan[nama] = true;
}
function lepas(nama) {
  if (nama in tahan) tahan[nama] = false;
}

window.addEventListener('keydown', (e) => {
  const a = peta[e.code];
  if (!a) return;
  e.preventDefault();
  if (!e.repeat) tekan(a);
});
window.addEventListener('keyup', (e) => {
  const a = peta[e.code];
  if (a) lepas(a);
});
window.addEventListener('blur', () => {
  for (const k in tahan) tahan[k] = false;
  joyX = 0;
});

export function pasangSentuh() {
  document.querySelectorAll('[data-aksi]').forEach((el) => {
    const a = el.dataset.aksi;
    const mulai = (e) => { e.preventDefault(); el.classList.add('tekan'); tekan(a); };
    const akhir = (e) => { e.preventDefault(); el.classList.remove('tekan'); lepas(a); };
    el.addEventListener('pointerdown', mulai);
    el.addEventListener('pointerup', akhir);
    el.addEventListener('pointercancel', akhir);
    el.addEventListener('pointerleave', akhir);
  });

  const joy = document.getElementById('joy');
  const knob = document.getElementById('joy-knob');
  const R = 60;
  let id = null;
  const gerak = (e) => {
    const r = joy.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    const k = d > R ? R / d : 1;
    dx *= k; dy *= k;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    joyX = dx / R;
  };
  joy.addEventListener('pointerdown', (e) => { id = e.pointerId; joy.setPointerCapture(id); gerak(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) gerak(e); });
  const selesai = (e) => {
    if (e.pointerId !== id) return;
    id = null; joyX = 0; knob.style.transform = '';
  };
  joy.addEventListener('pointerup', selesai);
  joy.addEventListener('pointercancel', selesai);
}

export const input = {
  arah() {
    let x = (tahan.kanan ? 1 : 0) - (tahan.kiri ? 1 : 0);
    if (!x) x = Math.abs(joyX) > 0.2 ? joyX : 0;
    return Math.max(-1, Math.min(1, x));
  },
  lompatTahan() { return tahan.lompat; },
  buffer(nama, ms) { return performance.now() - (jejak[nama] ?? SUDAH_DIPAKAI) < ms; },
  habiskan(nama) { jejak[nama] = SUDAH_DIPAKAI; },
  ambilJeda() {
    const ada = (jejak.jeda ?? SUDAH_DIPAKAI) > SUDAH_DIPAKAI;
    if (ada) jejak.jeda = SUDAH_DIPAKAI;
    return ada;
  },
  pushTap(x, y) {
    taps.push({ x, y });
    if (taps.length > 20) taps.shift();
  },
  ambilTap() { return taps.splice(0); },
};
