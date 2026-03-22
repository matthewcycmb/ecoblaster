"use client";

import { useEffect, useState } from "react";

const WAVE_MESSAGES: Record<number, string> = {
  1: "The first plastic arrives...",
  2: "It's getting worse.",
  3: "The fish are scared.",
  4: "The reef is struggling.",
  5: "You can't keep up.",
  6: "This is what extinction feels like.",
  7: "The current brings more.",
  8: "Nobody's coming to help.",
  9: "The colors are fading.",
  10: "The fish remember what this place was.",
  11: "Every wave is heavier than the last.",
  12: "You were never supposed to last this long.",
  13: "The ocean doesn't forgive.",
  14: "How long can one reef hold?",
  15: "They'll write about this reef.",
  16: "The tide is turning against you.",
  17: "Even the water tastes wrong.",
  18: "This is what persistence looks like.",
  19: "One reef. Against all of it.",
  20: "Still here. Still fighting.",
};

const DEFAULT_MESSAGE = "The reef endures.";

// Timing (ms) — total ≈ 3600ms to match WAVE_COUNTDOWN_MS
const STORY_FADE_IN = 400;
const STORY_HOLD = 1200;
const STORY_FADE_OUT = 400;
const STORY_TOTAL = STORY_FADE_IN + STORY_HOLD + STORY_FADE_OUT; // 2000

const WAVE_DELAY = STORY_TOTAL + 100; // small gap after story fades
const WAVE_FADE_IN = 300;
const WAVE_HOLD = 800;
const WAVE_FADE_OUT = 300;

type Stage = "story-in" | "story-hold" | "story-out" | "wave-in" | "wave-hold" | "wave-out" | "done";

export default function WaveCountdown({
  wave,
  isSurgeWave,
}: {
  wave: number;
  isSurgeWave: boolean;
}) {
  const [stage, setStage] = useState<Stage>("story-in");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 0;

    t += STORY_FADE_IN;
    timers.push(setTimeout(() => setStage("story-hold"), t));

    t += STORY_HOLD;
    timers.push(setTimeout(() => setStage("story-out"), t));

    t = WAVE_DELAY;
    timers.push(setTimeout(() => setStage("wave-in"), t));

    t += WAVE_FADE_IN;
    timers.push(setTimeout(() => setStage("wave-hold"), t));

    t += WAVE_HOLD;
    timers.push(setTimeout(() => setStage("wave-out"), t));

    t += WAVE_FADE_OUT;
    timers.push(setTimeout(() => setStage("done"), t));

    return () => timers.forEach(clearTimeout);
  }, [wave]);

  const message = WAVE_MESSAGES[wave] ?? DEFAULT_MESSAGE;

  const showStory = stage === "story-in" || stage === "story-hold" || stage === "story-out";
  const showWave = stage === "wave-in" || stage === "wave-hold" || stage === "wave-out";

  const storyOpacity =
    stage === "story-in" ? 0 :
    stage === "story-hold" ? 1 :
    stage === "story-out" ? 0 : 0;

  const waveOpacity =
    stage === "wave-in" ? 0 :
    stage === "wave-hold" ? 1 :
    stage === "wave-out" ? 0 : 0;

  const waveScale =
    stage === "wave-in" ? 0.7 :
    stage === "wave-hold" ? 1 :
    stage === "wave-out" ? 1.1 : 1;

  if (stage === "done") return null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-40 pointer-events-none">
      {/* Story message */}
      {showStory && (
        <p
          className="text-white text-lg sm:text-2xl md:text-3xl font-light tracking-wide text-center px-6"
          style={{
            opacity: storyOpacity,
            transition: `opacity ${stage === "story-in" ? STORY_FADE_IN : STORY_FADE_OUT}ms ease-out`,
            textShadow: "0 0 20px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.7)",
          }}
        >
          {message}
        </p>
      )}

      {/* Wave title */}
      {showWave && (
        <div
          className="flex flex-col items-center"
          style={{
            opacity: waveOpacity,
            transform: `scale(${waveScale})`,
            transition: `opacity ${WAVE_FADE_IN}ms ease-out, transform ${WAVE_FADE_IN}ms ease-out`,
          }}
        >
          {isSurgeWave ? (
            <>
              <p
                className="text-5xl sm:text-7xl font-black text-red-500 tracking-wider uppercase text-center px-4"
                style={{ textShadow: "0 0 30px rgba(255,80,80,0.6), 0 0 60px rgba(255,80,80,0.3)" }}
              >
                Trash Surge
              </p>
              <p className="text-lg sm:text-2xl text-red-300 mt-3 font-bold tracking-widest uppercase text-center px-4">
                Wave {wave} — Defend the Reef!
              </p>
            </>
          ) : (
            <p
              className="text-5xl sm:text-7xl font-black text-cyan-400 tracking-wider uppercase"
              style={{ textShadow: "0 0 30px rgba(0,200,255,0.5), 0 0 60px rgba(0,200,255,0.2)" }}
            >
              Wave {wave}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
