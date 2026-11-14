# HANDOFF — Volleyball 2D

Game voli aksi tampak samping, HTML + CSS + JavaScript ES Modules murni, tanpa build tool dan tanpa framework. Dirender di `<canvas>` 2D beresolusi logis 1280x720 yang diskalakan memenuhi layar. Semua grafis dan suara dibuat dengan kode.

## Menjalankan

- Modul ES harus dibuka lewat HTTP, tidak bisa lewat `file://`.
- Lokal: `python3 -m http.server 8000` lalu buka `http://localhost:8000`.
- GitHub Pages: upload isi zip ke root repo (`index.html` harus di root), aktifkan Pages dari branch utama.

## Tes

- Tes logika (Node, tanpa browser), dari root repo: `node tests/game.test.mjs`. Tes ini memeriksa aturan poin, balistik, pelanggaran sentuhan, dan bahwa 40 laga AI lawan AI selalu selesai.
- Tes ini harus lulus sebelum setiap push.

## Struktur

```
index.html              markup, canvas, overlay putar, kontrol sentuh
css/style.css           layout, safe-area, kontrol sentuh, media pendek
tests/game.test.mjs      tes logika (node tests/game.test.mjs)
js/main.js              bootstrap: skala canvas, orientasi, fullscreen, loop
js/core/
  konstanta.js          SEMUA angka yang bisa disetel
  loop.js               loop tetap 60 langkah/detik
  layar.js              pengelola layar (satu aktif)
  input.js              keyboard + sentuh, buffer tekan
  audio.js              suara WebAudio (tanpa file)
  simpan.js             localStorage + nomor versi + migrasi
js/game/           logika murni, tanpa DOM
  fisika.js             bola: gravitasi, dinding, jaring, lantai, waktuKe()
  pemain.js             gerak, lompat, titik tangan
  aturan.js             pemenang poin, cek pelanggaran sentuhan
  ai.js                 niat AI (arah, lompat, aksi)
  laga.js               class Laga: servis, rally, sentuhan, poin, fase
js/screen/               render dan UI
  menu.js, pengaturan.js, laga.js (+ jeda dan hasil)
  gambar.js             latar, jaring, pemain, bola, HUD
  ui.js                 tombol, teks, helper hit-test
js/data/
  statistik.js          statistik pemain (smash, terima, blok, servis, kecepatan)
  tim.js                tim dan urutan pemain [penyerang, pengumpan]
```

## Keputusan desain

- **State dipisah dari render.** `js/game/` tidak menyentuh DOM atau canvas, sehingga bisa diuji di Node. Layar hanya membaca state dan menggambarnya.
- **Balistik, bukan tebakan.** Setiap sentuhan menghitung kecepatan horizontal dari target dengan `waktuKe()`, sehingga smash benar-benar jatuh di titik target. Error target dihitung dari statistik dan kualitas timing.
- **Timing smash.** Kualitas timing = kedekatan `vy` pemain ke nol, yaitu puncak lompatan. Makin dekat puncak, makin akurat dan kuat smash.
- **Statistik berpengaruh:** `smash` mengatur daya dan akurasi, `terima` mengatur akurasi terima dan umpan, `blok` mengatur kekuatan pantulan, `servis` mengatur akurasi servis, dan `kecepatan` mengatur gerak serta lompatan.
- **Aturan.** Rally point sampai 15 dengan selisih minimal 2. Maksimal 3 sentuhan per sisi, tidak boleh dua sentuhan berturut oleh pemain yang sama, bola menyentuh jaring atau lantai langsung menghasilkan poin. Blok tidak dihitung sebagai sentuhan tim.
- **Kontrol.** Di desktop: panah (gerak), Spasi/↑ (lompat), Z/K (smash), X/J/Enter (terima atau servis), Esc/P (jeda). Di HP: joystick kiri, tombol kanan. Tombol terima berubah menjadi "Servis" saat pemain kita yang servis.
- **Input buffer.** Smash dan terima dicatat waktunya (170 ms) sehingga tekanan yang sedikit terlambat tetap diterima saat bola sudah dalam jangkauan.
- **Orientasi.** Di portrait ditampilkan overlay "Putar HP", dan permainan dijeda. Sentuhan pertama mencoba fullscreen dan `screen.orientation.lock('landscape')`. Bila gagal, overlay tetap berfungsi sebagai fallback.
- **Penyimpanan.** `localStorage` key `volleyball2d`, berisi `versi`, `suara`, dan `kesulitan`. Fungsi `migrasi()` di `simpan.js` menjadi tempat konversi saat versi naik.
- **Kesulitan AI.** Mudah 0.6, Normal 0.8, Sulit 1.0. Nilai ini memengaruhi peluang bereaksi AI.

