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

// ─── Background Music (MP3) ───

const MUSIC_TRACKS = [
  "/audio/amusement-park-pecan-pie-main-version-27491-02-07.mp3",
  "/audio/anomy5-phonk-phonk-music-467523.mp3",
  "/audio/watermello-phonk-phonk-drift-496890.mp3",
];

const MUSIC_VOLUME = 0.3;

let musicPlaying = false;
let musicMutedState = false;
let currentAudio: HTMLAudioElement | null = null;
let lastTrackIndex = -1;
let fadeInterval: ReturnType<typeof setInterval> | null = null;

function pickNextTrack(): string {
  let idx: number;
  do {
    idx = Math.floor(Math.random() * MUSIC_TRACKS.length);
  } while (idx === lastTrackIndex && MUSIC_TRACKS.length > 1);
  lastTrackIndex = idx;
  return MUSIC_TRACKS[idx];
}

function playNextTrack(): void {
  if (!musicPlaying) return;
  const src = pickNextTrack();
  const audio = new Audio(src);
  audio.volume = MUSIC_VOLUME;
  audio.muted = musicMutedState;
  audio.onended = () => {
    if (musicPlaying) playNextTrack();
  };
  currentAudio = audio;
  audio.play().catch(() => {});
}

export function startBackgroundMusic(): void {
  if (musicPlaying) return;
  // Clean up any lingering fade
  if (fadeInterval) {
    clearInterval(fadeInterval);
    fadeInterval = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  musicPlaying = true;
  playNextTrack();
}

export function stopBackgroundMusic(): void {
  musicPlaying = false;
  if (fadeInterval) {
    clearInterval(fadeInterval);
    fadeInterval = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

export function fadeOutBackgroundMusic(durationMs = 2000): void {
  if (!currentAudio || !musicPlaying) {
    stopBackgroundMusic();
    return;
  }
  musicPlaying = false; // prevent onended from queuing next track
  const audio = currentAudio;
  const startVol = audio.volume;
  const steps = 40;
  const stepMs = durationMs / steps;
  let step = 0;
  fadeInterval = setInterval(() => {
    step++;
    audio.volume = Math.max(0, startVol * (1 - step / steps));
    if (step >= steps) {
      clearInterval(fadeInterval!);
      fadeInterval = null;
      audio.pause();
      currentAudio = null;
    }
  }, stepMs);
}

export function setMusicMuted(m: boolean): void {
  musicMutedState = m;
  if (currentAudio) {
    currentAudio.muted = m;
  }
}

export function isMusicMuted(): boolean {
  return musicMutedState;
}
