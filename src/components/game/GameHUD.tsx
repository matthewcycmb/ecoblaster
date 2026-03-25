"use client";

import { TIME_FREEZE_COOLDOWN_MS, TIME_FREEZE_DURATION_MS, SNAP_CLEAR_COOLDOWN_MS, TSUNAMI_COOLDOWN_MS } from "@/lib/constants";

function CoralHealthBar({ health }: { health: number }) {
  const hue = health > 50 ? 340 + (health - 50) * 0.4 : 30 + health * 0.6;
  const saturation = Math.max(10, health * 0.9);
  const lightness = health > 25 ? 45 + (100 - health) * 0.15 : 70;

  const branches = 5;
  const pct = Math.max(0, health) / 100;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <svg
        viewBox="0 0 60 20"
        className="w-20 sm:w-32 h-5 sm:h-6"
        aria-label={`Reef health: ${health}%`}
      >
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

function PowerUpCooldown({
  emoji,
  label,
  ready,
  active,
  pct,
  secondsLeft,
  readyColor,
  activeColor,
  chargeProgress = 0,
}: {
  emoji: string;
  label: string;
  ready: boolean;
  active: boolean;
  pct: number;
  secondsLeft: number;
  readyColor: string;
  activeColor: string;
  barColor?: string;
  chargeProgress?: number;
}) {
  const r = 13;
  const circ = 2 * Math.PI * r;
  const charging = chargeProgress > 0;
  const displayPct = charging ? chargeProgress : pct;
  const offset = circ * (1 - displayPct);
  const ringColor = charging ? "#f59e0b" : ready ? readyColor : active ? activeColor : "rgba(150,150,150,0.4)";

  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
          <circle
            cx="18" cy="18" r={r} fill="none"
            stroke={ringColor}
            strokeWidth={charging ? "3.5" : "2.5"}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: charging ? "none" : "stroke-dashoffset 0.3s ease-out" }}
          />
        </svg>
        <span className={`text-base z-10 ${charging ? "animate-pulse" : ready ? "animate-pulse" : active ? "" : "opacity-40"}`}>{emoji}</span>
      </div>
      <div className="flex flex-col gap-0.5 leading-none">
        <span className="text-[10px] sm:text-[11px] text-white/60 font-semibold uppercase tracking-wider">{label}</span>
        <span className={`text-[11px] sm:text-xs font-bold uppercase tracking-wide ${
          charging ? "text-amber-400" : active ? "" : ready ? "text-white" : "text-white/40"
        }`} style={active ? { color: activeColor } : {}}>
          {charging ? "CHARGING" : active ? "ACTIVE" : ready ? "READY" : `${secondsLeft}s`}
        </span>
      </div>
    </div>
  );
}

function PowerUpBar({
  timeFreezeActive,
  timeFreezeCooldownUntil,
  snapClearCooldownUntil,
  tsunamiCooldownUntil,
  tsunamiChargeProgress = 0,
}: {
  timeFreezeActive: boolean;
  timeFreezeCooldownUntil: number;
  snapClearCooldownUntil: number;
  tsunamiCooldownUntil: number;
  tsunamiChargeProgress?: number;
}) {
  const now = Date.now();

  // Time freeze state
  const freezeReady = !timeFreezeActive && now >= timeFreezeCooldownUntil;
  const freezeOnCooldown = !timeFreezeActive && now < timeFreezeCooldownUntil;
  const freezeTotalCooldown = TIME_FREEZE_COOLDOWN_MS + TIME_FREEZE_DURATION_MS;
  const freezePct = timeFreezeActive ? 0 : freezeReady ? 1
    : 1 - (timeFreezeCooldownUntil - now) / freezeTotalCooldown;
  const freezeSecondsLeft = freezeOnCooldown ? Math.ceil((timeFreezeCooldownUntil - now) / 1000) : 0;

  // Snap clear state
  const snapReady = now >= snapClearCooldownUntil;
  const snapPct = snapReady ? 1 : 1 - (snapClearCooldownUntil - now) / SNAP_CLEAR_COOLDOWN_MS;
  const snapSecondsLeft = snapReady ? 0 : Math.ceil((snapClearCooldownUntil - now) / 1000);

  // Tsunami state
  const tsunamiReady = now >= tsunamiCooldownUntil;
  const tsunamiPct = tsunamiReady ? 1 : 1 - (tsunamiCooldownUntil - now) / TSUNAMI_COOLDOWN_MS;
  const tsunamiSecondsLeft = tsunamiReady ? 0 : Math.ceil((tsunamiCooldownUntil - now) / 1000);

  return (
    <div className="flex items-center gap-4 bg-black/50 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
      <PowerUpCooldown
        emoji="✋"
        label="Freeze"
        ready={freezeReady}
        active={timeFreezeActive}
        pct={freezePct}
        secondsLeft={freezeSecondsLeft}
        readyColor="#22d3ee"
        activeColor="#60a5fa"
        barColor="#22d3ee"
      />
      <div className="w-px h-7 bg-white/15" />
      <PowerUpCooldown
        emoji={"\u{1F90F}"}
        label="Damage"
        ready={snapReady}
        active={false}
        pct={snapPct}
        secondsLeft={snapSecondsLeft}
        readyColor="#34d399"
        activeColor="#34d399"
        barColor="#34d399"
      />
      <div className="w-px h-7 bg-white/15" />
      <PowerUpCooldown
        emoji={"\uD83D\uDC4D"}
        label="Tsunami"
        ready={tsunamiReady}
        active={false}
        pct={tsunamiPct}
        secondsLeft={tsunamiSecondsLeft}
        readyColor="#f59e0b"
        activeColor="#f59e0b"
        chargeProgress={tsunamiChargeProgress}
      />
    </div>
  );
}

