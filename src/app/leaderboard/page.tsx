"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getTopScores, LeaderboardEntry } from "@/lib/supabase/leaderboard";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function LeaderboardPage() {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTopScores(10).then((data) => {
      setScores(data);
      setLoading(false);
    });
  }, []);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-4xl font-bold tracking-tight text-white">
        Leaderboard
      </h1>

      <div className="w-full max-w-md">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading…</p>
        ) : scores.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No scores yet. Be the first to play!
          </p>
        ) : (
          <div className="bg-black/30 rounded-xl overflow-hidden border border-white/10">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground text-sm">
                  <th className="px-4 py-3 w-12">#</th>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((entry, i) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-white/5 ${
                      i === 0
                        ? "text-yellow-400 font-semibold"
                        : i === 1
                          ? "text-gray-300"
                          : i === 2
                            ? "text-amber-600"
                            : "text-white/80"
                    }`}
                  >
                    <td className="px-4 py-3 font-mono">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td className="px-4 py-3 truncate max-w-[160px]">
                      {entry.player_name}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {entry.score.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                      {timeAgo(entry.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <Link
          href="/"
          className="rounded-lg bg-white/60 px-6 py-3 text-game-primary font-semibold border border-game-primary/50 hover:bg-white/80 transition-colors"
        >
          Home
        </Link>
        <Link
          href="/game"
          className="rounded-lg bg-game-primary px-6 py-3 text-white font-semibold hover:bg-game-primary/90 transition-colors"
        >
          Play
        </Link>
      </div>
    </main>
  );
}
