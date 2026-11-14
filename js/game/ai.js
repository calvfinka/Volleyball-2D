// AI sederhana. Mengembalikan niat (arah, lompat, aksi) seperti input manusia.
import { K } from '../core/konstanta.js';
import { tangan, batasX } from './pemain.js';

const jepit = (v, a, b) => Math.max(a, Math.min(b, v));

export function niatAI(p, lg, tingkat) {
  const b = lg.bola;
  const niat = { arah: 0, lompat: false, aksi: null };
  const [minX, maxX] = batasX(p.tim);
  const sisiBola = b.x < K.NET_X ? 0 : 1;
  const bolaDiSisiku = sisiBola === p.tim;
  const bolaMenujuKu = p.tim === 0 ? b.vx < -40 : b.vx > 40;
  const reaksi = 0.5 + 0.5 * tingkat;

  if (lg.fase === 'servis' || lg.fase === 'poin') {
    niat.arah = jepit(p.dasar - p.x, -1, 1);
    if (lg.fase === 'servis' && lg.server === p && lg.timer >= K.SERVIS_TUNDA_AI) niat.aksi = 'servis';
    return niat;
  }

  // Posisi: ke bola bila di sisi kita atau menuju kita, selain itu kembali ke posisi dasar
  let tujuan = p.dasar;
  if (bolaDiSisiku || bolaMenujuKu) tujuan = jepit(b.x + b.vx * 0.12, minX, maxX);
  if (Math.abs(tujuan - p.x) > 10) niat.arah = Math.sign(tujuan - p.x);

  const dekatX = Math.abs(b.x - p.x) < 110;
  const tinggi = b.y < K.LANTAI_Y - 230;

  // Lompat untuk smash bila tim sudah menyentuh dua kali
  if (bolaDiSisiku && lg.sentuhTim === p.tim && lg.sentuhCount >= 2 && tinggi && dekatX) niat.lompat = true;
  // Lompat untuk blok bila lawan sudah dua sentuhan dan bola tinggi dekat jaring
  if (lg.sentuhTim !== p.tim && lg.sentuhCount >= 2 && tinggi && Math.abs(p.x - K.NET_X) < 170) niat.lompat = true;

  const tg = tangan(p);
  const dalam = Math.hypot(b.x - tg.x, b.y - tg.y) < K.JANGKAUAN + K.BOLA_R + 8;
  if (dalam && lg.fase === 'main' && bolaDiSisiku && b.lastId !== p.id) {
    if (lg.sentuhTim === p.tim && lg.sentuhCount === 1) {
      niat.aksi = 'set';
    } else if (p.diudara && lg.sentuhTim === p.tim && lg.sentuhCount >= 2 && Math.abs(p.vy) < 260 && Math.random() < reaksi) {
      niat.aksi = 'smash';
    } else if ((lg.sentuhTim !== p.tim || lg.sentuhCount === 0) && Math.random() < reaksi) {
      niat.aksi = 'terima';
    }
  }
  return niat;
}