export default function GameHUD({
  health,
  score,
  wave,
  isSurgeWave,
  onPause,
  musicMuted,
  onToggleMusic,
  currentCharges,
  onCurrentPush,
  timeFreezeActive,
  timeFreezeCooldownUntil,
  snapClearCooldownUntil,
  tsunamiCooldownUntil,
  tsunamiChargeProgress,
}: {
  health: number;
  score: number;
  wave: number;
  isSurgeWave: boolean;
  onPause: () => void;
  musicMuted: boolean;
  onToggleMusic: () => void;
  currentCharges?: number;
  onCurrentPush?: () => void;
  timeFreezeActive?: boolean;
  timeFreezeCooldownUntil?: number;
  snapClearCooldownUntil?: number;
  tsunamiCooldownUntil?: number;
  tsunamiChargeProgress?: number;
}) {
  return (
    <>
      {/* Top bar: Wave + Pause */}
      <div className="absolute top-4 left-0 right-0 px-4 flex items-center justify-between pointer-events-none">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 sm:px-4 py-1.5 sm:py-2">
          <span className={`font-mono font-bold text-xs sm:text-sm ${isSurgeWave ? "text-red-400" : "text-white/90"}`}>
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
      <div className="absolute bottom-12 sm:bottom-6 left-0 right-0 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 pointer-events-none">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
          <span className="text-white font-semibold text-xs sm:text-sm whitespace-nowrap">Reef:</span>
          <CoralHealthBar health={health} />
        </div>

        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 sm:px-5 py-1.5 sm:py-2 shrink-0">
          <span className="text-cyan-400 font-mono font-bold text-sm sm:text-lg">{score.toLocaleString()}</span>
        </div>
      </div>

      {/* Bottom left: Ocean current */}
      <div className="pointer-events-auto absolute bottom-2 left-2 sm:bottom-3 sm:left-3 flex flex-col gap-1.5">
        {currentCharges !== undefined && onCurrentPush && (
          <button
            onClick={onCurrentPush}
            disabled={currentCharges === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-sm transition-all ${
              currentCharges > 0
                ? "bg-cyan-500/30 border border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/40 active:scale-95"
                : "bg-gray-500/20 border border-gray-500/30 text-gray-400 cursor-not-allowed"
            }`}
            aria-label={`Ocean current push (${currentCharges} charges)`}
          >
            <span className="text-lg">🌊</span>
            <span>{currentCharges}</span>
          </button>
        )}
      </div>

      {/* Bottom center: Power-up cooldowns */}
      {timeFreezeActive !== undefined && timeFreezeCooldownUntil !== undefined && snapClearCooldownUntil !== undefined && tsunamiCooldownUntil !== undefined && (
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <PowerUpBar
            timeFreezeActive={timeFreezeActive}
            timeFreezeCooldownUntil={timeFreezeCooldownUntil}
            snapClearCooldownUntil={snapClearCooldownUntil}
            tsunamiCooldownUntil={tsunamiCooldownUntil}
            tsunamiChargeProgress={tsunamiChargeProgress}
          />
        </div>
      )}

      {/* Music mute toggle — bottom right */}
      <button
        onClick={onToggleMusic}
        className="pointer-events-auto absolute bottom-2 right-2 sm:bottom-3 sm:right-3 w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-full text-white/70 hover:text-white hover:bg-black/60 transition-colors"
        aria-label={musicMuted ? "Unmute music" : "Mute music"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5">
          {musicMuted ? (
            <>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </>
          ) : (
            <>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </>
          )}
        </svg>
      </button>
    </>
  );
}
