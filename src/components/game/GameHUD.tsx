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
      {/* Health - bottom left */}
      <div className="absolute bottom-4 left-6 flex items-center gap-3">
        <div className="bg-black/40 rounded-lg px-4 py-2 flex items-center gap-2">
          <span className="text-white font-semibold text-sm">Reef Health:</span>
          <div className="w-32 h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(0, health)}%`,
                backgroundColor: health > 50 ? "#10b981" : health > 25 ? "#FFD166" : "#FF5A5F",
              }}
            />
          </div>
          <span className="text-white font-mono text-sm">{health}</span>
        </div>
      </div>

      {/* Score & Wave - bottom right */}
      <div className="absolute bottom-4 right-16 flex items-center gap-3">
        <div className="bg-black/40 rounded-lg px-4 py-2">
          <span className={`font-mono font-bold text-sm ${isSurgeWave ? "text-red-400" : "text-white/70"}`}>
            {isSurgeWave ? `SURGE WAVE ${wave}` : `WAVE ${wave}`}
          </span>
        </div>
        <div className="bg-black/40 rounded-lg px-5 py-2">
          <span className="text-cyan-400 font-mono font-bold text-lg">{score.toLocaleString()}</span>
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
