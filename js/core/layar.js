// Pengelola layar sederhana: hanya satu layar aktif pada satu waktu.
// Layar: { nama, masuk?(), update(dt), render(ctx), labelTerima?() }
let aktif = null;

export const layar = {
  get aktif() { return aktif; },
  ganti(s) {
    aktif = s;
    if (s.masuk) s.masuk();
  },
  update(dt) { if (aktif) aktif.update(dt); },
  render(ctx) { if (aktif) aktif.render(ctx); },
};
