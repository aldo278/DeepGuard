// Privacy Compliance Framework for TrustShield

import { PrivacyConfig, SecurityEvent, TrustShieldError } from '@/types';
import TRUSTSHIELD_CONFIG from '@/lib/constants';

// Chrome extension types
declare const chrome: any;

export class PrivacyManager {
  private static instance: PrivacyManager;
  private config: PrivacyConfig;
  private consentGranted: boolean = false;
  private dataRetentionTimer: number | null = null;

  private constructor() {
    this.config = { ...TRUSTSHIELD_CONFIG.PRIVACY.DEFAULT_CONFIG };
  }

  static getInstance(): PrivacyManager {
    if (!PrivacyManager.instance) {
      PrivacyManager.instance = new PrivacyManager();
    }
    return PrivacyManager.instance;
  }

  // Initialize privacy manager with user configuration
  async initialize(config?: Partial<PrivacyConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Check if consent is required
    if (!this.consentGranted && this.config.explicitConsent) {
      await this.requestConsent();
    }

    // Start data cleanup timer
    this.startDataCleanupTimer();

    // Log initialization event
    this.logSecurityEvent({
      eventId: this.generateEventId(),
      type: 'privacy_violation',
      severity: 'low',
      timestamp: Date.now(),
      metadata: {
        action: 'privacy_manager_initialized',
        config: this.sanitizeConfig(this.config),
      },
      sessionId: this.getCurrentSessionId(),
    });
  }

