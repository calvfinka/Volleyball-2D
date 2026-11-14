// Suara dibuat dengan WebAudio. Tidak ada file audio.
let konteks = null;
let aktif = true;

export function setSuara(on) { aktif = on; }

function pastikan() {
  if (!konteks) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    konteks = new AC();
  }
  if (konteks.state === 'suspended') konteks.resume();
  return konteks;
}

function bunyi(frek, durasi, tipe, vol, geser = 0) {
  if (!aktif) return;
  const c = pastikan();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = tipe;
  o.frequency.setValueAtTime(frek, t);
  if (geser) o.frequency.linearRampToValueAtTime(Math.max(40, frek + geser), t + durasi);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durasi);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + durasi);
}

export const sfx = {
  pukul: () => bunyi(520, 0.07, 'triangle', 0.14),
  smash: () => bunyi(980, 0.12, 'sawtooth', 0.12, -700),
  pantul: () => bunyi(220, 0.06, 'sine', 0.12),
  peluit: () => bunyi(1400, 0.16, 'sine', 0.08),
  poin: () => bunyi(660, 0.28, 'square', 0.07, 320),
};
