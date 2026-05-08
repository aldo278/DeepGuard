// Error Handling and Fallback Mechanisms for TrustShield

import { TrustShieldError, SecurityEvent } from '@/types';
import TRUSTSHIELD_CONFIG from '@/lib/constants';

// Chrome extension types
declare const chrome: any;

export interface ErrorHandlerConfig {
  maxRetries: number;
  retryDelay: number;
  fallbackMode: 'graceful' | 'minimal' | 'disabled';
  enableTelemetry: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private config: ErrorHandlerConfig;
  private errorCounts: Map<string, number> = new Map();
  private lastErrors: Map<string, number> = new Map();
  private circuitBreakers: Map<string, { isOpen: boolean; openTime: number; retryCount: number }> = new Map();

  private constructor() {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      fallbackMode: 'graceful',
      enableTelemetry: false,
      logLevel: 'error',
    };
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Initialize error handler
  async initialize(config?: Partial<ErrorHandlerConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Set up global error handlers
    this.setupGlobalErrorHandlers();

    // Load error history from storage
    await this.loadErrorHistory();

    console.log('Error handler initialized');
  }

  // Setup global error handlers
  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        code: 'UNHANDLED_PROMISE_REJECTION',
        message: event.reason?.message || 'Unhandled promise rejection',
        severity: 'high',
        timestamp: Date.now(),
        context: { reason: event.reason },
        recoverable: false,
      });
    });

    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.handleError({
        code: 'UNCAUGHT_ERROR',
        message: event.message || 'Uncaught error',
        severity: 'high',
        timestamp: Date.now(),
        context: { 
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
        },
        recoverable: false,
      });
    });
  }

  // Handle error with circuit breaker and retry logic
  async handleError(error: TrustShieldError): Promise<void> {
    // Log error
    this.logError(error);

    // Update error counts
    this.updateErrorCounts(error.code);

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(error.code)) {
      console.warn(`Circuit breaker open for ${error.code}, skipping retry`);
      return;
    }

    // Store error
    await this.storeError(error);

    // Send to background script
    this.sendErrorToBackground(error);

    // Check if we need to enter fallback mode
    this.checkFallbackMode(error);

    // Attempt recovery if possible
    if (error.recoverable) {
      await this.attemptRecovery(error);
    }
  }

  // Log error based on log level
  private logError(error: TrustShieldError): void {
    const message = `[${error.code}] ${error.message}`;
    
    switch (this.config.logLevel) {
      case 'debug':
        console.debug(message, error.context);
        break;
      case 'info':
        console.info(message, error.context);
        break;
      case 'warn':
        if (error.severity === 'low' || error.severity === 'medium') {
          console.warn(message, error.context);
        }
        break;
      case 'error':
        if (error.severity === 'high' || error.severity === 'critical') {
          console.error(message, error.context);
        }
        break;
    }
  }

  // Update error counts for rate limiting
  private updateErrorCounts(errorCode: string): void {
    const count = this.errorCounts.get(errorCode) || 0;
    this.errorCounts.set(errorCode, count + 1);
    this.lastErrors.set(errorCode, Date.now());
  }

  // Check if circuit breaker is open
  private isCircuitBreakerOpen(errorCode: string): boolean {
    const breaker = this.circuitBreakers.get(errorCode);
    if (!breaker) return false;

    if (breaker.isOpen) {
      // Check if it's time to retry
      const timeSinceOpen = Date.now() - breaker.openTime;
      if (timeSinceOpen > 60000) { // 1 minute timeout
        breaker.isOpen = false;
        breaker.retryCount = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  // Open circuit breaker
  private openCircuitBreaker(errorCode: string): void {
    const breaker = this.circuitBreakers.get(errorCode) || { isOpen: false, openTime: 0, retryCount: 0 };
    breaker.isOpen = true;
    breaker.openTime = Date.now();
    breaker.retryCount++;
    this.circuitBreakers.set(errorCode, breaker);
  }

  // Store error in IndexedDB
  private async storeError(error: TrustShieldError): Promise<void> {
    try {
      const securityEvent: SecurityEvent = {
        eventId: this.generateEventId(),
        type: 'error',
        severity: error.severity,
        timestamp: error.timestamp,
        metadata: {
          errorCode: error.code,
          errorMessage: error.message,
          context: error.context,
        },
        sessionId: this.getCurrentSessionId(),
      };

      // Store via background script
      chrome.runtime.sendMessage({
        type: 'SECURITY_EVENT',
        payload: securityEvent
      });

    } catch (storageError) {
      console.error('Failed to store error:', storageError);
    }
  }

  // Send error to background script
  private sendErrorToBackground(error: TrustShieldError): void {
    try {
      chrome.runtime.sendMessage({
        type: 'ERROR',
        payload: error
      });
    } catch (messagingError) {
      console.error('Failed to send error to background:', messagingError);
    }
  }

  // Check if we need to enter fallback mode
  private checkFallbackMode(error: TrustShieldError): void {
    const errorCount = this.errorCounts.get(error.code) || 0;
    
    // Enter fallback mode if too many errors
    if (errorCount >= this.config.maxRetries) {
      this.openCircuitBreaker(error.code);
      
      if (this.config.fallbackMode === 'minimal') {
        this.enterMinimalMode();
      } else if (this.config.fallbackMode === 'disabled') {
        this.enterDisabledMode();
      }
    }
  }

  // Attempt recovery from error
  private async attemptRecovery(error: TrustShieldError): Promise<void> {
    switch (error.code) {
      case 'API_RATE_LIMIT':
        await this.handleRateLimitError();
        break;
      case 'NETWORK_ERROR':
        await this.handleNetworkError();
        break;
      case 'MODEL_LOAD_ERROR':
        await this.handleModelLoadError();
        break;
      case 'INFERENCE_ERROR':
        await this.handleInferenceError();
        break;
      case 'SPEECH_RECOGNITION_ERROR':
        await this.handleSpeechRecognitionError();
        break;
      case 'STORAGE_ERROR':
        await this.handleStorageError();
        break;
      default:
        await this.handleGenericError(error);
    }
  }

  // Handle rate limit errors
  private async handleRateLimitError(): Promise<void> {
    console.log('Handling rate limit error - implementing exponential backoff');
    
    // Implement exponential backoff
    const delay = Math.min(1000 * Math.pow(2, this.errorCounts.get('API_RATE_LIMIT') || 0), 30000);
    
    setTimeout(() => {
      console.log('Retrying after rate limit delay');
    }, delay);
  }

  // Handle network errors
  private async handleNetworkError(): Promise<void> {
    console.log('Handling network error - switching to offline mode');
    
    // Switch to offline mode
    chrome.runtime.sendMessage({
      type: 'ENTER_OFFLINE_MODE',
      payload: {}
    });
  }

  // Handle model load errors
  private async handleModelLoadError(): Promise<void> {
    console.log('Handling model load error - switching to fallback model');
    
    // Switch to fallback model or disable deepfake detection
    chrome.runtime.sendMessage({
      type: 'SWITCH_FALLBACK_MODEL',
      payload: {}
    });
  }

  // Handle inference errors
  private async handleInferenceError(): Promise<void> {
    console.log('Handling inference error - restarting inference worker');
    
    // Restart inference worker
    chrome.runtime.sendMessage({
      type: 'RESTART_INFERENCE_WORKER',
      payload: {}
    });
  }

  // Handle speech recognition errors
  private async handleSpeechRecognitionError(): Promise<void> {
    console.log('Handling speech recognition error - restarting recognition');
    
    // Restart speech recognition
    chrome.runtime.sendMessage({
      type: 'RESTART_SPEECH_RECOGNITION',
      payload: {}
    });
  }

  // Handle storage errors
  private async handleStorageError(): Promise<void> {
    console.log('Handling storage error - clearing cache');
    
    // Clear cache and retry
    chrome.runtime.sendMessage({
      type: 'CLEAR_STORAGE_CACHE',
      payload: {}
    });
  }

  // Handle generic errors
  private async handleGenericError(error: TrustShieldError): Promise<void> {
    console.log('Handling generic error:', error);
    
    // Implement generic retry logic
    const retryCount = this.errorCounts.get(error.code) || 0;
    if (retryCount < this.config.maxRetries) {
      const delay = this.config.retryDelay * Math.pow(2, retryCount);
      setTimeout(() => {
        console.log(`Retrying operation for ${error.code}`);
      }, delay);
    }
  }

  // Enter minimal mode
  private enterMinimalMode(): void {
    console.log('Entering minimal mode - only essential features active');
    
    chrome.runtime.sendMessage({
      type: 'ENTER_MINIMAL_MODE',
      payload: {}
    });
  }

  // Enter disabled mode
  private enterDisabledMode(): void {
    console.log('Entering disabled mode - all features disabled');
    
    chrome.runtime.sendMessage({
      type: 'ENTER_DISABLED_MODE',
      payload: {}
    });
  }

  // Retry operation with circuit breaker
  async retry<T>(
    operation: () => Promise<T>,
    errorCode: string,
    maxRetries: number = this.config.maxRetries
  ): Promise<T> {
    if (this.isCircuitBreakerOpen(errorCode)) {
      throw new Error(`Circuit breaker open for ${errorCode}`);
    }

    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          this.openCircuitBreaker(errorCode);
          throw lastError;
        }
        
        // Wait before retry
        const delay = this.config.retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  // Load error history from storage
  private async loadErrorHistory(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['errorHistory']);
      if (result.errorHistory) {
        // Restore error counts and circuit breakers
        Object.entries(result.errorHistory.counts || {}).forEach(([code, count]) => {
          this.errorCounts.set(code, count as number);
        });
        
        Object.entries(result.errorHistory.lastErrors || {}).forEach(([code, timestamp]) => {
          this.lastErrors.set(code, timestamp as number);
        });
      }
    } catch (error) {
      console.error('Failed to load error history:', error);
    }
  }

  // Save error history to storage
  private async saveErrorHistory(): Promise<void> {
    try {
      const errorHistory = {
        counts: Object.fromEntries(this.errorCounts),
        lastErrors: Object.fromEntries(this.lastErrors),
      };
      
      await chrome.storage.local.set({ errorHistory });
    } catch (error) {
      console.error('Failed to save error history:', error);
    }
  }

  // Get error statistics
  getErrorStats(): {
    totalErrors: number;
    errorsByCode: Record<string, number>;
    circuitBreakersOpen: string[];
  } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const errorsByCode = Object.fromEntries(this.errorCounts);
    const circuitBreakersOpen = Array.from(this.circuitBreakers.entries())
      .filter(([, breaker]) => breaker.isOpen)
      .map(([code]) => code);

    return {
      totalErrors,
      errorsByCode,
      circuitBreakersOpen,
    };
  }

  // Reset error statistics
  resetErrorStats(): void {
    this.errorCounts.clear();
    this.lastErrors.clear();
    this.circuitBreakers.clear();
    this.saveErrorHistory();
  }

  // Generate event ID
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get current session ID
  private getCurrentSessionId(): string {
    return `session_${Date.now()}`;
  }

  // Update configuration
  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Cleanup
  destroy(): void {
    this.saveErrorHistory();
    this.errorCounts.clear();
    this.lastErrors.clear();
    this.circuitBreakers.clear();
  }
}

