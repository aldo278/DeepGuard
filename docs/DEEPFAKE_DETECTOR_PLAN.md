# Multi-Signal Ensemble Deepfake Detector - Implementation Plan

## Overview

This implementation uses 5 specialized detectors that each look for different artifacts, then combines their votes for robust deepfake detection.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DeepfakeScanner                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  Landmark   │ │    Blink    │ │     PPG     │           │
│  │  Detector   │ │  Detector   │ │  Detector   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐                           │
│  │   LipSync   │ │  Frequency  │                           │
│  │  Detector   │ │  Detector   │                           │
│  └─────────────┘ └─────────────┘                           │
│                         ↓                                   │
│              Weighted Ensemble Vote                         │
│                         ↓                                   │
│                   ScanResult                                │
└─────────────────────────────────────────────────────────────┘
```

## The 5 Specialized Detectors

### Detector 1: Facial Landmark Inconsistency Detector
**File:** `detectors/LandmarkDetector.ts`  
**Weight:** 0.25  
**Status:** 🔴 Not Implemented

**What it does:**
- Tracks 468 facial keypoints across frames
- Measures if landmarks move unnaturally (jitter, discontinuities)

**Why it works:**
Deepfakes often have:
- Eyes that don't blink naturally
- Mouth corners that "slide" during speech
- Jawline that wobbles frame-to-frame
- Eyebrows that don't follow natural muscle movement

**Implementation:**
```typescript
// Calculate temporal variance of inter-landmark distances
// Real videos: smooth, continuous motion
// Fake videos: micro-jitters, discontinuities
```

---

### Detector 2: Eye Blink Pattern Analyzer
**File:** `detectors/BlinkDetector.ts`  
**Weight:** 0.15  
**Status:** ✅ Implemented

**What it does:**
- Measures blink frequency using Eye Aspect Ratio (EAR)
- Detects abnormal blink patterns

**Why it works:**
- Real humans blink 10-20 times per 10 seconds
- Deepfakes often have 0-5 blinks or unnatural timing

**Key metrics:**
- `EAR_THRESHOLD = 0.2` (eye closed when EAR < 0.2)
- `MIN_BLINK_RATE = 0.5` blinks/sec
- `MAX_BLINK_RATE = 3.0` blinks/sec

---

### Detector 3: Photoplethysmography (PPG) Blood Flow Detector
**File:** `detectors/PPGDetector.ts`  
**Weight:** 0.20  
**Status:** 🔴 Not Implemented

**What it does:**
- Detects subtle color changes in skin caused by heartbeat
- Uses FFT to find periodic signals in the 0.8-3 Hz range (48-180 BPM)

**Why it works:**
- Real skin shows periodic color fluctuations synchronized with heartbeat
- Deepfakes have synthesized textures without blood flow

**Implementation:**
```typescript
// 1. Extract face region (forehead/cheeks)
// 2. Average green channel values per frame
// 3. Apply bandpass filter (0.8-3 Hz)
// 4. FFT to find dominant frequency
// 5. Check if peak exists in heartbeat range
```

---

### Detector 4: Audio-Visual Sync Detector
**File:** `detectors/LipSyncDetector.ts`  
**Weight:** 0.25  
**Status:** 🔴 Not Implemented

**What it does:**
- Checks if lip movements match spoken audio
- Measures temporal alignment between audio and visual streams

**Why it works:**
- Face swaps keep original audio but wrong face
- Synthetic speech has lip-sync errors
- Temporal misalignment (delays between lips and sound)

**Implementation:**
```typescript
// 1. Extract audio features (amplitude envelope)
// 2. Extract mouth openness from landmarks
// 3. Calculate correlation between audio energy and mouth movement
// 4. Measure temporal offset
```

---

### Detector 5: Frequency Domain Artifact Detector
**File:** `detectors/FrequencyDetector.ts`  
**Weight:** 0.15  
**Status:** 🔴 Not Implemented

**What it does:**
- Analyzes images in frequency space using 2D FFT
- Detects GAN artifacts and upsampling traces

**Why it works:**
GANs create specific patterns:
- Checkerboard artifacts from transposed convolutions
- Missing high frequencies from over-smoothing
- Unique spectral fingerprints per architecture

**Implementation:**
```typescript
// 1. Convert frame to grayscale
// 2. Apply 2D FFT
// 3. Calculate radial frequency distribution
// 4. Check for abnormal patterns (missing high freq, suspicious peaks)
```

---

## Ensemble Strategy

```typescript
const weights = {
  landmarks: 0.25,
  blinks: 0.15,
  ppg: 0.20,
  lipsync: 0.25,
  frequency: 0.15
};

// Final score = sum of (isFake * weight) for each detector
// isFake = finalScore > 0.5
```

## Implementation Priority

### Phase 1 (Current)
- [x] BaseDetector abstract class
- [x] BlinkDetector (EAR-based)
- [ ] FrequencyDetector (FFT-based, no training needed)
- [ ] LandmarkDetector (MediaPipe-based)

### Phase 2
- [ ] PPGDetector (requires careful face region extraction)
- [ ] LipSyncDetector (audio-visual correlation)

### Phase 3
- [ ] Tune ensemble weights
- [ ] Add confidence thresholds
- [ ] Optimize for browser extension performance

## Expected Performance

| Configuration | Accuracy |
|--------------|----------|
| Blink alone | 60-70% |
| Frequency + Landmarks | 75-85% |
| All 5 detectors | 85-92% |

## Dependencies

- `@tensorflow-models/face-landmarks-detection` - Face mesh detection
- `@mediapipe/tasks-vision` - MediaPipe runtime
- `@tensorflow/tfjs` - TensorFlow.js for model inference

## File Structure

```
src/content/deepfake-detector/
├── types.ts                 # Shared interfaces
├── DeepfakeScanner.ts       # Main orchestrator
└── detectors/
    ├── BaseDetector.ts      # Abstract base class
    ├── BlinkDetector.ts     # ✅ Eye blink analysis
    ├── LandmarkDetector.ts  # 🔴 Facial landmark tracking
    ├── PPGDetector.ts       # 🔴 Blood flow detection
    ├── LipSyncDetector.ts   # 🔴 Audio-visual sync
    └── FrequencyDetector.ts # 🔴 FFT artifact detection
```
