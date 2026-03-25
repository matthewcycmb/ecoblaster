import {
  Landmark,
  WRIST,
  INDEX_TIP,
  INDEX_DIP,
  INDEX_PIP,
  INDEX_MCP,
  MIDDLE_TIP,
  MIDDLE_DIP,
  MIDDLE_PIP,
  MIDDLE_MCP,
  RING_TIP,
  RING_DIP,
  RING_PIP,
  RING_MCP,
  PINKY_TIP,
  PINKY_DIP,
  PINKY_PIP,
  PINKY_MCP,
  THUMB_TIP,
  THUMB_MCP,
  isFingerExtended,
  isFingerCurled,
  smoothLandmarks,
} from "./landmarkUtils";

export interface GestureResult {
  isFingerGun: boolean;
  isOpenPalm: boolean;
  isPinchRelease: boolean;
  isThumbsUp: boolean;
  indexTipX: number;
  indexTipY: number;
}

// Hysteresis: require N consecutive agreeing frames before switching state
const POSE_ON_FRAMES = 2;   // frames to confirm gun pose
const POSE_OFF_FRAMES = 4;  // frames to confirm gun pose lost (more lenient)

// EMA smoothing factor for landmarks (0 = frozen, 1 = raw/no smoothing)
// Higher = more responsive but jittery, lower = smoother but laggy
// Mobile uses higher alpha to compensate for lower CPU detection frame rate
const IS_MOBILE = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const LANDMARK_SMOOTH_ALPHA = IS_MOBILE ? 0.75 : 0.55;

// Hand-distance normalization: scale aim offset by inverse hand size
// so aiming feels consistent regardless of distance from camera
const HAND_SIZE_REF = 0.14;           // reference 2D hand size at comfortable mid-range
const HAND_SIZE_SMOOTH_ALPHA = 0.35;  // EMA for hand size (stable, prevents scale jumps)
const SCALE_FACTOR_MIN = 0.7;         // min scale (close hand)
const SCALE_FACTOR_MAX = 2.0;         // max scale (far hand)

export class GestureDetector {
  private smoothedLandmarks: Landmark[] | null = null;
  private poseState = false;          // current confirmed pose state
  private poseCandidate = false;      // what the raw detection is saying
  private poseCandidateFrames = 0;    // how many frames candidate has been consistent
  private smoothedHandSize2D: number | null = null;
  // Separate hysteresis for open-palm
  private palmState = false;
  private palmCandidate = false;
  private palmCandidateFrames = 0;
  // Pinch gesture state
  private pinchState = false;
  private pinchCandidate = false;
  private pinchCandidateFrames = 0;
  private pinchWasActive = false;
  // Thumbs-up gesture state
  private thumbsUpState = false;
  private thumbsUpCandidate = false;
  private thumbsUpCandidateFrames = 0;

