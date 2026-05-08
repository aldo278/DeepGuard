// DeepGuard - Real-time Deepfake Detection

import { Platform, ScoredFrame, DeepfakeVerdict, ExtensionMessage } from '@/types';
import TRUSTSHIELD_CONFIG from '@/lib/constants';

// Chrome extension types
declare const chrome: any;

interface DeepGuardConfig {
  fps: number;
  ambiguityGateMin: number;
  ambiguityGateMax: number;
  confidenceThreshold: number;
  enableVoiceAnalysis: boolean;
}

export class DeepGuard {
  private static instance: DeepGuard;
  private platform: Platform = 'other';
  private config: DeepGuardConfig;
  private isActive: boolean = false;
  private videoElements: Set<HTMLVideoElement> = new Set();
  private frameBuffer: ScoredFrame[] = [];
  private processingWorker: Worker | null = null;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;

  private constructor() {
    this.config = {
      fps: TRUSTSHIELD_CONFIG.MODELS.DEEPFAKE.FRAME_RATE,
      ambiguityGateMin: TRUSTSHIELD_CONFIG.MODELS.DEEPFAKE.AMBIGUITY_GATE_MIN,
      ambiguityGateMax: TRUSTSHIELD_CONFIG.MODELS.DEEPFAKE.AMBIGUITY_GATE_MAX,
      confidenceThreshold: TRUSTSHIELD_CONFIG.MODELS.DEEPFAKE.CONFIDENCE_THRESHOLD,
      enableVoiceAnalysis: false,
    };
  }

  static getInstance(): DeepGuard {
    if (!DeepGuard.instance) {
      DeepGuard.instance = new DeepGuard();
    }
    return DeepGuard.instance;
  }

  // Initialize DeepGuard
  async initialize(platform: Platform): Promise<void> {
    this.platform = platform;
    
    try {
      // Load settings
      await this.loadSettings();
      
      // Initialize Web Worker for inference
      await this.initializeWorker();
      
      // Start video monitoring
      this.startVideoMonitoring();
      
      this.isActive = true;
      console.log(`DeepGuard initialized for ${platform}`);
      
    } catch (error) {
      console.error('Failed to initialize DeepGuard:', error);
      this.sendError('DEEPGUARD_INIT_ERROR', 'DeepGuard initialization failed', error);
    }
  }

