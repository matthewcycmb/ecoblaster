"use client";

import { useState } from "react";
import SettingsModal from "@/components/settings/SettingsModal";

export default function PauseModal({
  onResume,
  onQuit,
}: {
  onResume: () => void;
  onQuit: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (settingsOpen) {
    return <SettingsModal open={true} onClose={() => setSettingsOpen(false)} />;
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-[#0a1628]/95 border border-cyan-500/25 rounded-xl p-8 shadow-[0_0_40px_rgba(0,200,255,0.12)] backdrop-blur-sm flex flex-col items-center gap-6 min-w-[300px]">
        <h2 className="text-2xl font-bold text-cyan-400">Paused</h2>
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={onResume}
            className="w-full rounded-lg bg-cyan-600/90 border border-cyan-500/50 px-6 py-3 text-white font-semibold hover:bg-cyan-500/90 transition-colors"
          >
            Resume
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full rounded-lg bg-white/5 border border-white/15 px-6 py-3 text-white/90 font-semibold hover:bg-white/10 transition-colors"
          >
            Settings
          </button>
          <button
            onClick={onQuit}
            className="w-full rounded-lg bg-white/5 border border-red-500/40 px-6 py-3 text-red-400 font-semibold hover:bg-red-500/10 transition-colors"
          >
            Quit
          </button>
        </div>
      </div>
    </div>
  );
}
