// Procedural WebAudio synthesizer for Volleyball 2D (zero external audio files)

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.unlocked = false;
  }

  ensureContext() {
    if (this.muted || !this.unlocked) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlock() {
    this.unlocked = true;
    this.ensureContext();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
  }

  isMuted() {
    return this.muted;
  }

  playTone({ freq = 440, endFreq = null, duration = 0.1, type = 'sine', gain = 0.18, delay = 0 }) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
    }

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playNoiseBurst({ duration = 0.06, filterFreq = 900, gain = 0.15 }) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.2;

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(amp);
    amp.connect(ctx.destination);
    src.start();
  }

  playJump() {
    this.playTone({ freq: 190, endFreq: 340, duration: 0.09, type: 'triangle', gain: 0.11 });
  }

  playServe() {
    this.playNoiseBurst({ duration: 0.07, filterFreq: 750, gain: 0.18 });
    this.playTone({ freq: 240, endFreq: 110, duration: 0.11, type: 'sine', gain: 0.2 });
  }

  playReceive() {
    const jitter = 0.94 + Math.random() * 0.12;
    this.playNoiseBurst({ duration: 0.05, filterFreq: 650 * jitter, gain: 0.13 });
    this.playTone({ freq: 210 * jitter, endFreq: 130, duration: 0.08, type: 'sine', gain: 0.16 });
  }

  playSet() {
    this.playTone({ freq: 380, endFreq: 520, duration: 0.08, type: 'sine', gain: 0.12 });
  }

  playSmash(isPerfect = false) {
    this.playNoiseBurst({ duration: 0.09, filterFreq: isPerfect ? 1400 : 1000, gain: isPerfect ? 0.28 : 0.2 });
    this.playTone({ freq: isPerfect ? 320 : 250, endFreq: 75, duration: 0.15, type: 'triangle', gain: isPerfect ? 0.26 : 0.2 });
    if (isPerfect) {
      this.playTone({ freq: 660, endFreq: 880, duration: 0.11, type: 'sine', gain: 0.11, delay: 0.02 });
    }
  }

  playBlock() {
    this.playNoiseBurst({ duration: 0.06, filterFreq: 500, gain: 0.22 });
    this.playTone({ freq: 165, endFreq: 85, duration: 0.12, type: 'square', gain: 0.12 });
  }

  playNetHit() {
    this.playTone({ freq: 140, endFreq: 95, duration: 0.09, type: 'triangle', gain: 0.12 });
  }

  playWhistle() {
    this.playTone({ freq: 2150, endFreq: 2280, duration: 0.12, type: 'sine', gain: 0.08 });
    this.playTone({ freq: 2280, endFreq: 2050, duration: 0.14, type: 'sine', gain: 0.07, delay: 0.11 });
  }

  playPoint(isHomePoint) {
    if (isHomePoint) {
      this.playTone({ freq: 523.25, duration: 0.1, type: 'triangle', gain: 0.14 });
      this.playTone({ freq: 659.25, duration: 0.14, type: 'triangle', gain: 0.15, delay: 0.08 });
    } else {
      this.playTone({ freq: 349.23, duration: 0.1, type: 'triangle', gain: 0.12 });
      this.playTone({ freq: 293.66, duration: 0.16, type: 'triangle', gain: 0.12, delay: 0.09 });
    }
  }

  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      this.playTone({ freq: f, duration: 0.18, type: 'triangle', gain: 0.15, delay: idx * 0.09 });
    });
  }

  playDefeat() {
    const notes = [392.0, 349.23, 311.13, 261.63];
    notes.forEach((f, idx) => {
      this.playTone({ freq: f, duration: 0.2, type: 'triangle', gain: 0.13, delay: idx * 0.11 });
    });
  }
}

export const audio = new SoundEngine();
