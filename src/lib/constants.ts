// TrustShield Constants and Configuration

export const TRUSTSHIELD_CONFIG = {
  // Extension metadata
  VERSION: '1.0.0',
  NAME: 'TrustShield',
  DESCRIPTION: 'Real-Time Deepfake & Misinformation Detection',
  
  // API endpoints and rate limits
  API: {
    OPENROUTER: 'https://openrouter.ai/api/v1/chat/completions',
    CLAIMBUSTER: 'https://claimbuster.api.app/score/text',
    GOOGLE_FACT_CHECK: 'https://factchecktools.googleapis.com/v1alpha1/claims:search',
    
    // Rate limits (requests per minute)
    RATE_LIMITS: {
      OPENROUTER: 20,
      CLAIMBUSTER: 60,
      GOOGLE_FACT_CHECK: 100,
    },
    
    // Timeouts (milliseconds)
    TIMEOUTS: {
      OPENROUTER: 10000,
      CLAIMBUSTER: 5000,
      GOOGLE_FACT_CHECK: 8000,
    },
  },
  
  // Model configurations
  MODELS: {
    DEEPFAKE: {
      ONNX_MODEL: 'efficientnet-b4.onnx',
      INPUT_SIZE: 224,
      CONFIDENCE_THRESHOLD: 0.5,
      AMBIGUITY_GATE_MIN: 0.4,
      AMBIGUITY_GATE_MAX: 0.7,
      FRAME_RATE: 5, // fps
      ROLLING_AVERAGE_FRAMES: 3,
    },
    
    LLM: {
      MODEL_NAME: 'google/gemini-3-flash-preview',
      MAX_TOKENS: {
        VISION: 150,
        TEXT: 200,
      },
      TEMPERATURE: 0.1,
    },
  },
  
  // Privacy and security defaults
  PRIVACY: {
    DEFAULT_CONFIG: {
      biometricDataRetention: 30, // minutes
      transcriptRetention: 7, // days
      explicitConsent: false,
      dataProcessingLocation: 'on-device' as const,
      gdprCompliant: true,
      allowTelemetry: false,
      encryptionEnabled: true,
    },
    
    DATA_CLEANUP_INTERVAL: 60000, // 1 minute in ms
    MAX_SESSION_DURATION: 180, // minutes
  },
  
  // Performance thresholds
  PERFORMANCE: {
    MAX_CPU_USAGE: 15, // percentage
    MAX_MEMORY_USAGE: 512, // MB
    MAX_LATENCY: {
      DEEPFAKE_LOCAL: 60, // ms
      DEEPFAKE_LLM: 800, // ms
      MISINFO_LOCAL: 2000, // ms
      MISINFO_LLM: 1500, // ms
    },
    BUFFER_SIZES: {
      FRAME_BUFFER: 10,
      TRANSCRIPT_BUFFER: 5, // seconds
      CLAIM_BUFFER: 20,
    },
  },
  
  // Platform detection patterns
  PLATFORMS: {
    GOOGLE_MEET: {
      URL_PATTERN: /meet\.google\.com/,
      VIDEO_SELECTOR: '[data-testid="participant-video"]',
      AUDIO_SELECTOR: 'audio',
    },
    
    ZOOM: {
      URL_PATTERN: /zoom\.us/,
      VIDEO_SELECTOR: '.video-container__video',
      AUDIO_SELECTOR: 'audio',
    },
    
    TEAMS: {
      URL_PATTERN: /teams\.microsoft\.com/,
      VIDEO_SELECTOR: '.video-tile-video',
      AUDIO_SELECTOR: 'audio',
    },
    
    YOUTUBE: {
      URL_PATTERN: /youtube\.com/,
      VIDEO_SELECTOR: 'video.html5-main-video',
      AUDIO_SELECTOR: 'video.html5-main-video',
      SUBTITLE_SELECTOR: 'track[type="captions"]',
    },
  },
  
  // UI Constants
  UI: {
    BADGE_STYLES: {
      REAL: { color: '#16a34a', icon: '🟢' },
      UNCERTAIN: { color: '#f59e0b', icon: '🟡' },
      DEEPFAKE: { color: '#dc2626', icon: '🔴' },
      TRUE: { color: '#2563eb', icon: '🔵' },
      FALSE: { color: '#dc2626', icon: '🔴' },
      DISPUTED: { color: '#f59e0b', icon: '🟡' },
      UNVERIFIABLE: { color: '#6b7280', icon: '⚪' },
    },
    
    ANIMATION: {
      FADE_IN: 300,
      SLIDE_UP: 300,
      BADGE_UPDATE: 200,
    },
    
    TOOLTIP: {
      SHOW_DELAY: 500,
      HIDE_DELAY: 200,
      MAX_WIDTH: 300,
    },
  },
  
  // Cost tracking
  COST: {
    OPENROUTER_PER_TOKEN: 0.0003 / 1000, // $0.0003 per 1K tokens
    ESTIMATED_COST_PER_HOUR: 0.05, // USD
    COST_WARNING_THRESHOLD: 0.10, // USD
  },
  
  // Error codes and messages
  ERRORS: {
    // General errors
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    
    // DeepGuard errors
    MODEL_LOAD_ERROR: 'MODEL_LOAD_ERROR',
    INFERENCE_ERROR: 'INFERENCE_ERROR',
    FACE_DETECTION_ERROR: 'FACE_DETECTION_ERROR',
    
    // MisinfoShield errors
    TRANSCRIPTION_ERROR: 'TRANSCRIPTION_ERROR',
    CLAIM_EXTRACTION_ERROR: 'CLAIM_EXTRACTION_ERROR',
    FACT_CHECK_ERROR: 'FACT_CHECK_ERROR',
    
    // Privacy errors
    PRIVACY_VIOLATION: 'PRIVACY_VIOLATION',
    CONSENT_REQUIRED: 'CONSENT_REQUIRED',
    DATA_RETENTION_ERROR: 'DATA_RETENTION_ERROR',
    
    // API errors
    API_KEY_MISSING: 'API_KEY_MISSING',
    API_RATE_LIMIT: 'API_RATE_LIMIT',
    API_QUOTA_EXCEEDED: 'API_QUOTA_EXCEEDED',
  },
  
  // Event names for Chrome extension messaging
  EVENTS: {
    PAGE_DETECTED: 'PAGE_DETECTED',
    DEEPFAKE_VERDICT: 'DEEPFAKE_VERDICT',
    CLAIM_VERDICT: 'CLAIM_VERDICT',
    SESSION_START: 'SESSION_START',
    SESSION_END: 'SESSION_END',
    PERFORMANCE_UPDATE: 'PERFORMANCE_UPDATE',
    SECURITY_EVENT: 'SECURITY_EVENT',
    ERROR: 'ERROR',
    SETTINGS_UPDATE: 'SETTINGS_UPDATE',
    PRIVACY_CONSENT_REQUEST: 'PRIVACY_CONSENT_REQUEST',
    PRIVACY_CONSENT_RESPONSE: 'PRIVACY_CONSENT_RESPONSE',
  },
  
  // Storage keys
  STORAGE: {
    SETTINGS: 'trustshield_settings',
    SESSIONS: 'trustshield_sessions',
    SECURITY_EVENTS: 'trustshield_security_events',
    PRIVACY_CONSENT: 'trustshield_privacy_consent',
    PERFORMANCE_METRICS: 'trustshield_performance_metrics',
  },
} as const;

export default TRUSTSHIELD_CONFIG;
