// Content Script Entry Point - Page Detection and Shield Initialization

import { PageType, Platform, ExtensionMessage } from '@/types';
import TRUSTSHIELD_CONFIG from '@/lib/constants';

// Chrome extension types
declare const chrome: any;

class ContentScriptManager {
  private static instance: ContentScriptManager;
  private pageType: PageType = 'other';
  private platform: Platform = 'other';
  private sessionId: string | null = null;
  private deepGuardActive: boolean = false;
  private misinfoShieldActive: boolean = false;
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): ContentScriptManager {
    if (!ContentScriptManager.instance) {
      ContentScriptManager.instance = new ContentScriptManager();
    }
    return ContentScriptManager.instance;
  }

  // Initialize the content script
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Detect page type and platform
      await this.detectPageType();
      
      // Initialize appropriate shields
      await this.initializeShields();
      
      // Notify background script
      await this.notifyBackgroundScript();
      
      // Set up message listeners
      this.setupMessageListeners();
      
      // Set up page change observers
      this.setupPageObservers();
      
      this.initialized = true;
      console.log(`TrustShield initialized for ${this.pageType} on ${this.platform}`);
      
    } catch (error) {
      console.error('Failed to initialize TrustShield content script:', error);
      this.sendError('CONTENT_SCRIPT_INIT_ERROR', 'Content script initialization failed', error);
    }
  }

  // Detect page type and platform
  private async detectPageType(): Promise<void> {
    const url = window.location.href;
    
    // Check for live call platforms
    if (TRUSTSHIELD_CONFIG.PLATFORMS.GOOGLE_MEET.URL_PATTERN.test(url)) {
      this.pageType = 'live-call';
      this.platform = 'meet';
    } else if (TRUSTSHIELD_CONFIG.PLATFORMS.ZOOM.URL_PATTERN.test(url)) {
      this.pageType = 'live-call';
      this.platform = 'zoom';
    } else if (TRUSTSHIELD_CONFIG.PLATFORMS.TEAMS.URL_PATTERN.test(url)) {
      this.pageType = 'live-call';
      this.platform = 'teams';
    } else if (TRUSTSHIELD_CONFIG.PLATFORMS.YOUTUBE.URL_PATTERN.test(url)) {
      this.pageType = 'embedded-video';
      this.platform = 'youtube';
    } else {
      // Check if it's a video page with embedded video
      const hasVideo = document.querySelector('video');
      if (hasVideo) {
        this.pageType = 'embedded-video';
        this.platform = 'other';
      } else {
        this.pageType = 'article';
        this.platform = 'other';
      }
    }

    console.log(`Detected page type: ${this.pageType}, platform: ${this.platform}`);
  }

  // Initialize appropriate shields based on page type
  private async initializeShields(): Promise<void> {
    // Get current settings
    const settings = await this.getSettings();
    
    // Initialize DeepGuard for live calls
    if (this.pageType === 'live-call' && settings.enableDeepGuard) {
      await this.initializeDeepGuard();
    }
    
    // Initialize MisinfoShield for all page types
    if (settings.enableMisinfoShield) {
      await this.initializeMisinfoShield();
    }
  }

  // Initialize DeepGuard
  private async initializeDeepGuard(): Promise<void> {
    try {
      // Import and initialize DeepGuard
      const { DeepGuard } = await import('./deepguard');
      const deepGuard = DeepGuard.getInstance();
      await deepGuard.initialize(this.platform);
      this.deepGuardActive = true;
      console.log('DeepGuard initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DeepGuard:', error);
      this.sendError('DEEPGUARD_INIT_ERROR', 'DeepGuard initialization failed', error);
    }
  }

  // Initialize MisinfoShield
  private async initializeMisinfoShield(): Promise<void> {
    try {
      // Import and initialize MisinfoShield
      const { MisinfoShield } = await import('./misinfo');
      const misinfoShield = MisinfoShield.getInstance();
      await misinfoShield.initialize(this.pageType, this.platform);
      this.misinfoShieldActive = true;
      console.log('MisinfoShield initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MisinfoShield:', error);
      this.sendError('MISINFO_INIT_ERROR', 'MisinfoShield initialization failed', error);
    }
  }

  // Notify background script of page detection
  private async notifyBackgroundScript(): Promise<void> {
    this.sessionId = this.generateSessionId();
    
    const message: ExtensionMessage = {
      type: 'PAGE_DETECTED',
      payload: {
        pageType: this.pageType,
        platform: this.platform,
      }
    };

    chrome.runtime.sendMessage(message, (response: any) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to notify background script:', chrome.runtime.lastError);
      } else {
        console.log('Background script notified successfully');
      }
    });
  }

  // Setup message listeners
  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender: any, sendResponse: Function) => {
      this.handleMessage(message, sender, sendResponse);
    });
  }

  // Handle messages from background script
  private async handleMessage(message: ExtensionMessage, sender: any, sendResponse: Function): Promise<void> {
    switch (message.type) {
      case 'PAGE_UPDATED':
        // Page URL changed, re-detect
        await this.detectPageType();
        await this.initializeShields();
        await this.notifyBackgroundScript();
        break;
        
      case 'SETTINGS_UPDATE':
        // Settings updated, re-initialize shields
        await this.initializeShields();
        break;
        
      case 'SESSION_START':
        // Session started
        this.sessionId = message.payload.sessionId;
        break;
        
      case 'SESSION_END':
        // Session ended
        this.sessionId = null;
        break;
        
      default:
        console.log('Content script received message:', message);
    }
    
    sendResponse({ success: true });
  }

  // Setup page change observers
  private setupPageObservers(): void {
    // Observe DOM changes for dynamic content
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check for new video elements or content changes
          this.checkForContentChanges();
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Listen for URL changes (SPA navigation)
    let currentUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.handleUrlChange();
      }
    });

    urlObserver.observe(document, {
      subtree: true,
      childList: true,
    });
  }

  // Check for content changes that might need shield activation
  private checkForContentChanges(): void {
    // Check for new video elements
    const videos = document.querySelectorAll('video');
    if (videos.length > 0 && this.pageType === 'article') {
      // Page now has video, switch to embedded-video mode
      this.pageType = 'embedded-video';
      this.initializeShields();
    }

    // Check for new text content for MisinfoShield
    if (this.misinfoShieldActive) {
      this.notifyMisinfoShieldOfContentChange();
    }
  }

  // Handle URL changes
  private handleUrlChange(): void {
    console.log('URL changed, re-detecting page type');
    this.detectPageType().then(() => {
      this.initializeShields();
      this.notifyBackgroundScript();
    });
  }

  // Notify MisinfoShield of content changes
  private notifyMisinfoShieldOfContentChange(): void {
    // This will be implemented when MisinfoShield is created
    console.log('Content change detected, notifying MisinfoShield');
  }

  // Get settings from storage
  private async getSettings(): Promise<any> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(TRUSTSHIELD_CONFIG.STORAGE.SETTINGS, (result: any) => {
        resolve(result[TRUSTSHIELD_CONFIG.STORAGE.SETTINGS] || {});
      });
    });
  }

  // Generate session ID
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Send error to background script
  private sendError(code: string, message: string, error: any): void {
    const errorMessage = {
      type: 'ERROR',
      payload: {
        code,
        message,
        severity: 'medium',
        timestamp: Date.now(),
        context: { originalError: error },
        recoverable: true,
      }
    };

    chrome.runtime.sendMessage(errorMessage);
  }

  // Public methods
  getPageType(): PageType {
    return this.pageType;
  }

  getPlatform(): Platform {
    return this.platform;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  isDeepGuardActive(): boolean {
    return this.deepGuardActive;
  }

  isMisinfoShieldActive(): boolean {
    return this.misinfoShieldActive;
  }

  // Cleanup method
  destroy(): void {
    // Cleanup any resources
    console.log('Content script destroyed');
  }
}

// Initialize the content script
const contentScript = ContentScriptManager.getInstance();

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    contentScript.initialize();
  });
} else {
  contentScript.initialize();
}

// Export for testing
export default ContentScriptManager;
