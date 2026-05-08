// Additional detection-specific types for better organization

export interface DeepfakeDetectionResult {
  verdict: 'real' | 'deepfake' | 'uncertain';
  confidence: number;
  reasoning: string;
  latency: number;
  frameId: string;
  timestamp: number;
}

export interface MisinformationDetectionResult {
  verdict: 'true' | 'false' | 'disputed' | 'unverifiable';
  confidence: number;
  reasoning: string;
  claimText: string;
  sources?: string[];
  latency: number;
  timestamp: number;
}

export interface UnifiedDetectionResult {
  sessionId: string;
  deepfake?: DeepfakeDetectionResult;
  misinformation?: MisinformationDetectionResult;
  timestamp: number;
  cost: number;
}
