"use client";

export default function GameHUD({
  health,
  score,
  wave,
  isSurgeWave,
  onPause,
}: {
  health: number;
  score: number;
  wave: number;
  isSurgeWave: boolean;
  onPause: () => void;
}) {
  return (
    <>
      {/* Bottom HUD bar */}
      <div className="absolute bottom-16 sm:bottom-6 left-0 right-0 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3">
        {/* Health */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
          <span className="text-white font-semibold text-xs sm:text-sm whitespace-nowrap">Reef:</span>
          <div className="w-20 sm:w-32 h-2 sm:h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(0, health)}%`,
                backgroundColor: health > 50 ? "#10b981" : health > 25 ? "#FFD166" : "#FF5A5F",
              }}
            />
          </div>
          <span className="text-white font-mono text-xs sm:text-sm">{health}</span>
        </div>

        {/* Wave */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2.5 sm:px-4 py-1.5 sm:py-2 shrink-0">
          <span className={`font-mono font-bold text-xs sm:text-sm ${isSurgeWave ? "text-red-400" : "text-white/70"}`}>
            {isSurgeWave ? `SURGE ${wave}` : `W${wave}`}
          </span>
        </div>

        {/* Score */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 sm:px-5 py-1.5 sm:py-2 shrink-0">
          <span className="text-cyan-400 font-mono font-bold text-sm sm:text-lg">{score.toLocaleString()}</span>
        </div>
      </div>

      {/* Pause button - top right */}
      <div className="absolute top-4 right-4">
        <button
          onClick={onPause}
          className="bg-black/40 text-white/80 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-black/60 transition-colors"
          aria-label="Pause"
        >
          Pause
        </button>
      </div>
    </>
  );
}
