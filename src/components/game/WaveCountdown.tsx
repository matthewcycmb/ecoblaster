"use client";

import { useState, useEffect } from "react";

export default function WaveCountdown({
  wave,
  isBossWave,
}: {
  wave: number;
  isBossWave: boolean;
}) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    setCount(3);
    const interval = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [wave]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-40 pointer-events-none">
      {isBossWave ? (
        <>
          <p className="text-5xl font-bold text-red-500 animate-pulse">
            BOSS WAVE {wave}
          </p>
          <p className="text-xl text-red-300 mt-2 font-semibold">
            PREPARE FOR BATTLE
          </p>
        </>
      ) : (
        <p className="text-4xl font-bold text-white animate-pulse">
          Wave {wave} incoming...
        </p>
      )}
      {count > 0 && (
        <p className="text-6xl font-bold text-game-accent mt-4">{count}</p>
      )}
    </div>
  );
}
