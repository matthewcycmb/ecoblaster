"use client";

import { useEffect, useState } from "react";

export default function TutorialOverlay({ onComplete }: { onComplete?: () => void }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2000);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 3000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none"
      style={{
        backgroundColor: "rgba(0,0,0,0.45)",
        opacity: fading ? 0 : 1,
        transition: "opacity 1s ease-out",
      }}
    >
      {/* Animated hand icon */}
      <div
        className="text-8xl sm:text-9xl mb-4"
        style={{
          animation: "tutorial-bob 1.5s ease-in-out infinite",
          filter: "drop-shadow(0 0 20px rgba(0,200,255,0.4))",
        }}
      >
        👉
      </div>

      <p
        className="text-3xl sm:text-4xl font-black text-white text-center px-6 tracking-wide"
        style={{ textShadow: "0 0 20px rgba(0,200,255,0.5), 0 2px 8px rgba(0,0,0,0.8)" }}
      >
        Point your finger like a gun
      </p>

      <p
        className="text-lg sm:text-xl text-cyan-300/80 mt-3 font-medium tracking-wide"
        style={{ textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}
      >
        Flick to shoot the trash!
      </p>

      {/* Pulsing crosshair hint */}
      <div
        className="mt-8 w-12 h-12 rounded-full border-2 border-cyan-400/60"
        style={{ animation: "tutorial-pulse 1.5s ease-in-out infinite" }}
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
        </div>
      </div>
    </div>
  );
}