// Fallback mode manager
export class FallbackModeManager {
  private static instance: FallbackModeManager;
  private currentMode: 'normal' | 'minimal' | 'disabled' = 'normal';
  private modeListeners: Set<(mode: string) => void> = new Set();

  private constructor() {}

  static getInstance(): FallbackModeManager {
    if (!FallbackModeManager.instance) {
      FallbackModeManager.instance = new FallbackModeManager();
    }
    return FallbackModeManager.instance;
  }

  // Enter fallback mode
  enterMode(mode: 'minimal' | 'disabled'): void {
    this.currentMode = mode;
    console.log(`Entering ${mode} mode`);
    
    // Notify listeners
    this.modeListeners.forEach(listener => listener(mode));
    
    // Apply mode-specific settings
    this.applyModeSettings(mode);
  }

  // Exit fallback mode
  exitMode(): void {
    this.currentMode = 'normal';
    console.log('Exiting fallback mode - returning to normal operation');
    
    // Notify listeners
    this.modeListeners.forEach(listener => listener('normal'));
    
    // Restore normal settings
    this.restoreNormalSettings();
  }

  // Apply mode-specific settings
  private applyModeSettings(mode: 'minimal' | 'disabled'): void {
    switch (mode) {
      case 'minimal':
        // Disable resource-intensive features
        chrome.runtime.sendMessage({
          type: 'UPDATE_SETTINGS',
          payload: {
            deepguard: { fps: 1 },
            misinfo: { enableAudioTranscription: false },
          }
        });
        break;
        
      case 'disabled':
        // Disable all features
        chrome.runtime.sendMessage({
          type: 'UPDATE_SETTINGS',
          payload: {
            enableDeepGuard: false,
            enableMisinfoShield: false,
          }
        });
        break;
    }
  }

  // Restore normal settings
  private restoreNormalSettings(): void {
    chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: {
        enableDeepGuard: true,
        enableMisinfoShield: true,
        deepguard: { fps: 5 },
        misinfo: { enableAudioTranscription: true },
      }
    });
  }

  // Get current mode
  getCurrentMode(): string {
    return this.currentMode;
  }

  // Add mode change listener
  addModeListener(listener: (mode: string) => void): void {
    this.modeListeners.add(listener);
  }

  // Remove mode change listener
  removeModeListener(listener: (mode: string) => void): void {
    this.modeListeners.delete(listener);
  }
}

export default ErrorHandler;