  // Request user consent for data processing
  async requestConsent(): Promise<boolean> {
    return new Promise((resolve) => {
      // Send consent request to side panel
      chrome.runtime.sendMessage({
        type: 'PRIVACY_CONSENT_REQUEST',
        payload: { required: true }
      });

      // Listen for response
      const messageListener = (message: any) => {
        if (message.type === 'PRIVACY_CONSENT_RESPONSE') {
          chrome.runtime.onMessage.removeListener(messageListener);
          this.consentGranted = message.payload.granted;
          
          if (message.payload.granted) {
            this.config = { ...this.config, ...message.payload.config };
          }

          resolve(message.payload.granted);
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);

      // Timeout after 30 seconds
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageListener);
        resolve(false);
      }, 30000);
    });
  }

  // Check if biometric data processing is allowed
  canProcessBiometricData(): boolean {
    if (!this.consentGranted) return false;
    if (!this.config.gdprCompliant) return false;
    if (this.config.dataProcessingLocation !== 'on-device') return false;
    return true;
  }

  // Check if transcription data processing is allowed
  canProcessTranscriptionData(): boolean {
    if (!this.consentGranted) return false;
    return true; // Transcription is generally less sensitive
  }

  // Sanitize data before storage (remove PII, encrypt if needed)
  sanitizeData(data: any, dataType: 'biometric' | 'transcript' | 'metadata'): any {
    if (!this.config.encryptionEnabled) {
      return data;
    }

    switch (dataType) {
      case 'biometric':
        // Remove or hash any identifiable features
        return this.sanitizeBiometricData(data);
      
      case 'transcript':
        // Remove names, addresses, phone numbers, etc.
        return this.sanitizeTranscriptData(data);
      
      case 'metadata':
        // Remove any potentially sensitive metadata
        return this.sanitizeMetadata(data);
      
      default:
        return data;
    }
  }

  private sanitizeBiometricData(data: any): any {
    // Remove facial embeddings that could be used to identify individuals
    if (data.faceEmbeddings) {
      delete data.faceEmbeddings;
    }

    // Hash frame IDs to prevent reverse engineering
    if (data.frameId) {
      data.frameId = this.hashString(data.frameId);
    }

    return data;
  }

  private sanitizeTranscriptData(data: any): any {
    if (typeof data === 'string') {
      // Remove PII patterns
      return data
        .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]') // Phone numbers
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // Emails
        .replace(/\b\d{1,5}\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/gi, '[ADDRESS]'); // Addresses
    }

    return data;
  }

  private sanitizeMetadata(data: any): any {
    // Remove URLs, user agents, and other potentially identifying metadata
    const sanitized = { ...data };
    
    if (sanitized.url) {
      sanitized.url = this.hashUrl(sanitized.url);
    }

    if (sanitized.userAgent) {
      delete sanitized.userAgent;
    }

    return sanitized;
  }

  // Encrypt sensitive data
  encryptData(data: string): string {
    if (!this.config.encryptionEnabled) {
      return data;
    }

    // Simple XOR encryption for demonstration
    // In production, use proper encryption libraries
    const key = 'trustshield-encryption-key';
    return data.split('').map((char, i) => 
      String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
    ).join('');
  }

  // Decrypt sensitive data
  decryptData(encryptedData: string): string {
    if (!this.config.encryptionEnabled) {
      return encryptedData;
    }

    const key = 'trustshield-encryption-key';
    return encryptedData.split('').map((char, i) => 
      String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
    ).join('');
  }

  // Check if data should be retained based on retention policy
  shouldRetainData(dataType: 'biometric' | 'transcript' | 'metadata', timestamp: number): boolean {
    const now = Date.now();
    const retentionMs = this.getRetentionPeriod(dataType);
    
    return (now - timestamp) < retentionMs;
  }

  private getRetentionPeriod(dataType: string): number {
    switch (dataType) {
      case 'biometric':
        return this.config.biometricDataRetention * 60 * 1000; // minutes to ms
      case 'transcript':
        return this.config.transcriptRetention * 24 * 60 * 60 * 1000; // days to ms
      case 'metadata':
        return 30 * 24 * 60 * 60 * 1000; // 30 days for metadata
      default:
        return 24 * 60 * 60 * 1000; // 1 day default
    }
  }

  // Start automatic data cleanup
  private startDataCleanupTimer(): void {
    if (this.dataRetentionTimer) {
      clearInterval(this.dataRetentionTimer);
    }

    this.dataRetentionTimer = window.setInterval(() => {
      this.performDataCleanup();
    }, TRUSTSHIELD_CONFIG.PRIVACY.DATA_CLEANUP_INTERVAL);
  }

  // Perform data cleanup based on retention policies
  private async performDataCleanup(): Promise<void> {
    try {
      const now = Date.now();
      
      // Clean up old sessions
      const sessions = await this.getStoredSessions();
      const validSessions = sessions.filter(session => 
        this.shouldRetainData('metadata', session.startTime)
      );

      if (validSessions.length !== sessions.length) {
        await this.updateStoredSessions(validSessions);
      }

      // Clean up old security events
      const events = await this.getStoredSecurityEvents();
      const validEvents = events.filter(event => 
        this.shouldRetainData('metadata', event.timestamp)
      );

      if (validEvents.length !== events.length) {
        await this.updateStoredSecurityEvents(validEvents);
      }

      this.logSecurityEvent({
        eventId: this.generateEventId(),
        type: 'privacy_violation',
        severity: 'low',
        timestamp: now,
        metadata: {
          action: 'data_cleanup_completed',
          sessionsRemoved: sessions.length - validSessions.length,
          eventsRemoved: events.length - validEvents.length,
        },
        sessionId: this.getCurrentSessionId(),
      });

    } catch (error) {
      this.logError('DATA_CLEANUP_ERROR', 'Failed to perform data cleanup', error);
    }
  }

  // Generate unique event IDs
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get current session ID
  private getCurrentSessionId(): string {
    return `session_${Date.now()}`;
  }

  // Hash sensitive strings
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  // Hash URLs to preserve domain but remove specific paths
  private hashUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const pathHash = this.hashString(urlObj.pathname + urlObj.search);
      return `${domain}[${pathHash}]`;
    } catch {
      return '[INVALID_URL]';
    }
  }

  // Sanitize config for logging (remove sensitive data)
  private sanitizeConfig(config: PrivacyConfig): any {
    const sanitized = { ...config };
    // Remove any sensitive fields from config logging
    return sanitized;
  }

  // Log security events
  private logSecurityEvent(event: Omit<SecurityEvent, 'id'>): void {
    // Store security event in IndexedDB
    this.storeSecurityEvent(event);
  }

  // Log errors
  private logError(code: string, message: string, error: any): void {
    const trustShieldError: TrustShieldError = {
      code,
      message,
      severity: 'medium',
      timestamp: Date.now(),
      context: { originalError: error },
      recoverable: true,
    };

    chrome.runtime.sendMessage({
      type: 'ERROR',
      payload: trustShieldError
    });
  }

  // Storage helpers (these will be implemented with the IndexedDB wrapper)
  private async getStoredSessions(): Promise<any[]> {
    // Placeholder - will be implemented with IndexedDB
    return [];
  }

  private async updateStoredSessions(sessions: any[]): Promise<void> {
    // Placeholder - will be implemented with IndexedDB
    console.log('Updating sessions:', sessions.length);
  }

  private async getStoredSecurityEvents(): Promise<any[]> {
    // Placeholder - will be implemented with IndexedDB
    return [];
  }

  private async updateStoredSecurityEvents(events: any[]): Promise<void> {
    // Placeholder - will be implemented with IndexedDB
    console.log('Updating security events:', events.length);
  }

  private async storeSecurityEvent(event: Omit<SecurityEvent, 'id'>): Promise<void> {
    // Placeholder - will be implemented with IndexedDB
    console.log('Storing security event:', event.eventId);
  }

  // Public methods for getting current configuration
  getConfig(): PrivacyConfig {
    return { ...this.config };
  }

  isConsentGranted(): boolean {
    return this.consentGranted;
  }

  // Update configuration
  async updateConfig(newConfig: Partial<PrivacyConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // Restart cleanup timer with new settings
    this.startDataCleanupTimer();

    // Log configuration change
    this.logSecurityEvent({
      eventId: this.generateEventId(),
      type: 'privacy_violation',
      severity: 'low',
      timestamp: Date.now(),
      metadata: {
        action: 'config_updated',
        newConfig: this.sanitizeConfig(this.config),
      },
      sessionId: this.getCurrentSessionId(),
    });
  }

  // Cleanup method
  destroy(): void {
    if (this.dataRetentionTimer) {
      clearInterval(this.dataRetentionTimer);
      this.dataRetentionTimer = null;
    }
  }
}

export default PrivacyManager;