  update(landmarks: Landmark[]): GestureResult {
    if (!landmarks || landmarks.length < 21) {
      this.smoothedLandmarks = null;
      return { isFingerGun: false, isOpenPalm: false, isPinchRelease: false, isThumbsUp: false, indexTipX: 0.5, indexTipY: 0.5 };
    }

    // Smooth landmarks to reduce jitter
    const smoothed = smoothLandmarks(this.smoothedLandmarks, landmarks, LANDMARK_SMOOTH_ALPHA);
    this.smoothedLandmarks = smoothed;

    const wrist = smoothed[WRIST];

    // Compute 2D hand size for distance normalization
    const middleMcp = smoothed[MIDDLE_MCP];
    const handSize2D = Math.sqrt(
      (middleMcp.x - wrist.x) ** 2 + (middleMcp.y - wrist.y) ** 2
    );
    if (this.smoothedHandSize2D === null) {
      this.smoothedHandSize2D = handSize2D;
    } else {
      this.smoothedHandSize2D += HAND_SIZE_SMOOTH_ALPHA * (handSize2D - this.smoothedHandSize2D);
    }

    // Check finger-gun pose using joint angles
    const indexExtended = isFingerExtended(
      smoothed[INDEX_TIP], smoothed[INDEX_DIP], smoothed[INDEX_PIP], smoothed[INDEX_MCP], wrist
    );

    const middleCurled = isFingerCurled(
      smoothed[MIDDLE_TIP], smoothed[MIDDLE_DIP], smoothed[MIDDLE_PIP], smoothed[MIDDLE_MCP], wrist
    );
    const ringCurled = isFingerCurled(
      smoothed[RING_TIP], smoothed[RING_DIP], smoothed[RING_PIP], smoothed[RING_MCP], wrist
    );
    const pinkyCurled = isFingerCurled(
      smoothed[PINKY_TIP], smoothed[PINKY_DIP], smoothed[PINKY_PIP], smoothed[PINKY_MCP], wrist
    );

    // Thumb check: thumb should be extended upward/sideways (like a real gun grip)
    const thumbTip = smoothed[THUMB_TIP];
    const thumbMcp = smoothed[THUMB_MCP];
    const indexMcp = smoothed[INDEX_MCP];

    const handScale = Math.sqrt(
      (indexMcp.x - wrist.x) ** 2 + (indexMcp.y - wrist.y) ** 2 + (indexMcp.z - wrist.z) ** 2
    );
    const thumbToIndexBase = Math.sqrt(
      (thumbTip.x - indexMcp.x) ** 2 + (thumbTip.y - indexMcp.y) ** 2 + (thumbTip.z - indexMcp.z) ** 2
    );
    const thumbExtension = Math.sqrt(
      (thumbTip.x - thumbMcp.x) ** 2 + (thumbTip.y - thumbMcp.y) ** 2 + (thumbTip.z - thumbMcp.z) ** 2
    );
    const thumbAcceptable = thumbToIndexBase < handScale * 2.0 && thumbExtension > handScale * 0.25;

    const rawPose = indexExtended && middleCurled && ringCurled && pinkyCurled && thumbAcceptable;

    // Open-palm detection: all five fingers extended
    const middleExtended = isFingerExtended(
      smoothed[MIDDLE_TIP], smoothed[MIDDLE_DIP], smoothed[MIDDLE_PIP], smoothed[MIDDLE_MCP], wrist
    );
    const ringExtended = isFingerExtended(
      smoothed[RING_TIP], smoothed[RING_DIP], smoothed[RING_PIP], smoothed[RING_MCP], wrist
    );
    const pinkyExtended = isFingerExtended(
      smoothed[PINKY_TIP], smoothed[PINKY_DIP], smoothed[PINKY_PIP], smoothed[PINKY_MCP], wrist
    );
    const thumbExtendedForPalm = thumbExtension > handScale * 0.4;
    const rawOpenPalm = indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtendedForPalm;

    // Pinch detection: thumb tip and index tip close together (2D only — z is noisy)
    const indexTipLm = smoothed[INDEX_TIP];
    const pinchDist = Math.sqrt(
      (thumbTip.x - indexTipLm.x) ** 2 + (thumbTip.y - indexTipLm.y) ** 2
    );
    const rawPinch = pinchDist < handScale * 0.55;

    // Thumbs-up detection: thumb extended, all four fingers curled, index NOT extended
    // Distinct from finger-gun (index extended) and open palm (all extended)
    const rawThumbsUp = !indexExtended && middleCurled && ringCurled && pinkyCurled
      && thumbExtension > handScale * 0.5;

    // Apply hysteresis to avoid flickering
    const isFingerGun = rawOpenPalm ? false : this.applyHysteresis(rawPose);
    const isOpenPalm = this.applyPalmHysteresis(rawOpenPalm);

    // Suppress pinch if other gestures active (conflict guard)
    const pinchSuppressed = isFingerGun || isOpenPalm;
    const pinchConfirmed = pinchSuppressed ? false : this.applyPinchHysteresis(rawPinch && !pinchSuppressed);
    let isPinchRelease = false;
    if (this.pinchWasActive && !pinchConfirmed) {
      isPinchRelease = true;
    }
    this.pinchWasActive = pinchConfirmed;

    // Suppress thumbs-up if other gestures active
    const thumbsUpSuppressed = isFingerGun || isOpenPalm || pinchConfirmed;
    const isThumbsUp = thumbsUpSuppressed ? false : this.applyThumbsUpHysteresis(rawThumbsUp && !thumbsUpSuppressed);

    // Normalize aim by inverse hand size so distance from camera doesn't matter
    const indexTip = smoothed[INDEX_TIP];
    const scaleFactor = Math.max(
      SCALE_FACTOR_MIN,
      Math.min(SCALE_FACTOR_MAX, HAND_SIZE_REF / this.smoothedHandSize2D!)
    );
    const adjustedX = Math.max(0, Math.min(1, 0.5 + (indexTip.x - 0.5) * scaleFactor));
    const adjustedY = Math.max(0, Math.min(1, 0.5 + (indexTip.y - 0.5) * scaleFactor));

    return {
      isFingerGun,
      isOpenPalm,
      isPinchRelease,
      isThumbsUp,
      indexTipX: adjustedX,
      indexTipY: adjustedY,
    };
  }

