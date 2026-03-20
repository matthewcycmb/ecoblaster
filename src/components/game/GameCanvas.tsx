"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { GameState, GamePhase, Settings, Difficulty } from "@/lib/types";
import { createInitialState, saveHighScore } from "@/lib/game/state";
import { createGameEngine, startWave, GameEngine } from "@/lib/game/engine";
import { DIFFICULTY_CONFIGS } from "@/lib/game/difficulty";
import {
  raycastFromPoint,
  findClosestTrashAtPoint,
  findTrashInRadius,
  setHitMarginMultiplier,
} from "@/lib/game/hitDetection";
import { EASY_HIT_MARGIN } from "@/lib/constants";
import { handleNetDeath } from "@/lib/game/zombies";
import { incrementCombo } from "@/lib/game/combo";
import { maybeDropPowerUp } from "@/lib/game/powerups";
import { loadSettings, saveSettings } from "@/lib/settings/store";
import { leaderboardNameSchema } from "@/lib/settings/schema";
import {
  MUZZLE_FLASH_DURATION_MS,
  CANVAS_MAX_WIDTH,
  HAND_NOT_DETECTED_TIMEOUT_MS,
  POSE_NOT_DETECTED_TIMEOUT_MS,
  RAPID_FIRE_COOLDOWN_MS,
  SHOTGUN_BLAST_RADIUS,
  BASE_SCORE_PER_KILL,
  BOSS_BONUS_MULTIPLIER,
  EXPLODER_DAMAGE_RADIUS,
  PISTOL_RECOIL_DURATION_MS,
  EASY_AUTO_FIRE_INTERVAL_MS,
  HIT_FLASH_DURATION_MS,
  SCREEN_SHAKE_DURATION_MS,
  WAVE_COUNTDOWN_MS,
} from "@/lib/constants";
import {
  playGunshot,
  playHit,
  playZombieGroan,
  playGameOverStinger,
  playExplosion,
  playComboChime,
  initAudio,
  startBackgroundMusic,
  stopBackgroundMusic,
} from "@/lib/audio/sfx";
import { GestureDetector } from "@/lib/mediapipe/gestureDetector";
import { Landmark } from "@/lib/mediapipe/landmarkUtils";
import GameHUD from "./GameHUD";
import PauseModal from "./PauseModal";
import GameOverModal from "./GameOverModal";
import WaveCountdown from "./WaveCountdown";
import TutorialOverlay from "./TutorialOverlay";
import DifficultyPrompt from "./DifficultyPrompt";
import type { TrackerStatus, HandTrackerHandle } from "@/components/mediapipe/HandTracker";

