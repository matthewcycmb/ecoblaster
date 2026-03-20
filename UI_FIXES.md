# UI Polish Fixes — Reef Defender

5 targeted changes to eliminate visual inconsistencies before the live demo.
Each fix is a class/color swap — no new features, no structural changes.

---

## Fix 1: Theme Pause + Game Over modals to dark ocean style

**Why:** The white `bg-white` cards with `#0B63FF` blue buttons break immersion.
Judges will see these screens. They should feel like part of the underwater world.

### File: `src/components/game/PauseModal.tsx`

**Line 21 — modal container:**
```
OLD: className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center gap-6 min-w-[300px]"
NEW: className="bg-[#0a1628]/95 border border-cyan-500/25 rounded-xl p-8 shadow-[0_0_40px_rgba(0,200,255,0.12)] backdrop-blur-sm flex flex-col items-center gap-6 min-w-[300px]"
```

**Line 22 — heading:**
```
OLD: className="text-2xl font-bold text-game-primary"
NEW: className="text-2xl font-bold text-cyan-400"
```

**Line 26 — Resume button:**
```
OLD: className="w-full rounded-lg bg-game-primary px-6 py-3 text-white font-semibold hover:bg-game-primary/90 transition-colors"
NEW: className="w-full rounded-lg bg-cyan-600/90 border border-cyan-500/50 px-6 py-3 text-white font-semibold hover:bg-cyan-500/90 transition-colors"
```

**Line 32 — Settings button:**
```
OLD: className="w-full rounded-lg bg-white px-6 py-3 text-game-primary font-semibold border border-game-primary hover:bg-gray-50 transition-colors"
NEW: className="w-full rounded-lg bg-white/5 border border-white/15 px-6 py-3 text-white/90 font-semibold hover:bg-white/10 transition-colors"
```

**Line 38 — Quit button:**
```
OLD: className="w-full rounded-lg bg-white px-6 py-3 text-game-danger font-semibold border border-game-danger hover:bg-red-50 transition-colors"
NEW: className="w-full rounded-lg bg-white/5 border border-red-500/40 px-6 py-3 text-red-400 font-semibold hover:bg-red-500/10 transition-colors"
```

### File: `src/components/game/GameOverModal.tsx`

**Line 29 — modal container:**
```
OLD: className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center gap-6 min-w-[340px]"
NEW: className="bg-[#0a1628]/95 border border-red-500/25 rounded-xl p-8 shadow-[0_0_40px_rgba(255,90,95,0.12)] backdrop-blur-sm flex flex-col items-center gap-6 min-w-[340px]"
```

**Line 30 — heading:**
```
OLD: className="text-3xl font-bold text-game-danger"
NEW: className="text-3xl font-bold text-red-400"
```

**Line 31 — score text:**
```
OLD: className="text-lg text-game-text"
NEW: className="text-lg text-white/80"
```

**Line 32 — score number (the `<span>` inside):**
```
OLD: className="font-mono font-bold text-2xl"
NEW: className="font-mono font-bold text-2xl text-cyan-400"
```

**Line 35 — submitted text:**
```
OLD: className="text-sm text-green-600 font-semibold"
NEW: className="text-sm text-emerald-400 font-semibold"
```

**Line 42 — Try Again button:**
```
OLD: className="w-full rounded-lg bg-game-primary px-6 py-3 text-white font-semibold hover:bg-game-primary/90 transition-colors"
NEW: className="w-full rounded-lg bg-cyan-600/90 border border-cyan-500/50 px-6 py-3 text-white font-semibold hover:bg-cyan-500/90 transition-colors"
```

**Line 48 — View Leaderboard link:**
```
OLD: className="w-full rounded-lg bg-white px-6 py-3 text-game-primary font-semibold border border-game-primary hover:bg-gray-50 transition-colors text-center"
NEW: className="w-full rounded-lg bg-white/5 border border-white/15 px-6 py-3 text-white/90 font-semibold hover:bg-white/10 transition-colors text-center"
```

---

## Fix 2: Restyle HUD Pause button to match gameplay

**Why:** The white rectangle with blue text (`bg-white/80 text-game-primary`) is the only
bright-white element during gameplay. It should match the health bar's `bg-black/40` style.

### File: `src/components/game/GameHUD.tsx`

**Line 33 — Pause button:**
```
OLD: className="bg-white/80 text-game-primary border border-game-primary rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white transition-colors"
NEW: className="bg-black/40 text-white/80 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-black/60 transition-colors"
```

---

## Fix 3: Enlarge + glow the wave countdown

**Why:** "Wave 1 incoming... 3" at `text-4xl` gets lost against the full canvas. This is the
first thing a judge sees after pressing Start. It needs to feel like an event.