  private applyHysteresis(rawPose: boolean): boolean {
    if (rawPose === this.poseCandidate) {
      this.poseCandidateFrames++;
    } else {
      this.poseCandidate = rawPose;
      this.poseCandidateFrames = 1;
    }

    if (rawPose && !this.poseState && this.poseCandidateFrames >= POSE_ON_FRAMES) {
      this.poseState = true;
    } else if (!rawPose && this.poseState && this.poseCandidateFrames >= POSE_OFF_FRAMES) {
      this.poseState = false;
    }

    return this.poseState;
  }

  private applyPalmHysteresis(rawPalm: boolean): boolean {
    if (rawPalm === this.palmCandidate) {
      this.palmCandidateFrames++;
    } else {
      this.palmCandidate = rawPalm;
      this.palmCandidateFrames = 1;
    }

    const PALM_ON_FRAMES = 3;  // require 3 consecutive frames to confirm
    const PALM_OFF_FRAMES = 4;
    if (rawPalm && !this.palmState && this.palmCandidateFrames >= PALM_ON_FRAMES) {
      this.palmState = true;
    } else if (!rawPalm && this.palmState && this.palmCandidateFrames >= PALM_OFF_FRAMES) {
      this.palmState = false;
    }

    return this.palmState;
  }

  private applyPinchHysteresis(rawPinch: boolean): boolean {
    if (rawPinch === this.pinchCandidate) {
      this.pinchCandidateFrames++;
    } else {
      this.pinchCandidate = rawPinch;
      this.pinchCandidateFrames = 1;
    }

    const PINCH_ON_FRAMES = 2;  // require 2 consecutive frames to confirm pinch
    const PINCH_OFF_FRAMES = 2; // fast release detection
    if (rawPinch && !this.pinchState && this.pinchCandidateFrames >= PINCH_ON_FRAMES) {
      this.pinchState = true;
    } else if (!rawPinch && this.pinchState && this.pinchCandidateFrames >= PINCH_OFF_FRAMES) {
      this.pinchState = false;
    }

    return this.pinchState;
  }

  private applyThumbsUpHysteresis(rawThumbsUp: boolean): boolean {
    if (rawThumbsUp === this.thumbsUpCandidate) {
      this.thumbsUpCandidateFrames++;
    } else {
      this.thumbsUpCandidate = rawThumbsUp;
      this.thumbsUpCandidateFrames = 1;
    }

    const THUMBS_UP_ON_FRAMES = 3;
    const THUMBS_UP_OFF_FRAMES = 3;
    if (rawThumbsUp && !this.thumbsUpState && this.thumbsUpCandidateFrames >= THUMBS_UP_ON_FRAMES) {
      this.thumbsUpState = true;
    } else if (!rawThumbsUp && this.thumbsUpState && this.thumbsUpCandidateFrames >= THUMBS_UP_OFF_FRAMES) {
      this.thumbsUpState = false;
    }

    return this.thumbsUpState;
  }

  reset(): void {
    this.smoothedLandmarks = null;
    this.smoothedHandSize2D = null;
    this.poseState = false;
    this.poseCandidate = false;
    this.poseCandidateFrames = 0;
    this.palmState = false;
    this.palmCandidate = false;
    this.palmCandidateFrames = 0;
    this.pinchState = false;
    this.pinchCandidate = false;
    this.pinchCandidateFrames = 0;
    this.pinchWasActive = false;
    this.thumbsUpState = false;
    this.thumbsUpCandidate = false;
    this.thumbsUpCandidateFrames = 0;
  }
}
