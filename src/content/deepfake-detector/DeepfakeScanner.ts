// DeepfakeScanner.ts - Multi-Signal Ensemble Detector Orchestrator

import { ScanResult, ScannerConfig, DetectorResult } from './types';
import { BaseDetector } from './detectors/BaseDetector';
import { HuggingFaceDetector } from './detectors/HuggingFaceDetector';
import { BlinkDetector } from './detectors/BlinkDetector';
import { LandmarkDetector } from './detectors/LandmarkDetector';
import { PPGDetector } from './detectors/PPGDetector';
import { LipSyncDetector } from './detectors/LipSyncDetector';
import { FrequencyDetector } from './detectors/FrequencyDetector';

export class DeepfakeScanner {
  private detectors: Map<string, BaseDetector> = new Map();
  private config: ScannerConfig;

  constructor(config?: Partial<ScannerConfig>) {
    this.config = this.getDefaultConfig();
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.initializeDetectors();
  }

  private getDefaultConfig(): ScannerConfig {
    return {
      detectors: {
        // Local ONNX model - PRIMARY detector (runs entirely in browser)
        huggingface: { enabled: true, weight: 0.80, threshold: 0.5, timeout: 60000 },
        // Legacy detectors - disabled by default, kept for fallback
        landmarks: { enabled: false, weight: 0.05, threshold: 0.15, timeout: 10000 },
        blinks: { enabled: false, weight: 0.05, threshold: 0.5, timeout: 15000 },
        ppg: { enabled: false, weight: 0.05, threshold: 0.3, timeout: 8000 },
        lipsync: { enabled: false, weight: 0.00, threshold: 0.6, timeout: 8000 },
        frequency: { enabled: false, weight: 0.05, threshold: 0.4, timeout: 5000 },
      },
      debug: true,
    };
  }

  private initializeDetectors(): void {
    const { detectors } = this.config;

    // HuggingFace API detector - PRIMARY (iemsayan/deepfake-detector)
    if (detectors.huggingface.enabled) {
      this.detectors.set(
        'huggingface',
        new HuggingFaceDetector({
          threshold: detectors.huggingface.threshold,
          timeout: detectors.huggingface.timeout,
        })
      );
    }

    // Legacy detectors - kept for fallback/ensemble
    if (detectors.landmarks.enabled) {
      this.detectors.set(
        'landmarks',
        new LandmarkDetector({
          threshold: detectors.landmarks.threshold,
          timeout: detectors.landmarks.timeout,
        })
      );
    }

    if (detectors.blinks.enabled) {
      this.detectors.set(
        'blinks',
        new BlinkDetector({
          threshold: detectors.blinks.threshold,
          timeout: detectors.blinks.timeout,
        })
      );
    }

    if (detectors.ppg.enabled) {
      this.detectors.set(
        'ppg',
        new PPGDetector({
          threshold: detectors.ppg.threshold,
          timeout: detectors.ppg.timeout,
        })
      );
    }

    if (detectors.lipsync.enabled) {
      this.detectors.set(
        'lipsync',
        new LipSyncDetector({
          threshold: detectors.lipsync.threshold,
          timeout: detectors.lipsync.timeout,
        })
      );
    }

    if (detectors.frequency.enabled) {
      this.detectors.set(
        'frequency',
        new FrequencyDetector({
          threshold: detectors.frequency.threshold,
          timeout: detectors.frequency.timeout,
        })
      );
    }

    if (this.config.debug) {
      this.detectors.forEach((detector) => detector.enableDebug());
    }
  }

  async scan(videoElement: HTMLVideoElement): Promise<ScanResult> {
    const startTime = performance.now();
    const detectorResults: Record<string, DetectorResult> = {};

    console.log('🔍 Starting deepfake scan with', this.detectors.size, 'detectors');

    const detectorPromises = Array.from(this.detectors.entries()).map(
      async ([name, detector]) => {
        console.log(`▶️ Running ${name} detector...`);
        try {
          const result = await detector.detect(videoElement);
          console.log(`✅ ${name} complete:`, result.isFake ? '🚨 FAKE' : '✓ REAL', result);
          return { name, result };
        } catch (error) {
          console.error(`❌ ${name} failed:`, error);
          return { 
            name, 
            result: { 
              isFake: false, 
              confidence: 0, 
              details: { error: String(error) }, 
              processingTime: 0 
            } 
          };
        }
      }
    );

    const results = await Promise.all(detectorPromises);

    results.forEach(({ name, result }) => {
      detectorResults[name] = result;
    });

    let weightedScore = 0;
    const signals: string[] = [];

    results.forEach(({ name, result }) => {
      const weight = this.config.detectors[name as keyof typeof this.config.detectors]?.weight || 0;
      
      if (result.isFake) {
        weightedScore += weight;
        signals.push(name);
      }
    });

    const totalProcessingTime = performance.now() - startTime;

    const scanResult: ScanResult = {
      isFake: weightedScore > 0.5,
      overallConfidence: weightedScore,
      signals,
      detectorResults,
      totalProcessingTime,
    };

    console.log('🎯 Scan complete:', scanResult);

    return scanResult;
  }

  async testDetector(
    detectorName: string,
    videoElement: HTMLVideoElement
  ): Promise<{ result: DetectorResult; logs: string[] }> {
    const detector = this.detectors.get(detectorName);
    
    if (!detector) {
      throw new Error(`Detector "${detectorName}" not found`);
    }

    detector.enableDebug();
    const result = await detector.detect(videoElement);
    
    return {
      result,
      logs: detector.getDebugLogs(),
    };
  }

  getDebugInfo(): Record<string, string[]> {
    const debugInfo: Record<string, string[]> = {};
    
    this.detectors.forEach((detector, name) => {
      debugInfo[name] = detector.getDebugLogs();
    });
    
    return debugInfo;
  }
}
