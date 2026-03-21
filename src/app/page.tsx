"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import SettingsModal from "@/components/settings/SettingsModal";

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  // Blinking cursor effect
  useEffect(() => {
    const interval = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { label: "Start Game", href: "/game" },
    { label: "Leaderboard", href: "/leaderboard" },
    { label: "Settings", action: () => setSettingsOpen(true) },
  ];

  return (
    <main className="relative flex h-dvh flex-col items-center justify-center overflow-hidden">
      {/* Animated pixel art background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url(/menu-bg.gif)",
          imageRendering: "pixelated",
        }}
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/50" />

      {/* Floating pixel bubbles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-sm bg-white/20"
            style={{
              width: `${3 + (i % 3) * 2}px`,
              height: `${3 + (i % 3) * 2}px`,
              left: `${10 + i * 11}%`,
              bottom: `${-10}%`,
              imageRendering: "pixelated" as const,
              animation: `bubble-rise ${6 + i * 1.5}s linear infinite`,
              animationDelay: `${i * 0.8}s`,
            }}
          />
        ))}
      </div>

      {/* Title block */}
      <div className="relative z-10 flex flex-col items-center mb-10 sm:mb-14">
        {/* REEF */}
        <h1
          className="text-5xl sm:text-7xl md:text-8xl font-bold text-center"
          style={{
            color: "#ffd54f",
            textShadow:
              "-2px -2px 0 #0a2a4a, 2px -2px 0 #0a2a4a, -2px 2px 0 #0a2a4a, 2px 2px 0 #0a2a4a, 0 -2px 0 #0a2a4a, 0 2px 0 #0a2a4a, -2px 0 0 #0a2a4a, 2px 0 0 #0a2a4a, 4px 4px 0 #051525",
            letterSpacing: "0.15em",
          }}
        >
          REEF
        </h1>
        {/* DEFENDER */}
        <h1
          className="text-4xl sm:text-6xl md:text-7xl font-bold text-center mt-2 sm:mt-4"
          style={{
            color: "#70d4f0",
            textShadow:
              "-2px -2px 0 #0a2a4a, 2px -2px 0 #0a2a4a, -2px 2px 0 #0a2a4a, 2px 2px 0 #0a2a4a, 0 -2px 0 #0a2a4a, 0 2px 0 #0a2a4a, -2px 0 0 #0a2a4a, 2px 0 0 #0a2a4a, 4px 4px 0 #051525",
            letterSpacing: "0.15em",
          }}
        >
          DEFENDER
        </h1>
      </div>

      {/* Menu items - pixel style */}
      <nav className="relative z-10 flex flex-col gap-2 items-center">
        {menuItems.map((item, i) => {
          const isSelected = selectedIndex === i;
          const content = (
            <div
              className="relative px-6 py-2.5 cursor-pointer transition-all text-center"
              onMouseEnter={() => setSelectedIndex(i)}
              style={{ fontFamily: "var(--font-pixel), monospace" }}
            >
              {/* Selection arrow — absolutely positioned so it doesn't shift text */}
              <span
                className="absolute -left-2 top-1/2 -translate-y-1/2 text-sm sm:text-base"
                style={{
                  color: "#f0c040",
                  opacity: isSelected && showCursor ? 1 : 0,
                  textShadow: "0 0 8px rgba(240,192,64,0.6)",
                  transition: "opacity 0.1s",
                }}
              >
                &gt;
              </span>
              <span
                className="text-sm sm:text-base tracking-wider uppercase"
                style={{
                  color: isSelected ? "#ffffff" : "rgba(180,220,240,0.5)",
                  textShadow: isSelected
                    ? "0 0 12px rgba(91,196,232,0.5), 0 2px 4px rgba(0,0,0,0.8)"
                    : "0 2px 4px rgba(0,0,0,0.8)",
                  transition: "color 0.15s, text-shadow 0.15s",
                }}
              >
                {item.label}
              </span>
            </div>
          );

          if (item.href) {
            return (
              <Link key={item.label} href={item.href}>
                {content}
              </Link>
            );
          }
          return (
            <button key={item.label} onClick={item.action}>
              {content}
            </button>
          );
        })}
      </nav>

      {/* Footer hint */}
      <p
        className="relative z-10 mt-10 text-center px-4"
        style={{
          fontFamily: "var(--font-pixel), monospace",
          fontSize: "8px",
          color: "rgba(180,220,240,0.3)",
          letterSpacing: "0.15em",
          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
        }}
      >
        Webcam + hand tracking required
      </p>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}
