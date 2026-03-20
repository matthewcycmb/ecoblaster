"use client";

export default function GameHUD({
  health,
  onPause,
}: {
  health: number;
  onPause: () => void;
}) {
  return (
    <>
      {/* Health - top left */}
      <div className="absolute top-4 left-4 flex items-center gap-3">
        <div className="bg-black/40 rounded-lg px-4 py-2 flex items-center gap-2">
          <span className="text-white font-semibold text-sm">Health:</span>
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

      {/* Pause button - top right */}
      <div className="absolute top-4 right-4">
        <button
          onClick={onPause}
          className="bg-white/80 text-game-primary border border-game-primary rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white transition-colors"
          aria-label="Pause"
        >
          Pause
        </button>
      </div>
    </>
  );
}