### File: `src/components/game/WaveCountdown.tsx`

**Replace the entire return JSX (lines 28-48) with:**

```tsx
return (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-40 pointer-events-none">
    {isSurgeWave ? (
      <>
        <p
          className="text-6xl sm:text-7xl font-black text-red-500 animate-pulse tracking-wider uppercase"
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
    {count > 0 && (
      <p
        className="text-7xl sm:text-8xl font-black text-white mt-6"
        style={{ textShadow: "0 0 20px rgba(255,255,255,0.4)" }}
      >
        {count}
      </p>
    )}
  </div>
);
```

**Key changes:**
- Wave title: `text-4xl` → `text-5xl sm:text-6xl`, white → `text-cyan-400` with cyan textShadow glow
- Countdown number: `text-6xl text-game-accent` → `text-7xl sm:text-8xl text-white` with white glow
- Surge wave: `text-5xl` → `text-6xl sm:text-7xl` with red textShadow glow
- Background dim: `bg-black/40` → `bg-black/50`
- "Incoming..." split to its own line at `text-xl text-white/50`

---

## Fix 4: Add live score to the gameplay HUD

**Why:** No score is visible during gameplay — only at Game Over. Judges watching have no
sense of progress. Score is the primary feedback loop.

### File: `src/components/game/GameHUD.tsx`

**Add `score` prop (line 4):**
```
OLD: health, onPause
NEW: health, score, onPause
```

**Update type (lines 6-8):**
```
OLD:
  health: number;
  onPause: () => void;

NEW:
  health: number;
  score: number;
  onPause: () => void;
```

**Add score display between the health div and the pause div (after line 27):**
```tsx
{/* Score - top center */}
<div className="absolute top-4 left-1/2 -translate-x-1/2">
  <div className="bg-black/40 rounded-lg px-5 py-2">
    <span className="text-cyan-400 font-mono font-bold text-lg">{score.toLocaleString()}</span>
  </div>
</div>
```

### File: `src/components/game/GameCanvas.tsx`

**Line 527-528 — pass score prop:**
```
OLD: <GameHUD health={health} onPause={...}
NEW: <GameHUD health={health} score={score} onPause={...}
```

---

## Fix 5: Fix home page title glow color mismatch

**Why:** Title text is cyan (`text-cyan-400` / `#22d3ee`) but `@keyframes title-glow` uses
`#FF5A5F` (red/pink). The glow fights the text instead of reinforcing it. Same issue with
`menu-btn-glow` using `#0B63FF` when the primary button is now teal/cyan.

### File: `src/app/globals.css`

**Lines 107-110 — title-glow keyframes:**
```
OLD:
@keyframes title-glow {
  0%, 100% { text-shadow: 0 0 20px #FF5A5F88, 0 0 40px #FF5A5F44, 0 0 80px #FF5A5F22; }
  50% { text-shadow: 0 0 30px #FF5A5FBB, 0 0 60px #FF5A5F66, 0 0 100px #FF5A5F33; }
}

NEW:
@keyframes title-glow {
  0%, 100% { text-shadow: 0 0 20px #22d3ee88, 0 0 40px #22d3ee44, 0 0 80px #22d3ee22; }
  50% { text-shadow: 0 0 30px #22d3eeBB, 0 0 60px #22d3ee66, 0 0 100px #22d3ee33; }
}
```

**Lines 117-120 — menu-btn-glow keyframes:**
```
OLD:
@keyframes menu-btn-glow {
  0%, 100% { box-shadow: 0 0 8px #0B63FF44, inset 0 1px 0 #ffffff22; }
  50% { box-shadow: 0 0 16px #0B63FF88, inset 0 1px 0 #ffffff33; }
}

NEW:
@keyframes menu-btn-glow {
  0%, 100% { box-shadow: 0 0 8px #22d3ee44, inset 0 1px 0 #ffffff22; }
  50% { box-shadow: 0 0 16px #22d3ee88, inset 0 1px 0 #ffffff33; }
}
```

**Color reference:** `#22d3ee` = Tailwind `cyan-400`, matching the title text color.

---

## Summary

| # | Fix | Files | Est. time |
|---|-----|-------|-----------|
| 1 | Dark ocean modals | `PauseModal.tsx`, `GameOverModal.tsx` | 15 min |
| 2 | Restyle Pause button | `GameHUD.tsx` | 5 min |
| 3 | Bigger wave countdown | `WaveCountdown.tsx` | 10 min |
| 4 | Live score in HUD | `GameHUD.tsx`, `GameCanvas.tsx` | 10 min |
| 5 | Fix title glow colors | `globals.css` | 5 min |
