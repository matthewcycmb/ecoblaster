# Zombie Flick — Project Reference

> Use this file to onboard a new Claude conversation. Paste/attach it to minimize tokens.

## Quick Facts

- **Framework:** Next.js 16.1.6, App Router, Turbopack, TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Dev server:** `npm run dev` → `localhost:3333`
- **Hand tracking:** `@mediapipe/tasks-vision` (HandLandmarker, VIDEO mode, GPU delegate)
- **Audio:** Procedural Web Audio API (no external audio files) — SFX + background music
- **Leaderboard:** Supabase + localStorage fallback (works offline)

---

## File Structure

```
src/
  app/
    layout.tsx              — Root layout, Inter font, dark bg
    page.tsx                — Home: heading, Start Game, Leaderboard, Settings
    globals.css             — Tailwind v4 theme, PRD color tokens as CSS vars
    game/page.tsx           — Thin server shell → <GameCanvas />
    leaderboard/page.tsx    — Top 10 leaderboard with rank medals, relative timestamps
  components/
    game/
      GameCanvas.tsx        — MAIN ORCHESTRATOR: canvas, engine, hand tracking, fire logic, aim smoothing, name input, music lifecycle
      GameHUD.tsx           — Health bar + pause button (absolute overlay)
      PauseModal.tsx        — Resume, Settings, Quit
      GameOverModal.tsx     — Score display, auto-submit to leaderboard, View Leaderboard link
      WaveCountdown.tsx     — "Wave N incoming..." with 3-2-1 countdown
    mediapipe/
      HandTracker.tsx       — Camera stream + MediaPipe detection loop (forwardRef exposes video)
    settings/
      SettingsModal.tsx     — Sensitivity slider, cooldown slider, difficulty radio, mute toggle
  lib/
    types.ts                — Zombie (with types: normal/fast/tank/boss), GameState, GamePhase, Settings, DifficultyConfig, PowerUp, Combo, HitToast
    constants.ts            — All magic numbers (see below)
    utils.ts                — shadcn cn() utility
    game/
      engine.ts             — requestAnimationFrame game loop, tick → updatePlaying → renderFrame, score animation, combo decay, power-up expiry, wave transitions
      state.ts              — createInitialState() factory, loadHighScore()/saveHighScore() localStorage helpers
      zombies.ts            — spawnZombie() (type-aware), moveZombies(), checkZombieReachedPlayer(), getZombieCountForWave()
      hitDetection.ts       — findClosestZombieAtPoint() (scale-aware proximity) + raycastFromPoint() (scale-aware AABB)
      renderer.ts           — Canvas 2D: spooky background, perspective zombies, pistol, crosshair, muzzle flash at barrel tip, score/wave/high-score on canvas, toasts, PIP webcam
      difficulty.ts         — Easy/Normal/Hard configs (depth-speed based)
      powerups.ts           — Power-up spawning, collection, types (rapid-fire, slow-mo, nuke)
    mediapipe/
      gestureDetector.ts    — GestureDetector class: joint-angle pose detection, EMA smoothing, hysteresis, flick velocity
      landmarkUtils.ts      — Landmark type, finger indices, angleBetween(), isFingerExtended(), isFingerCurled(), smoothLandmarks()
    audio/
      sfx.ts                — playGunshot(), playHit(), playZombieGroan(), playGameOverStinger(), playComboChime(), playExplosion(), playPowerUpCollect(), playBossRoar(), startBackgroundMusic(), stopBackgroundMusic(), setMuted(), initAudio()
    settings/
      store.ts              — localStorage read/write for Settings (includes playerName)
      schema.ts             — Zod v4 leaderboard name validation
    supabase/
      client.ts             — Conditional Supabase client (null if env vars missing)
      leaderboard.ts        — submitScore(), getTopScores(), isLeaderboardAvailable() — Supabase with localStorage fallback
```

---

## Architecture & Key Patterns

