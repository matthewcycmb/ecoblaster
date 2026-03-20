export default function WaveCountdown({
  wave,
  isSurgeWave,
}: {
  wave: number;
  isSurgeWave: boolean;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-40 pointer-events-none">
      {isSurgeWave ? (
        <>
          <p
            className="text-6xl sm:text-7xl font-black text-red-500 tracking-wider uppercase"
            style={{ textShadow: "0 0 30px rgba(255,80,80,0.6), 0 0 60px rgba(255,80,80,0.3)" }}
          >
            Trash Surge
          </p>
          <p className="text-2xl text-red-300 mt-3 font-bold tracking-widest uppercase">
            Wave {wave} — Defend the Reef!
          </p>
        </>
      ) : (
        <>
          <p
            className="text-5xl sm:text-6xl font-black text-cyan-400 tracking-wider"
            style={{ textShadow: "0 0 20px rgba(0,200,255,0.5), 0 0 40px rgba(0,200,255,0.2)" }}
          >
            Wave {wave}
          </p>
          <p className="text-xl text-white/50 mt-2 font-medium tracking-wide">
            Incoming...
          </p>
        </>
      )}
    </div>
  );
}
