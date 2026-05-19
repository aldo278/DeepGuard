// PPGDetector.ts - Photoplethysmography Blood Flow Detector
// Detects subtle color changes in skin caused by heartbeat
// Simplified version - analyzes center region without ML model

import { BaseDetector } from './BaseDetector';
import { DetectorResult } from '../types';

interface PPGSample {
  timestamp: number;
  greenValue: number;
  redValue: number;
}

export class PPGDetector extends BaseDetector {
  private readonly MIN_HEART_RATE = 0.7; // Hz (42 BPM)
  private readonly MAX_HEART_RATE = 4.0; // Hz (240 BPM)
  private readonly SIGNAL_STRENGTH_THRESHOLD = 0.15;

  constructor(config: { threshold: number; timeout?: number }) {
    super('PPGDetector', config);
  }

  async detect(videoElement: HTMLVideoElement): Promise<DetectorResult> {
    return this.runWithTimeout(
      async () => this.analyzePPGSignal(videoElement),
      this.getPPGDetails()
    );
  }

  private async analyzePPGSignal(
    videoElement: HTMLVideoElement
  ): Promise<boolean> {
    console.log('💓 PPGDetector: Starting PPG analysis (no ML required)');

    const durationSeconds = 4;
    const samples: PPGSample[] = [];
    const startTime = Date.now();
    const fps = 30;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('❌ PPGDetector: Failed to get canvas context');
      return false;
    }

    // Use a reasonable size for analysis
    const width = Math.min(videoElement.videoWidth || 640, 320);
    const height = Math.min(videoElement.videoHeight || 480, 240);
    canvas.width = width;
    canvas.height = height;

    console.log(`📐 PPGDetector: Analyzing center region at ${width}x${height}`);

    // Sample the video for the specified duration
    while (Date.now() - startTime < durationSeconds * 1000) {
      ctx.drawImage(videoElement, 0, 0, width, height);

      // Extract color from center region (where face typically is)
      const centerX = Math.floor(width * 0.3);
      const centerY = Math.floor(height * 0.2);
      const regionWidth = Math.floor(width * 0.4);
      const regionHeight = Math.floor(height * 0.4);

      const { green, red } = this.getAverageColors(ctx, centerX, centerY, regionWidth, regionHeight);

      samples.push({
        timestamp: Date.now() - startTime,
        greenValue: green,
        redValue: red,
      });

      await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
    }

    console.log(`📊 PPGDetector: Collected ${samples.length} samples`);

    if (samples.length < fps * 2) {
      console.log('⚠️ PPGDetector: Not enough samples');
      return false;
    }

    // Analyze green channel for PPG signal
    const greenValues = samples.map((s) => s.greenValue);
    const filtered = this.bandpassFilter(greenValues, fps);

    // Calculate FFT to find dominant frequency
    const { dominantFreq, peakPower, totalPower } = this.analyzeFrequency(filtered, fps);

    const signalStrength = totalPower > 0 ? peakPower / totalPower : 0;
    const hasHeartbeat =
      dominantFreq >= this.MIN_HEART_RATE &&
      dominantFreq <= this.MAX_HEART_RATE &&
      signalStrength > this.SIGNAL_STRENGTH_THRESHOLD;

    console.log('💓 PPGDetector: Analysis complete', {
      dominantFreq: dominantFreq.toFixed(2),
      estimatedBPM: (dominantFreq * 60).toFixed(0),
      signalStrength: signalStrength.toFixed(4),
      threshold: this.SIGNAL_STRENGTH_THRESHOLD,
      hasHeartbeat,
    });

    // No heartbeat signal indicates potential fake
    const isFake = !hasHeartbeat;
    console.log(`🎯 PPGDetector: ${isFake ? 'No heartbeat detected - FAKE' : 'Heartbeat detected - REAL'}`);

    return isFake;
  }

  private getPPGDetails(): Record<string, any> {
    return {
      method: 'Green channel PPG with FFT analysis (no ML)',
      heartRateRange: `${this.MIN_HEART_RATE * 60}-${this.MAX_HEART_RATE * 60} BPM`,
      signalThreshold: this.SIGNAL_STRENGTH_THRESHOLD,
    };
  }

  private getAverageColors(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): { green: number; red: number } {
    try {
      const imageData = ctx.getImageData(x, y, width, height);
      let redSum = 0;
      let greenSum = 0;
      let count = 0;

      for (let i = 0; i < imageData.data.length; i += 4) {
        redSum += imageData.data[i];
        greenSum += imageData.data[i + 1];
        count++;
      }

      return {
        red: count > 0 ? redSum / count : 0,
        green: count > 0 ? greenSum / count : 0,
      };
    } catch {
      return { red: 0, green: 0 };
    }
  }

  private bandpassFilter(signal: number[], fps: number): number[] {
    // High-pass: remove DC component and slow drift
    const windowSize = Math.max(3, Math.floor(fps / this.MIN_HEART_RATE));
    const highPassed = this.highPassFilter(signal, windowSize);

    // Low-pass: remove high-frequency noise
    const lowPassWindow = Math.max(2, Math.floor(fps / this.MAX_HEART_RATE / 2));
    return this.lowPassFilter(highPassed, lowPassWindow);
  }

  private highPassFilter(signal: number[], windowSize: number): number[] {
    const result: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < signal.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(signal.length, i + halfWindow + 1);
      const windowSlice = signal.slice(start, end);
      const mean = windowSlice.reduce((a, b) => a + b, 0) / windowSlice.length;
      result.push(signal[i] - mean);
    }

    return result;
  }

  private lowPassFilter(signal: number[], windowSize: number): number[] {
    const result: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < signal.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(signal.length, i + halfWindow + 1);
      const windowSlice = signal.slice(start, end);
      const mean = windowSlice.reduce((a, b) => a + b, 0) / windowSlice.length;
      result.push(mean);
    }

    return result;
  }

  private analyzeFrequency(
    signal: number[],
    fps: number
  ): { dominantFreq: number; peakPower: number; totalPower: number } {
    const n = signal.length;
    if (n === 0) return { dominantFreq: 0, peakPower: 0, totalPower: 0 };

    const freqResolution = fps / n;
    const magnitudes: number[] = [];

    const minBin = Math.max(1, Math.floor(this.MIN_HEART_RATE / freqResolution));
    const maxBin = Math.min(Math.floor(n / 2), Math.ceil(this.MAX_HEART_RATE / freqResolution));

    for (let k = minBin; k <= maxBin; k++) {
      let real = 0;
      let imag = 0;

      for (let t = 0; t < n; t++) {
        const angle = (2 * Math.PI * k * t) / n;
        real += signal[t] * Math.cos(angle);
        imag -= signal[t] * Math.sin(angle);
      }

      magnitudes.push(Math.sqrt(real * real + imag * imag));
    }

    if (magnitudes.length === 0) return { dominantFreq: 0, peakPower: 0, totalPower: 0 };

    const totalPower = magnitudes.reduce((a, b) => a + b, 0);
    const peakIdx = magnitudes.indexOf(Math.max(...magnitudes));
    const peakPower = magnitudes[peakIdx] || 0;
    const dominantFreq = (minBin + peakIdx) * freqResolution;

    return { dominantFreq, peakPower, totalPower };
  }
}