const HandTracker = dynamic(
  () => import("@/components/mediapipe/HandTracker"),
  { ssr: false }
);

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const engineRef = useRef<GameEngine | null>(null);
  const settingsRef = useRef<Settings>(loadSettings());
  const gestureDetectorRef = useRef(new GestureDetector());
  const lastHandSeenRef = useRef(0);
  const lastPoseSeenRef = useRef(0);
  const handTrackerRef = useRef<HandTrackerHandle | null>(null);
  const aimPositionRef = useRef<{ x: number; y: number } | null>(null);
  const aimTargetRef = useRef<{ x: number; y: number } | null>(null);
  const pendingStartRef = useRef(false);
  const handleFireRef = useRef<(dirX?: number, dirY?: number) => void>(() => {});

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [health, setHealth] = useState(100);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [isSurgeWave, setIsSurgeWave] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [nameError, setNameError] = useState("");
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>("loading");
  const [handWarning, setHandWarning] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [difficulty, setDifficultyState] = useState<Difficulty>("easy");
  const [showTutorial, setShowTutorial] = useState(false);
  const hasShownTutorialRef = useRef(false);
  const [showDifficultyPrompt, setShowDifficultyPrompt] = useState(false);
  const showDifficultyPromptRef = useRef(false);
  const hasShownDifficultyPromptRef = useRef(false);

  // Load player name and difficulty on mount
  useEffect(() => {
    const settings = loadSettings();
    setPlayerName(settings.playerName);
    setDifficultyState(settings.difficulty);
  }, []);

  // Sync React state from game state periodically
  const syncUIState = useCallback(() => {
    const s = stateRef.current;
    setHealth(s.health);
    setScore(s.score);
    setWave(s.wave);
    setIsSurgeWave(s.isSurgeWave);

    if (s.phase === "playing" && cameraActive) {
      const now = Date.now();
      if (now - lastHandSeenRef.current > POSE_NOT_DETECTED_TIMEOUT_MS) {
        setHandWarning("Point your index finger to aim (other fingers folded).");
      } else if (now - lastHandSeenRef.current > HAND_NOT_DETECTED_TIMEOUT_MS) {
        setHandWarning("Hand not detected. Place your hand in view.");
      } else {
        setHandWarning(null);
      }
    } else {
      setHandWarning(null);
    }

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
            handleFireRef.current(dx / len, dy / len);
          }
        }
      }
    }
  }, [cameraActive]);

  useEffect(() => {
    const interval = setInterval(syncUIState, 100);
    return () => clearInterval(interval);
  }, [syncUIState]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      const w = Math.min(CANVAS_MAX_WIDTH, window.innerWidth);
      const h = window.innerHeight;
      canvas!.width = w;
      canvas!.height = h;
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Initialize game engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createGameEngine(
      canvas,
      () => stateRef.current,
      (newPhase) => {
        setPhase(newPhase);
        if (newPhase === "game-over") {
          playGameOverStinger();
          stopBackgroundMusic();
          saveHighScore(stateRef.current.score);
        }
        if (newPhase === "wave-countdown") {
          playZombieGroan();
          // After wave 5: prompt difficulty upgrade (once per session, easy only)
          if (
            stateRef.current.wave === 6 &&
            settingsRef.current.difficulty === "easy" &&
            !hasShownDifficultyPromptRef.current
          ) {
            hasShownDifficultyPromptRef.current = true;
            stateRef.current.phase = "paused";
            setPhase("paused");
            showDifficultyPromptRef.current = true;
            setShowDifficultyPrompt(true);
          }
        }
      },
      () => DIFFICULTY_CONFIGS[settingsRef.current.difficulty],
      () => handTrackerRef.current?.getVideo() ?? null,
      () => aimPositionRef.current
    );

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.stop();
      stopBackgroundMusic();
    };
  }, []);

  /**
   * Process a kill: score, combo, power-up drop, net chain.
   */
  const processKill = useCallback((state: GameState, z: typeof state.trashItems[0], now: number): number => {
    let totalKills = 1;
    z.alive = false;
    state.trashRemainingInWave--;

    state.hitFlashUntil = now + HIT_FLASH_DURATION_MS;
    state.screenShakeUntil = now + SCREEN_SHAKE_DURATION_MS;

    const { newMultiplier, milestoneReached } = incrementCombo(state.combo);
    if (milestoneReached) {
      playComboChime(newMultiplier);
    }

    const killScore = BASE_SCORE_PER_KILL * state.combo.multiplier;
    state.score += killScore;
    state.lastScoreChangeTime = now;

    if (z.trashType === "barge") {
      state.score += BOSS_BONUS_MULTIPLIER * state.wave;
      state.surgeCleared = true;
    }

    maybeDropPowerUp(state, z.x, z.y, z.id);

    const toastText = killScore > BASE_SCORE_PER_KILL
      ? `+${killScore} (x${state.combo.multiplier})`
      : `+${killScore}`;
    state.hitToasts.push({
      id: `hit-${now}-${z.id}`,
      x: z.x,
      y: z.y - 30,
      createdAt: now,
      text: toastText,
      color: state.combo.multiplier >= 5 ? "#FFD166" : "#0B63FF",
    });

    if (z.trashType === "net") {
      playExplosion();
      const chainKilled = handleNetDeath(z, state.trashItems, EXPLODER_DAMAGE_RADIUS);
      for (const ck of chainKilled) {
        totalKills += processKill(state, ck, now);
      }
    }

    return totalKills;
  }, []);

  // Handle fire
  const handleFire = useCallback((dirX?: number, dirY?: number) => {
    const state = stateRef.current;
    if (state.phase !== "playing") return;

    const now = Date.now();
    const baseCooldown = settingsRef.current.flickCooldownMs;
    const cooldown = state.activePowerUp?.type === "rapid-fire"
      ? RAPID_FIRE_COOLDOWN_MS
      : baseCooldown;
    if (now - state.lastFireTime < cooldown) return;

    state.lastFireTime = now;
    state.muzzleFlashUntil = now + MUZZLE_FLASH_DURATION_MS;
    state.recoilUntil = now + PISTOL_RECOIL_DURATION_MS;

    playGunshot();

    const canvas = canvasRef.current!;
    const aim = aimPositionRef.current;

    let targetX: number;
    let targetY: number;

    if (aim && dirX !== undefined) {
      targetX = aim.x;
      targetY = aim.y;
    } else if (dirX !== undefined && dirY !== undefined) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      targetX = cx + dirX * 500;
      targetY = cy + dirY * 500;
    } else {
      targetX = canvas.width / 2;
      targetY = canvas.height / 2;
    }

    // Shotgun blast
    if (state.activePowerUp?.type === "shotgun-blast") {
      const hits = findTrashInRadius(state.trashItems, targetX, targetY, SHOTGUN_BLAST_RADIUS);
      for (const z of hits) {
        z.hp--;
        if (z.hp <= 0) {
          processKill(state, z, now);
          playHit();
        }
      }
      return;
    }

    // Normal fire
    let hit = findClosestTrashAtPoint(state.trashItems, targetX, targetY);
    if (!hit) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const dx = targetX - cx;
      const dy = targetY - cy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        hit = raycastFromPoint(state.trashItems, cx, cy, dx / len, dy / len);
      }
    }
    if (hit) {
      hit.hp--;
      if (hit.hp <= 0) {
        processKill(state, hit, now);
      }
      playHit();
    }
  }, [processKill]);

  handleFireRef.current = handleFire;

  const IS_MOBILE = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const AIM_LERP_SPEED = IS_MOBILE ? 0.55 : 0.35;

  // MediaPipe frame callback
  const handleFrame = useCallback(
    (landmarks: Landmark[] | null) => {
      const now = Date.now();
      const canvas = canvasRef.current;

      if (!landmarks) return;
      lastHandSeenRef.current = now;

      const detector = gestureDetectorRef.current;
      const result = detector.update(landmarks);

      if (canvas) {
        const rawX = (1 - result.indexTipX) * canvas.width;
        const rawY = result.indexTipY * canvas.height;
        aimTargetRef.current = { x: rawX, y: rawY };

        const prev = aimPositionRef.current;
        if (prev) {
          aimPositionRef.current = {
            x: prev.x + (rawX - prev.x) * AIM_LERP_SPEED,
            y: prev.y + (rawY - prev.y) * AIM_LERP_SPEED,
          };
        } else {
          aimPositionRef.current = { x: rawX, y: rawY };
        }
      }

      if (result.isFingerGun) {
        lastPoseSeenRef.current = now;
      }

      const settings = settingsRef.current;
      const state = stateRef.current;

      if (
        detector.shouldFire(
          result.isFingerGun,
          result.flickVelocity,
          state.lastFireTime,
          settings.flickCooldownMs,
          settings.sensitivity
        )
      ) {
        if (canvas && aimPositionRef.current) {
          const cx = canvas.width / 2;
          const cy = canvas.height / 2;
          const dx = aimPositionRef.current.x - cx;
          const dy = aimPositionRef.current.y - cy;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            handleFire(dx / len, dy / len);
          } else {
            handleFire(0, -1);
          }
        } else {
          handleFire(0, -1);
        }
      }
    },
    [handleFire]
  );

  // Click to fire
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      aimPositionRef.current = { x: mx, y: my };
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const dx = mx - cx;
      const dy = my - cy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        handleFire(dx / len, dy / len);
      } else {
        handleFire(0, -1);
      }
    },
    [handleFire]
  );

  // Actually start wave countdown + playing (called after tutorial if first time)
  const startCountdownAndPlay = useCallback(() => {
    const settings = settingsRef.current;
    const state = stateRef.current;
    state.phase = "wave-countdown";
    state.waveCountdownUntil = Date.now() + 800;
    setPhase("wave-countdown");

    startBackgroundMusic();

    const canvas = canvasRef.current!;
    const config = DIFFICULTY_CONFIGS[settings.difficulty];
    setTimeout(() => {
      if (stateRef.current.phase === "wave-countdown") {
        stateRef.current.phase = "playing";
        startWave(stateRef.current, canvas.width, canvas.height, config);
        setPhase("playing");
        playZombieGroan();
      }
    }, 800);
  }, []);

  // Handle tutorial completion — start wave 1
  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false);
    startCountdownAndPlay();
  }, [startCountdownAndPlay]);

  // Begin countdown (called once tracker is confirmed running)
  const beginCountdown = useCallback(() => {
    const settings = settingsRef.current;
    setHitMarginMultiplier(settings.difficulty === "easy" ? EASY_HIT_MARGIN : 1.0);
    const state = createInitialState();
    stateRef.current = state;
    setHealth(state.health);
    setScore(0);
    setWave(1);
    setIsSurgeWave(false);
    lastHandSeenRef.current = Date.now();
    lastPoseSeenRef.current = Date.now();
    gestureDetectorRef.current.reset();

    if (!hasShownTutorialRef.current) {
      // First time: show tutorial for 3 seconds, then start wave 1
      hasShownTutorialRef.current = true;
      setShowTutorial(true);
      // handleTutorialComplete will be called by TutorialOverlay's onComplete
    } else {
      // Subsequent games: go straight to countdown
      startCountdownAndPlay();
    }
  }, [startCountdownAndPlay]);

  const handleSetDifficulty = useCallback((d: Difficulty) => {
    setDifficultyState(d);
    const settings = loadSettings();
    settings.difficulty = d;
    saveSettings(settings);
    settingsRef.current = settings;
  }, []);

  // Start game — validates name, activates camera, waits for tracker
  const handleStartGame = useCallback(() => {
    const result = leaderboardNameSchema.safeParse(playerName.trim());
    if (!result.success) {
      setNameError("Name must be 1-32 characters, letters or numbers only.");
      return;
    }
    setNameError("");

    const settings = loadSettings();
    settings.playerName = result.data;
    saveSettings(settings);
    setPlayerName(result.data);

    initAudio();
    settingsRef.current = settings;
    pendingStartRef.current = true;
    setCameraActive(true);

    // If tracker is already running (e.g., restart), start immediately
    if (trackerStatus === "running") {
      pendingStartRef.current = false;
      beginCountdown();
    }
  }, [playerName, trackerStatus, beginCountdown]);

  // Pause/Resume with P key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "p" || e.key === "P") {
        if (showDifficultyPromptRef.current) return;
        const state = stateRef.current;
        if (state.phase === "playing") {
          state.phase = "paused";
          setPhase("paused");
        } else if (state.phase === "paused") {
          state.phase = "playing";
          setPhase("playing");
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleResume = useCallback(() => {
    stateRef.current.phase = "playing";
    setPhase("playing");
  }, []);

  const handleDifficultyKeepEasy = useCallback(() => {
    showDifficultyPromptRef.current = false;
    setShowDifficultyPrompt(false);
    // Resume into wave-countdown
    stateRef.current.phase = "wave-countdown";
    stateRef.current.waveCountdownUntil = Date.now() + WAVE_COUNTDOWN_MS;
    setPhase("wave-countdown");
  }, []);

  const handleDifficultyLevelUp = useCallback(() => {
    showDifficultyPromptRef.current = false;
    setShowDifficultyPrompt(false);
    // Switch to normal difficulty
    const settings = loadSettings();
    settings.difficulty = "normal";
    saveSettings(settings);
    settingsRef.current = settings;
    setDifficultyState("normal");
    setHitMarginMultiplier(1.0);
    // Resume into wave-countdown
    stateRef.current.phase = "wave-countdown";
    stateRef.current.waveCountdownUntil = Date.now() + WAVE_COUNTDOWN_MS;
    setPhase("wave-countdown");
  }, []);

  const handleRestart = useCallback(() => {
    handleStartGame();
  }, [handleStartGame]);

  const handleTrackerStatus = useCallback((status: TrackerStatus) => {
    setTrackerStatus(status);
    if (status === "running" && pendingStartRef.current) {
      pendingStartRef.current = false;
      beginCountdown();
    }
  }, [beginCountdown]);

  return (
    <div className="relative flex items-center justify-center w-full h-screen bg-game-bg overflow-hidden">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="cursor-crosshair"
      />

      {cameraActive && (
        <HandTracker
          ref={handTrackerRef}
          onFrame={handleFrame}
          onStatusChange={handleTrackerStatus}
          paused={phase === "paused"}
        />
      )}

      {/* HUD overlay */}
      {(phase === "playing" || phase === "wave-countdown") && (
        <GameHUD
          health={health}
          score={score}
          wave={wave}
          isSurgeWave={isSurgeWave}
          onPause={() => {
            stateRef.current.phase = "paused";
            setPhase("paused");
          }}
        />
      )}

      {/* Hand detection warnings */}
      {handWarning && phase === "playing" && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/60 rounded-lg px-6 py-3 text-white text-sm">
          {handWarning}
        </div>
      )}

      {/* Camera status overlays */}
      {cameraActive && trackerStatus === "requesting-camera" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-50">
          <h2 className="text-2xl font-bold text-white mb-2">Request Camera Permission</h2>
          <p className="text-muted-foreground text-center max-w-sm">
            Reef Defender needs your webcam to detect your hand gesture.
          </p>
        </div>
      )}

      {cameraActive && trackerStatus === "initializing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-50">
          <h2 className="text-xl font-bold text-white mb-2">Loading hand tracker...</h2>
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {cameraActive && trackerStatus === "camera-denied" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-50">
          <h2 className="text-xl font-bold text-white mb-2">Camera Access Denied</h2>
          <p className="text-muted-foreground text-center max-w-sm mb-4">
            Camera access denied. To play, enable camera permissions in your browser settings.
          </p>
          <div className="flex gap-3">
            <button onClick={() => window.location.reload()} className="rounded-lg bg-game-primary px-6 py-2 text-white font-semibold">Retry</button>
            <button onClick={() => (window.location.href = "/")} className="rounded-lg bg-white px-6 py-2 text-game-primary font-semibold border border-game-primary">Quit</button>
          </div>
        </div>
      )}

      {cameraActive && trackerStatus === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-50">
          <h2 className="text-xl font-bold text-white mb-2">Tracking Engine Error</h2>
          <p className="text-muted-foreground text-center max-w-sm mb-4">
            Tracking engine failed to load. Try reloading the page.
          </p>
          <button onClick={() => window.location.reload()} className="rounded-lg bg-game-danger px-6 py-2 text-white font-semibold">Reload</button>
        </div>
      )}

      {/* Idle state — name input + start (hidden while camera is loading) */}
      {phase === "idle" && !cameraActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-40">
          <h2 className="game-title text-4xl sm:text-5xl font-black text-cyan-400 mb-2 tracking-widest">
            Reef Defender
          </h2>
          <p className="game-subtitle text-gray-400 mb-6 text-center max-w-sm tracking-wide">
            Protect the reef with your hands.
          </p>

          <div className="w-40 h-px bg-gradient-to-r from-transparent via-teal-400/40 to-transparent mb-6" />

          <div className="flex flex-col gap-2 mb-6 w-72">
            <label className="text-gray-300 text-sm font-medium tracking-wide uppercase">Player Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => { setPlayerName(e.target.value); setNameError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleStartGame(); }}
              maxLength={32}
              placeholder="Enter your name"
              className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-400/60 tracking-wide"
            />
            {nameError && <p className="text-sm text-red-400">{nameError}</p>}
          </div>

          <button
            onClick={handleStartGame}
            className="game-menu-btn rounded-lg bg-teal-500 border border-teal-400/50 px-10 py-3 text-lg font-bold text-white tracking-wider uppercase hover:bg-teal-400 transition-colors"
          >
            Start Game
          </button>

          <div className="flex gap-3 mt-5">
            <button
              onClick={() => handleSetDifficulty("easy")}
              className={`rounded-lg border px-5 py-2 text-sm font-bold tracking-wider uppercase transition-colors ${
                difficulty === "easy"
                  ? "bg-emerald-500/90 border-emerald-400/60 text-white"
                  : "bg-white/5 border-white/15 text-gray-400 hover:bg-white/10"
              }`}
            >
              Easy
            </button>
            <button
              onClick={() => handleSetDifficulty("normal")}
              className={`rounded-lg border px-5 py-2 text-sm font-bold tracking-wider uppercase transition-colors ${
                difficulty === "normal"
                  ? "bg-amber-500/90 border-amber-400/60 text-white"
                  : "bg-white/5 border-white/15 text-gray-400 hover:bg-white/10"
              }`}
            >
              Normal
            </button>
          </div>

          <p className="text-xs text-gray-600 mt-6 tracking-wide">Press P to pause during gameplay</p>
        </div>
      )}

      {/* Wave countdown */}
      {phase === "wave-countdown" && (
        <WaveCountdown wave={wave} isSurgeWave={isSurgeWave} />
      )}

      {/* Tutorial overlay — once before wave 1 */}
      {showTutorial && (
        <TutorialOverlay onComplete={handleTutorialComplete} />
      )}

      {/* Difficulty upgrade prompt — after wave 5, easy mode only */}
      {showDifficultyPrompt && (
        <DifficultyPrompt
          onKeepEasy={handleDifficultyKeepEasy}
          onLevelUp={handleDifficultyLevelUp}
        />
      )}

      {/* Pause modal */}
      {phase === "paused" && !showDifficultyPrompt && (
        <PauseModal
          onResume={handleResume}
          onQuit={() => (window.location.href = "/")}
        />
      )}

      {/* Game over */}
      {phase === "game-over" && (
        <GameOverModal score={score} playerName={playerName} onPlayAgain={handleRestart} />
      )}
    </div>
  );
}
