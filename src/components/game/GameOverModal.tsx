"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { submitScore } from "@/lib/supabase/leaderboard";

export default function GameOverModal({
  score,
  playerName,
  onPlayAgain,
}: {
  score: number;
  playerName: string;
  onPlayAgain: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);

  // Auto-submit score on mount
  useEffect(() => {
    if (playerName && score > 0) {
      submitScore(playerName, score).then((result) => {
        if (result.success) setSubmitted(true);
      });
    }
  }, [playerName, score]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
      <div className="bg-[#0a1628]/95 border border-red-500/25 rounded-xl p-8 shadow-[0_0_40px_rgba(255,90,95,0.12)] backdrop-blur-sm flex flex-col items-center gap-6 min-w-[340px]">
        <h2 className="text-3xl font-bold text-red-400">Reef Destroyed</h2>
        <p className="text-lg text-white/80">
          Trash cleaned: <span className="font-mono font-bold text-2xl text-cyan-400">{score.toLocaleString()}</span>
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