  // Load settings from storage
  private async loadSettings(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(TRUSTSHIELD_CONFIG.STORAGE.SETTINGS, (result: any) => {
        const settings = result[TRUSTSHIELD_CONFIG.STORAGE.SETTINGS];
        if (settings && settings.deepguard) {
          this.config = { ...this.config, ...settings.deepguard };
        }
        resolve();
      });
    });
  }

  // Initialize Web Worker for inference
  private async initializeWorker(): Promise<void> {
    try {
      // Create worker from the inference script
      const workerUrl = chrome.runtime.getURL('src/worker/inference.worker.js');
      this.processingWorker = new Worker(workerUrl);
      
      // Set up worker message handler
      this.processingWorker.onmessage = (event) => {
        this.handleWorkerMessage(event.data);
      };
      
      this.processingWorker.onerror = (error) => {
        console.error('Worker error:', error);
        this.sendError('WORKER_ERROR', 'Inference worker error', error);
      };
      
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      throw error;
    }
  }

  // Start monitoring video elements
  private startVideoMonitoring(): void {
    // Find existing video elements
    this.findVideoElements();
    
    // Set up MutationObserver to detect new video elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.tagName === 'VIDEO') {
              this.addVideoElement(element as HTMLVideoElement);
            } else {
              // Check for video elements within the added node
              const videos = element.querySelectorAll('video');
              videos.forEach(video => this.addVideoElement(video));
            }
          }
        });
        
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.tagName === 'VIDEO') {
              this.removeVideoElement(element as HTMLVideoElement);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Start frame processing loop
    this.startFrameProcessing();
  }

  // Find existing video elements
  private findVideoElements(): void {
    const selector = this.getVideoSelector();
    const videos = document.querySelectorAll(selector);
    videos.forEach(video => {
      if (video instanceof HTMLVideoElement) {
        this.addVideoElement(video);
      }
    });
  }

  // Get video selector based on platform
  private getVideoSelector(): string {
    switch (this.platform) {
      case 'meet':
        return TRUSTSHIELD_CONFIG.PLATFORMS.GOOGLE_MEET.VIDEO_SELECTOR;
      case 'zoom':
        return TRUSTSHIELD_CONFIG.PLATFORMS.ZOOM.VIDEO_SELECTOR;
      case 'teams':
        return TRUSTSHIELD_CONFIG.PLATFORMS.TEAMS.VIDEO_SELECTOR;
      case 'youtube':
        return TRUSTSHIELD_CONFIG.PLATFORMS.YOUTUBE.VIDEO_SELECTOR;
      default:
        return 'video';
    }
  }

  // Add video element to monitoring
  private addVideoElement(video: HTMLVideoElement): void {
    if (!this.videoElements.has(video)) {
      this.videoElements.add(video);
      console.log('Added video element to monitoring:', video.src || 'local stream');
      
      // Add event listeners
      video.addEventListener('play', () => this.handleVideoPlay(video));
      video.addEventListener('pause', () => this.handleVideoPause(video));
      video.addEventListener('ended', () => this.handleVideoEnd(video));
    }
  }

  // Remove video element from monitoring
  private removeVideoElement(video: HTMLVideoElement): void {
    if (this.videoElements.has(video)) {
      this.videoElements.delete(video);
      console.log('Removed video element from monitoring');
    }
  }

  // Handle video play event
  private handleVideoPlay(video: HTMLVideoElement): void {
    console.log('Video started playing');
  }

  // Handle video pause event
  private handleVideoPause(video: HTMLVideoElement): void {
    console.log('Video paused');
  }

  // Handle video end event
  private handleVideoEnd(video: HTMLVideoElement): void {
    console.log('Video ended');
  }

  // Start frame processing loop
  private startFrameProcessing(): void {
    const processFrame = (timestamp: number) => {
      if (!this.isActive) return;

      // Check if enough time has passed based on FPS
      const frameInterval = 1000 / this.config.fps;
      if (timestamp - this.lastFrameTime >= frameInterval) {
        this.processVideoFrames();
        this.lastFrameTime = timestamp;
      }

      this.animationFrameId = requestAnimationFrame(processFrame);
    };

    this.animationFrameId = requestAnimationFrame(processFrame);
  }

  // Process frames from all video elements
  private processVideoFrames(): void {
    this.videoElements.forEach(video => {
      if (video.readyState >= 2 && !video.paused && !video.ended) {
        this.captureFrame(video);
      }
    });
  }

  // Capture frame from video element
  private captureFrame(video: HTMLVideoElement): void {
    try {
      // Create canvas for frame capture
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;

      // Set canvas size to video size
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get frame data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Create scored frame
      const frame: ScoredFrame = {
        frameId: this.generateFrameId(),
        timestamp: Date.now(),
        confidence: 0, // Will be set by inference
        isAmbiguous: false,
        processingLatency: 0,
      };

      // Send to worker for processing
      if (this.processingWorker) {
        this.processingWorker.postMessage({
          type: 'PROCESS_FRAME',
          payload: {
            frame,
            imageData: canvas.toDataURL('image/jpeg', 0.8),
            videoElement: video.src || 'stream',
          }
        });
      }

    } catch (error) {
      console.error('Failed to capture frame:', error);
      this.sendError('FRAME_CAPTURE_ERROR', 'Frame capture failed', error);
    }
  }

  // Handle messages from worker
  private handleWorkerMessage(data: any): void {
    switch (data.type) {
      case 'FRAME_PROCESSED':
        this.handleFrameProcessed(data.payload);
        break;
      case 'INFERENCE_ERROR':
        this.sendError('INFERENCE_ERROR', 'Frame inference failed', data.payload);
        break;
      default:
        console.log('Unknown worker message:', data);
    }
  }

  // Handle processed frame
  private handleFrameProcessed(payload: any): void {
    const { frame, confidence, faceBoundingBox, processingLatency } = payload;
    
    // Update frame with results
    frame.confidence = confidence;
    frame.faceBoundingBox = faceBoundingBox;
    frame.processingLatency = processingLatency;
    
    // Determine if ambiguous
    frame.isAmbiguous = confidence >= this.config.ambiguityGateMin && 
                        confidence <= this.config.ambiguityGateMax;
    
    // Add to buffer
    this.frameBuffer.push(frame);
    
    // Keep buffer size limited
    if (this.frameBuffer.length > TRUSTSHIELD_CONFIG.PERFORMANCE.BUFFER_SIZES.FRAME_BUFFER) {
      this.frameBuffer.shift();
    }
    
    // Generate verdict
    this.generateVerdict();
  }

  // Generate verdict from frame buffer
  private generateVerdict(): void {
    if (this.frameBuffer.length < TRUSTSHIELD_CONFIG.MODELS.DEEPFAKE.ROLLING_AVERAGE_FRAMES) {
      return;
    }

    // Get last N frames for rolling average
    const recentFrames = this.frameBuffer.slice(-TRUSTSHIELD_CONFIG.MODELS.DEEPFAKE.ROLLING_AVERAGE_FRAMES);
    
    // Calculate average confidence
    const avgConfidence = recentFrames.reduce((sum, frame) => sum + frame.confidence, 0) / recentFrames.length;
    
    // Determine verdict
    let verdict: 'real' | 'deepfake' | 'uncertain';
    let needsLLM = false;
    
    if (avgConfidence < this.config.confidenceThreshold) {
      verdict = 'real';
    } else if (avgConfidence > 1 - this.config.confidenceThreshold) {
      verdict = 'deepfake';
    } else {
      verdict = 'uncertain';
      needsLLM = true;
    }
    
    // Check if any recent frames are ambiguous
    const hasAmbiguousFrame = recentFrames.some(frame => frame.isAmbiguous);
    if (hasAmbiguousFrame) {
      needsLLM = true;
      verdict = 'uncertain';
    }
    
    // Create verdict
    const deepfakeVerdict: DeepfakeVerdict = {
      frameId: recentFrames[recentFrames.length - 1].frameId,
      localScore: avgConfidence,
      llmVerdict: verdict,
      llmReasoning: `Local model confidence: ${(avgConfidence * 100).toFixed(1)}%`,
      latencyMs: recentFrames[recentFrames.length - 1].processingLatency,
      timestamp: Date.now(),
      confidence: avgConfidence,
      modelVersion: 'efficientnet-b4-v1',
    };
    
    // Send to background script
    this.sendVerdict(deepfakeVerdict);
    
    // If ambiguous, escalate to LLM
    if (needsLLM && recentFrames[recentFrames.length - 1].jpegB64) {
      this.escalateToLLM(recentFrames[recentFrames.length - 1]);
    }
  }

  // Escalate to LLM for ambiguous frames
  private async escalateToLLM(frame: ScoredFrame): Promise<void> {
    try {
      // Send LLM request to background script
      const message: ExtensionMessage = {
        type: 'DEEPFAKE_LLM_REQUEST',
        payload: {
          frameBase64: frame.jpegB64 || '',
          frameId: frame.frameId,
          context: { localScore: frame.confidence },
        }
      };
      
      chrome.runtime.sendMessage(message);
      
    } catch (error) {
      console.error('Failed to escalate to LLM:', error);
      this.sendError('LLM_ESCALATION_ERROR', 'LLM escalation failed', error);
    }
  }

  // Send verdict to background script
  private sendVerdict(verdict: DeepfakeVerdict): void {
    const message: ExtensionMessage = {
      type: 'DEEPFAKE_VERDICT',
      payload: verdict
    };
    
    chrome.runtime.sendMessage(message);
  }

  // Generate frame ID
  private generateFrameId(): string {
    return `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
  updateConfig(newConfig: Partial<DeepGuardConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get current status
  getStatus(): {
    isActive: boolean;
    platform: Platform;
    videoElementsCount: number;
    framesProcessed: number;
    currentFPS: number;
  } {
    return {
      isActive: this.isActive,
      platform: this.platform,
      videoElementsCount: this.videoElements.size,
      framesProcessed: this.frameBuffer.length,
      currentFPS: this.config.fps,
    };
  }

  // Stop DeepGuard
  stop(): void {
    this.isActive = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.processingWorker) {
      this.processingWorker.terminate();
      this.processingWorker = null;
    }
    
    this.videoElements.clear();
    this.frameBuffer = [];
    
    console.log('DeepGuard stopped');
  }

  // Cleanup
  destroy(): void {
    this.stop();
  }
}

export default DeepGuard;
