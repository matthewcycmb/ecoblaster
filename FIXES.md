# Gameplay Fixes for Demo Day

## Fix 1: Gentler Wave 1 Spawning (~5 min)

**Files:** `src/lib/game/engine.ts`, `src/lib/game/difficulty.ts`

### engine.ts — `startWave()` (line ~218)

```diff
- const immediate = Math.min(3, totalForWave);
+ const immediate = Math.min(state.wave === 1 ? 1 : 3, totalForWave);
```

### difficulty.ts — easy config

```diff
  easy: {
-   initialTrash: 3,
+   initialTrash: 2,
    depthSpeedPerSec: 0.048,
    extraPerWave: 1,
-   spawnIntervalSec: 5,
+   spawnIntervalSec: 7,
    trashTypeWeights: { bottle: 70, bag: 15, barrel: 10, net: 5, barge: 0 },
  },
```

---

## Fix 2: Auto-fire on Easy Mode (~15 min)

**Files:** `src/lib/constants.ts`, `src/components/game/GameCanvas.tsx`

### constants.ts — add constant

```ts
export const EASY_AUTO_FIRE_INTERVAL_MS = 350;
```

### GameCanvas.tsx — add auto-fire in `syncUIState` callback (runs every 100ms)

Inside `syncUIState`, after the existing hand-warning logic, add auto-fire for easy mode when the finger-gun pose is held and aiming at a target:

```ts
// Auto-fire on easy mode: if finger-gun pose is active, fire automatically
if (
  s.phase === "playing" &&
  settingsRef.current.difficulty === "easy" &&
  aimPositionRef.current &&
  gestureDetectorRef.current
) {
  const now = Date.now();
  if (now - s.lastFireTime >= EASY_AUTO_FIRE_INTERVAL_MS) {
    const aim = aimPositionRef.current;
    const canvas = canvasRef.current;
    if (canvas && aim) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const dx = aim.x - cx;
      const dy = aim.y - cy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        handleFire(dx / len, dy / len);
      }
    }
  }
}
```

Also add `EASY_AUTO_FIRE_INTERVAL_MS` to the imports from `@/lib/constants`.

The `handleFire` function already has cooldown gating (`now - state.lastFireTime < cooldown`), so this is safe to call repeatedly — it will no-op if cooldown hasn't elapsed.

This means judges just need to point, not flick. The flick still works for faster firing.

---

## Fix 3: Screen-Shake + Hit Flash (~15 min)

**Files:** `src/lib/types.ts`, `src/lib/game/renderer.ts`, `src/components/game/GameCanvas.tsx`

### types.ts — add fields to GameState

```diff
  recoilUntil: number;
+ hitFlashUntil: number;
+ screenShakeUntil: number;
  displayedScore: number;
```

### state.ts — add defaults in `createInitialState()`

```diff
  recoilUntil: 0,
+ hitFlashUntil: 0,
+ screenShakeUntil: 0,
  displayedScore: 0,
```

### constants.ts — add constants

```ts
export const HIT_FLASH_DURATION_MS = 80;
export const SCREEN_SHAKE_DURATION_MS = 120;
export const SCREEN_SHAKE_INTENSITY = 4;
```

### GameCanvas.tsx — trigger in `processKill`

After `z.alive = false;` inside processKill:

```ts
state.hitFlashUntil = now + HIT_FLASH_DURATION_MS;
state.screenShakeUntil = now + SCREEN_SHAKE_DURATION_MS;
```

### renderer.ts — apply in `renderFrame`

At the very start of `renderFrame`, after `const t = now / 1000;`:

```ts
// Screen shake
if (now < state.screenShakeUntil) {
  const intensity = SCREEN_SHAKE_INTENSITY * ((state.screenShakeUntil - now) / SCREEN_SHAKE_DURATION_MS);
  const shakeX = (Math.random() - 0.5) * 2 * intensity;
  const shakeY = (Math.random() - 0.5) * 2 * intensity;
  ctx.save();
  ctx.translate(shakeX, shakeY);
}
```

At the very end of `renderFrame`, before the closing `}`:

```ts
// End screen shake transform
if (now < state.screenShakeUntil) {
  ctx.restore();
}

// White hit flash overlay
if (now < state.hitFlashUntil) {
  const flashAlpha = 0.15 * ((state.hitFlashUntil - now) / HIT_FLASH_DURATION_MS);
  ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}
```

---

## Fix 4: Slower Easy-Mode Trash Speed (~5 min)

**Files:** `src/lib/game/difficulty.ts`, `src/lib/constants.ts`

### difficulty.ts — easy config

```diff
  easy: {
    initialTrash: 2,
-   depthSpeedPerSec: 0.048,
+   depthSpeedPerSec: 0.035,
    extraPerWave: 1,
    spawnIntervalSec: 7,
```

### constants.ts — increase reach depth

```diff
- export const ZOMBIE_REACH_DEPTH = 0.95;
+ export const ZOMBIE_REACH_DEPTH = 0.98;
```

This gives ~27 seconds to cross, plus items stay hittable at large scale for 3 more depth-units near the player.

---

## Fix 5: Shorter Wave Countdown (~10 min)

**Files:** `src/lib/constants.ts`, `src/components/game/WaveCountdown.tsx`, `src/components/game/GameCanvas.tsx`

### constants.ts

```diff
- export const WAVE_COUNTDOWN_MS = 3000;
+ export const WAVE_COUNTDOWN_MS = 1500;
```

### WaveCountdown.tsx — replace 3-2-1 countdown with a brief splash

```tsx
export default function WaveCountdown({
  wave,
  isSurgeWave,
}: {
  wave: number;
  isSurgeWave: boolean;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-40 pointer-events-none">
      {isSurgeWave ? (
        <>
          <p className="text-5xl font-bold text-red-500 animate-pulse">
            TRASH SURGE WAVE {wave}
          </p>
          <p className="text-xl text-red-300 mt-2 font-semibold">
            DEFEND THE REEF!
          </p>
        </>
      ) : (
        <p className="text-4xl font-bold text-white animate-pulse">
          Wave {wave}
        </p>
      )}
    </div>
  );
}
```

### GameCanvas.tsx — `beginCountdown` timeout

```diff
- state.waveCountdownUntil = Date.now() + 3000;
+ state.waveCountdownUntil = Date.now() + 1500;
  ...
- }, 3000);
+ }, 1500);
```

This removes the "3, 2, 1" counter and just shows a brief "Wave N" flash for 1.5 seconds before gameplay resumes.
