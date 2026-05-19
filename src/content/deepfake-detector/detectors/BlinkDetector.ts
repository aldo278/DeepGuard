// src/detectors/BlinkDetector.ts

import { BaseDetector } from './BaseDetector';
import { DetectorResult } from '../types';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

interface BlinkEvent {
  timestamp: number;
  leftEAR: number;
  rightEAR: number;
}

export class BlinkDetector extends BaseDetector {
  private model: faceLandmarksDetection.FaceLandmarksDetector | null = null;
  private readonly EAR_THRESHOLD = 0.2;
  private readonly MIN_BLINK_RATE = 0.5; // blinks per second
  private readonly MAX_BLINK_RATE = 3.0;

  constructor(config: { threshold: number; timeout?: number }) {
    super('BlinkDetector', config);
  }

  async detect(videoElement: HTMLVideoElement): Promise<DetectorResult> {
    return this.runWithTimeout(
      async () => this.analyzeBlinkPattern(videoElement),
      await this.getBlinkDetails(videoElement)
    );
  }

  private async analyzeBlinkPattern(
    videoElement: HTMLVideoElement
  ): Promise<boolean> {
    // Load model if not loaded
    if (!this.model) {
      this.log('Loading face landmarks model...');
      console.log('👁️ BlinkDetector: Loading TensorFlow.js face mesh model...');
      this.model = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        { 
          runtime: 'tfjs',  // Use tfjs runtime (works in extensions)
          maxFaces: 1,
          refineLandmarks: true
        }
      );
      console.log('✅ BlinkDetector: Model loaded successfully');
      this.log('Model loaded');
    }

    const durationSeconds = 10;
    const blinks: BlinkEvent[] = [];
    const startTime = Date.now();
    let frameCount = 0;
    let wasBlinking = false;

    this.log(`Starting blink analysis for ${durationSeconds} seconds`);

    while (Date.now() - startTime < durationSeconds * 1000) {
      const predictions = await this.model.estimateFaces(videoElement);

      frameCount++;

      if (predictions.length > 0) {
        const face = predictions[0];
        
        // Calculate Eye Aspect Ratio for both eyes
        // Access keypoints through the correct API structure
        const keypoints = face.keypoints;
        const leftEyeUpper0 = keypoints.filter((kp: any) => kp.name === 'leftEyeUpper0').map((kp: any) => [kp.x, kp.y, kp.z] as [number, number, number]);
        const leftEyeLower0 = keypoints.filter((kp: any) => kp.name === 'leftEyeLower0').map((kp: any) => [kp.x, kp.y, kp.z] as [number, number, number]);
        const rightEyeUpper0 = keypoints.filter((kp: any) => kp.name === 'rightEyeUpper0').map((kp: any) => [kp.x, kp.y, kp.z] as [number, number, number]);
        const rightEyeLower0 = keypoints.filter((kp: any) => kp.name === 'rightEyeLower0').map((kp: any) => [kp.x, kp.y, kp.z] as [number, number, number]);
        
        const leftEAR = this.calculateEAR(leftEyeUpper0, leftEyeLower0);
        const rightEAR = this.calculateEAR(rightEyeUpper0, rightEyeLower0);

        const isBlinking = leftEAR < this.EAR_THRESHOLD && rightEAR < this.EAR_THRESHOLD;

        // Detect blink start (transition from open to closed)
        if (isBlinking && !wasBlinking) {
          blinks.push({
            timestamp: Date.now() - startTime,
            leftEAR,
            rightEAR,
          });
          this.log(`Blink detected at ${blinks[blinks.length - 1].timestamp}ms`);
        }

        wasBlinking = isBlinking;
      }

      // Wait for next frame (~30 FPS)
      await new Promise((resolve) => setTimeout(resolve, 33));
    }

    const blinkRate = blinks.length / durationSeconds;
    this.log(`Analysis complete: ${blinks.length} blinks in ${durationSeconds}s`, {
      blinkRate,
      frameCount,
    });

    // Abnormal blink rate indicates fake
    const isFake = blinkRate < this.MIN_BLINK_RATE || blinkRate > this.MAX_BLINK_RATE;
    
    return isFake;
  }

  private async getBlinkDetails(
    videoElement: HTMLVideoElement
  ): Promise<Record<string, any>> {
    // This is called separately to populate the details field
    // You can calculate additional metrics here
    return {
      earThreshold: this.EAR_THRESHOLD,
      expectedBlinkRate: `${this.MIN_BLINK_RATE}-${this.MAX_BLINK_RATE} blinks/sec`,
    };
  }

  private calculateEAR(
    upperPoints: Array<[number, number, number]>,
    lowerPoints: Array<[number, number, number]>
  ): number {
    // Calculate vertical distances
    const verticalDist1 = this.euclideanDistance(upperPoints[1], lowerPoints[1]);
    const verticalDist2 = this.euclideanDistance(upperPoints[2], lowerPoints[2]);

    // Calculate horizontal distance
    const horizontalDist = this.euclideanDistance(upperPoints[0], upperPoints[3]);

    // Eye Aspect Ratio formula
    const ear = (verticalDist1 + verticalDist2) / (2.0 * horizontalDist);
    return ear;
  }

  private euclideanDistance(
    point1: [number, number, number],
    point2: [number, number, number]
  ): number {
    const dx = point1[0] - point2[0];
    const dy = point1[1] - point2[1];
    const dz = point1[2] - point2[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
