"use client";

import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { Landmark } from "@/lib/mediapipe/landmarkUtils";

interface HandTrackerProps {
  onFrame: (landmarks: Landmark[] | null) => void;
  onStatusChange: (status: TrackerStatus) => void;
  paused: boolean;
}

export type TrackerStatus =
  | "loading"
  | "requesting-camera"
  | "initializing"
  | "running"
  | "camera-denied"
  | "error";

export interface HandTrackerHandle {
  getVideo: () => HTMLVideoElement | null;
}

const HandTracker = forwardRef<HandTrackerHandle, HandTrackerProps>(
  function HandTracker({ onFrame, onStatusChange, paused }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const handLandmarkerRef = useRef<unknown>(null);
    const animIdRef = useRef(0);
    const pausedRef = useRef(paused);

    useEffect(() => {
      pausedRef.current = paused;
    }, [paused]);

    useImperativeHandle(ref, () => ({
      getVideo: () => videoRef.current,
    }));

    useEffect(() => {
      let cancelled = false;
      let stream: MediaStream | null = null;

      async function init() {
        try {
          onStatusChange("requesting-camera");

          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: isMobile
                ? { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
                : { facingMode: "user", width: 640, height: 480 },
            });
          } catch {
            onStatusChange("camera-denied");
            return;
          }

          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          const video = videoRef.current!;
          video.srcObject = stream;
          await video.play();

          onStatusChange("initializing");

          const { FilesetResolver, HandLandmarker } = await import(
            "@mediapipe/tasks-vision"
          );

          if (cancelled) return;

          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
          );

          if (cancelled) return;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let handLandmarker: any;
          const modelPath = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
          const preferredDelegate = isMobile ? "CPU" : "GPU";

          try {
            handLandmarker = await HandLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath: modelPath, delegate: preferredDelegate },
              runningMode: "VIDEO",
              numHands: 1,
            });
          } catch {
            // GPU delegate can fail on some devices — fall back to CPU
            handLandmarker = await HandLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath: modelPath, delegate: "CPU" },
              runningMode: "VIDEO",
              numHands: 1,
            });
          }

          if (cancelled) return;

          handLandmarkerRef.current = handLandmarker;
          onStatusChange("running");

          let lastVideoTime = -1;
          function detect() {
            if (cancelled) return;
            const video = videoRef.current;
            if (!video || video.paused || video.ended) {
              animIdRef.current = requestAnimationFrame(detect);
              return;
            }

            if (pausedRef.current) {
              animIdRef.current = requestAnimationFrame(detect);
              return;
            }

            if (video.currentTime !== lastVideoTime) {
              lastVideoTime = video.currentTime;
              try {
                const result = (
                  handLandmarker as {
                    detectForVideo: (
                      v: HTMLVideoElement,
                      t: number
                    ) => {
                      landmarks?: { x: number; y: number; z: number }[][];
                    };
                  }
                ).detectForVideo(video, performance.now());
                const landmarks = result.landmarks?.[0] ?? null;
                onFrame(landmarks as Landmark[] | null);
              } catch {
                onFrame(null);
              }
            }

            animIdRef.current = requestAnimationFrame(detect);
          }

          detect();
        } catch {
          if (!cancelled) {
            onStatusChange("error");
          }
        }
      }

      init();

      return () => {
        cancelled = true;
        cancelAnimationFrame(animIdRef.current);
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute opacity-0 pointer-events-none"
        width={640}
        height={480}
      />
    );
  }
);

export default HandTracker;
