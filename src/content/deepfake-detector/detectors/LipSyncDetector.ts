// LipSyncDetector.ts - Audio-Visual Sync Detector
// Checks if lip movements match spoken audio

import { BaseDetector } from './BaseDetector';
import { DetectorResult } from '../types';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

interface SyncFrame {
  timestamp: number;
  mouthOpenness: number;
  audioEnergy: number;
}

export class LipSyncDetector extends BaseDetector {
  private model: faceLandmarksDetection.FaceLandmarksDetector | null = null;
  private audioContext: AudioContext | null = null;
  private readonly CORRELATION_THRESHOLD = 0.4;
  private readonly MAX_OFFSET_MS = 200;

  constructor(config: { threshold: number; timeout?: number }) {
    super('LipSyncDetector', config);
  }

  async detect(videoElement: HTMLVideoElement): Promise<DetectorResult> {
    return this.runWithTimeout(
      async () => this.analyzeLipSync(videoElement),
      await this.getLipSyncDetails()
    );
  }

  private async analyzeLipSync(
    videoElement: HTMLVideoElement
  ): Promise<boolean> {
    // Load face model
    if (!this.model) {
      this.log('Loading face landmarks model...');
      console.log('👄 LipSyncDetector: Loading TensorFlow.js face mesh model...');
      this.model = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'tfjs',  // Use tfjs runtime (works in extensions)
          maxFaces: 1,
          refineLandmarks: true,
        }
      );
      console.log('✅ LipSyncDetector: Model loaded successfully');
      this.log('Model loaded');
    }

    // Setup audio analysis
    const audioData = await this.setupAudioAnalysis(videoElement);
    if (!audioData) {
      this.log('No audio available, skipping lip sync analysis');
      return false;
    }

    const { analyser, dataArray } = audioData;
    const durationSeconds = 3;
    const frames: SyncFrame[] = [];
    const startTime = Date.now();
    const fps = 30;

    this.log(`Starting lip sync analysis for ${durationSeconds} seconds`);

    while (Date.now() - startTime < durationSeconds * 1000) {
      const timestamp = Date.now() - startTime;

      // Get audio energy
      analyser.getByteFrequencyData(dataArray);
      const audioEnergy = this.calculateAudioEnergy(dataArray);

      // Get mouth openness
      const predictions = await this.model.estimateFaces(videoElement);
      let mouthOpenness = 0;

      if (predictions.length > 0) {
        mouthOpenness = this.calculateMouthOpenness(predictions[0]);
      }

      frames.push({ timestamp, mouthOpenness, audioEnergy });

      await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
    }

    this.log(`Collected ${frames.length} sync frames`);

    if (frames.length < fps) {
      this.log('Not enough frames for lip sync analysis');
      return false;
    }

    // Normalize signals
    const mouthSignal = this.normalizeSignal(frames.map((f) => f.mouthOpenness));
    const audioSignal = this.normalizeSignal(frames.map((f) => f.audioEnergy));

    // Calculate cross-correlation
    const { maxCorrelation, bestOffset } = this.crossCorrelate(
      mouthSignal,
      audioSignal,
      fps
    );

    this.log('Lip sync analysis complete', {
      maxCorrelation,
      bestOffsetMs: bestOffset * (1000 / fps),
    });

    // Low correlation or large offset indicates fake
    const isFake =
      maxCorrelation < this.CORRELATION_THRESHOLD ||
      Math.abs(bestOffset * (1000 / fps)) > this.MAX_OFFSET_MS;

    return isFake;
  }

  private async getLipSyncDetails(): Promise<Record<string, any>> {
    return {
      method: 'Audio-visual cross-correlation',
      correlationThreshold: this.CORRELATION_THRESHOLD,
      maxOffsetMs: this.MAX_OFFSET_MS,
    };
  }

  private async setupAudioAnalysis(
    videoElement: HTMLVideoElement
  ): Promise<{ analyser: AnalyserNode; dataArray: Uint8Array<ArrayBuffer> } | null> {
    try {
      // Check if video has audio
      const hasAudio =
        (videoElement as any).mozHasAudio ||
        Boolean((videoElement as any).webkitAudioDecodedByteCount) ||
        Boolean((videoElement as any).audioTracks?.length);

      if (!hasAudio && !videoElement.src) {
        return null;
      }

      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaElementSource(videoElement);
      const analyser = this.audioContext.createAnalyser();

      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(this.audioContext.destination);

      const dataArray = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;

      return { analyser, dataArray };
    } catch (error) {
      this.log('Failed to setup audio analysis', { error });
      return null;
    }
  }

  private calculateAudioEnergy(dataArray: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length / 255; // Normalize to 0-1
  }

  private calculateMouthOpenness(face: any): number {
    const keypoints = face.keypoints;

    // Find upper and lower lip landmarks
    const upperLip = keypoints.filter((kp: any) =>
      kp.name?.includes('lips') && kp.name?.includes('Upper')
    );
    const lowerLip = keypoints.filter((kp: any) =>
      kp.name?.includes('lips') && kp.name?.includes('Lower')
    );

    if (upperLip.length === 0 || lowerLip.length === 0) {
      // Fallback: use general mouth landmarks by index
      // MediaPipe mouth landmarks are roughly indices 61-95
      const mouthIndices = {
        upperOuter: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
        lowerOuter: [146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
        upperInner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
        lowerInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
      };

      // Get vertical distance between upper and lower inner lip
      const upperY = keypoints[13]?.y || 0;
      const lowerY = keypoints[14]?.y || 0;

      return Math.abs(lowerY - upperY);
    }

    // Calculate average vertical distance
    const upperY =
      upperLip.reduce((sum: number, kp: any) => sum + kp.y, 0) / upperLip.length;
    const lowerY =
      lowerLip.reduce((sum: number, kp: any) => sum + kp.y, 0) / lowerLip.length;

    return Math.abs(lowerY - upperY);
  }

  private normalizeSignal(signal: number[]): number[] {
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const range = max - min;

    if (range === 0) return signal.map(() => 0);

    return signal.map((v) => (v - min) / range);
  }

  private crossCorrelate(
    signal1: number[],
    signal2: number[],
    fps: number
  ): { maxCorrelation: number; bestOffset: number } {
    const maxLag = Math.floor((this.MAX_OFFSET_MS / 1000) * fps);
    let maxCorrelation = -1;
    let bestOffset = 0;

    for (let lag = -maxLag; lag <= maxLag; lag++) {
      const correlation = this.pearsonCorrelation(signal1, signal2, lag);

      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestOffset = lag;
      }
    }

    return { maxCorrelation, bestOffset };
  }

  private pearsonCorrelation(
    x: number[],
    y: number[],
    lag: number
  ): number {
    const n = Math.min(x.length, y.length) - Math.abs(lag);
    if (n < 2) return 0;

    const xStart = lag > 0 ? lag : 0;
    const yStart = lag < 0 ? -lag : 0;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (let i = 0; i < n; i++) {
      const xi = x[xStart + i];
      const yi = y[yStart + i];

      sumX += xi;
      sumY += yi;
      sumXY += xi * yi;
      sumX2 += xi * xi;
      sumY2 += yi * yi;
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );

    if (denominator === 0) return 0;

    return numerator / denominator;
  }
}
