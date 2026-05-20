// Deepfake Detector Types Interfaces that will be used across the detector

export interface DetectorResult {
    isFake: boolean;
    confidence: number;
    details: Record<string, any>;
    processingTime: number
}

export interface ScanResult {
    isFake: boolean;
    overallConfidence: number;
    signals: string[];
    detectorResults: Record<string, DetectorResult>;
    totalProcessingTime: number;
}

export interface DetectorConfig {
  enabled: boolean;
  weight: number;
  threshold: number;
  timeout?: number; // ms
}

export interface ScannerConfig {
  detectors: {
    realitydefender: DetectorConfig;
    huggingface: DetectorConfig;
    landmarks: DetectorConfig;
    blinks: DetectorConfig;
    ppg: DetectorConfig;
    lipsync: DetectorConfig;
    frequency: DetectorConfig;
  };
  debug: boolean;
}
