// Core TrustShield Types with Privacy Compliance

export type PageType = 'live-call' | 'article' | 'embedded-video' | 'other';
export type Platform = 'meet' | 'zoom' | 'teams' | 'youtube' | 'other';

// Privacy Compliance Configuration
export interface PrivacyConfig {
  biometricDataRetention: number; // minutes
  transcriptRetention: number; // days
  explicitConsent: boolean;
  dataProcessingLocation: 'on-device' | 'cloud';
  gdprCompliant: boolean;
  allowTelemetry: boolean;
  encryptionEnabled: boolean;
}

// Security Audit Logging
export interface SecurityEvent {
  eventId: string;
  type: 'deepfake_detected' | 'misinfo_flagged' | 'api_call' | 'privacy_violation' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  metadata: Record<string, any>;
  userId?: string;
  sessionId: string;
}

// Performance Monitoring
export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  frameProcessingRate: number;
  apiCallSuccessRate: number;
  errorRates: {
    deepfake: number;
    misinfo: number;
    transcription: number;
  };
  timestamp: number;
}

// DeepGuard Types
export interface ScoredFrame {
  frameId: string;
  timestamp: number;
  confidence: number; // 0.0 = real, 1.0 = deepfake
  isAmbiguous: boolean;
  jpegB64?: string; // only when escalating to LLM
  faceBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  processingLatency: number;
}

export interface DeepfakeVerdict {
  frameId: string;
  localScore: number;
  llmVerdict: 'real' | 'deepfake' | 'uncertain';
  llmReasoning: string;
  latencyMs: number;
  timestamp: number;
  confidence: number;
  modelVersion: string;
}

// MisinfoShield Types
export interface Claim {
  claimId: string;
  text: string; // the sentence
  source: 'article' | 'transcript' | 'subtitle';
  checkWorthiness: number; // ClaimBuster score 0.0–1.0
  timestamp: number;
  context?: string; // surrounding text for better analysis
  speaker?: string; // for live calls
}

export interface ClaimVerdict {
  claimId: string;
  claimText: string;
  factCheckMatch?: {
    url: string;
    publisher: string;
    verdict: string;
    rating: string;
    confidence: number;
  };
  llmVerdict: 'true' | 'false' | 'disputed' | 'unverifiable';
  llmReasoning: string;
  confidence: number;
  timestamp: number;
  processingLatency: number;
}

// Session Management
export interface TrustShieldSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  mode: PageType;
  platform?: Platform;
  url: string;
  privacyConfig: PrivacyConfig;
  
  deepguard: {
    framesProcessed: number;
    llmCallsMade: number;
    verdictDistribution: { real: number; deepfake: number; uncertain: number };
    averageLatency: number;
    falsePositiveRate?: number;
  };
  
  misinfo: {
    claimsChecked: number;
    llmCallsMade: number;
    verdictDistribution: { true: number; false: number; disputed: number; unverifiable: number };
    fullTranscript?: string;
    averageLatency: number;
  };
  
  totalLLMCalls: number;
  estimatedCostUSD: number;
  performanceMetrics: PerformanceMetrics[];
  securityEvents: SecurityEvent[];
}

// Settings and Configuration
export interface TrustShieldSettings {
  // API Configuration
  openRouterApiKey?: string;
  enableDeepGuard: boolean;
  enableMisinfoShield: boolean;
  
  // DeepGuard Settings
  deepguard: {
    fps: number;
    ambiguityGateMin: number;
    ambiguityGateMax: number;
    confidenceThreshold: number;
    enableVoiceAnalysis: boolean;
  };
  
  // MisinfoShield Settings
  misinfo: {
    claimBusterThreshold: number;
    factCheckThreshold: number;
    enableAudioTranscription: boolean;
    enableTextAnalysis: boolean;
    transcriptionLanguage: string;
  };
  
  // Privacy Settings
  privacy: PrivacyConfig;
  
  // UI Settings
  ui: {
    theme: 'light' | 'dark' | 'system';
    showNotifications: boolean;
    showOverlays: boolean;
    compactMode: boolean;
  };
  
  // Advanced Settings
  advanced: {
    debugMode: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    enableTelemetry: boolean;
    maxSessionDuration: number; // minutes
  };
}

// API Response Types
export interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ClaimBusterResponse {
  results: Array<{
    sentence: string;
    score: number;
  }>;
}

export interface GoogleFactCheckResponse {
  claims: Array<{
    text: string;
    claimant: string;
    claimDate: string;
    claimReview: Array<{
      publisher: string;
      url: string;
      title: string;
      textualRating: string;
      languageCode: string;
    }>;
  }>;
}

// Error Types
export interface TrustShieldError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  context?: Record<string, any>;
  recoverable: boolean;
}

// Event Types for Chrome Extension Messaging
export type ExtensionMessage = 
  | { type: 'PAGE_DETECTED'; payload: { pageType: PageType; platform: Platform } }
  | { type: 'DEEPFAKE_VERDICT'; payload: DeepfakeVerdict }
  | { type: 'CLAIM_VERDICT'; payload: ClaimVerdict }
  | { type: 'TRANSCRIPT_UPDATE'; payload: { sessionId: string; text: string } }
  | { type: 'PAGE_UPDATED'; payload: { pageType: PageType; platform: Platform } }
  | { type: 'CLAIM_LLM_REQUEST'; payload: { claimText: string; claimId: string; context: Record<string, any> } }
  | { type: 'DEEPFAKE_LLM_REQUEST'; payload: { frameBase64: string; frameId: string; context: Record<string, any> } }
  | { type: 'SESSION_START'; payload: { sessionId: string; mode: PageType } }
  | { type: 'SESSION_END'; payload: { sessionId: string } }
  | { type: 'PERFORMANCE_UPDATE'; payload: PerformanceMetrics }
  | { type: 'SECURITY_EVENT'; payload: SecurityEvent }
  | { type: 'ERROR'; payload: TrustShieldError }
  | { type: 'SETTINGS_UPDATE'; payload: Partial<TrustShieldSettings> }
  | { type: 'PRIVACY_CONSENT_REQUEST'; payload: { required: boolean } }
  | { type: 'PRIVACY_CONSENT_RESPONSE'; payload: { granted: boolean; config: PrivacyConfig } };

// Database Schema Types
export interface StoredSession extends TrustShieldSession {
  id: string; // IndexedDB primary key
  createdAt: number;
  updatedAt: number;
}

export interface StoredSettings extends TrustShieldSettings {
  id: string; // IndexedDB primary key
  lastUpdated: number;
}

export interface StoredSecurityEvent extends SecurityEvent {
  id: string; // IndexedDB primary key
}

// Utility Types
export type DeepGuardStatus = 'inactive' | 'initializing' | 'active' | 'error';
export type MisinfoShieldStatus = 'inactive' | 'initializing' | 'active' | 'error';
export type VerdictBadge = 'real' | 'uncertain' | 'deepfake' | 'true' | 'false' | 'disputed' | 'unverifiable';