### Game Loop (60fps)
- `GameState` lives in `useRef` (NOT `useState`) to avoid re-renders at 60fps
- Canvas rendered imperatively via `requestAnimationFrame` in `engine.ts`
- React overlays (HUD, modals) positioned absolutely over canvas, synced via `setInterval(syncUIState, 100)`

### Data Flow: Hand → Fire
```
Camera frame
  → HandLandmarker.detectForVideo() → landmarks[21]
  → onFrame(landmarks) in GameCanvas
  → GestureDetector.update(landmarks):
      1. EMA smooth landmarks (alpha=0.55)
      2. Joint-angle pose detection (finger-gun check)
      3. Hysteresis (2 frames ON, 4 frames OFF)
      4. Wrist-relative flick velocity
  → aimTargetRef set from smoothed indexTip (mirrored X)
  → aimPositionRef lerped toward target (alpha=0.35) — two-stage smoothing
  → shouldFire() check (finger-gun + flick velocity + cooldown)
  → handleFire(dirX, dirY)
  → findClosestZombieAtPoint() or raycastFromPoint() — scale-aware hit detection
  → processKill() — score, combo, power-up drop, recoil, SFX
```

### Camera Gate (Start Flow)
- "Start Game" validates name, activates camera, sets `pendingStartRef = true`
- Game does NOT start countdown until `trackerStatus === "running"` (camera granted + MediaPipe loaded)
- On restart (tracker already running), countdown starts immediately
- Camera-denied/error overlays block gameplay with retry/quit options

### Mobile Tracking
- Auto-detects mobile via `navigator.userAgent`
- Mobile: `delegate: "CPU"` + `ideal` camera constraints (640x480, 30fps)
- Desktop: `delegate: "GPU"` + exact constraints (unchanged from original)

### SSR Safety
- `HandTracker.tsx` imported via `next/dynamic({ ssr: false })`
- `@mediapipe/tasks-vision` dynamically imported inside `useEffect`
- AudioContext created lazily on first user gesture

### Webcam Feed
- Video element is invisible (`opacity-0`) in DOM but present for MediaPipe
- `HandTracker` exposes video via `forwardRef` + `useImperativeHandle`
- Renderer draws video as small PIP (220x165) in top-center, mirrored for selfie view

### Crosshair + Aim (Two-Stage Smoothing)
- **Stage 1:** EMA landmark smoothing in `gestureDetector.ts` (alpha=0.55) — reduces raw MediaPipe jitter
- **Stage 2:** Lerp in `GameCanvas.tsx` (alpha=0.35) — smooth visual crosshair glide
- X coordinate mirrored: `(1 - indexTipX) * canvasWidth` to match selfie view
- **Never nulls out:** When tracking is lost, crosshair stays at last known position (no snap-to-center)
- Crosshair only rendered when aim data exists during gameplay (no phantom center crosshair)

---

## Zombie Types & Boss Waves

### Zombie Types
| Type | HP | Speed Mult | Size Mult | Appearance |
|------|-----|-----------|-----------|------------|
| normal | 1 | 1.0x | 1.0x | Standard green zombie |
| fast | 1 | 1.6x | 0.8x | Smaller, purple-tinted, quicker |
| tank | 3 | 0.7x | 1.3x | Larger, armored, 3 hits to kill |
| boss | 10 | 0.5x | 2.0x | Massive, red-eyed, 3x damage, boss roar SFX |

### Boss Waves
- Every 5th wave is a boss wave (`BOSS_WAVE_INTERVAL = 5`)
- Boss spawns immediately at wave start with roar SFX
- Boss deals 3x damage (60 HP) when reaching player
- Regular zombies also spawn alongside boss
- Wave only clears when boss is defeated AND all zombies dead

### Combo System
- Consecutive kills within 3s (`COMBO_DECAY_MS`) build combo counter
- Multiplier tiers: x1 (0-2), x2 (3-4), x3 (5-6), x4 (7+)
- Score per kill = base points × combo multiplier
- Combo resets on being hit or decay timeout
- Combo chime SFX scales with tier

### Power-Ups
| Type | Effect | Duration |
|------|--------|----------|
| rapid-fire | Halves fire cooldown | 8s |
| slow-mo | Halves zombie speed | 8s |
| nuke | Kills all on-screen zombies | Instant |

