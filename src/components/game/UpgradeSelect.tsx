"use client";

import { Upgrade } from "@/lib/types";

export default function UpgradeSelect({
  choices,
  onSelect,
  score,
  onBuyDefender,
}: {
  choices: Upgrade[];
  onSelect: (upgrade: Upgrade) => void;
  score: number;
  onBuyDefender: () => void;
}) {
  const showDefender = false; // hidden for now — score >= 500

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-40 px-4 sm:px-6">
      <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-cyan-400 mb-1 sm:mb-1.5 tracking-widest uppercase">
        Choose Upgrade
      </h2>
      <p className="text-xs sm:text-sm text-gray-400/70 mb-4 sm:mb-8">
        Pick one to power up your reef defense
      </p>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-5 justify-center items-center sm:items-stretch w-full max-w-[20rem] sm:max-w-none">
        {choices.map((upgrade) => (
          <button
            key={upgrade.id}
            onClick={() => onSelect(upgrade)}
            className="w-full sm:w-64 bg-white/5 border border-white/10 hover:border-cyan-400/50 hover:bg-white/10 active:bg-white/15 rounded-2xl px-5 sm:px-8 py-4 sm:py-8 flex flex-row sm:flex-col items-center gap-3 sm:gap-3 transition-all group cursor-pointer overflow-hidden"
          >
            <span className="text-3xl sm:text-5xl group-hover:scale-110 transition-transform shrink-0">
              {upgrade.icon}
            </span>
            <div className="flex flex-col sm:items-center gap-0.5 sm:gap-2 text-left sm:text-center">
              <span className="text-white font-bold text-sm sm:text-lg">
                {upgrade.name}
              </span>
              <span className="text-gray-400/80 text-xs sm:text-sm">
                {upgrade.description}
              </span>
            </div>
          </button>
        ))}

        {showDefender && (
          <button
            onClick={onBuyDefender}
            className="w-full sm:w-64 bg-teal-500/10 border border-teal-400/30 hover:border-teal-400/60 hover:bg-teal-500/20 active:bg-teal-500/25 rounded-2xl px-5 sm:px-8 py-3 sm:py-8 flex flex-row sm:flex-col items-center gap-3 sm:gap-3 transition-all group cursor-pointer overflow-hidden"
          >
            <span className="text-3xl sm:text-5xl group-hover:scale-110 transition-transform shrink-0">
              🐟
            </span>
            <div className="flex flex-col sm:items-center gap-0.5 sm:gap-2 text-left sm:text-center">
              <span className="text-teal-300 font-bold text-sm sm:text-lg">
                Reef Defender
              </span>
              <span className="text-teal-400/60 text-xs sm:text-sm">
                Fish ally · 500 pts
              </span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
