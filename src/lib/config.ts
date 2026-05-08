// TrustShield Configuration

export const TRUSTSHIELD_CONFIG = {
  // API Configuration
  api: {
    openrouter: {
      baseUrl: 'https://openrouter.ai/api/v1',
      timeout: 30000,
      maxRetries: 3,
    },
    claimBuster: {
      baseUrl: 'https://idir.uta.edu/claimbuster/api/v2',
      timeout: 10000,
      maxRetries: 2,
    },
    googleFactCheck: {
      baseUrl: 'https://factchecktools.googleapis.com/v1alpha1',
      timeout: 15000,
      maxRetries: 2,
    },
  },

  // DeepGuard Configuration
  deepguard: {
    modelPath: '/models/deepguard.onnx',
    frameRate: 2,
    confidenceThreshold: 0.7,
    maxConcurrentDetections: 5,
    inferenceTimeout: 5000,
    frameBuffer: {
      maxSize: 100,
      cleanupInterval: 30000,
    },
    verdict: {
      highConfidenceThreshold: 0.9,
      mediumConfidenceThreshold: 0.7,
      lowConfidenceThreshold: 0.5,
      arbitrationThreshold: 0.6,
    },
  },

  // MisinfoShield Configuration
  misinfo: {
    speechRecognition: {
      continuous: true,
      interimResults: true,
      language: 'en-US',
      maxAlternatives: 3,
    },
    claimDetection: {
      minClaimLength: 10,
      maxClaimLength: 500,
      claimWorthinessThreshold: 0.4,
      batchSize: 5,
    },
    factChecking: {
      timeout: 20000,
      maxRetries: 2,
      batchSize: 3,
    },
    textAnalysis: {
      minTextLength: 50,
      maxTextLength: 10000,
      chunkSize: 1000,
    },
  },

  // Privacy Configuration
  privacy: {
    dataRetention: {
      biometricData: 30 * 60 * 1000, // 30 minutes
      transcripts: 7 * 24 * 60 * 60 * 1000, // 7 days
      metadata: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
    encryption: {
      algorithm: 'AES-GCM',
      keyLength: 256,
      ivLength: 12,
    },
    consent: {
      required: true,
      gdprCompliant: true,
      explicitConsent: false,
    },
    processing: {
      location: 'on-device', // 'on-device' | 'cloud'
      anonymization: true,
      dataMinimization: true,
    },
  },

  // Performance Configuration
  performance: {
    monitoring: {
      enabled: true,
      interval: 5000,
      historySize: 100,
    },
    thresholds: {
      cpuUsage: 80, // percentage
      memoryUsage: 512, // MB
      networkLatency: 2000, // ms
      errorRate: 0.05, // 5%
    },
    optimization: {
      autoOptimize: true,
      frameRateAdjustment: true,
      batchProcessing: true,
      lazyLoading: true,
    },
    resources: {
      maxMemoryUsage: 1024, // MB
      maxCpuUsage: 90, // percentage
      cleanupInterval: 60000, // ms
    },
  },

  // UI Configuration
  ui: {
    theme: 'system', // 'light' | 'dark' | 'system'
    notifications: {
      enabled: true,
      position: 'top-right', // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
      duration: 5000,
    },
    overlays: {
      enabled: true,
      position: 'top-right',
      opacity: 0.9,
      animation: true,
    },
    sidePanel: {
      width: 400,
      minWidth: 300,
      maxWidth: 600,
      collapsible: true,
    },
  },

  // Storage Configuration
  storage: {
    indexedDB: {
      name: 'TrustShieldDB',
      version: 1,
      stores: {
        sessions: 'sessions',
        transcripts: 'transcripts',
        verdicts: 'verdicts',
        claims: 'claims',
        settings: 'settings',
        performance: 'performance',
      },
    },
    chromeStorage: {
      sync: ['settings', 'apiKeys'],
      local: ['sessions', 'transcripts', 'verdicts'],
    },
  },

  // Security Configuration
  security: {
    encryption: {
      enabled: true,
      algorithm: 'AES-GCM',
      keyRotation: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    authentication: {
      required: false,
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    },
    validation: {
      inputSanitization: true,
      outputEncoding: true,
      requestValidation: true,
    },
  },

  // Error Handling Configuration
  errorHandling: {
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 120000,
    },
    retry: {
      enabled: true,
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
    },
    fallback: {
      enabled: true,
      minimalMode: true,
      disabledMode: false,
    },
    telemetry: {
      enabled: true,
      endpoint: '/api/telemetry',
      batchSize: 10,
      flushInterval: 30000,
    },
  },

  // Platform Detection Configuration
  platforms: {
    meet: {
      urlPattern: /meet\.google\.com/,
      videoSelectors: ['video'],
      audioSelectors: ['audio'],
      transcriptSelector: '[data-i18n="transcript"]',
    },
    zoom: {
      urlPattern: /zoom\.us/,
      videoSelectors: ['video'],
      audioSelectors: ['audio'],
      transcriptSelector: '.transcript-content',
    },
    teams: {
      urlPattern: /teams\.microsoft\.com/,
      videoSelectors: ['video'],
      audioSelectors: ['audio'],
      transcriptSelector: '.transcript-container',
    },
    youtube: {
      urlPattern: /youtube\.com|youtu\.be/,
      videoSelectors: ['video.html5-main-video'],
      audioSelectors: ['audio'],
      transcriptSelector: '.ytd-transcript-renderer',
      subtitleSelector: '.ytp-caption-segment',
    },
  },

  // Development Configuration
  development: {
    debug: false,
    logging: {
      level: 'info', // 'debug' | 'info' | 'warn' | 'error'
      console: true,
      remote: false,
    },
    testing: {
      mockApis: true,
      simulateErrors: false,
      performanceMonitoring: true,
    },
  },

  // Feature Flags
  features: {
    deepguard: {
      enabled: true,
      realTimeDetection: true,
      batchProcessing: false,
      llmArbitration: true,
    },
    misinfo: {
      enabled: true,
      speechRecognition: true,
      textAnalysis: true,
      subtitleExtraction: true,
      factChecking: true,
      llmAnalysis: true,
    },
    privacy: {
      enabled: true,
      encryption: true,
      gdprCompliance: true,
      dataMinimization: true,
    },
    performance: {
      enabled: true,
      monitoring: true,
      autoOptimization: true,
      resourceManagement: true,
    },
  },

  // Constants
  constants: {
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    maxSessionDuration: 4 * 60 * 60 * 1000, // 4 hours
    maxTranscriptLength: 10000,
    maxClaimLength: 500,
    maxVideoElements: 10,
    maxAudioElements: 5,
    apiTimeout: 30000,
    heartbeatInterval: 30000,
    cleanupInterval: 300000, // 5 minutes
  },
}

// Default Settings
export const DEFAULT_SETTINGS = {
  // API Keys
  apiKeys: {
    openrouter: '',
    claimBuster: '',
    googleFactCheck: '',
  },

  // Shield Settings
  deepguard: {
    enabled: true,
    frameRate: 2,
    confidenceThreshold: 0.7,
    showOverlays: true,
    llmArbitration: true,
  },

  misinfo: {
    enabled: true,
    enableAudioTranscription: true,
    enableTextAnalysis: true,
    enableSubtitleExtraction: true,
    claimWorthinessThreshold: 0.4,
    factCheckingEnabled: true,
    llmAnalysis: true,
  },

  // Privacy Settings
  privacy: {
    dataRetention: {
      biometricData: 30 * 60 * 1000, // 30 minutes
      transcripts: 7 * 24 * 60 * 60 * 1000, // 7 days
      metadata: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
    encryptionEnabled: true,
    gdprCompliant: true,
    processingLocation: 'on-device',
    anonymizationEnabled: true,
  },

  // UI Settings
  ui: {
    theme: 'system',
    showNotifications: true,
    showOverlays: true,
    sidePanelWidth: 400,
    notificationPosition: 'top-right',
    overlayOpacity: 0.9,
  },

  // Performance Settings
  performance: {
    monitoringEnabled: true,
    autoOptimization: true,
    maxMemoryUsage: 1024,
    maxCpuUsage: 90,
    frameRateAdjustment: true,
  },

  // Advanced Settings
  advanced: {
    debugMode: false,
    logLevel: 'info',
    telemetryEnabled: true,
    errorReporting: true,
    crashReporting: false,
  },
}

// Type Definitions
export type Theme = 'light' | 'dark' | 'system'
export type ProcessingLocation = 'on-device' | 'cloud'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type NotificationPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface Settings {
  apiKeys: {
    openrouter: string
    claimBuster: string
    googleFactCheck: string
  }
  deepguard: {
    enabled: boolean
    frameRate: number
    confidenceThreshold: number
    showOverlays: boolean
    llmArbitration: boolean
  }
  misinfo: {
    enabled: boolean
    enableAudioTranscription: boolean
    enableTextAnalysis: boolean
    enableSubtitleExtraction: boolean
    claimWorthinessThreshold: number
    factCheckingEnabled: boolean
    llmAnalysis: boolean
  }
  privacy: {
    dataRetention: {
      biometricData: number
      transcripts: number
      metadata: number
    }
    encryptionEnabled: boolean
    gdprCompliant: boolean
    processingLocation: ProcessingLocation
    anonymizationEnabled: boolean
  }
  ui: {
    theme: Theme
    showNotifications: boolean
    showOverlays: boolean
    sidePanelWidth: number
    notificationPosition: NotificationPosition
    overlayOpacity: number
  }
  performance: {
    monitoringEnabled: boolean
    autoOptimization: boolean
    maxMemoryUsage: number
    maxCpuUsage: number
    frameRateAdjustment: boolean
  }
  advanced: {
    debugMode: boolean
    logLevel: LogLevel
    telemetryEnabled: boolean
    errorReporting: boolean
    crashReporting: boolean
  }
}

export default TRUSTSHIELD_CONFIG
