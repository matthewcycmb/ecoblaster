"use client";

function CoralHealthBar({ health }: { health: number }) {
  // Coral color shifts from vibrant to bleached as health drops
  const hue = health > 50 ? 340 + (health - 50) * 0.4 : 30 + health * 0.6; // pink-coral → pale
  const saturation = Math.max(10, health * 0.9); // vibrant → washed out
  const lightness = health > 25 ? 45 + (100 - health) * 0.15 : 70; // darkens → whitens (bleaching)

  const branches = 5;
  const pct = Math.max(0, health) / 100;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <svg
        viewBox="0 0 60 20"
        className="w-20 sm:w-32 h-5 sm:h-6"
        aria-label={`Reef health: ${health}%`}
      >
        {/* Background (dead coral silhouette) */}
        {Array.from({ length: branches }).map((_, i) => {
          const x = 6 + i * 12;
          const maxH = 8 + Math.sin(i * 1.7 + 1) * 4;
          return (
            <rect
              key={`bg-${i}`}
              x={x}
              y={20 - maxH}
              width={6}
              height={maxH}
              rx={2}
              fill="rgba(80, 80, 80, 0.4)"
            />
          );
        })}
        {/* Living coral — height scales with health */}
        {Array.from({ length: branches }).map((_, i) => {
          const x = 6 + i * 12;
          const maxH = 8 + Math.sin(i * 1.7 + 1) * 4;
          const h = maxH * pct;
          return (
            <rect
              key={`fg-${i}`}
              x={x}
              y={20 - h}
              width={6}
              height={Math.max(0, h)}
              rx={2}
              fill={`hsl(${hue}, ${saturation}%, ${lightness}%)`}
              style={{ transition: "all 0.5s ease-out" }}
            />
          );
        })}
        {/* Small polyp dots on living branches */}
        {health > 15 && Array.from({ length: branches }).map((_, i) => {
          const x = 9 + i * 12;
          const maxH = 8 + Math.sin(i * 1.7 + 1) * 4;
          const h = maxH * pct;
          if (h < 4) return null;
          return (
            <circle
              key={`dot-${i}`}
              cx={x}
              cy={20 - h + 2}
              r={1.2}
              fill={`hsl(${hue + 20}, ${Math.min(100, saturation + 20)}%, ${lightness + 10}%)`}
              style={{ transition: "all 0.5s ease-out" }}
            />
          );
        })}
      </svg>
      <span className="text-white font-mono text-xs sm:text-sm">{health}</span>
    </div>
  );
}

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
      {/* Top bar: Wave + Pause */}
      <div className="absolute top-4 left-0 right-0 px-4 flex items-center justify-between pointer-events-none">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 sm:px-4 py-1.5 sm:py-2">
          <span className={`font-mono font-bold text-xs sm:text-sm ${isSurgeWave ? "text-red-400" : "text-white/70"}`}>
            {isSurgeWave ? `SURGE WAVE ${wave}` : `WAVE ${wave}`}
          </span>
        </div>
        <button
          onClick={onPause}
          className="pointer-events-auto bg-black/50 backdrop-blur-sm text-white/80 rounded-lg px-4 py-1.5 sm:py-2 text-sm font-semibold hover:bg-black/60 transition-colors"
          aria-label="Pause"
        >
          Pause
        </button>
      </div>

      {/* Bottom bar: Health + Score */}
      <div className="absolute bottom-16 sm:bottom-6 left-0 right-0 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 pointer-events-none">
        {/* Health — living coral */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
          <span className="text-white font-semibold text-xs sm:text-sm whitespace-nowrap">Reef:</span>
          <CoralHealthBar health={health} />
        </div>

        {/* Score */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 sm:px-5 py-1.5 sm:py-2 shrink-0">
          <span className="text-cyan-400 font-mono font-bold text-sm sm:text-lg">{score.toLocaleString()}</span>
        </div>
      </div>
    </>
  );
}
