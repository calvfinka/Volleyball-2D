// Aturan voli: pemenang poin, dan pengecekan pelanggaran sentuhan.
import { K } from '../core/konstanta.js';

// Mengembalikan indeks tim pemenang, atau -1 bila laga belum selesai.
export function menangPoin(skor) {
  const [a, b] = skor;
  if (Math.max(a, b) >= K.POIN_TARGET && Math.abs(a - b) >= K.SELISIH_MIN) {
    return a > b ? 0 : 1;
  }
  return -1;
}

// Mengembalikan tim yang melanggar, atau -1 bila sentuhan sah.
// Blok tidak dihitung sebagai sentuhan tim.
export function cekSentuhan(lg, p, jenis) {
  if (jenis === 'blok') return -1;
  if (lg.bola.lastId === p.id) return p.tim;                     // dua sentuhan berturut oleh pemain yang sama
  if (lg.sentuhTim === p.tim && lg.sentuhCount >= K.SENTUH_MAKS) return p.tim; // lebih dari tiga sentuhan
  return -1;
}
