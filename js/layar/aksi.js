// Mode Aksi 2D (prototipe): satu laga voli tampak samping. Kamu menggerakkan satu pemain: TERIMA bola, lalu SMASH saat bola turun di zona hijau.
// Statistik pemain terbaik di susunanmu menentukan kekuatan; tingkat lawan menentukan blok dan pertahanan. Hadiah: koin saja (tidak mengubah klasemen).
import { esc } from './gambar.js';
import { fixtureSaya } from '../sistem/musim.js';
import { pesan } from '../sistem/klub.js';
const W = 800, H = 450, FL = 360, NETX = 400, NETH = 150, TARGET = 15;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u, rnd = (a, b) => a + Math.random() * (b - a);
export function bukaLagaAksi(S, aksi) {
  const M = S.musim, f = fixtureSaya(M), lawan = f ? M.tim[f.lawan] : { nama: 'Latihan', tingkat: 45 };
  const pil = S.susunan.map(id => S.skuad.find(p => p.id === id)).filter(Boolean), aku = pil.slice().sort((a, b) => b.smash - a.smash)[0] || S.skuad[0];
  const opp = { smash: lawan.tingkat + 4, def: lawan.tingkat + 2, blok: lawan.tingkat };
  const el = document.createElement('div'); el.className = 'aksi'; el.setAttribute('role', 'dialog');
  el.innerHTML = `<div class="aksi-hud"><b>${esc(S.manajer.tim)}</b><span id="aS">0 : 0</span><b>${esc(lawan.nama)}</b><button id="aX" aria-label="Keluar">✕</button></div><canvas id="aC" width="${W}" height="${H}"></canvas><div class="aksi-info" id="aM">Siap?</div><div class="aksi-kartu"><div><small>PEMAIN KAMU</small><b>${esc(aku.nama)}</b><span>${aku.posisi} · #${aku.nomor}</span></div><div class="st"><i>SMASH<b>${aku.smash}</b></i><i>TERIMA<b>${aku.receive}</b></i><i>SERVIS<b>${aku.servis}</b></i></div></div><ol class="aksi-tips"><li><b>Terima:</b> geser ke bayangan kuning, tekan saat bola rendah.</li><li><b>Smash:</b> geser di bawah bola, tekan saat cincin hijau.</li><li><b>Servis:</b> tekan saat batang di tengah.</li></ol><div class="aksi-ctl"><button id="aL" aria-label="Kiri">◀</button><button id="aR" aria-label="Kanan">▶</button><button id="aA" class="besar">SERVIS</button></div>`;
  document.body.appendChild(el);
  const cv = el.querySelector('#aC'), c = cv.getContext('2d'), sponsor = ['GARUDA MUDA', 'VOLLEY MANAGER', 'KOPI NUSANTARA', 'BANK GARUDA', 'SINAR MOTOR'];
  let sk, srv, fase, ball, me, rally, msg, msgT, tugas, raf, jam, tt, tombol = { l: 0, r: 0 }, tutup = false;
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H; gambarLatar(bg.getContext('2d'));
  function mulai() { sk = [0, 0]; srv = 0; ball = { x: 0, h: 0, vy: 0, seg: null, landX: 0 }; me = { x: 200, j: 0, cd: 0 }; rally = 0; msg = ''; msgT = 0; tugas = []; tt = 0; skor(); servisBaru(); }
  const skor = () => el.querySelector('#aS').textContent = sk[0] + ' : ' + sk[1];
  const info = (s, d = 1.2) => { msg = s; msgT = d; el.querySelector('#aM').textContent = s; };
  const tunda = (d, fn) => tugas.push({ d, fn });
  const terbang = (x0, h0, x1, h1, ap, dur, fn) => { ball.seg = { x0, h0, x1, h1, ap, dur, u: 0, fn }; };
  function poin(k, s) { if (fase === 'jeda' || fase === 'selesai') return; sk[k]++; srv = k; fase = 'jeda'; skor(); info(s, 1.5); if (sk[k] >= TARGET) return tunda(1.2, akhir); tunda(1.6, servisBaru); }
  function servisBaru() {
    rally = 0; me.x = 200; ball.seg = null;
    if (srv === 0) { fase = 'servisku'; ball.x = me.x + 16; ball.h = 120; ball.vy = 0; info('Servis: tekan saat batang di tengah'); }
    else { fase = 'servisLawan'; ball.x = 720; ball.h = 120; info('Lawan servis…'); tunda(.9, () => { fase = 'terima'; ball.landX = rnd(110, 340); terbang(720, 120, ball.landX, 0, 150, 1.15, () => poin(1, 'Bola jatuh!')); info('TERIMA!', .8); }); }
  }
  function musuhSerang() {
    fase = 'musuh'; rally++; if (rally > 5 && Math.random() < .5) return poin(0, 'Lawan melakukan kesalahan');
    info('Lawan menyerang!', .8);
    tunda(.55, () => { fase = 'terima'; ball.landX = rnd(90, 350); terbang(500, 190, ball.landX, 0, 60, clamp(1.05 - (opp.smash - 40) * .012, .6, .95), () => poin(1, 'Bola jatuh!')); });
  }
  function aksiTombol() {
    if (me.cd > 0 || fase === 'jeda' || fase === 'selesai') return;
    if (fase === 'servisku') { const m = (tt * 1.7) % 2, q = 1 - Math.abs((m < 1 ? m : 2 - m) - .5) * 2, ace = Math.random() < .04 + q * .22 * (aku.servis / 55), gagal = q < .25 && Math.random() < .5, tx = rnd(480, 740);
      me.cd = .5; me.j = .3; fase = 'servisTerbang'; info(q > .8 ? 'Servis keras!' : q > .45 ? 'Servis bagus' : 'Servis lemah', .8);
      if (gagal) return terbang(ball.x, 120, 396, 95, 50, .7, () => { terbang(396, 95, 340, 0, 10, .4, () => poin(1, 'Servis nyangkut di net!')); });
      if (ace) return terbang(ball.x, 120, tx, 0, 160, 1.0, () => poin(0, 'ACE!'));
      return terbang(ball.x, 120, tx, 70, 160, 1.0, () => { info('Lawan menerima'); tunda(.4, musuhSerang); }); }
    if (fase === 'terima') { me.cd = .45; me.j = .22; const d = Math.abs(ball.x - me.x);
      if (d > 62 || ball.h > 125 || ball.h < 8) return info('Meleset!', .5);
      const q = .6 * (1 - d / 70) + .4 * clamp(1 - Math.abs(ball.h - 55) / 70, 0, 1) + (aku.receive - 45) * .004;
      if (q < .22) return poin(1, 'Terima gagal!');
      info(q > .7 ? 'Terima sempurna!' : 'Terima oke', .7); fase = 'umpan';
      return terbang(ball.x, ball.h, 345, 140, 80, .6, () => { const ax = clamp(320 - (1 - q) * 70 + rnd(-15, 15), 220, 350); fase = 'toss'; ball.landX = ax; info('SMASH! tunggu bola turun', 1); terbang(345, 140, ax, 0, 230, 1.05, () => poin(1, 'Serangan gagal')); }); }
    if (fase === 'toss') { me.cd = .7; me.j = .4; const dx = Math.abs(ball.x - me.x), h = ball.h;
      if (ball.vy >= 0 || dx > 62 || h < 100 || h > 225) return info(dx > 62 ? 'Terlalu jauh!' : 'Salah timing!', .6);
      spike(clamp(.65 * clamp(1 - Math.abs(h - 165) / 70, 0, 1) + .35 * (1 - dx / 62), .1, 1)); }
  }
  function spike(q) {
    fase = 'serang'; const pw = aku.smash / 55, pBlok = clamp(.08 + (1 - q) * .3 + (opp.blok - 45) * .004, .04, .55), pOut = (1 - q) * .22, pDig = clamp(.5 * (1 - q * .55) * (opp.def / 50) * (1.1 - pw * .35), .1, .7), dur = .3 + (1 - q) * .2, r = Math.random();
    info(q > .85 ? 'SEMPURNA!' : q > .6 ? 'BAGUS!' : 'Lemah…', .8); const x = ball.x, h = ball.h;
    if (r < pBlok) return terbang(x, h, 405, NETH + 12, 30, .3, () => terbang(405, NETH + 12, 350, 0, 10, .35, () => poin(1, 'Diblok lawan!')));
    if (r < pBlok + pOut) return terbang(x, h, 830, 0, 80, .55, () => poin(1, 'Keluar!'));
    if (Math.random() < pDig) return terbang(x, h, 600, 60, 50, .5, () => { info('Ditahan lawan!'); tunda(.35, musuhSerang); });
    terbang(x, h, rnd(520, 740), 0, 30, dur, () => poin(0, 'SMASH MASUK!'));
  }
  function update(dt) {
    tt += dt; me.cd = Math.max(0, me.cd - dt); me.j = Math.max(0, me.j - dt); if (msgT > 0) msgT -= dt;
    if (fase !== 'jeda' && fase !== 'selesai') me.x = clamp(me.x + (tombol.r - tombol.l) * (200 + aku.receive * 1.8) * dt, 60, 380);
    for (const k of tugas.slice()) { k.d -= dt; if (k.d <= 0) { tugas.splice(tugas.indexOf(k), 1); k.fn(); } }
    const s = ball.seg; if (s) { s.u += dt / s.dur; const u = Math.min(1, s.u), h0 = ball.h; ball.x = lerp(s.x0, s.x1, u); ball.h = lerp(s.h0, s.h1, u) + 4 * s.ap * u * (1 - u); ball.vy = (ball.h - h0) / Math.max(dt, .001); if (s.u >= 1) { ball.seg = null; s.fn(); } }
    else if (fase === 'servisku') { ball.x = me.x + 16; ball.h = 120 + Math.sin(tt * 4) * 4; }
    const a = el.querySelector('#aA'), tx = fase === 'servisku' ? 'SERVIS' : fase === 'toss' ? 'SMASH' : 'TERIMA'; if (a.textContent !== tx) a.textContent = tx;
  }
  const rect = (x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
  function orang(x, y, warna, no, lompat, label, lawanSisi) {
    c.save(); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y + 4, 22 - lompat * .1, 6, 0, 0, 7); c.fill(); c.translate(x, y - lompat);
    c.strokeStyle = '#d9a479'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(-7, -42); c.lineTo(-9, -4); c.moveTo(7, -42); c.lineTo(9, -4); c.stroke();
    c.fillStyle = '#111827'; rect(-14, -56, 28, 18, 5); c.fillStyle = warna; rect(-15, -90, 30, 38, 8); c.fillStyle = '#fff'; c.font = '800 16px sans-serif'; c.textAlign = 'center'; c.fillText(no, 0, -64);
    c.strokeStyle = '#d9a479'; c.lineWidth = 6; c.beginPath(); const d = lawanSisi ? -1 : 1; c.moveTo(-14, -84); c.lineTo(lompat ? -10 : -20, lompat ? -122 : -58); c.moveTo(14, -84); c.lineTo(lompat ? 12 : 20, lompat ? -128 : -58); c.stroke();
    c.fillStyle = '#d9a479'; c.beginPath(); c.arc(0, -102, 11, 0, 7); c.fill(); c.fillStyle = '#1b1b24'; c.beginPath(); c.arc(0, -105, 11, Math.PI, 0); c.fill();
    if (label) { c.fillStyle = '#c6ff3d'; c.font = '800 13px sans-serif'; c.fillText('▼ ' + label, 0, -128 - lompat * 0); } c.restore();
  }
  function gambar() {
    c.drawImage(bg, 0, 0);
    c.fillStyle = '#06102a'; c.fillRect(0, 300, W, 26); c.font = '800 16px sans-serif'; c.textAlign = 'left'; const off = (tt * 60) % 960;
    for (let i = -1; i < 3; i++) sponsor.forEach((s, k) => { c.fillStyle = k % 2 ? '#c6ff3d' : '#fff'; c.fillText(s, i * 960 + k * 190 - off, 318); });
    if (fase === 'terima') { const p = .5 + .5 * Math.sin(tt * 8); c.strokeStyle = `rgba(255,200,60,${.5 + p * .5})`; c.lineWidth = 3; c.beginPath(); c.ellipse(ball.landX, FL + 6, 26 + p * 4, 8, 0, 0, 7); c.stroke(); }
    // net
    c.fillStyle = 'rgba(230,236,245,.25)'; c.fillRect(NETX - 3, FL - NETH, 6, NETH); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; for (let y = FL - NETH; y < FL; y += 10) { c.beginPath(); c.moveTo(NETX - 3, y); c.lineTo(NETX + 3, y); c.stroke(); }
    c.fillStyle = '#f5f6f7'; c.fillRect(NETX - 5, FL - NETH - 4, 10, 8); c.fillStyle = '#34465b'; c.fillRect(NETX - 3, FL - NETH - 40, 6, 40);
    const near = Math.abs(ball.x - 345) < 80, a = ball.h;
    orang(345, FL, '#2455a6', S.skuad.find(p => p.posisi === 'S')?.nomor ?? 7, 0, '', 0); orang(140 + Math.sin(tt) * 8, FL, '#2455a6', 15, 0, '', 0);
    const aj = me.j > 0 ? Math.sin((1 - me.j / .4) * Math.PI) * 95 : 0; orang(me.x, FL, '#2455a6', aku.nomor, aj, 'KAMU', 0);
    const ox = clamp(ball.x, 440, 740); orang(470 + (ox - 600) * .05, FL, '#c33b42', 3, 0, '', 1); orang(570 + (ox - 600) * .1, FL, '#c33b42', 9, 0, '', 1); orang(690 + (ox - 600) * .05, FL, '#c33b42', 12, 0, '', 1);
    // bola, bayangan, cincin timing
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(ball.x, FL + 6, Math.max(4, 12 - a * .03), 4, 0, 0, 7); c.fill();
    if (fase === 'toss' && ball.vy < 0) { const q = clamp(1 - Math.abs(a - 165) / 70, 0, 1), dx = Math.abs(ball.x - me.x); c.strokeStyle = a < 100 || a > 225 || dx > 62 ? '#ff5470' : q > .6 ? '#3ddc97' : '#ffc83d'; c.lineWidth = 4; c.beginPath(); c.arc(ball.x, FL - a, 24, 0, 7); c.stroke(); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ball.x, FL - a, 11, 0, 7); c.fill(); c.strokeStyle = '#2455a6'; c.lineWidth = 2; c.beginPath(); c.arc(ball.x, FL - a, 11, 0, 7); c.moveTo(ball.x - 11, FL - a); c.quadraticCurveTo(ball.x, FL - a - 6, ball.x + 11, FL - a); c.stroke();
    if (fase === 'servisku') { const m = (tt * 1.7) % 2, v = m < 1 ? m : 2 - m; c.fillStyle = 'rgba(7,10,20,.8)'; rect(250, 60, 300, 22, 11); c.fillStyle = '#3ddc97'; rect(375, 62, 50, 18, 9); c.fillStyle = '#c6ff3d'; rect(255 + v * 284, 58, 8, 26, 4); }
    if (msgT > 0) { c.globalAlpha = Math.min(1, msgT * 2); c.fillStyle = '#fff'; c.strokeStyle = '#0a1200'; c.lineWidth = 6; c.font = '800 44px sans-serif'; c.textAlign = 'center'; c.strokeText(msg, 400, 150); c.fillText(msg, 400, 150); c.globalAlpha = 1; }
  }
  function akhir() {
    fase = 'selesai'; const menang = sk[0] > sk[1], hadiah = menang ? 60 : 15; S.koin += hadiah; pesan(S, 'Mode Aksi: ' + (menang ? 'menang ' : 'kalah ') + sk[0] + '-' + sk[1] + ' vs ' + lawan.nama, `Hadiah ${hadiah} koin.`); aksi.simpan(); aksi.perbaruiKoin();
    const k = document.createElement('div'); k.className = 'aksi-hasil'; k.innerHTML = `<h2 class="${menang ? 'm' : 'k'}">${menang ? 'MENANG!' : 'KALAH'}</h2><b>${sk[0]} : ${sk[1]}</b><p>+${hadiah} koin</p><button class="tombol-besar" id="aU">MAIN LAGI</button><button class="tombol-besar sekunder" id="aT">TUTUP</button>`;
    el.appendChild(k); k.querySelector('#aU').onclick = () => { k.remove(); mulai(); }; k.querySelector('#aT').onclick = keluar;
  }
  function keluar() { if (tutup) return; tutup = true; cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); el.remove(); }
  const kd = e => { if (e.repeat) return; if (e.key === 'ArrowLeft') tombol.l = 1; if (e.key === 'ArrowRight') tombol.r = 1; if (e.key === ' ') { e.preventDefault(); aksiTombol(); } }, ku = e => { if (e.key === 'ArrowLeft') tombol.l = 0; if (e.key === 'ArrowRight') tombol.r = 0; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const tahan = (id, k) => { const b = el.querySelector(id); b.onpointerdown = e => { e.preventDefault(); tombol[k] = 1; }; for (const n of ['onpointerup', 'onpointerleave', 'onpointercancel']) b[n] = () => tombol[k] = 0; };
  tahan('#aL', 'l'); tahan('#aR', 'r'); el.querySelector('#aA').onpointerdown = e => { e.preventDefault(); aksiTombol(); }; el.querySelector('#aX').onclick = keluar;
  el.dbg = () => ({ fase, sk, me: { ...me }, ball: { x: ball.x, h: ball.h, vy: ball.vy } }); el.aksi = aksiTombol; el.tombol = tombol;
  function loop(n) { if (tutup) return; const dt = Math.min((n - jam) / 1000, .05); jam = n; update(dt); gambar(); raf = requestAnimationFrame(loop); }
  mulai(); jam = performance.now(); raf = requestAnimationFrame(loop);
}
function gambarLatar(c) {
  let sd = 77; const r = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#070b1a'); g.addColorStop(.7, '#10204a'); g.addColorStop(1, '#0a1224'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const col = ['#e4e9f2', '#2455a6', '#f2c230', '#c33b42', '#7d8fb0'];
  for (let row = 0; row < 11; row++) for (let x = 6 + (row % 2) * 7; x < W; x += 14) { c.globalAlpha = .45 + r() * .5; c.fillStyle = col[Math.floor(r() * 5)]; c.beginPath(); c.arc(x, 90 + row * 18, 5.5, 0, 7); c.fill(); }
  c.globalAlpha = 1; for (const x of [120, 400, 680]) { const l = c.createRadialGradient(x, 0, 5, x, 0, 260); l.addColorStop(0, 'rgba(255,241,207,.45)'); l.addColorStop(1, 'rgba(255,241,207,0)'); c.fillStyle = l; c.fillRect(x - 260, 0, 520, 300); }
  c.fillStyle = '#0d1730'; c.fillRect(0, 326, W, 12);
  const fl = c.createLinearGradient(0, 338, 0, H); fl.addColorStop(0, '#b66a2c'); fl.addColorStop(1, '#e0914a'); c.fillStyle = fl; c.fillRect(0, 338, W, H - 338);
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${r() * .06})`; c.fillRect(0, 340 + r() * 110, W, 2); }
  c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(70, 342); c.lineTo(730, 342); c.moveTo(20, 446); c.lineTo(780, 446); c.moveTo(70, 342); c.lineTo(20, 446); c.moveTo(730, 342); c.lineTo(780, 446); c.moveTo(400, 342); c.lineTo(400, 446); c.moveTo(285, 342); c.lineTo(255, 446); c.moveTo(515, 342); c.lineTo(545, 446); c.stroke();
}
