/**
 * Eagerly preloads MediaPipe vision WASM + JS bundle on page load.
 * The HandTracker reuses these cached promises instead of loading from scratch.
 */

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";
export const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Start loading the JS module immediately
export const visionModulePromise = import("@mediapipe/tasks-vision");

// Start resolving the WASM fileset as soon as the JS module is ready
export const visionPromise = visionModulePromise.then(({ FilesetResolver }) =>
  FilesetResolver.forVisionTasks(WASM_URL)
);
