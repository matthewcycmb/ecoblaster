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
      <div className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center gap-6 min-w-[300px]">
        <h2 className="text-2xl font-bold text-game-primary">Paused</h2>
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={onResume}
            className="w-full rounded-lg bg-game-primary px-6 py-3 text-white font-semibold hover:bg-game-primary/90 transition-colors"
          >
            Resume
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full rounded-lg bg-white px-6 py-3 text-game-primary font-semibold border border-game-primary hover:bg-gray-50 transition-colors"
          >
            Settings
          </button>
          <button
            onClick={onQuit}
            className="w-full rounded-lg bg-white px-6 py-3 text-game-danger font-semibold border border-game-danger hover:bg-red-50 transition-colors"
          >
            Quit
          </button>
        </div>
      </div>
    </div>
  );
}
