// MisinfoShield - Real-time Misinformation Detection

import { PageType, Platform, Claim, ClaimVerdict, ExtensionMessage } from '@/types';
import TRUSTSHIELD_CONFIG from '@/lib/constants';
import ENV from '@/lib/env';

// Chrome extension types
declare const chrome: any;

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface MisinfoShieldConfig {
  claimBusterThreshold: number;
  factCheckThreshold: number;
  enableAudioTranscription: boolean;
  enableTextAnalysis: boolean;
  transcriptionLanguage: string;
}

export class MisinfoShield {
  private static instance: MisinfoShield;
  private pageType: PageType = 'other';
  private platform: Platform = 'other';
  private config: MisinfoShieldConfig;
  private isActive: boolean = false;
  private speechRecognition: any = null;
  private textObserver: MutationObserver | null = null;
  private claimsBuffer: Claim[] = [];
  private transcriptBuffer: string[] = [];
  private isTranscribing: boolean = false;
  private sessionId: string | null = null;

  private constructor() {
    this.config = {
      claimBusterThreshold: 0.5,
      factCheckThreshold: 0.8,
      enableAudioTranscription: true,
      enableTextAnalysis: true,
      transcriptionLanguage: 'en-US',
    };
  }

  static getInstance(): MisinfoShield {
    if (!MisinfoShield.instance) {
      MisinfoShield.instance = new MisinfoShield();
    }
    return MisinfoShield.instance;
  }