## Konstanta yang bisa disetel (`js/core/konstanta.js`)

| Konstanta | Nilai | Fungsi |
|---|---|---|
| `GRAVITASI` | 1800 | Percepatan gravitasi (px/s²). Naikkan agar permainan lebih cepat. |
| `LONCAT` | 800 | Kecepatan awal lompatan. Mengatur tinggi lompatan. |
| `PEMAIN_SPEED` | 340 | Kecepatan gerak dasar, dikali statistik kecepatan. |
| `JANGKAUAN` | 62 | Jarak tangan ke bola yang masih bisa menyentuh. Naikkan agar lebih pemaaf. |
| `SENTUH_MAKS` | 3 | Batas sentuhan per sisi. |
| `SENTUH_JEDA` | 0.22 | Cooldown sentuhan per pemain (detik). |
| `BLOK_JARAK` | 130 | Jarak maks pemain dari jaring untuk bisa blok. |
| `NET_ATAS` | 420 | Tinggi jaring (y puncak). |
| `POIN_TARGET` | 15 | Skor kemenangan. |
| `SELISIH_MIN` | 2 | Selisih minimal untuk menang. |
| `JEDA_POIN` | 1.3 | Jeda antar poin (detik). |
| `SERVIS_TUNDA_AI` | 0.9 | Waktu sebelum AI servis (detik). |
| `BOLA_MAKS` | 1400 | Batas kecepatan bola (px/s). |

Konstanta lain di `js/game/laga.js` dan `js/game/ai.js`: kecepatan target smash (`vy` dan `err`), kecepatan terima dan set (`vy` -560 dan -980), kecepatan servis (`vy` -620), dan ambang reaksi AI.

## Status uji

- Sintaks semua modul lolos `node --check`.
- Simulasi logika (Node, tanpa browser): 40 dari 40 laga AI lawan AI selesai tanpa macet, rata-rata 26 poin per laga, dan aturan selisih 2 berfungsi.
- Chromium headless (Playwright), tanpa galat konsol:
  - Landscape 844x390 dan 1280x720: menu, laga, dan jeda tampil benar. Screenshot sudah diperiksa.
  - Mode sentuh di HP landscape: joystick, Lompat, Smash, dan Servis tampil dan tidak menimpa skor.
  - Portrait 390x844: overlay "Putar HP" muncul.
- **Belum diuji:** perangkat Android sungguhan (fullscreen, lock orientasi, performa 60 fps, dan latensi sentuh), iOS Safari, dan keseimbangan permainan saat dimainkan manusia. Tingkat kesulitan dan konstanta perlu disetel setelah bermain di HP.

## Tahap berikutnya

- Tahap 2: servis dengan timing (power meter), blok dengan timing yang lebih ketat, dan rotasi pemain dalam tim.
- Tahap 3: AI yang lebih cerdas (membaca lintasan bola, formasi), dan opsi 1v1 atau 3v3.
- Tahap 4: statistik karier yang disimpan dan tampilan hasil lebih lengkap.
- Tahap 5: aset tambahan yang tetap dibuat dengan kode (variasi karakter dan warna), serta efek partikel.