- 15% drop chance per kill (`POWERUP_DROP_CHANCE`)
- Auto-collected when crosshair passes near them
- 10s lifetime before despawning
- Collect SFX + visual indicators on canvas

---

## Pistol Rendering

- Procedural metallic pistol drawn at bottom-center (88% canvas height)
- Gradient barrel, slide with serrations, trigger guard + trigger, wooden grip with texture
- Rotates toward aim/crosshair via `atan2`, clamped to upper hemisphere
- Recoil animation on each shot (150ms ease-out kick)
- Muzzle flash appears at barrel tip (not at crosshair)

---

## Background Music

- Procedural 130 BPM loop via Web Audio API (no audio files)
- Sawtooth bassline (A minor: A2, A2, E2, A2, C3, C3, G2, A2)
- Sine kick on even beats, hi-hat 8th notes with accented off-beats
- Sparse eerie melody (E5, D5, C5) with vibrato
- Master gain at 0.08 (well below SFX volume)
- Schedule-ahead pattern: 2s buffer, 200ms scheduling interval for gapless looping
- Starts on game start, stops on game over and unmount
- Respects mute setting via AudioContext suspend/resume

---

## Leaderboard System

### Player Name Flow
1. Idle screen shows name input field (validated via Zod schema: 1-20 chars, alphanumeric + spaces/hyphens)
2. Name saved to settings (persists across sessions via localStorage)
3. On game over, score auto-submitted with player name
4. "View Leaderboard" link on game over modal

### Storage Strategy
- **Supabase** (when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars set):
  - Table: `leaderboard_entry` with columns: `id`, `player_name`, `score`, `created_at`
  - Falls back to localStorage on Supabase errors
- **localStorage fallback** (when env vars not set or Supabase errors):
  - Key: `"zombie-flick-leaderboard"`, stores top 50 entries
  - Fully functional offline leaderboard

### Supabase Setup
To enable online leaderboard:
1. Create a Supabase project at https://supabase.com
2. Create the `leaderboard_entry` table:
   ```sql
   CREATE TABLE leaderboard_entry (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     player_name TEXT NOT NULL,
     score INTEGER NOT NULL,
     created_at TIMESTAMPTZ DEFAULT now()
   );

   -- Enable read access for all, insert for all (anonymous)
   ALTER TABLE leaderboard_entry ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Anyone can read scores"
     ON leaderboard_entry FOR SELECT
     USING (true);

   CREATE POLICY "Anyone can insert scores"
     ON leaderboard_entry FOR INSERT
     WITH CHECK (true);
   ```
3. Add env vars to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
4. Restart dev server — leaderboard will automatically use Supabase

---

## Score & Wave Display (Canvas-Rendered)

- **Score:** Large 34px text in top-right with glow effect, smooth count-up animation via `displayedScore` lerping toward actual score (10% per frame), flashes gold on change
- **Wave:** "WAVE N" below score; during transitions shows large centered pulsing announcement; boss waves in red
- **High Score:** Persisted to localStorage (`"zombie-flick-high-score"`), pulsing gold "NEW HIGH SCORE!" text when beaten
- **HUD overlay:** Simplified to health bar (top-left) + pause button (top-right) only

---

## Constants (src/lib/constants.ts)

