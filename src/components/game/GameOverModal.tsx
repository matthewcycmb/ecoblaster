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
      <div className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center gap-6 min-w-[340px]">
        <h2 className="text-3xl font-bold text-game-danger">Game Over</h2>
        <p className="text-lg text-game-text">
          Your score: <span className="font-mono font-bold text-2xl">{score.toLocaleString()}</span>
        </p>
        {submitted && (
          <p className="text-sm text-green-600 font-semibold">
            Score submitted as {playerName}!
          </p>
        )}
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={onPlayAgain}
            className="w-full rounded-lg bg-game-primary px-6 py-3 text-white font-semibold hover:bg-game-primary/90 transition-colors"
          >
            Play Again
          </button>
          <Link
            href="/leaderboard"
            className="w-full rounded-lg bg-white px-6 py-3 text-game-primary font-semibold border border-game-primary hover:bg-gray-50 transition-colors text-center"
          >
            View Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
