// LandmarkDetector.ts - Facial Landmark Inconsistency Detector
// Tracks facial keypoints across frames and measures unnatural movement

import { BaseDetector } from './BaseDetector';
import { DetectorResult } from '../types';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

interface LandmarkFrame {
  timestamp: number;
  landmarks: Array<{ x: number; y: number; z: number }>;
}

export class LandmarkDetector extends BaseDetector {
  private model: faceLandmarksDetection.FaceLandmarksDetector | null = null;
  private readonly JITTER_THRESHOLD = 0.02;
  private readonly VELOCITY_THRESHOLD = 0.1;

  constructor(config: { threshold: number; timeout?: number }) {
    super('LandmarkDetector', config);
  }

  async detect(videoElement: HTMLVideoElement): Promise<DetectorResult> {
    return this.runWithTimeout(
      async () => this.analyzeLandmarkConsistency(videoElement),
      await this.getLandmarkDetails()
    );
  }

  private async analyzeLandmarkConsistency(
    videoElement: HTMLVideoElement
  ): Promise<boolean> {
    // Load model if not loaded
    if (!this.model) {
      this.log('Loading face landmarks model...');
      console.log('🎭 LandmarkDetector: Loading TensorFlow.js face mesh model...');
      this.model = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'tfjs',  // Use tfjs runtime (works in extensions)
          maxFaces: 1,
          refineLandmarks: true,
        }
      );
      console.log('✅ LandmarkDetector: Model loaded successfully');
      this.log('Model loaded');
    }

    const durationSeconds = 3;
    const frames: LandmarkFrame[] = [];
    const startTime = Date.now();

    this.log(`Starting landmark analysis for ${durationSeconds} seconds`);

    while (Date.now() - startTime < durationSeconds * 1000) {
      const predictions = await this.model.estimateFaces(videoElement);

      if (predictions.length > 0) {
        const face = predictions[0];
        const landmarks = face.keypoints.map((kp: any) => ({
          x: kp.x,
          y: kp.y,
          z: kp.z || 0,
        }));

        frames.push({
          timestamp: Date.now() - startTime,
          landmarks,
        });
      }

      // ~30 FPS
      await new Promise((resolve) => setTimeout(resolve, 33));
    }

    this.log(`Collected ${frames.length} frames`);

    if (frames.length < 10) {
      this.log('Not enough frames for analysis');
      return false;
    }

    // Calculate temporal metrics
    const jitterScore = this.calculateJitter(frames);
    const velocityVariance = this.calculateVelocityVariance(frames);
    const discontinuityScore = this.calculateDiscontinuities(frames);

    this.log('Landmark analysis complete', {
      jitterScore,
      velocityVariance,
      discontinuityScore,
    });

    // High jitter or velocity variance indicates fake
    const isFake =
      jitterScore > this.JITTER_THRESHOLD ||
      velocityVariance > this.VELOCITY_THRESHOLD ||
      discontinuityScore > 0.1;

    return isFake;
  }

  private async getLandmarkDetails(): Promise<Record<string, any>> {
    return {
      method: 'MediaPipe FaceMesh temporal analysis',
      jitterThreshold: this.JITTER_THRESHOLD,
      velocityThreshold: this.VELOCITY_THRESHOLD,
    };
  }

  private calculateJitter(frames: LandmarkFrame[]): number {
    if (frames.length < 3) return 0;

    let totalJitter = 0;
    let count = 0;

    // Calculate frame-to-frame jitter for key landmarks
    const keyIndices = [0, 1, 4, 5, 6, 7, 8, 9, 10]; // Key facial points

    for (let i = 1; i < frames.length - 1; i++) {
      const prev = frames[i - 1].landmarks;
      const curr = frames[i].landmarks;
      const next = frames[i + 1].landmarks;

      for (const idx of keyIndices) {
        if (prev[idx] && curr[idx] && next[idx]) {
          // Expected position (linear interpolation)
          const expectedX = (prev[idx].x + next[idx].x) / 2;
          const expectedY = (prev[idx].y + next[idx].y) / 2;

          // Actual deviation
          const deviationX = Math.abs(curr[idx].x - expectedX);
          const deviationY = Math.abs(curr[idx].y - expectedY);

          totalJitter += Math.sqrt(deviationX * deviationX + deviationY * deviationY);
          count++;
        }
      }
    }

    return count > 0 ? totalJitter / count : 0;
  }

  private calculateVelocityVariance(frames: LandmarkFrame[]): number {
    if (frames.length < 2) return 0;

    const velocities: number[] = [];
    const keyIndices = [0, 1, 4, 5, 6, 7, 8, 9, 10];

    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1];
      const curr = frames[i];
      const dt = (curr.timestamp - prev.timestamp) / 1000; // seconds

      if (dt <= 0) continue;

      let frameVelocity = 0;
      let count = 0;

      for (const idx of keyIndices) {
        if (prev.landmarks[idx] && curr.landmarks[idx]) {
          const dx = curr.landmarks[idx].x - prev.landmarks[idx].x;
          const dy = curr.landmarks[idx].y - prev.landmarks[idx].y;
          const velocity = Math.sqrt(dx * dx + dy * dy) / dt;
          frameVelocity += velocity;
          count++;
        }
      }

      if (count > 0) {
        velocities.push(frameVelocity / count);
      }
    }

    if (velocities.length < 2) return 0;

    // Calculate variance
    const mean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const variance =
      velocities.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      velocities.length;

    return Math.sqrt(variance);
  }

  private calculateDiscontinuities(frames: LandmarkFrame[]): number {
    if (frames.length < 2) return 0;

    let discontinuityCount = 0;
    const keyIndices = [0, 1, 4, 5, 6, 7, 8, 9, 10];
    const jumpThreshold = 0.05; // 5% of frame dimension

    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1].landmarks;
      const curr = frames[i].landmarks;

      for (const idx of keyIndices) {
        if (prev[idx] && curr[idx]) {
          const dx = Math.abs(curr[idx].x - prev[idx].x);
          const dy = Math.abs(curr[idx].y - prev[idx].y);
          const jump = Math.sqrt(dx * dx + dy * dy);

          if (jump > jumpThreshold) {
            discontinuityCount++;
          }
        }
      }
    }

    return discontinuityCount / (frames.length * keyIndices.length);
  }
}
