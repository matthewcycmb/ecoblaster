"use client";

import { useEffect, useState } from "react";

interface StoryIntroProps {
  onComplete: () => void;
}

const LINES = [
  "You are the last living reef.",
  "The ocean has forgotten you.",
  "But the trash hasn't.",
];

const FADE_IN_TIMES = [0, 1500, 3000]; // ms
const TOTAL_DURATION = 5000; // ms before fade-out begins
const FADE_OUT_DURATION = 800; // ms

export default function StoryIntro({ onComplete }: StoryIntroProps) {
  const [visibleLines, setVisibleLines] = useState<boolean[]>([false, false, false]);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Fade in each line
    FADE_IN_TIMES.forEach((delay, i) => {
      timers.push(
        setTimeout(() => {
          setVisibleLines((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }, delay)
      );
    });

    // Start fade-out
    timers.push(
      setTimeout(() => setFadingOut(true), TOTAL_DURATION)
    );

    // Complete
    timers.push(
      setTimeout(() => onComplete(), TOTAL_DURATION + FADE_OUT_DURATION)
    );

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-50 transition-opacity"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        opacity: fadingOut ? 0 : 1,
        transitionDuration: `${FADE_OUT_DURATION}ms`,
      }}
    >
      <div className="flex flex-col items-center gap-5 sm:gap-7 px-6">
        {LINES.map((line, i) => (
          <p
            key={i}
            className="text-white text-lg sm:text-2xl md:text-3xl font-light tracking-wide text-center transition-opacity duration-1000"
            style={{
              opacity: visibleLines[i] ? 1 : 0,
              fontStyle: i === 2 ? "italic" : "normal",
            }}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
