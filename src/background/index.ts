// TrustShield Service Worker - Background Script

import { ExtensionMessage, TrustShieldSettings, SecurityEvent } from '@/types';
import TRUSTSHIELD_CONFIG from '@/lib/constants';
import PrivacyManager from '@/lib/privacy';

// Chrome extension types
declare const chrome: any;

class TrustShieldServiceWorker {
  private static instance: TrustShieldServiceWorker;
  private privacyManager: PrivacyManager;
  private settings: TrustShieldSettings;
  private activeSessions: Map<string, any> = new Map();
  private messageHandlers: Map<string, Function> = new Map();

  private constructor() {
    this.privacyManager = PrivacyManager.getInstance();
    this.settings = this.getDefaultSettings();
    this.initializeMessageHandlers();
    this.setupEventListeners();
  }

  static getInstance(): TrustShieldServiceWorker {
    if (!TrustShieldServiceWorker.instance) {
      TrustShieldServiceWorker.instance = new TrustShieldServiceWorker();
    }
    return TrustShieldServiceWorker.instance;
  }

  // Initialize the service worker
  async initialize(): Promise<void> {
    try {
      // Load settings from storage
      await this.loadSettings();
      
      // Initialize privacy manager
      await this.privacyManager.initialize(this.settings.privacy);
      
      // Set up extension click handler
      this.setupExtensionClick();
      
      // Set up side panel
      this.setupSidePanel();
      
      console.log('TrustShield service worker initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize TrustShield service worker:', error);
      this.logError('SERVICE_WORKER_INIT_ERROR', 'Service worker initialization failed', error);
    }
  }

  // Get default settings
  private getDefaultSettings(): TrustShieldSettings {
    return {
      enableDeepGuard: true,
      enableMisinfoShield: true,
      
      deepguard: {
        fps: TRUSTSHIELD_CONFIG.MODELS.DEEPFAKE.FRAME_RATE,
        ambiguityGateMin: TRUSTSHIELD_CONFIG.MODELS.DEEPFAKE.AMBIGUITY_GATE_MIN,
        ambiguityGateMax: TRUSTSHIELD_CONFIG.MODELS.DEEPFAKE.AMBIGUITY_GATE_MAX,
        confidenceThreshold: TRUSTSHIELD_CONFIG.MODELS.DEEPFAKE.CONFIDENCE_THRESHOLD,
        enableVoiceAnalysis: false,
      },
      
      misinfo: {
        claimBusterThreshold: 0.5,
        factCheckThreshold: 0.8,
        enableAudioTranscription: true,
        enableTextAnalysis: true,
        transcriptionLanguage: 'en-US',
      },
      
      privacy: TRUSTSHIELD_CONFIG.PRIVACY.DEFAULT_CONFIG,
      
      ui: {
        theme: 'system',
        showNotifications: true,
        showOverlays: true,
        compactMode: false,
      },
      
      advanced: {
        debugMode: false,
        logLevel: 'info',
        enableTelemetry: false,
        maxSessionDuration: TRUSTSHIELD_CONFIG.PRIVACY.MAX_SESSION_DURATION,
      },
    };
  }

