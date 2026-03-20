let audioCtx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (muted) return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function setMuted(m: boolean): void {
  muted = m;
  if (audioCtx) {
    if (m) {
      audioCtx.suspend();
    } else {
      audioCtx.resume();
    }
  }
}

export function isMuted(): boolean {
  return muted;
}

export function initAudio(): void {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

export function playGunshot(): void {
  const ctx = getCtx();
  if (!ctx) return;

  const duration = 0.08;
  const sampleRate = ctx.sampleRate;
  const bufferSize = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1200;
  filter.Q.value = 1.5;

  const gain = ctx.createGain();
  gain.gain.value = 0.4;

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
}

export function playHit(): void {
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}

export function playZombieGroan(): void {
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(90, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(70, ctx.currentTime + 0.4);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 15;
  lfo.connect(lfoGain).connect(osc.frequency);
  lfo.start();

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 0.5);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 300;

  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
  lfo.stop(ctx.currentTime + 0.5);
}

export function playGameOverStinger(): void {
  const ctx = getCtx();
  if (!ctx) return;

  const notes = [110, 130.81, 164.81]; // A2, C3, E3 — minor feel
  for (const freq of notes) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq + (Math.random() - 0.5) * 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.5);
  }
}

export function playComboChime(tier: number): void {
  const ctx = getCtx();
  if (!ctx) return;

  const baseFreq = 400 + tier * 200;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, ctx.currentTime + 0.15);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

export function playExplosion(): void {
  const ctx = getCtx();
  if (!ctx) return;

  const duration = 0.3;
  const sampleRate = ctx.sampleRate;
  const bufferSize = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;

  const gain = ctx.createGain();
  gain.gain.value = 0.5;

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
}

export function playPowerUpCollect(): void {
  const ctx = getCtx();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.06);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.06 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.06 + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + i * 0.06);
    osc.stop(ctx.currentTime + i * 0.06 + 0.15);
  });
}

export function playBossRoar(): void {
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(60, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.8);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 8;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 20;
  lfo.connect(lfoGain).connect(osc.frequency);
  lfo.start();

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 1.0);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 250;

  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 1.0);
  lfo.stop(ctx.currentTime + 1.0);
}

// ─── Background Music ───

let musicPlaying = false;
let musicStopFn: (() => void) | null = null;

export function startBackgroundMusic(): void {
  if (musicPlaying) return;
  const maybeCtx = getCtx();
  if (!maybeCtx) return;
  const ctx: AudioContext = maybeCtx;

  musicPlaying = true;

  const bpm = 130;
  const beatDur = 60 / bpm;
  const loopDuration = beatDur * 8; // 8 beats per loop

  // Master gain for music (well below SFX)
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.08;
  masterGain.connect(ctx.destination);

  // Bass oscillator (continuous, note changes scheduled)
  const bassOsc = ctx.createOscillator();
  bassOsc.type = "sawtooth";
  const bassFilter = ctx.createBiquadFilter();
  bassFilter.type = "lowpass";
  bassFilter.frequency.value = 200;
  bassFilter.Q.value = 5;
  const bassGain = ctx.createGain();
  bassGain.gain.value = 0.4;
  bassOsc.connect(bassFilter).connect(bassGain).connect(masterGain);

  const bassNotes = [110, 110, 82.41, 110, 130.81, 130.81, 98, 110];

  function scheduleBass(startTime: number) {
    for (let i = 0; i < bassNotes.length; i++) {
      const noteTime = startTime + i * beatDur;
      bassOsc.frequency.setValueAtTime(bassNotes[i], noteTime);
      bassGain.gain.setValueAtTime(0.4, noteTime);
      bassGain.gain.exponentialRampToValueAtTime(0.15, noteTime + beatDur * 0.8);
    }
  }

  function createKick(time: number) {
    const kickOsc = ctx.createOscillator();
    kickOsc.type = "sine";
    kickOsc.frequency.setValueAtTime(150, time);
    kickOsc.frequency.exponentialRampToValueAtTime(30, time + 0.1);
    const kickGain = ctx.createGain();
    kickGain.gain.setValueAtTime(0.5, time);
    kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    kickOsc.connect(kickGain).connect(masterGain);
    kickOsc.start(time);
    kickOsc.stop(time + 0.15);
  }

  function createHiHat(time: number, accent: boolean) {
    const bufferSize = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 4);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const hhFilter = ctx.createBiquadFilter();
    hhFilter.type = "highpass";
    hhFilter.frequency.value = 8000;
    const hhGain = ctx.createGain();
    hhGain.gain.value = accent ? 0.25 : 0.12;
    source.connect(hhFilter).connect(hhGain).connect(masterGain);
    source.start(time);
  }

  const melodyNotes = [0, 659.25, 0, 587.33, 0, 0, 523.25, 0];

  function createMelodyNote(time: number, freq: number) {
    if (freq === 0) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 3;
    lfo.connect(lfoG).connect(osc.frequency);
    lfo.start(time);
    lfo.stop(time + beatDur * 1.5);
    const melGain = ctx.createGain();
    melGain.gain.setValueAtTime(0, time);
    melGain.gain.linearRampToValueAtTime(0.15, time + 0.05);
    melGain.gain.exponentialRampToValueAtTime(0.001, time + beatDur * 1.2);
    osc.connect(melGain).connect(masterGain);
    osc.start(time);
    osc.stop(time + beatDur * 1.5);
  }

  function scheduleLoop(startTime: number) {
    scheduleBass(startTime);
    for (let beat = 0; beat < 8; beat++) {
      const t = startTime + beat * beatDur;
      if (beat % 2 === 0) createKick(t);
      createHiHat(t, beat % 2 === 1);
      createHiHat(t + beatDur * 0.5, false);
      createMelodyNote(t, melodyNotes[beat]);
    }
  }

  bassOsc.start(ctx.currentTime);
  scheduleLoop(ctx.currentTime);

  let nextLoopTime = ctx.currentTime + loopDuration;
  const scheduleInterval = setInterval(() => {
    if (!musicPlaying) {
      clearInterval(scheduleInterval);
      return;
    }
    while (nextLoopTime < ctx.currentTime + 2) {
      scheduleLoop(nextLoopTime);
      nextLoopTime += loopDuration;
    }
  }, 200);

  musicStopFn = () => {
    musicPlaying = false;
    clearInterval(scheduleInterval);
    try { bassOsc.stop(); } catch { /* already stopped */ }
    try { masterGain.disconnect(); } catch { /* ok */ }
  };
}

export function stopBackgroundMusic(): void {
  if (musicStopFn) {
    musicStopFn();
    musicStopFn = null;
  }
  musicPlaying = false;
}
