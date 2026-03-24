"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { submitScore } from "@/lib/supabase/leaderboard";

// Timing (ms)
const LINE_HOLD = 2000;
const FADE_DURATION = 1500;
const STEP_TOTAL = LINE_HOLD + FADE_DURATION;

const OCEAN_FACTS = [
  "8 million tons of plastic enter the ocean every year.",
  "By 2050, there could be more plastic than fish in the sea.",
  "Over 1 million marine animals die from plastic pollution annually.",
  "Only 9% of all plastic ever produced has been recycled.",
  "A single plastic bottle takes 450 years to decompose in the ocean.",
  "Coral reefs support 25% of all marine species but cover less than 1% of the ocean floor.",
  "We've lost half the world's coral reefs in the last 30 years.",
  "Microplastics have been found in the deepest ocean trenches.",
];

type Stage = "silent" | "waves" | "real-ocean" | "fact" | "score";

export default function GameOverModal({
  score,
  wave,
  playerName,
  onPlayAgain,
}: {
  score: number;
  wave: number;
  playerName: string;
  onPlayAgain: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [stage, setStage] = useState<Stage>("silent");
  const [fadeIn, setFadeIn] = useState(false);
  const [fact] = useState(() => OCEAN_FACTS[Math.floor(Math.random() * OCEAN_FACTS.length)]);
  const timersRef = { current: [] as ReturnType<typeof setTimeout>[] };

  const skipToScore = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setStage("score");
    setFadeIn(true);
  };

  // Auto-submit score on mount
  useEffect(() => {
    if (playerName && score > 0) {
      submitScore(playerName, score).then((result) => {
        if (result.success) setSubmitted(true);
      });
    }
  }, [playerName, score]);

  // Cinematic sequence
  useEffect(() => {
    // Trigger initial fade-in on next frame
    requestAnimationFrame(() => setFadeIn(true));

    const timers: ReturnType<typeof setTimeout>[] = [];
    timersRef.current = timers;
    let t = 0;

    // "The reef went silent." holds for LINE_HOLD, then fades out
    t += LINE_HOLD;
    timers.push(setTimeout(() => setFadeIn(false), t));

    // Transition to "waves" line
    t += FADE_DURATION;
    timers.push(setTimeout(() => { setStage("waves"); setFadeIn(true); }, t));

    // Hold "waves", then fade out
    t += LINE_HOLD;
    timers.push(setTimeout(() => setFadeIn(false), t));

    // Transition to "real-ocean" line
    t += FADE_DURATION;
    timers.push(setTimeout(() => { setStage("real-ocean"); setFadeIn(true); }, t));

    // Hold "real-ocean", then fade out
    t += LINE_HOLD;
    timers.push(setTimeout(() => setFadeIn(false), t));

    // Transition to ocean fact
    t += FADE_DURATION;
    timers.push(setTimeout(() => { setStage("fact"); setFadeIn(true); }, t));

    // Hold fact, then fade out
    t += LINE_HOLD + 500; // slightly longer hold for the fact
    timers.push(setTimeout(() => setFadeIn(false), t));

    // Transition to score screen
    t += FADE_DURATION;
    timers.push(setTimeout(() => { setStage("score"); setFadeIn(true); }, t));

    return () => timers.forEach(clearTimeout);
  }, []);

  // Narrative lines
  if (stage !== "score") {
    const text =
      stage === "silent" ? "The reef went silent." :
      stage === "waves" ? `You protected it for ${wave - 1} wave${wave - 1 === 1 ? "" : "s"}.` :
      stage === "real-ocean" ? "But in the real ocean, there are no restarts." :
      fact;

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50 cursor-pointer" onClick={skipToScore}>
        <p
          className="text-white text-xl sm:text-3xl font-light tracking-wide text-center px-8 max-w-lg"
          style={{
            opacity: fadeIn ? 1 : 0,
            transition: `opacity ${FADE_DURATION}ms ease-in-out`,
            textShadow: "0 0 20px rgba(0,0,0,0.9)",
          }}
        >
          {text}
        </p>
        <p className="absolute bottom-8 text-xs text-white/30 tracking-wide">Tap to skip</p>
      </div>
    );
  }

  // Score screen
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
      <div
        className="bg-[#0a1628]/95 border border-cyan-500/25 rounded-xl p-6 sm:p-8 shadow-[0_0_40px_rgba(0,200,255,0.12)] backdrop-blur-sm flex flex-col items-center gap-4 sm:gap-6 w-[85vw] max-w-[340px]"
        style={{
          opacity: fadeIn ? 1 : 0,
          transition: `opacity ${FADE_DURATION}ms ease-in-out`,
        }}
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-cyan-400">Reef Destroyed</h2>
        <p className="text-base sm:text-lg text-white/80">
          Trash cleaned: <span className="font-mono font-bold text-xl sm:text-2xl text-cyan-400">{score.toLocaleString()}</span>
        </p>
        {submitted && (
          <p className="text-sm text-emerald-400 font-semibold">
            Score submitted as {playerName}!
          </p>
        )}
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={onPlayAgain}
            className="w-full rounded-lg bg-cyan-600/90 border border-cyan-500/50 px-6 py-3 text-white font-semibold hover:bg-cyan-500/90 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/leaderboard"
            className="w-full rounded-lg bg-white/5 border border-white/15 px-6 py-3 text-white/90 font-semibold hover:bg-white/10 transition-colors text-center"
          >
            View Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
