// Penyimpanan di localStorage dengan nomor versi dan migrasi.
const KUNCI = 'volleyball2d';
const VERSI = 1;
const BAWAAN = { versi: VERSI, suara: true, kesulitan: 1 }; // kesulitan: 0 Mudah, 1 Normal, 2 Sulit

function migrasi(d) {
  // Tiap kenaikan VERSI menambah langkah konversi di sini.
  if (!d.versi) d.versi = 1;
  return d;
}

export function muatSimpan() {
  try {
    const raw = localStorage.getItem(KUNCI);
    if (!raw) return { ...BAWAAN };
    return { ...BAWAAN, ...migrasi(JSON.parse(raw)) };
  } catch (e) {
    return { ...BAWAAN };
  }
}

export function simpanData(data) {
  try {
    localStorage.setItem(KUNCI, JSON.stringify({ ...data, versi: VERSI }));
  } catch (e) { /* penyimpanan diblokir atau penuh: abaikan */ }
}

export const pengaturan = muatSimpan();
