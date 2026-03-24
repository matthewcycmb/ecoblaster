"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { GameState, GamePhase, Settings, Difficulty, HandGunState, Upgrade } from "@/lib/types";
import { createInitialState, saveHighScore } from "@/lib/game/state";
import { createGameEngine, startWave, GameEngine } from "@/lib/game/engine";
import { DIFFICULTY_CONFIGS } from "@/lib/game/difficulty";
import {
  raycastFromPoint,
  findClosestTrashAtPoint,
  findTrashInRadius,
  setHitMarginMultiplier,
} from "@/lib/game/hitDetection";
import { EASY_HIT_MARGIN, NORMAL_HIT_MARGIN } from "@/lib/constants";
import { spawnNetFragments } from "@/lib/game/zombies";
import { incrementCombo } from "@/lib/game/combo";
import { maybeDropPowerUp } from "@/lib/game/powerups";
import { applyUpgrades } from "@/lib/game/upgrades";
import { activateOceanCurrent } from "@/lib/game/current";
import { createDefender } from "@/lib/game/defenders";
import { findFishAtPoint } from "@/lib/game/fish";
import { loadSettings, saveSettings } from "@/lib/settings/store";
import { leaderboardNameSchema } from "@/lib/settings/schema";
import {
  FISH_SHOOT_PENALTY,
  FISH_PENALTY_FLASH_MS,
  MUZZLE_FLASH_DURATION_MS,
  CANVAS_MAX_WIDTH,
  HAND_NOT_DETECTED_TIMEOUT_MS,
  POSE_NOT_DETECTED_TIMEOUT_MS,
  RAPID_FIRE_COOLDOWN_MS,
  SHOTGUN_BLAST_RADIUS,
  BASE_SCORE_PER_KILL,
  BOSS_BONUS_MULTIPLIER,
  BOSS_KILL_SHAKE_MS,
  BOSS_KILL_SHAKE_INTENSITY,
  PISTOL_RECOIL_DURATION_MS,
  AUTO_FIRE_INTERVAL_MS,
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
  playFishPenalty,
  initAudio,
  startBackgroundMusic,
  stopBackgroundMusic,
  fadeOutBackgroundMusic,
  setMusicMuted,
  isMusicMuted,
} from "@/lib/audio/sfx";
import { GestureDetector } from "@/lib/mediapipe/gestureDetector";
import { Landmark } from "@/lib/mediapipe/landmarkUtils";
import GameHUD from "./GameHUD";
import PauseModal from "./PauseModal";
import GameOverModal from "./GameOverModal";
import WaveCountdown from "./WaveCountdown";
import TutorialOverlay from "./TutorialOverlay";
import StoryIntro from "./StoryIntro";
import DifficultyPrompt from "./DifficultyPrompt";
import UpgradeSelect from "./UpgradeSelect";
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
  const gestureDetectorsRef = useRef([new GestureDetector(), new GestureDetector()]);
  const lastHandSeenRef = useRef(0);
  const lastPoseSeenRef = useRef(0);
  const handTrackerRef = useRef<HandTrackerHandle | null>(null);
  const aimPositionRef = useRef<{ x: number; y: number } | null>(null);
  const aimTargetRef = useRef<{ x: number; y: number } | null>(null);
  const aimPositionsRef = useRef<({ x: number; y: number } | null)[]>([null, null]);
  const handGunStatesRef = useRef<HandGunState[]>([
    { lastFireTime: 0, muzzleFlashUntil: 0, recoilUntil: 0 },
    { lastFireTime: 0, muzzleFlashUntil: 0, recoilUntil: 0 },
  ]);
  const activeHandCountRef = useRef(2);
  const secondHandFirstSeenRef = useRef(0);   // when second hand was first detected
  const secondHandLastSeenRef = useRef(0);     // when second hand was last detected
  const secondHandActiveRef = useRef(false);   // debounced: is second hand "confirmed"
  const fpsHistoryRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef(0);
  const pendingStartRef = useRef(false);
  const handleFireRef = useRef<(dirX?: number, dirY?: number, handIndex?: number) => void>(() => {});

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
  const [showDualGunHint, setShowDualGunHint] = useState(false);
  const hasShownDualGunHintRef = useRef(false);
  const [showIntro, setShowIntro] = useState(false);
  const hasShownIntroRef = useRef(false);
  const [showDifficultyPrompt, setShowDifficultyPrompt] = useState(false);
  const [musicMuted, setMusicMutedState] = useState(false);
  const [currentCharges, setCurrentCharges] = useState(2);
  const [pendingUpgradeChoices, setPendingUpgradeChoices] = useState<Upgrade[] | null>(null);
  const showDifficultyPromptRef = useRef(false);
  const hasShownDifficultyPromptRef = useRef(false);
  const hasPlayedOnceRef = useRef(false);

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
    setCurrentCharges(s.currentCharges);
    if (s.pendingUpgradeChoices && s.phase === "upgrade-select") {
      setPendingUpgradeChoices(s.pendingUpgradeChoices);
    }
    // Apply wider-hitbox upgrade bonus to hit detection margin
    const upgradeMods = applyUpgrades(s.upgrades);
    const baseMargin = settingsRef.current.difficulty === "easy" ? EASY_HIT_MARGIN : NORMAL_HIT_MARGIN;
    setHitMarginMultiplier(baseMargin + upgradeMods.hitMarginBonus);

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

    // Auto-fire: each hand fires independently
    if (s.phase === "playing") {
      const now = Date.now();
      const canvas = canvasRef.current;
      if (canvas) {
        for (let i = 0; i < activeHandCountRef.current; i++) {
          const aim = aimPositionsRef.current[i];
          const handGun = handGunStatesRef.current[i];
          if (!aim) continue;
          const autoMods = applyUpgrades(s.upgrades);
          const cooldown = (s.activePowerUp?.type === "rapid-fire"
            ? RAPID_FIRE_COOLDOWN_MS : AUTO_FIRE_INTERVAL_MS) * autoMods.fireCooldownMult;
          if (now - handGun.lastFireTime >= cooldown) {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const dx = aim.x - cx;
            const dy = aim.y - cy;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
              handleFireRef.current(dx / len, dy / len, i);
            }
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
          hasPlayedOnceRef.current = true;
          playGameOverStinger();
          fadeOutBackgroundMusic(2000);
          saveHighScore(stateRef.current.score);
        }
        if (newPhase === "upgrade-select") {
          setPendingUpgradeChoices(stateRef.current.pendingUpgradeChoices);
        }
        if (newPhase === "upgrade-select") {
          playZombieGroan();
        }
        if (newPhase === "wave-countdown") {
          // After wave 2: show dual-gun hint (once per session)
          if (stateRef.current.wave === 3 && !hasShownDualGunHintRef.current) {
            hasShownDualGunHintRef.current = true;
            setShowDualGunHint(true);
            setTimeout(() => setShowDualGunHint(false), 4000);
          }
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
      () => aimPositionRef.current,
      () => aimPositionsRef.current.filter(Boolean) as { x: number; y: number }[],
      () => handGunStatesRef.current
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
      state.comboFlashUntil = now + 300;
    }

    const mods = applyUpgrades(state.upgrades);
    const killScore = Math.round(BASE_SCORE_PER_KILL * state.combo.multiplier * mods.scoreBonusMult);
    state.score += killScore;
    state.lastScoreChangeTime = now;

    if (z.trashType === "barge") {
      // Boss kill: big bonus, clear all trash, heavy screen shake
      state.score += BOSS_BONUS_MULTIPLIER * state.wave;
      state.surgeCleared = true;
      state.screenShakeUntil = now + BOSS_KILL_SHAKE_MS;
      for (const t of state.trashItems) {
        if (t.alive && t.id !== z.id) {
          t.alive = false;
          state.trashRemainingInWave--;
          totalKills++;
        }
      }
      playExplosion();
    }

    maybeDropPowerUp(state, z.x, z.y, z.id, settingsRef.current.difficulty);

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

    // Net splitting: spawn fragments instead of chain-killing
    if (z.trashType === "net" && !z.isFragment) {
      playExplosion();
      const canvas = canvasRef.current!;
      const config = DIFFICULTY_CONFIGS[settingsRef.current.difficulty];
      const fragments = spawnNetFragments(z, canvas.width, canvas.height, config);
      for (const frag of fragments) {
        state.trashItems.push(frag);
        state.trashRemainingInWave++;
      }
    }

    return totalKills;
  }, []);

  // Handle fire — handIndex selects which hand's state to update
  const handleFire = useCallback((dirX?: number, dirY?: number, handIndex?: number) => {
    const state = stateRef.current;
    if (state.phase !== "playing") return;

    const now = Date.now();
    const hi = handIndex ?? 0;
    const handGun = handGunStatesRef.current[hi];
    const mods = applyUpgrades(state.upgrades);
    const baseCooldown = state.activePowerUp?.type === "rapid-fire"
      ? RAPID_FIRE_COOLDOWN_MS
      : AUTO_FIRE_INTERVAL_MS;
    const cooldown = baseCooldown * mods.fireCooldownMult;
    if (now - handGun.lastFireTime < cooldown) return;

    // Update per-hand state
    handGun.lastFireTime = now;
    handGun.muzzleFlashUntil = now + MUZZLE_FLASH_DURATION_MS;
    handGun.recoilUntil = now + PISTOL_RECOIL_DURATION_MS;

    // Also update shared state for screen effects
    state.lastFireTime = now;
    state.muzzleFlashUntil = now + MUZZLE_FLASH_DURATION_MS;
    state.recoilUntil = now + PISTOL_RECOIL_DURATION_MS;

    playGunshot();

    const canvas = canvasRef.current!;
    const aim = aimPositionsRef.current[hi] ?? aimPositionRef.current;

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

    // Check fish hit FIRST — penalty for shooting friendly fish
    const fishHit = findFishAtPoint(state.swimmingFish, targetX, targetY);
    if (fishHit) {
      fishHit.alive = false;
      fishHit.hitAt = now;
      state.health = Math.max(0, state.health - FISH_SHOOT_PENALTY);
      state.fishPenaltyFlashUntil = now + FISH_PENALTY_FLASH_MS;
      // Break combo
      state.combo.count = 0;
      state.combo.multiplier = 1;
      state.comboResetFlashUntil = now + 200;
      playFishPenalty();
      state.hitToasts.push({
        id: `fish-penalty-${now}-${fishHit.id}`,
        x: fishHit.x,
        y: fishHit.y - 30,
        createdAt: now,
        text: `Don't shoot fish! -${FISH_SHOOT_PENALTY} HP`,
        color: "#FF3333",
      });
      if (state.health <= 0) {
        state.phase = "game-over";
        setPhase("game-over");
        playGameOverStinger();
        fadeOutBackgroundMusic(2000);
        saveHighScore(state.score);
      }
      return; // Don't check trash — shot wasted on fish
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
    // Final fallback: find nearest alive item within range of tap point.
    // Far items (low depth) get a larger search radius since they're tiny on screen.
    if (!hit) {
      let bestDist = Infinity;
      for (const z of state.trashItems) {
        if (!z.alive) continue;
        const ddx = z.x - targetX;
        const ddy = z.y - targetY;
        const d = Math.sqrt(ddx * ddx + ddy * ddy);
        const radius = z.depth < 0.3 ? 80 : z.depth < 0.6 ? 50 : 35;
        if (d < radius && d < bestDist) {
          bestDist = d;
          hit = z;
        }
      }
    }
    if (hit) {
      hit.hp--;
      if (hit.hp <= 0) {
        processKill(state, hit, now);
      }
      // Splash damage from upgrade
      if (mods.splashRadius > 0) {
        const splashHits = findTrashInRadius(state.trashItems, hit.x, hit.y, mods.splashRadius);
        for (const sz of splashHits) {
          if (sz === hit || !sz.alive) continue;
          sz.hp--;
          if (sz.hp <= 0) {
            processKill(state, sz, now);
          }
        }
      }
      playHit();
    } else {
      // Miss — reset combo with red flash
      if (state.combo.count > 0) {
        state.combo.count = 0;
        state.combo.multiplier = 1;
        state.comboResetFlashUntil = now + 200;
      }
    }
  }, [processKill]);

  handleFireRef.current = handleFire;

  const IS_MOBILE = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const AIM_LERP_SPEED = IS_MOBILE ? 0.55 : 0.35;

  // MediaPipe frame callback — processes up to 2 hands
  const handleFrame = useCallback(
    (hands: (Landmark[] | null)[]) => {
      const now = Date.now();
      const canvas = canvasRef.current;

      if (hands.length === 0) return;
      lastHandSeenRef.current = now;

      // FPS-based auto-detect: drop to single hand if truly struggling
      if (lastFrameTimeRef.current > 0) {
        const delta = now - lastFrameTimeRef.current;
        if (delta > 0) {
          const fps = 1000 / delta;
          const history = fpsHistoryRef.current;
          history.push(fps);
          if (history.length > 120) history.shift();
          if (history.length >= 120) {
            const avgFps = history.reduce((a, b) => a + b, 0) / history.length;
            if (avgFps < 10 && activeHandCountRef.current === 2) {
              activeHandCountRef.current = 1;
              aimPositionsRef.current[1] = null;
              gestureDetectorsRef.current[1].reset();
            } else if (avgFps >= 14 && activeHandCountRef.current === 1) {
              activeHandCountRef.current = 2;
            }
          }
        }
      }
      lastFrameTimeRef.current = now;

      const maxHands = Math.min(activeHandCountRef.current, hands.length);

      // Assign hands to slots using spatial proximity (left hand → slot 0, right → slot 1)
      // MediaPipe may swap hand ordering between frames, so we stabilize by X position
      const validHands: { idx: number; landmarks: Landmark[] }[] = [];
      for (let i = 0; i < hands.length; i++) {
        if (hands[i]) validHands.push({ idx: i, landmarks: hands[i]! });
      }

      // Sort by wrist X position (landmark 0) — leftmost hand maps to slot 0 in camera space
      // Since we flip X for rendering, the camera-left hand appears on the right side
      if (validHands.length >= 2) {
        validHands.sort((a, b) => a.landmarks[0].x - b.landmarks[0].x);
      }

      // Debounce second hand: require 500ms sustained detection before activating,
      // and keep it alive for 300ms after it disappears to avoid flickering
      const SECOND_HAND_ACTIVATE_MS = 500;
      const SECOND_HAND_GRACE_MS = 300;

      if (validHands.length >= 2) {
        secondHandLastSeenRef.current = now;
        if (secondHandFirstSeenRef.current === 0) {
          secondHandFirstSeenRef.current = now;
        }
        if (!secondHandActiveRef.current && now - secondHandFirstSeenRef.current >= SECOND_HAND_ACTIVATE_MS) {
          secondHandActiveRef.current = true;
        }
      } else {
        if (secondHandActiveRef.current && now - secondHandLastSeenRef.current > SECOND_HAND_GRACE_MS) {
          secondHandActiveRef.current = false;
          secondHandFirstSeenRef.current = 0;
        }
        if (!secondHandActiveRef.current) {
          secondHandFirstSeenRef.current = 0;
        }
      }

      // Only process slot 1 if second hand is confirmed active
      const effectiveMaxHands = secondHandActiveRef.current ? maxHands : Math.min(maxHands, 1);

      for (let slot = 0; slot < effectiveMaxHands && slot < validHands.length; slot++) {
        const { landmarks } = validHands[slot];
        const detector = gestureDetectorsRef.current[slot];
        const result = detector.update(landmarks);

        if (canvas) {
          const rawX = (1 - result.indexTipX) * canvas.width;
          const rawY = result.indexTipY * canvas.height;

          if (slot === 0) {
            aimTargetRef.current = { x: rawX, y: rawY };
          }

          const prev = aimPositionsRef.current[slot];
          if (prev) {
            aimPositionsRef.current[slot] = {
              x: prev.x + (rawX - prev.x) * AIM_LERP_SPEED,
              y: prev.y + (rawY - prev.y) * AIM_LERP_SPEED,
            };
          } else {
            aimPositionsRef.current[slot] = { x: rawX, y: rawY };
          }
        }

        if (result.isFingerGun) {
          lastPoseSeenRef.current = now;
        }
      }

      // Keep primary aimPositionRef in sync for backward compat
      aimPositionRef.current = aimPositionsRef.current[0];

      // Clear aim for hands that aren't active
      if (!secondHandActiveRef.current) {
        aimPositionsRef.current[1] = null;
      }
      for (let i = validHands.length; i < 2; i++) {
        if (i === 1 && secondHandActiveRef.current && now - secondHandLastSeenRef.current <= SECOND_HAND_GRACE_MS) {
          continue; // keep slot 1 alive during grace period
        }
        aimPositionsRef.current[i] = null;
      }
    },
    [handleFire]
  );

  // Pointer up to fire — uses final finger position so swipes/flicks land correctly
  const handleCanvasPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
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
    state.waveCountdownUntil = Date.now() + WAVE_COUNTDOWN_MS;
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
    }, WAVE_COUNTDOWN_MS);
  }, []);

  // Handle intro completion — proceed to tutorial or countdown
  const handleIntroComplete = useCallback(() => {
    setShowIntro(false);
    if (!hasShownTutorialRef.current) {
      hasShownTutorialRef.current = true;
      setShowTutorial(true);
    } else {
      startCountdownAndPlay();
    }
  }, [startCountdownAndPlay]);

  // Handle tutorial completion — start wave 1
  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false);
    startCountdownAndPlay();
  }, [startCountdownAndPlay]);

  // Begin countdown (called once tracker is confirmed running)
  const beginCountdown = useCallback(() => {
    const settings = settingsRef.current;
    setHitMarginMultiplier(settings.difficulty === "easy" ? EASY_HIT_MARGIN : NORMAL_HIT_MARGIN);
    const state = createInitialState();
    stateRef.current = state;
    setHealth(state.health);
    setScore(0);
    setWave(1);
    setIsSurgeWave(false);
    lastHandSeenRef.current = Date.now();
    lastPoseSeenRef.current = Date.now();
    gestureDetectorsRef.current.forEach(d => d.reset());
    aimPositionsRef.current = [null, null];
    handGunStatesRef.current = [
      { lastFireTime: 0, muzzleFlashUntil: 0, recoilUntil: 0 },
      { lastFireTime: 0, muzzleFlashUntil: 0, recoilUntil: 0 },
    ];

    if (!hasShownIntroRef.current) {
      // First time: show story intro, then tutorial, then start wave 1
      hasShownIntroRef.current = true;
      setShowIntro(true);
      // handleIntroComplete will proceed to tutorial or countdown
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

  const handleUpgradeSelect = useCallback((upgrade: Upgrade) => {
    const state = stateRef.current;
    state.upgrades.push(upgrade.id);
    state.pendingUpgradeChoices = null;
    setPendingUpgradeChoices(null);
    // Apply tougher-reef immediately (max health increase)
    if (upgrade.id === "tougher-reef") {
      const mods = applyUpgrades(state.upgrades);
      const maxHp = 100 + mods.maxHealthBonus;
      state.health = Math.min(maxHp, state.health + 15);
    }
    state.phase = "wave-countdown";
    state.waveCountdownUntil = Date.now() + WAVE_COUNTDOWN_MS;
    setPhase("wave-countdown");
  }, []);

  const handleBuyDefender = useCallback(() => {
    const state = stateRef.current;
    if (state.score < 500) return;
    state.score -= 500;
    const defender = createDefender(state);
    state.reefDefenders.push(defender);
    // Dismiss upgrade screen and move to wave countdown
    state.pendingUpgradeChoices = null;
    setPendingUpgradeChoices(null);
    state.phase = "wave-countdown";
    state.waveCountdownUntil = Date.now() + WAVE_COUNTDOWN_MS;
    setPhase("wave-countdown");
  }, []);

  const handleCurrentPush = useCallback(() => {
    activateOceanCurrent(stateRef.current);
    setCurrentCharges(stateRef.current.currentCharges);
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
    setHitMarginMultiplier(NORMAL_HIT_MARGIN);
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
        onPointerUp={handleCanvasPointerUp}
        className="cursor-crosshair touch-none"
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
      {(phase === "playing" || phase === "wave-countdown" || phase === "upgrade-select") && (
        <GameHUD
          health={health}
          score={score}
          wave={wave}
          isSurgeWave={isSurgeWave}
          onPause={() => {
            stateRef.current.phase = "paused";
            setPhase("paused");
          }}
          musicMuted={musicMuted}
          onToggleMusic={() => {
            const next = !musicMuted;
            setMusicMutedState(next);
            setMusicMuted(next);
          }}
          currentCharges={currentCharges}
          onCurrentPush={handleCurrentPush}
        />
      )}

      {/* Dual-gun hint */}
      {showDualGunHint && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          style={{
            animation: "fadeInOut 4s ease-in-out forwards",
          }}
        >
          <div className="bg-black/70 backdrop-blur-sm border border-cyan-500/30 rounded-xl px-5 sm:px-6 py-3 sm:py-4 flex items-center gap-3 shadow-[0_0_20px_rgba(0,200,255,0.15)]">
            <span className="text-2xl sm:text-3xl" style={{ filter: "drop-shadow(0 0 8px rgba(0,200,255,0.4))" }}>
              👉👉
            </span>
            <div>
              <p className="text-white font-bold text-xs sm:text-sm tracking-wide">
                Use both hands for dual guns!
              </p>
              <p className="text-cyan-300/70 text-[10px] sm:text-xs mt-0.5">
                Double the firepower with two finger guns
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hand detection warnings */}
      {handWarning && phase === "playing" && (
        <div className="absolute bottom-28 sm:bottom-20 left-1/2 -translate-x-1/2 bg-black/70 rounded-lg px-4 sm:px-6 py-2 sm:py-3 text-white text-xs sm:text-sm max-w-[80vw] text-center z-30">
          {handWarning}
        </div>
      )}

      {/* Camera status overlays */}
      {cameraActive && trackerStatus === "requesting-camera" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-50 px-6">
          <h2 className="text-base sm:text-2xl font-bold text-white mb-2 text-center">Request Camera Permission</h2>
          <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-sm">
            Reef Defender needs your webcam to detect your hand gesture.
          </p>
        </div>
      )}

      {cameraActive && trackerStatus === "initializing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-50 px-6">
          <h2 className="text-base sm:text-xl font-bold text-white mb-3 text-center">Loading hand tracker...</h2>
          <div className="w-7 h-7 sm:w-8 sm:h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {cameraActive && trackerStatus === "camera-denied" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-50 px-6">
          <h2 className="text-base sm:text-xl font-bold text-white mb-2 text-center">Camera Access Denied</h2>
          <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-sm mb-4">
            Camera access denied. To play, enable camera permissions in your browser settings.
          </p>
          <div className="flex gap-3">
            <button onClick={() => window.location.reload()} className="rounded-lg bg-game-primary px-4 sm:px-6 py-2 text-white text-sm font-semibold">Retry</button>
            <button onClick={() => (window.location.href = "/")} className="rounded-lg bg-white px-4 sm:px-6 py-2 text-game-primary text-sm font-semibold border border-game-primary">Quit</button>
          </div>
        </div>
      )}

      {cameraActive && trackerStatus === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-50 px-6">
          <h2 className="text-base sm:text-xl font-bold text-white mb-2 text-center">Tracking Engine Error</h2>
          <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-sm mb-4">
            Tracking engine failed to load. Try reloading the page.
          </p>
          <button onClick={() => window.location.reload()} className="rounded-lg bg-game-danger px-4 sm:px-6 py-2 text-white text-sm font-semibold">Reload</button>
        </div>
      )}

      {/* Idle state — name input + start (hidden while camera is loading) */}
      {phase === "idle" && !cameraActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-40 px-6">
          <h2 className="game-title text-xl sm:text-3xl font-black text-cyan-400 mb-3 sm:mb-4 tracking-widest text-center">
            REEF DEFENDER
          </h2>
          <p className="game-subtitle text-[10px] sm:text-xs text-gray-400/70 mb-5 sm:mb-7 text-center tracking-wide">
            {hasPlayedOnceRef.current ? "Protect the reef. Again." : "Protect the reef with your hands."}
          </p>

          <div className="flex flex-col items-center gap-1.5 sm:gap-2 mb-4 sm:mb-5 w-full max-w-64 sm:max-w-72">
            <label className="text-gray-400 text-[10px] sm:text-xs font-medium tracking-wide uppercase self-start">Player Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => { setPlayerName(e.target.value); setNameError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleStartGame(); }}
              maxLength={32}
              placeholder="Enter your name"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 sm:px-4 py-2 sm:py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-400/40 tracking-wide text-sm"
            />
            {nameError && <p className="text-xs text-red-400">{nameError}</p>}
          </div>

          <button
            onClick={handleStartGame}
            className="game-menu-btn w-full max-w-64 sm:max-w-72 rounded-lg bg-teal-500 border border-teal-400/50 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-white tracking-wider uppercase hover:bg-teal-400 transition-colors"
          >
            Start Game
          </button>

          <div className="flex gap-2.5 sm:gap-3 mt-3 sm:mt-4">
            <button
              onClick={() => handleSetDifficulty("easy")}
              className={`rounded-lg border px-4 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold tracking-wider uppercase transition-colors ${
                difficulty === "easy"
                  ? "bg-emerald-500/90 border-emerald-400/60 text-white"
                  : "bg-white/5 border-white/15 text-gray-400 hover:bg-white/10"
              }`}
            >
              Easy
            </button>
            <button
              onClick={() => handleSetDifficulty("normal")}
              className={`rounded-lg border px-4 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold tracking-wider uppercase transition-colors ${
                difficulty === "normal"
                  ? "bg-amber-500/90 border-amber-400/60 text-white"
                  : "bg-white/5 border-white/15 text-gray-400 hover:bg-white/10"
              }`}
            >
              Normal
            </button>
          </div>

          <p className="text-[8px] sm:text-[10px] text-gray-600/60 mt-4 sm:mt-5 tracking-wide text-center">Tap pause button to pause</p>
        </div>
      )}

      {/* Upgrade selection */}
      {phase === "upgrade-select" && pendingUpgradeChoices && (
        <UpgradeSelect
          choices={pendingUpgradeChoices}
          onSelect={handleUpgradeSelect}
          score={score}
          onBuyDefender={handleBuyDefender}
        />
      )}

      {/* Wave countdown */}
      {phase === "wave-countdown" && (
        <WaveCountdown wave={wave} isSurgeWave={isSurgeWave} />
      )}

      {/* Story intro — once per session before wave 1 */}
      {showIntro && (
        <StoryIntro onComplete={handleIntroComplete} />
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
        <GameOverModal score={score} wave={wave} playerName={playerName} onPlayAgain={handleRestart} />
      )}
    </div>
  );
}
