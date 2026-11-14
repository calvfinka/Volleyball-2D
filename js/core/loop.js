// Loop tetap 60 langkah per detik, terpisah dari kecepatan render layar.
export function mulaiLoop(update, render) {
  const LANGKAH = 1 / 60;
  let terakhir = performance.now();
  let akumulasi = 0;

  function bingkai(waktu) {
    let dt = (waktu - terakhir) / 1000;
    terakhir = waktu;
    if (dt > 0.1) dt = 0.1; // cegah lompatan besar setelah tab tidak aktif
    akumulasi += dt;
    while (akumulasi >= LANGKAH) {
      update(LANGKAH);
      akumulasi -= LANGKAH;
    }
    render();
    requestAnimationFrame(bingkai);
  }
  requestAnimationFrame(bingkai);
}
