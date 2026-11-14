// Semua angka yang bisa disetel ada di sini. Satuan: piksel logis dan detik.
export const K = {
  LEBAR: 1280,
  TINGGI: 720,

  LANTAI_Y: 600,        // permukaan lapangan (kaki pemain berada di y ini)
  NET_X: 640,           // posisi horizontal jaring
  NET_ATAS: 420,        // y puncak jaring
  NET_TEBAL: 10,

  GRAVITASI: 1800,      // px/s²
  BOLA_R: 18,
  BOLA_MAKS: 1400,      // batas kecepatan bola px/s

  PEMAIN_T: 96,         // tinggi badan pemain
  PEMAIN_L: 40,         // lebar badan (untuk batas gerak)
  PEMAIN_SPEED: 340,    // px/s dasar, dikali statistik kecepatan
  LONCAT: 800,          // kecepatan awal lompatan
  JANGKAUAN: 62,        // jarak tangan ke pusat bola yang masih bisa menyentuh

  SENTUH_MAKS: 3,       // sentuhan per sisi sebelum pelanggaran
  SENTUH_JEDA: 0.22,    // detik cooldown sentuhan per pemain
  BLOK_JARAK: 130,      // jarak maks pemain dari jaring untuk bisa blok

  POIN_TARGET: 15,      // rally point sampai 15
  SELISIH_MIN: 2,       // harus unggul minimal 2 poin
  JEDA_POIN: 1.3,       // detik antar poin
  SERVIS_TUNDA_AI: 0.9, // detik sebelum AI melakukan servis
};
