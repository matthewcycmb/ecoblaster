"use client";

import { useState, useEffect } from "react";
import { Settings, Difficulty } from "@/lib/types";
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "@/lib/settings/store";
import { setMuted } from "@/lib/audio/sfx";

export default function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (open) {
      setSettings(loadSettings());
    }
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    saveSettings(settings);
    setMuted(settings.muted);
    onClose();
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_SETTINGS });
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
      <div className="bg-[#0a1628]/95 border border-cyan-500/25 rounded-xl p-8 shadow-[0_0_40px_rgba(0,200,255,0.12)] backdrop-blur-sm flex flex-col gap-6 min-w-[340px] max-w-[420px]">
        <h2 className="text-2xl font-bold text-cyan-400">Settings</h2>

        {/* Difficulty */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-white/80">
            Difficulty
          </label>
          <div className="flex gap-2">
            {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setSettings((s) => ({ ...s, difficulty: d }))}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors capitalize ${
                  settings.difficulty === d
                    ? "bg-cyan-600/90 border border-cyan-500/50 text-white"
                    : "bg-white/5 border border-white/15 text-white/60 hover:bg-white/10"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Mute toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white/80">
            Mute Audio
          </label>
          <button
            onClick={() => setSettings((s) => ({ ...s, muted: !s.muted }))}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              settings.muted ? "bg-white/20" : "bg-cyan-500"
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                settings.muted ? "left-0.5" : "left-6"
              }`}
            />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-cyan-600/90 border border-cyan-500/50 px-6 py-3 text-white font-semibold hover:bg-cyan-500/90 transition-colors"
          >
            Save Settings
          </button>
          <button
            onClick={handleReset}
            className="flex-1 rounded-lg bg-white/5 border border-white/15 px-6 py-3 text-white/80 font-semibold hover:bg-white/10 transition-colors"
          >
            Reset to Default
          </button>
        </div>
      </div>
    </div>
  );
}
