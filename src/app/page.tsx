"use client";

import Link from "next/link";
import { useState } from "react";
import SettingsModal from "@/components/settings/SettingsModal";

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden">
      {/* Atmospheric fog layers */}
      <div className="game-fog absolute inset-0 bg-gradient-to-b from-red-900/5 via-transparent to-green-900/5" />
      <div className="game-fog absolute inset-0 bg-gradient-to-r from-transparent via-purple-900/5 to-transparent" style={{ animationDelay: "4s" }} />

      {/* Title block */}
      <div className="relative z-10 flex flex-col items-center gap-3 mb-2">
        <h1 className="game-title text-6xl sm:text-7xl font-black text-game-danger tracking-widest drop-shadow-lg">
          Zombie Flick
        </h1>
        <p className="game-subtitle text-lg sm:text-xl text-gray-400 text-center max-w-md tracking-wide">
          Aim with your hand. Flick to kill.
        </p>
      </div>

      {/* Divider line */}
      <div className="w-48 h-px bg-gradient-to-r from-transparent via-game-danger/40 to-transparent" />

      {/* Menu buttons */}
      <nav className="relative z-10 flex flex-col gap-3 items-center w-64">
        <Link
          href="/game"
          className="game-menu-btn w-full text-center rounded-lg bg-game-danger/90 border border-game-danger/50 px-8 py-4 text-lg font-bold text-white tracking-wider uppercase"
        >
          Start Game
        </Link>
        <Link
          href="/leaderboard"
          className="game-menu-btn w-full text-center rounded-lg bg-white/5 border border-white/15 px-8 py-3 text-base font-semibold text-white/90 tracking-wide uppercase"
        >
          Leaderboard
        </Link>
        <button
          onClick={() => setSettingsOpen(true)}
          className="game-menu-btn w-full text-center rounded-lg bg-white/5 border border-white/15 px-8 py-3 text-base font-semibold text-white/90 tracking-wide uppercase"
        >
          Settings
        </button>
      </nav>

      {/* Footer hint */}
      <p className="relative z-10 text-xs text-gray-600 mt-4 tracking-wide">
        Webcam + hand tracking required
      </p>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}
