// deepfake-detector.ts - Content script entry point for deepfake detection
// Runs on YouTube, Google Meet, Zoom, and Teams

import { DeepfakeScanner } from './deepfake-detector/DeepfakeScanner';
import { ScanResult } from './deepfake-detector/types';

class DeepfakeDetectorContentScript {
  private scanner: DeepfakeScanner;
  private isScanning = false;
  private scanInterval: number | null = null;
  private overlayElement: HTMLDivElement | null = null;
  private scanButtons: Map<HTMLVideoElement, HTMLButtonElement> = new Map();
  private processedVideos: WeakSet<HTMLVideoElement> = new WeakSet();

  constructor() {
    this.scanner = new DeepfakeScanner({ debug: true });
    this.init();
  }

  private init(): void {
    console.log('🛡️ DeepGuard: Deepfake detector initialized');

    // Listen for messages from background/popup
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true; // Keep channel open for async response
    });

    // Auto-detect video elements on page
    this.observeVideoElements();
    
    // Initial scan for existing videos
    this.addButtonsToVideos();
  }

  private handleMessage(
    message: any,
    sendResponse: (response: any) => void
  ): void {
    switch (message.type) {
      case 'START_SCAN':
        this.startScanning(message.videoSelector);
        sendResponse({ success: true });
        break;

      case 'STOP_SCAN':
        this.stopScanning();
        sendResponse({ success: true });
        break;

      case 'GET_STATUS':
        sendResponse({
          isScanning: this.isScanning,
          debugInfo: this.scanner.getDebugInfo(),
        });
        break;

      case 'TEST_DETECTOR':
        this.testSingleDetector(message.detectorName, message.videoSelector)
          .then((result) => sendResponse({ success: true, result }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }

  private observeVideoElements(): void {
    const observer = new MutationObserver(() => {
      this.addButtonsToVideos();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private addButtonsToVideos(): void {
    const videos = document.querySelectorAll('video');
    
    videos.forEach((video) => {
      const videoEl = video as HTMLVideoElement;
      
      // Skip if already processed or too small
      if (this.processedVideos.has(videoEl)) return;
      if (videoEl.offsetWidth < 200 || videoEl.offsetHeight < 150) return;
      
      this.processedVideos.add(videoEl);
      this.createScanButton(videoEl);
      console.log('🎥 DeepGuard: Added scan button to video');
    });
  }

  private createScanButton(video: HTMLVideoElement): void {
    // Find or create a container for the button
    const container = video.parentElement;
    if (!container) return;

    // Ensure container has relative positioning
    const containerStyle = window.getComputedStyle(container);
    if (containerStyle.position === 'static') {
      container.style.position = 'relative';
    }

    // Create the scan button
    const button = document.createElement('button');
    button.id = `deepguard-scan-btn-${Date.now()}`;
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span>Scan for Deepfake</span>
    `;
    
    button.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.75);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      backdrop-filter: blur(8px);
      transition: all 0.2s ease;
      opacity: 0.9;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(59, 130, 246, 0.9)';
      button.style.opacity = '1';
      button.style.transform = 'scale(1.02)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(0, 0, 0, 0.75)';
      button.style.opacity = '0.9';
      button.style.transform = 'scale(1)';
    });

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (this.isScanning) {
        console.log('⚠️ DeepGuard: Already scanning');
        return;
      }

      // Update button to show scanning state
      button.innerHTML = `
        <div style="
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: deepguard-spin 1s linear infinite;
        "></div>
        <span>Scanning...</span>
      `;
      button.style.pointerEvents = 'none';

      await this.startScanningVideo(video, button);
    });

    // Add keyframe animation
    if (!document.getElementById('deepguard-styles')) {
      const style = document.createElement('style');
      style.id = 'deepguard-styles';
      style.textContent = `
        @keyframes deepguard-spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    container.appendChild(button);
    this.scanButtons.set(video, button);
  }

  private async startScanningVideo(video: HTMLVideoElement, button: HTMLButtonElement): Promise<void> {
    this.isScanning = true;
    
    try {
      const result = await this.scanner.scan(video);
      this.updateButtonWithResult(button, result);
      this.notifyBackground(result);
    } catch (error) {
      console.error('❌ DeepGuard: Scan failed', error);
      this.updateButtonWithError(button);
    }
    
    this.isScanning = false;
  }

  private updateButtonWithResult(button: HTMLButtonElement, result: ScanResult): void {
    if (result.isFake) {
      button.innerHTML = `
        <span style="font-size: 14px;">⚠️</span>
        <span>Potential Deepfake (${(result.overallConfidence * 100).toFixed(0)}%)</span>
      `;
      button.style.background = 'rgba(239, 68, 68, 0.9)';
      button.style.borderColor = 'rgba(239, 68, 68, 0.5)';
    } else {
      button.innerHTML = `
        <span style="font-size: 14px;">✓</span>
        <span>Appears Authentic</span>
      `;
      button.style.background = 'rgba(34, 197, 94, 0.9)';
      button.style.borderColor = 'rgba(34, 197, 94, 0.5)';
    }
    
    button.style.pointerEvents = 'auto';
    
    // Reset button after 10 seconds
    setTimeout(() => {
      this.resetButton(button);
    }, 10000);
  }

  private updateButtonWithError(button: HTMLButtonElement): void {
    button.innerHTML = `
      <span style="font-size: 14px;">❌</span>
      <span>Scan Failed</span>
    `;
    button.style.background = 'rgba(245, 158, 11, 0.9)';
    button.style.pointerEvents = 'auto';
    
    setTimeout(() => {
      this.resetButton(button);
    }, 5000);
  }

  private resetButton(button: HTMLButtonElement): void {
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span>Scan for Deepfake</span>
    `;
    button.style.background = 'rgba(0, 0, 0, 0.75)';
    button.style.borderColor = 'rgba(255, 255, 255, 0.2)';
  }

  private async startScanning(videoSelector?: string): Promise<void> {
    if (this.isScanning) {
      console.log('⚠️ DeepGuard: Already scanning');
      return;
    }

    const video = this.findVideoElement(videoSelector);
    if (!video) {
      console.error('❌ DeepGuard: No video element found');
      return;
    }

    console.log('🔍 DeepGuard: Starting deepfake scan');
    this.isScanning = true;
    this.createOverlay();

    // Run scan
    try {
      const result = await this.scanner.scan(video);
      this.displayResult(result);
      this.notifyBackground(result);
    } catch (error) {
      console.error('❌ DeepGuard: Scan failed', error);
      this.updateOverlay('Error', 'Scan failed', 'error');
    }

    this.isScanning = false;
  }

  private stopScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isScanning = false;
    this.removeOverlay();
    console.log('⏹️ DeepGuard: Scanning stopped');
  }

  private async testSingleDetector(
    detectorName: string,
    videoSelector?: string
  ): Promise<any> {
    const video = this.findVideoElement(videoSelector);
    if (!video) {
      throw new Error('No video element found');
    }

    return this.scanner.testDetector(detectorName, video);
  }

  private findVideoElement(selector?: string): HTMLVideoElement | null {
    if (selector) {
      return document.querySelector(selector) as HTMLVideoElement;
    }

    // Platform-specific selectors
    const selectors = [
      'video[src]',
      'video.html5-main-video', // YouTube
      'video[data-testid="video"]', // Various platforms
      'video', // Fallback
    ];

    for (const sel of selectors) {
      const video = document.querySelector(sel) as HTMLVideoElement;
      if (video && video.readyState >= 2) {
        return video;
      }
    }

    return document.querySelector('video') as HTMLVideoElement;
  }

  private createOverlay(): void {
    if (this.overlayElement) return;

    this.overlayElement = document.createElement('div');
    this.overlayElement.id = 'deepguard-overlay';
    this.overlayElement.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    this.overlayElement.innerHTML = `
      <div class="deepguard-spinner" style="
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: deepguard-spin 1s linear infinite;
      "></div>
      <span>Analyzing video...</span>
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes deepguard-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.overlayElement);
  }

  private updateOverlay(
    status: string,
    details: string,
    type: 'safe' | 'warning' | 'error'
  ): void {
    if (!this.overlayElement) return;

    const colors = {
      safe: '#22c55e',
      warning: '#ef4444',
      error: '#f59e0b',
    };

    const icons = {
      safe: '✓',
      warning: '⚠️',
      error: '❌',
    };

    this.overlayElement.innerHTML = `
      <span style="font-size: 20px;">${icons[type]}</span>
      <div>
        <div style="font-weight: 600; color: ${colors[type]};">${status}</div>
        <div style="font-size: 12px; opacity: 0.8;">${details}</div>
      </div>
    `;
  }

  private removeOverlay(): void {
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }
  }

  private displayResult(result: ScanResult): void {
    if (result.isFake) {
      this.updateOverlay(
        'Potential Deepfake Detected',
        `Confidence: ${(result.overallConfidence * 100).toFixed(1)}% | Signals: ${result.signals.join(', ')}`,
        'warning'
      );
    } else {
      this.updateOverlay(
        'Video Appears Authentic',
        `Confidence: ${((1 - result.overallConfidence) * 100).toFixed(1)}%`,
        'safe'
      );
    }

    // Auto-hide after 10 seconds
    setTimeout(() => this.removeOverlay(), 10000);
  }

  private notifyBackground(result: ScanResult): void {
    chrome.runtime.sendMessage({
      type: 'DEEPFAKE_SCAN_RESULT',
      result,
      url: window.location.href,
      timestamp: Date.now(),
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new DeepfakeDetectorContentScript();
  });
} else {
  new DeepfakeDetectorContentScript();
}