| Constant | Value | Purpose |
|----------|-------|---------|
| ZOMBIE_BASE_WIDTH | 90 | Zombie base width before perspective scaling |
| ZOMBIE_BASE_HEIGHT | 140 | Zombie base height before perspective scaling |
| ZOMBIE_HIT_RADIUS | 50 | Base hit detection radius (scaled with perspective) |
| HORIZON_Y_RATIO | 0.28 | Horizon line at 28% from top |
| GROUND_Y_RATIO | 0.95 | Ground/player at 95% from top |
| MIN_SCALE | 0.15 | Zombie scale at far horizon |
| MAX_SCALE | 1.8 | Zombie scale right in your face |
| ZOMBIE_REACH_DEPTH | 0.95 | Depth at which zombie damages player |
| DAMAGE_PER_HIT | 20 | HP lost when zombie reaches player |
| INITIAL_HEALTH | 100 | Starting HP |
| FLICK_THRESHOLD | -0.02 | Default flick sensitivity (wrist-relative Y velocity) |
| DEFAULT_COOLDOWN_MS | 200 | Min ms between fires |
| MUZZLE_FLASH_DURATION_MS | 100 | Muzzle flash visual duration |
| WAVE_COUNTDOWN_MS | 3000 | Wave countdown timer |
| HIT_TOAST_DURATION_MS | 800 | Hit toast fade duration |
| HAND_NOT_DETECTED_TIMEOUT_MS | 3000 | Warning if no hand seen |
| POSE_NOT_DETECTED_TIMEOUT_MS | 5000 | Warning if no finger-gun pose |
| CANVAS_MAX_WIDTH | 1280 | Max canvas width |
| PIP_WIDTH / PIP_HEIGHT | 220 / 165 | PIP webcam dimensions |
| PIP_MARGIN | 12 | PIP offset from edge |
| PIP_BORDER_RADIUS | 10 | PIP corner rounding |
| COMBO_DECAY_MS | 3000 | Combo resets after 3s without kill |
| POWERUP_DROP_CHANCE | 0.15 | 15% chance per kill |
| POWERUP_LIFETIME_MS | 10000 | Power-up despawns after 10s |
| POWERUP_DURATION_MS | 8000 | Active power-up lasts 8s |
| BOSS_WAVE_INTERVAL | 5 | Boss every 5th wave |
| PISTOL_Y_OFFSET | 0.88 | Pistol vertical position (88% down) |
| PISTOL_RECOIL_DURATION_MS | 150 | Recoil animation length |

---

## Perspective Zombie System

Zombies approach the player in first-person perspective.

### Zombie Type
```typescript
interface Zombie {
  id: string;
  laneX: number;             // -1 to 1 horizontal world position
  depth: number;             // 0.0 (far/horizon) to 1.0 (reached player)
  width: number;             // base width before perspective scaling
  height: number;            // base height before perspective scaling
  hp: number;
  depthSpeedPerSec: number;  // depth units per second
  alive: boolean;
  x: number; y: number;     // computed screen-space position
  screenScale: number;       // computed perspective scale
  zombieType: "normal" | "fast" | "tank" | "boss";
}
```

### Depth-Based Movement
- `depth` increases each frame by `depthSpeedPerSec * dt`
- Slight horizontal sway via sine function for natural walking
- Screen position: `t = depth^0.65` (power curve for perspective)
- Scale: `MIN_SCALE + (MAX_SCALE - MIN_SCALE) * t`
- Y: `horizonY + (groundY - horizonY) * t`
- X: lanes converge at horizon, spread near player

### Rendering
- Zombies sorted by depth for correct z-ordering
- Walking animation (leg/arm sway) driven by depth
- Glowing red eyes, tattered clothing, reaching arms
- Red danger glow when very close (scale > 1.2)
- Type-specific rendering: fast=purple tint, tank=armor, boss=massive+red glow
- Spooky background: dark purple sky, moon, stars, fog, green ground, perspective grid

### Hit Detection
- `findClosestZombieAtPoint(zombies, aimX, aimY)` — proximity with scale-adjusted radius
- `raycastFromPoint(zombies, originX, originY, dirX, dirY)` — AABB with scale-adjusted bounds
- Far-away zombies are harder to hit (smaller screen targets)

### Difficulty Configs
| Difficulty | Initial | depthSpeed | Extra/Wave | Spawn Interval |
|------------|---------|-----------|------------|----------------|
| Easy | 3 | 0.08 (~12s) | +1 | 5s |
| Normal | 5 | 0.12 (~8s) | +2 | 4s |
| Hard | 8 | 0.18 (~5.5s) | +3 | 3s |

---

## Gesture Detection

