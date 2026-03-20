export default function DifficultyPrompt({
  onKeepEasy,
  onLevelUp,
}: {
  onKeepEasy: () => void;
  onLevelUp: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-50">
      <p className="text-3xl sm:text-4xl font-black text-white mb-3 tracking-wide">
        Ready for a challenge?
      </p>
      <p className="text-base text-white/50 mb-8 text-center max-w-sm">
        Normal mode: faster trash, flick-to-shoot, smaller hitboxes.
      </p>
      <div className="flex gap-4">
        <button
          onClick={onKeepEasy}
          className="rounded-lg bg-white/10 border border-white/20 px-8 py-3 text-lg font-bold text-white tracking-wide hover:bg-white/20 transition-colors"
        >
          Keep it Easy
        </button>
        <button
          onClick={onLevelUp}
          className="rounded-lg bg-teal-500 border border-teal-400/50 px-8 py-3 text-lg font-bold text-white tracking-wide hover:bg-teal-400 transition-colors"
        >
          Level Up
        </button>
      </div>
    </div>
  );
}