  // Load settings from Chrome storage
  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(TRUSTSHIELD_CONFIG.STORAGE.SETTINGS);
      if (result[TRUSTSHIELD_CONFIG.STORAGE.SETTINGS]) {
        this.settings = { ...this.settings, ...result[TRUSTSHIELD_CONFIG.STORAGE.SETTINGS] };
      }
    } catch (error) {
      console.warn('Failed to load settings from storage:', error);
    }
  }

  // Save settings to Chrome storage
  private async saveSettings(): Promise<void> {
    try {
      await chrome.storage.sync.set({
        [TRUSTSHIELD_CONFIG.STORAGE.SETTINGS]: this.settings
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.logError('SETTINGS_SAVE_ERROR', 'Failed to save settings', error);
    }
  }

  // Initialize message handlers
  private initializeMessageHandlers(): void {
    this.messageHandlers.set('PAGE_DETECTED', this.handlePageDetected.bind(this));
    this.messageHandlers.set('DEEPFAKE_VERDICT', this.handleDeepfakeVerdict.bind(this));
    this.messageHandlers.set('CLAIM_VERDICT', this.handleClaimVerdict.bind(this));
    this.messageHandlers.set('SESSION_START', this.handleSessionStart.bind(this));
    this.messageHandlers.set('SESSION_END', this.handleSessionEnd.bind(this));
    this.messageHandlers.set('PERFORMANCE_UPDATE', this.handlePerformanceUpdate.bind(this));
    this.messageHandlers.set('SECURITY_EVENT', this.handleSecurityEvent.bind(this));
    this.messageHandlers.set('ERROR', this.handleError.bind(this));
    this.messageHandlers.set('SETTINGS_UPDATE', this.handleSettingsUpdate.bind(this));
    this.messageHandlers.set('PRIVACY_CONSENT_RESPONSE', this.handlePrivacyConsentResponse.bind(this));
    this.messageHandlers.set('GET_API_KEY', this.handleGetApiKey.bind(this));
    this.messageHandlers.set('CLAIM_LLM_REQUEST', this.handleClaimLLMRequest.bind(this));
    
    // Reality Defender API proxy handlers (bypass CORS)
    this.messageHandlers.set('RD_GET_PRESIGNED_URL', this.handleRDGetPresignedUrl.bind(this));
    this.messageHandlers.set('RD_UPLOAD_VIDEO', this.handleRDUploadVideo.bind(this));
    this.messageHandlers.set('RD_UPLOAD_IMAGE', this.handleRDUploadImage.bind(this));
    this.messageHandlers.set('RD_GET_RESULTS', this.handleRDGetResults.bind(this));
  }

  // Set up event listeners
  private setupEventListeners(): void {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener(this.handleInstall.bind(this));
    
    // Handle messages from content scripts and side panel
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Handle extension click
    chrome.action.onClicked.addListener(this.handleActionClick.bind(this));
    
    // Handle tab updates for page type detection
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
  }

  // Handle extension installation
  private async handleInstall(details: any): Promise<void> {
    if (details.reason === 'install') {
      // Set default settings
      await this.saveSettings();
      
      // Open welcome page
      chrome.tabs.create({
        url: chrome.runtime.getURL('src/panel/welcome.html')
      });
      
      console.log('TrustShield installed successfully');
    } else if (details.reason === 'update') {
      console.log('TrustShield updated to version', TRUSTSHIELD_CONFIG.VERSION);
    }
  }

  // Handle messages from content scripts and side panel
  private handleMessage(
    message: ExtensionMessage,
    sender: any,
    sendResponse: Function
  ): boolean {
    const handler = this.messageHandlers.get(message.type);
    
    if (handler) {
      // Handle async - must return true to keep sendResponse valid
      handler(message.payload, sender, sendResponse).catch((error: any) => {
        console.error(`Error handling message type ${message.type}:`, error);
        this.logError('MESSAGE_HANDLER_ERROR', `Failed to handle ${message.type}`, error);
        sendResponse({ error: error.message });
      });
      return true; // Keep channel open for async response
    } else {
      console.warn('Unknown message type:', message.type);
      return false;
    }
  }

  // Handle extension action click
  private handleActionClick(tab: any): void {
    // Open side panel
    chrome.sidePanel.open({ tabId: tab.id });
  }

  // Handle tab updates
  private handleTabUpdate(tabId: number, changeInfo: any, tab: any): void {
    if (changeInfo.status === 'complete' && tab.url) {
      // Notify content script of page change
      chrome.tabs.sendMessage(tabId, {
        type: 'PAGE_UPDATED',
        payload: { url: tab.url }
      });
    }
  }

  // Set up extension click handler
  private setupExtensionClick(): void {
    // Already handled by handleActionClick
  }

  // Set up side panel
  private setupSidePanel(): void {
    // Side panel configuration is in manifest.json
  }

  // Message handlers
  private async handlePageDetected(payload: any, sender: any, sendResponse: Function): Promise<void> {
    const { pageType, platform } = payload;
    
    // Store page info in session
    const sessionId = this.generateSessionId();
    const sessionData = {
      sessionId,
      pageType,
      platform,
      url: sender.tab?.url || '',
      startTime: Date.now(),
    };
    
    this.activeSessions.set(sessionId, sessionData);
    
    // Notify side panel
    this.broadcastToSidePanel({
      type: 'PAGE_DETECTED',
      payload: sessionData
    });
    
    sendResponse({ success: true, sessionId });
  }

  private async handleDeepfakeVerdict(payload: any, sender: any, sendResponse: Function): Promise<void> {
    // Store verdict and notify side panel
    this.broadcastToSidePanel({
      type: 'DEEPFAKE_VERDICT',
      payload
    });
    
    sendResponse({ success: true });
  }

  private async handleClaimVerdict(payload: any, sender: any, sendResponse: Function): Promise<void> {
    // Store verdict and notify side panel
    this.broadcastToSidePanel({
      type: 'CLAIM_VERDICT',
      payload
    });
    
    sendResponse({ success: true });
  }

  private async handleSessionStart(payload: any, sender: any, sendResponse: Function): Promise<void> {
    const { sessionId, mode } = payload;
    
    // Update session
    if (this.activeSessions.has(sessionId)) {
      const session = this.activeSessions.get(sessionId);
      session.mode = mode;
      session.startTime = Date.now();
    }
    
    sendResponse({ success: true });
  }

  private async handleSessionEnd(payload: any, sender: any, sendResponse: Function): Promise<void> {
    const { sessionId } = payload;
    
    // Remove from active sessions
    this.activeSessions.delete(sessionId);
    
    sendResponse({ success: true });
  }

  private async handlePerformanceUpdate(payload: any, sender: any, sendResponse: Function): Promise<void> {
    // Store performance metrics
    this.broadcastToSidePanel({
      type: 'PERFORMANCE_UPDATE',
      payload
    });
    
    sendResponse({ success: true });
  }

  private async handleSecurityEvent(payload: SecurityEvent, sender: any, sendResponse: Function): Promise<void> {
    // Store security event
    this.broadcastToSidePanel({
      type: 'SECURITY_EVENT',
      payload
    });
    
    sendResponse({ success: true });
  }

  private async handleError(payload: any, sender: any, sendResponse: Function): Promise<void> {
    // Log error and notify side panel
    console.error('TrustShield error:', payload);
    this.broadcastToSidePanel({
      type: 'ERROR',
      payload
    });
    
    sendResponse({ success: true });
  }

  private async handleSettingsUpdate(payload: Partial<TrustShieldSettings>, sender: any, sendResponse: Function): Promise<void> {
    // Update settings
    this.settings = { ...this.settings, ...payload };
    await this.saveSettings();
    
    // Update privacy manager if privacy settings changed
    if (payload.privacy) {
      await this.privacyManager.updateConfig(payload.privacy);
    }
    
    // Broadcast to all content scripts
    this.broadcastToContentScripts({
      type: 'SETTINGS_UPDATE',
      payload
    });
    
    sendResponse({ success: true });
  }

  private async handlePrivacyConsentResponse(payload: any, sender: any, sendResponse: Function): Promise<void> {
    const { granted, config } = payload;
    
    // Update privacy manager
    if (granted) {
      await this.privacyManager.updateConfig(config);
    }
    
    sendResponse({ success: true });
  }

  private async handleGetApiKey(payload: any, sender: any, sendResponse: Function): Promise<void> {
    // Return the API key from environment (embedded at build time)
    const apiKey = (import.meta as any).env?.VITE_OPENROUTER_API_KEY || '';
    sendResponse({ apiKey });
  }

  // Reality Defender API proxy handlers (bypass CORS from content scripts)
  private async handleRDGetPresignedUrl(payload: any, sender: any, sendResponse: Function): Promise<void> {
    try {
      const apiKey = (import.meta as any).env?.VITE_REALITYDEFENDER_API_KEY || '';
      const { fileName } = payload;
      
      console.log('🔑 Requesting presigned URL for:', fileName);
      console.log('🔑 API Key present:', !!apiKey);
      
      const response = await fetch('https://api.prd.realitydefender.xyz/api/files/aws-presigned', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName }),
      });

      console.log('🔑 Presigned URL response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔑 Presigned URL error:', errorText);
        sendResponse({ error: `Failed to get presigned URL: ${response.status} - ${errorText}` });
        return;
      }

      const data = await response.json();
      console.log('🔑 Full API response keys:', Object.keys(data));
      
      // Reality Defender API returns presigned URL nested under response.signedUrl
      const presignedUrl = data.response?.signedUrl || 
                          data.presignedUrl || data.presigned_url || 
                          data.url || data.signedUrl || 
                          data.signed_url || data.uploadUrl || data.upload_url || 
                          data.s3Url || data.s3_url;
      const requestId = data.requestId || data.request_id || data.id || data.mediaId || data.media_id;
      
      console.log('🔑 Extracted presigned URL:', presignedUrl ? presignedUrl.substring(0, 100) + '...' : 'NONE FOUND');
      console.log('🔑 Extracted Request ID:', requestId);
      
      if (!presignedUrl) {
        console.error('🔑 ERROR: Could not find presigned URL in response. Available keys:', Object.keys(data));
        sendResponse({ error: `No presigned URL in response. Keys: ${Object.keys(data).join(', ')}` });
        return;
      }
      
      sendResponse({ success: true, presignedUrl, requestId });
    } catch (error) {
      console.error('🔑 Presigned URL exception:', error);
      sendResponse({ error: `Presigned URL request failed: ${error}` });
    }
  }

  private async handleRDUploadVideo(payload: any, sender: any, sendResponse: Function): Promise<void> {
    try {
      const { presignedUrl, videoData } = payload;
      
      // Convert base64 back to blob
      const binaryString = atob(videoData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'video/webm' });

      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: blob,
      });

      if (!response.ok) {
        sendResponse({ error: `Failed to upload video: ${response.status}` });
        return;
      }

      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ error: `Video upload failed: ${error}` });
    }
  }

  private async handleRDUploadImage(payload: any, sender: any, sendResponse: Function): Promise<void> {
    try {
      const { presignedUrl, imageData } = payload;
      
      console.log('📤 Uploading image to presigned URL:', presignedUrl?.substring(0, 100) + '...');
      console.log('📤 Image data length:', imageData?.length);
      
      if (!presignedUrl) {
        sendResponse({ error: 'No presigned URL provided' });
        return;
      }
      
      if (!imageData) {
        sendResponse({ error: 'No image data provided' });
        return;
      }
      
      // Convert base64 back to blob
      const binaryString = atob(imageData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      
      console.log('📤 Blob size:', blob.size, 'bytes');

      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': 'image/jpeg',
        },
      });

      console.log('📤 Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('📤 Upload error:', errorText);
        sendResponse({ error: `Failed to upload image: ${response.status} - ${errorText}` });
        return;
      }

      sendResponse({ success: true });
    } catch (error) {
      console.error('📤 Upload exception:', error);
      sendResponse({ error: `Image upload failed: ${error}` });
    }
  }

  private async handleRDGetResults(payload: any, sender: any, sendResponse: Function): Promise<void> {
    try {
      const apiKey = (import.meta as any).env?.VITE_REALITYDEFENDER_API_KEY || '';
      const { requestId } = payload;
      
      const response = await fetch(`https://api.prd.realitydefender.xyz/api/media/users/${requestId}`, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          sendResponse({ success: true, status: 'PROCESSING' });
          return;
        }
        sendResponse({ error: `Failed to get results: ${response.status}` });
        return;
      }

      const data = await response.json();
      sendResponse({ success: true, data });
    } catch (error) {
      sendResponse({ error: `Get results failed: ${error}` });
    }
  }

  private async handleClaimLLMRequest(payload: any, sender: any, sendResponse: Function): Promise<void> {
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const apiKey = (import.meta as any).env?.VITE_OPENROUTER_API_KEY || '';
        const { claimText, claimId, context, factCheckResult } = payload;

        if (!apiKey) {
          sendResponse({ error: 'OpenRouter API key not configured' });
          return;
        }

        // Build prompt with Google Fact Check context if available
        let systemPrompt = 'You are a fact-checking assistant. Analyze claims for accuracy and provide verdicts.';
        let userPrompt = `Claim: "${claimText}"`;

        if (factCheckResult && factCheckResult.claimReview && factCheckResult.claimReview.length > 0) {
          const review = factCheckResult.claimReview[0];
          userPrompt += `\n\nGoogle Fact Check Result:\n- Publisher: ${review.publisher.name}\n- Rating: ${review.textualRating}\n- URL: ${review.url}\n\nConsider this fact check result in your analysis, but provide your own independent assessment.`;
        } else {
          userPrompt += '\n\nNo external fact check results available. Provide your analysis based on the claim text.';
        }

        const response = await fetch(TRUSTSHIELD_CONFIG.API.OPENROUTER, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: TRUSTSHIELD_CONFIG.MODELS.LLM.MODEL_NAME,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: TRUSTSHIELD_CONFIG.MODELS.LLM.MAX_TOKENS.TEXT,
            temperature: TRUSTSHIELD_CONFIG.MODELS.LLM.TEMPERATURE,
          }),
        });

        // Retry on 502 Bad Gateway or 5xx errors
        if (!response.ok && (response.status === 502 || response.status >= 500)) {
          console.warn(`OpenRouter API error ${response.status}, retrying (${attempt + 1}/${maxRetries})...`);
          lastError = `OpenRouter API error: ${response.status}`;
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
            continue;
          }
        }

        if (!response.ok) {
          sendResponse({ error: `OpenRouter API error: ${response.status}` });
          return;
        }

        const data = await response.json();
        const llmResponse = data.choices[0]?.message?.content || '';

        // Parse LLM response for verdict
        const verdict = this.parseLLMVerdict(llmResponse);

        sendResponse({
          success: true,
          claimId,
          llmResponse,
          verdict,
          factCheckResult: factCheckResult || null,
        });

        return; // Success, exit retry loop

      } catch (error) {
        console.error(`LLM request attempt ${attempt + 1} failed:`, error);
        lastError = error;
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
          continue;
        }
      }
    }

    // All retries failed
    console.error('LLM request failed after retries:', lastError);
    sendResponse({ error: `LLM request failed after ${maxRetries} retries: ${lastError}` });
  }

  private parseLLMVerdict(response: string): 'true' | 'false' | 'disputed' | 'unverifiable' {
    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('true') || lowerResponse.includes('accurate') || lowerResponse.includes('correct') || lowerResponse.includes('verified')) {
      return 'true';
    } else if (lowerResponse.includes('false') || lowerResponse.includes('inaccurate') || lowerResponse.includes('incorrect') || lowerResponse.includes('misleading')) {
      return 'false';
    } else if (lowerResponse.includes('disputed') || lowerResponse.includes('debate') || lowerResponse.includes('controversial') || lowerResponse.includes('uncertain')) {
      return 'disputed';
    } else {
      return 'unverifiable';
    }
  }

  // Utility methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private broadcastToSidePanel(message: ExtensionMessage): void {
    // Send to side panel
    chrome.runtime.sendMessage(message).catch(() => {
      // Side panel might not be open, ignore error
    });
  }

  private broadcastToContentScripts(message: ExtensionMessage): void {
    // Send to all content scripts
    chrome.tabs.query({}, (tabs: any[]) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Content script might not be loaded, ignore error
        });
      });
    });
  }

  private logError(code: string, message: string, error: any): void {
    const errorPayload = {
      code,
      message,
      severity: 'medium' as const,
      timestamp: Date.now(),
      context: { originalError: error },
      recoverable: true,
    };

    this.broadcastToSidePanel({
      type: 'ERROR',
      payload: errorPayload
    });
  }

  // Public methods
  getSettings(): TrustShieldSettings {
    return { ...this.settings };
  }

  async updateSettings(newSettings: Partial<TrustShieldSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();
  }

  getPrivacyManager(): PrivacyManager {
    return this.privacyManager;
  }

  getActiveSessions(): Map<string, any> {
    return new Map(this.activeSessions);
  }
}

// Initialize service worker
const serviceWorker = TrustShieldServiceWorker.getInstance();
serviceWorker.initialize();

// Export for testing
export default TrustShieldServiceWorker;