### Finger-Gun Pose Detection (3D Joint Angles)
- **Index extended:** PIP and DIP joint angles > 2.3 rad AND tip farther from MCP than PIP
- **Middle/Ring/Pinky curled:** PIP angle < 2.4 rad AND tip close to MCP (relative distance)
- **Thumb acceptable:** Hand-scale-relative distances (thumb tip within 2x handScale of index MCP, thumb somewhat extended)
- Uses `angleBetween(a, b, c)` — dot product of 3D bone vectors — works regardless of hand rotation

### Hand-Distance Normalization
- Aim coordinates are scaled by inverse hand size (wrist-to-middle-MCP 2D distance)
- Reference hand size: 0.14 (comfortable mid-range), scale factor clamped to [0.7, 2.0]
- Hand size smoothed via EMA (alpha=0.35) to prevent jumps when moving toward/away from camera
- Result: consistent aiming range regardless of hand distance from webcam

### Two-Stage Smoothing Pipeline
1. **EMA landmark smoothing** (alpha=0.55) in `gestureDetector.ts` — all 21 landmarks smoothed every frame
2. **Aim position lerp** (alpha=0.35) in `GameCanvas.tsx` — crosshair glides toward target

### Stability
- **Pose hysteresis:** 2 frames to confirm ON, 4 frames to confirm OFF — prevents flicker
- **Wrist-relative flick:** index tip Y tracked relative to wrist, cancels hand movement
- **7-frame velocity history** for smoother flick detection
- **Never nulls aim:** When tracking is briefly lost, crosshair holds last known position

### Flick Detection
- Track last 7 frames of wrist-relative index tip Y
- Compute average Y velocity across frames
- Fire when: `isFingerGun AND vy <= sensitivity AND cooldown elapsed`

---

## Dependencies (package.json)

```json
{
  "@hookform/resolvers": "^5.2.2",
  "@mediapipe/tasks-vision": "^0.10.32",
  "@supabase/supabase-js": "^2.95.3",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^0.564.0",
  "next": "16.1.6",
  "radix-ui": "^1.4.3",
  "react": "19.2.3",
  "react-dom": "19.2.3",
  "react-hook-form": "^7.71.1",
  "tailwind-merge": "^3.4.1",
  "zod": "^4.3.6"
}
```

---

## Color Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| game-primary | #0B63FF | Buttons, links, accents |
| game-accent | #FFD166 | Muzzle flash, countdown, combo |
| game-danger | #FF5A5F | Health low, game over, damage toasts |
| game-bg | #0F1724 | Background |
| game-surface | #FFFFFF | Cards, modals |
| game-text | #111827 | Dark text on light surfaces |

---

## Current Status

- All 7 phases implemented and working
- First-person perspective: zombies approach from horizon, growing bigger
- 4 zombie types (normal, fast, tank, boss) with boss waves every 5th wave
- Combo system with score multiplier (up to x4)
- Power-up drops (rapid-fire, slow-mo, nuke) with auto-collection
- Spooky background with moon, stars, fog, perspective grid
- Procedural pistol at bottom that rotates toward aim with recoil animation
- Procedural background music (130 BPM, A minor)
- Canvas-rendered score with glow/animation + wave announcements + high score tracking
- PIP webcam (220x165) in top-center
- Two-stage aim smoothing: EMA landmarks (0.55) + aim lerp (0.35)
- Hand-distance normalization: aim scaled by inverse hand size for consistent range at any camera distance
- Crosshair never snaps to center — holds last known position when tracking lost
- Joint-angle-based gesture detection with hysteresis
- Mouse click works as fallback fire mechanism
- Pre-game name input with auto-submit to leaderboard on game over
- Leaderboard page with top 10 scores (Supabase or localStorage)
- Settings persist to localStorage
- Muzzle flash at pistol barrel tip
- Video-game-style landing page and idle screen (glowing title, animated buttons, atmospheric fog CSS)
- Camera gate: game countdown only starts after camera permission granted AND hand tracker running
- Mobile tracking: CPU delegate + ideal camera constraints for mobile; GPU delegate unchanged for desktop