  // Initialize MisinfoShield
  async initialize(pageType: PageType, platform: Platform): Promise<void> {
    this.pageType = pageType;
    this.platform = platform;
    this.sessionId = `misinfo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Load settings
      await this.loadSettings();
      
      // Initialize based on page type
      switch (pageType) {
        case 'live-call':
          await this.initializeForLiveCall();
          break;
        case 'embedded-video':
          await this.initializeForVideo();
          break;
        case 'article':
          await this.initializeForArticle();
          break;
        default:
          await this.initializeForArticle();
      }
      
      this.isActive = true;
      console.log(`MisinfoShield initialized for ${pageType} on ${platform}`);
      
    } catch (error) {
      console.error('Failed to initialize MisinfoShield:', error);
      this.sendError('MISINFO_INIT_ERROR', 'MisinfoShield initialization failed', error);
    }
  }

  // Load settings from storage
  private async loadSettings(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(TRUSTSHIELD_CONFIG.STORAGE.SETTINGS, (result: any) => {
        const settings = result[TRUSTSHIELD_CONFIG.STORAGE.SETTINGS];
        if (settings && settings.misinfo) {
          this.config = { ...this.config, ...settings.misinfo };
        }
        resolve();
      });
    });
  }

  // Initialize for live calls
  private async initializeForLiveCall(): Promise<void> {
    if (this.config.enableAudioTranscription) {
      await this.initializeSpeechRecognition();
    }
  }

  // Initialize for embedded videos
  private async initializeForVideo(): Promise<void> {
    if (this.config.enableAudioTranscription) {
      await this.initializeVideoAudioCapture();
    }
    
    // Also check for subtitles/captions
    this.initializeSubtitleMonitoring();
  }

  // Initialize for articles
  private async initializeForArticle(): Promise<void> {
    if (this.config.enableTextAnalysis) {
      this.initializeTextMonitoring();
    }
  }

  // Initialize speech recognition
  private async initializeSpeechRecognition(): Promise<void> {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.warn('Speech recognition not supported');
        return;
      }

      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;
      this.speechRecognition.lang = this.config.transcriptionLanguage;

      this.speechRecognition.onresult = (event: any) => {
        this.handleSpeechResult(event);
      };

      this.speechRecognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        this.sendError('SPEECH_RECOGNITION_ERROR', 'Speech recognition failed', event.error);
      };

      this.speechRecognition.onend = () => {
        // Restart recognition if still active
        if (this.isActive && this.config.enableAudioTranscription) {
          setTimeout(() => {
            this.startSpeechRecognition();
          }, 1000);
        }
      };

      this.startSpeechRecognition();
      
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      this.sendError('SPEECH_INIT_ERROR', 'Speech recognition initialization failed', error);
    }
  }

  // Start speech recognition
  private startSpeechRecognition(): void {
    if (this.speechRecognition && !this.isTranscribing) {
      try {
        this.speechRecognition.start();
        this.isTranscribing = true;
        console.log('Speech recognition started');
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }
    }
  }

  // Handle speech recognition results
  private handleSpeechResult(event: any): void {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      this.processTranscript(finalTranscript.trim());
    }

    // Send interim transcript to side panel for live display
    if (interimTranscript || finalTranscript) {
      this.sendTranscriptUpdate(interimTranscript || finalTranscript);
    }
  }

  // Initialize video audio capture
  private async initializeVideoAudioCapture(): Promise<void> {
    try {
      const videos = document.querySelectorAll('video');
      
      videos.forEach(video => {
        // Try to capture audio from video element
        this.captureVideoAudio(video);
      });
      
      // Monitor for new video elements
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.tagName === 'VIDEO') {
                this.captureVideoAudio(element as HTMLVideoElement);
              }
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
      
    } catch (error) {
      console.error('Failed to initialize video audio capture:', error);
      this.sendError('VIDEO_AUDIO_ERROR', 'Video audio capture failed', error);
    }
  }

  // Capture audio from video element
  private captureVideoAudio(video: HTMLVideoElement): void {
    try {
      // Create audio context from video element
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaElementSource(video);
      const analyzer = audioContext.createAnalyser();
      
      source.connect(analyzer);
      analyzer.connect(audioContext.destination);
      
      // For now, we'll use the same speech recognition
      // In a real implementation, you'd process the audio stream directly
      console.log('Audio capture setup for video:', video.src);
      
    } catch (error) {
      console.error('Failed to capture video audio:', error);
    }
  }

  // Initialize subtitle monitoring
  private initializeSubtitleMonitoring(): void {
    const videos = document.querySelectorAll('video');
    
    videos.forEach(video => {
      const tracks = video.textTracks;
      
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (track.kind === 'subtitles' || track.kind === 'captions') {
          track.addEventListener('cuechange', () => {
            this.handleSubtitleChange(track);
          });
        }
      }
    });
  }

  // Handle subtitle changes
  private handleSubtitleChange(track: TextTrack): void {
    const activeCues = track.activeCues;
    
    if (activeCues && activeCues.length > 0) {
      for (let i = 0; i < activeCues.length; i++) {
        const cue = activeCues[i] as VTTCue;
        this.processTranscript(cue.text.trim());
      }
    }
  }

  // Initialize text monitoring
  private initializeTextMonitoring(): void {
    this.textObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            this.processTextElement(element);
          }
        });
      });
    });

    // Process existing content
    this.processExistingText();

    // Observe body for changes
    this.textObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Process existing text content
  private processExistingText(): void {
    const paragraphs = document.querySelectorAll('p, div, article, section');
    paragraphs.forEach(element => {
      this.processTextElement(element);
    });
  }

  // Process text element for claims
  private processTextElement(element: Element): void {
    const text = element.textContent?.trim();
    if (text && text.length > 50) { // Only process substantial text
      this.processTranscript(text);
    }
  }

  // Process transcript/text for claims
  private async processTranscript(text: string): Promise<void> {
    try {
      // Split into sentences
      const sentences = this.splitIntoSentences(text);
      
      // Process each sentence as a potential claim
      for (const sentence of sentences) {
        if (sentence.length > 20) { // Only process meaningful sentences
          const claim: Claim = {
            claimId: this.generateClaimId(),
            text: sentence,
            source: this.pageType === 'article' ? 'article' : 'transcript',
            checkWorthiness: 0, // Will be set by ClaimBuster
            timestamp: Date.now(),
          };

          // Check claim worthiness
          await this.checkClaimWorthiness(claim);
        }
      }
      
    } catch (error) {
      console.error('Failed to process transcript:', error);
      this.sendError('TRANSCRIPT_PROCESS_ERROR', 'Transcript processing failed', error);
    }
  }

  // Split text into sentences
  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0);
  }

  // Check claim worthiness using ClaimBuster
  private async checkClaimWorthiness(claim: Claim): Promise<void> {
    try {
      // Call ClaimBuster API
      const response = await fetch(TRUSTSHIELD_CONFIG.API.CLAIMBUSTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: claim.text,
        }),
      });

      if (!response.ok) {
        throw new Error(`ClaimBuster API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        claim.checkWorthiness = data.results[0].score;
        
        // If worth checking, proceed to fact-check
        if (claim.checkWorthiness >= this.config.claimBusterThreshold) {
          this.claimsBuffer.push(claim);
          await this.factCheckClaim(claim);
        }
      } else {
        // No results, still escalate to LLM for analysis
        this.claimsBuffer.push(claim);
        await this.escalateClaimToLLM(claim);
      }
      
    } catch (error) {
      console.error('Failed to check claim worthiness:', error);
      // On error, still escalate to LLM as fallback
      this.claimsBuffer.push(claim);
      await this.escalateClaimToLLM(claim);
      this.sendError('CLAIM_WORTHINESS_ERROR', 'Claim worthiness check failed, escalating to LLM', error);
    }
  }

  // Fact check claim using Google Fact Check Tools
  private async factCheckClaim(claim: Claim): Promise<void> {
    let factCheckResult: any = null;
    
    // Try Google Fact Check if API key is available
    if (ENV.GOOGLE_FACT_CHECK_API_KEY) {
      try {
        const response = await fetch(`${TRUSTSHIELD_CONFIG.API.GOOGLE_FACT_CHECK}?query=${encodeURIComponent(claim.text)}&languageCode=en&key=${ENV.GOOGLE_FACT_CHECK_API_KEY}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.claims && data.claims.length > 0) {
            factCheckResult = data.claims[0];
          }
        }
      } catch (error) {
        console.error('Google Fact Check API error:', error);
      }
    } else {
      console.warn('Google Fact Check API key not configured');
    }

    // Always escalate to LLM for additional analysis
    // This provides comprehensive analysis using both sources
    await this.escalateClaimToLLM(claim, factCheckResult);
  }

  // Map fact check rating to verdict
  private mapFactCheckToVerdict(rating: string): 'true' | 'false' | 'disputed' | 'unverifiable' {
    const lowerRating = rating.toLowerCase();
    
    if (lowerRating.includes('true') || lowerRating.includes('accurate') || lowerRating.includes('correct')) {
      return 'true';
    } else if (lowerRating.includes('false') || lowerRating.includes('inaccurate') || lowerRating.includes('incorrect')) {
      return 'false';
    } else if (lowerRating.includes('disputed') || lowerRating.includes('debate') || lowerRating.includes('controversial')) {
      return 'disputed';
    } else {
      return 'unverifiable';
    }
  }

  // Escalate claim to LLM for analysis
  private async escalateClaimToLLM(claim: Claim, factCheckResult?: any): Promise<void> {
    try {
      chrome.runtime.sendMessage({
        type: 'CLAIM_LLM_REQUEST',
        payload: {
          claimText: claim.text,
          claimId: claim.claimId,
          context: claim.context ? { text: claim.context } : {},
          factCheckResult: factCheckResult || null, // Include Google Fact Check result if available
        }
      });
      
    } catch (error) {
      console.error('Failed to escalate claim to LLM:', error);
      this.sendError('CLAIM_LLM_ESCALATION_ERROR', 'Claim LLM escalation failed', error);
    }
  }

  // Get context for claim analysis
  private getClaimContext(claim: Claim): string {
    // Get surrounding text for context
    const contextRadius = 2; // sentences before and after
    const allClaims = [...this.claimsBuffer].sort((a, b) => a.timestamp - b.timestamp);
    const claimIndex = allClaims.findIndex(c => c.claimId === claim.claimId);
    
    if (claimIndex === -1) return '';
    
    const start = Math.max(0, claimIndex - contextRadius);
    const end = Math.min(allClaims.length, claimIndex + contextRadius + 1);
    
    return allClaims.slice(start, end).map(c => c.text).join(' ');
  }

  // Send claim verdict to background script
  private sendClaimVerdict(verdict: ClaimVerdict): void {
    const message: ExtensionMessage = {
      type: 'CLAIM_VERDICT',
      payload: verdict
    };
    
    chrome.runtime.sendMessage(message);
  }

  // Send transcript update to side panel
  private sendTranscriptUpdate(transcript: string): void {
    chrome.runtime.sendMessage({
      type: 'TRANSCRIPT_UPDATE',
      payload: {
        sessionId: this.sessionId,
        text: transcript,
      }
    });
  }

  // Generate claim ID
  private generateClaimId(): string {
    return `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  // Update configuration
  updateConfig(newConfig: Partial<MisinfoShieldConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart speech recognition if settings changed
    if (newConfig.enableAudioTranscription !== undefined) {
      if (newConfig.enableAudioTranscription && !this.speechRecognition) {
        this.initializeSpeechRecognition();
      } else if (!newConfig.enableAudioTranscription && this.speechRecognition) {
        this.speechRecognition.stop();
        this.speechRecognition = null;
      }
    }
  }

  // Get current status
  getStatus(): {
    isActive: boolean;
    pageType: PageType;
    platform: Platform;
    claimsProcessed: number;
    isTranscribing: boolean;
  } {
    return {
      isActive: this.isActive,
      pageType: this.pageType,
      platform: this.platform,
      claimsProcessed: this.claimsBuffer.length,
      isTranscribing: this.isTranscribing,
    };
  }

  // Stop MisinfoShield
  stop(): void {
    this.isActive = false;
    
    if (this.speechRecognition) {
      this.speechRecognition.stop();
      this.speechRecognition = null;
    }
    
    if (this.textObserver) {
      this.textObserver.disconnect();
      this.textObserver = null;
    }
    
    this.isTranscribing = false;
    this.claimsBuffer = [];
    this.transcriptBuffer = [];
    
    console.log('MisinfoShield stopped');
  }

  // Cleanup
  destroy(): void {
    this.stop();
  }
}

export default MisinfoShield;
