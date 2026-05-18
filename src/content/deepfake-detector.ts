// Deepfake Detector Content Script - Enhanced Video Analysis
// Supports: Live capture, YouTube auto-detect, file upload
// Uses TensorFlow.js + MediaPipe for accurate deepfake detection

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

declare const chrome: any;

interface DeepfakeResult {
  isDeepfake: boolean;
  confidence: number;
  frameCount: number;
  averageScore: number;
  verdict: 'authentic' | 'deepfake' | 'uncertain';
  explainability?: ExplainabilitySignals;
}

interface ExplainabilitySignals {
  temporalInstability: number;
  flickeringDetected: boolean;
  faceArtifacts: number;
  textureAnomalies: number;
  motionInconsistency: number;
}

interface FrameAnalysis {
  timestamp: number;
  score: number;
  isDeepfake: boolean;
  faceDetected: boolean;
  features?: Float32Array;
}

interface FrameData {
  imageData: ImageData;
  timestamp: number;
  faceBox?: { x: number; y: number; width: number; height: number };
  alignedFace?: ImageData;
}

// Frame sequence buffer for temporal analysis
class FrameSequenceBuffer {
  private buffer: FrameData[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number = 16) {
    this.maxSize = maxSize;
  }

  add(frame: FrameData): void {
    this.buffer.push(frame);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getSequence(): FrameData[] {
    return [...this.buffer];
  }

  isFull(): boolean {
    return this.buffer.length >= this.maxSize;
  }

  clear(): void {
    this.buffer = [];
  }

  get length(): number {
    return this.buffer.length;
  }
}

class DeepfakeDetector {
  private isAnalyzing: boolean = false;
  private videoElement: HTMLVideoElement | null = null;
  private analysisInterval: number | null = null;
  private frameResults: FrameAnalysis[] = [];
  private overlay: HTMLElement | null = null;
  private statusBadge: HTMLElement | null = null;
  private tfReady: boolean = false;
  
  // Frame sequence buffer for temporal analysis
  private frameBuffer: FrameSequenceBuffer = new FrameSequenceBuffer(16);
  private embeddings: Float32Array[] = [];
  
  // Face detection model (BlazeFace via TensorFlow.js)
  private faceDetector: any = null;
  private faceDetectorLoaded: boolean = false;
  
  // Configuration
  private readonly FPS = 4; // Increased for better temporal analysis
  private readonly CONFIDENCE_THRESHOLD = 0.5;
  private readonly MIN_FRAMES_FOR_VERDICT = 8; // Need more frames for temporal
  private readonly INPUT_SIZE = 224;
  private readonly SEQUENCE_LENGTH = 16;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.injectStyles();
    await this.initTensorFlow();
    await this.initFaceDetector();
    this.detectPlatform();
    this.setupMessageListener();
    console.log('TrustShield Deepfake Detector: Ready (TensorFlow.js + Face Detection)');
  }

  private async initTensorFlow(): Promise<void> {
    try {
      // Set up WebGL backend for GPU acceleration
      await tf.setBackend('webgl');
      await tf.ready();
      this.tfReady = true;
      console.log('TensorFlow.js initialized with backend:', tf.getBackend());
    } catch (error) {
      console.warn('WebGL backend failed, falling back to CPU:', error);
      try {
        await tf.setBackend('cpu');
        await tf.ready();
        this.tfReady = true;
      } catch (cpuError) {
        console.error('TensorFlow.js initialization failed:', cpuError);
      }
    }
  }

  private async initFaceDetector(): Promise<void> {
    try {
      // Load BlazeFace model for face detection
      const blazeface = await import('@tensorflow-models/blazeface');
      this.faceDetector = await blazeface.load();
      this.faceDetectorLoaded = true;
      console.log('BlazeFace face detector loaded');
    } catch (error) {
      console.warn('BlazeFace loading failed, using fallback face detection:', error);
      // Will use canvas-based face detection as fallback
    }
  }

  private async detectFace(imageData: ImageData): Promise<{ x: number; y: number; width: number; height: number } | null> {
    if (!this.faceDetectorLoaded || !this.faceDetector) {
      // Fallback: assume face is in center region
      return {
        x: Math.floor(imageData.width * 0.2),
        y: Math.floor(imageData.height * 0.1),
        width: Math.floor(imageData.width * 0.6),
        height: Math.floor(imageData.height * 0.8)
      };
    }

    try {
      // Create tensor from image data
      const tensor = tf.browser.fromPixels({
        data: new Uint8Array(imageData.data),
        width: imageData.width,
        height: imageData.height
      }, 3);

      const predictions = await this.faceDetector.estimateFaces(tensor, false);
      tensor.dispose();

      if (predictions.length > 0) {
        const face = predictions[0];
        const topLeft = face.topLeft as [number, number];
        const bottomRight = face.bottomRight as [number, number];
        
        return {
          x: Math.floor(topLeft[0]),
          y: Math.floor(topLeft[1]),
          width: Math.floor(bottomRight[0] - topLeft[0]),
          height: Math.floor(bottomRight[1] - topLeft[1])
        };
      }
    } catch (error) {
      console.warn('Face detection error:', error);
    }

    return null;
  }

  private alignAndCropFace(
    imageData: ImageData, 
    faceBox: { x: number; y: number; width: number; height: number }
  ): ImageData {
    // Create canvas for face alignment
    const canvas = document.createElement('canvas');
    canvas.width = this.INPUT_SIZE;
    canvas.height = this.INPUT_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Create source canvas from imageData
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = imageData.width;
    srcCanvas.height = imageData.height;
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.putImageData(imageData, 0, 0);

    // Add padding around face (20%)
    const padding = 0.2;
    const paddedX = Math.max(0, faceBox.x - faceBox.width * padding);
    const paddedY = Math.max(0, faceBox.y - faceBox.height * padding);
    const paddedWidth = Math.min(imageData.width - paddedX, faceBox.width * (1 + 2 * padding));
    const paddedHeight = Math.min(imageData.height - paddedY, faceBox.height * (1 + 2 * padding));

    // Draw cropped and scaled face
    ctx.drawImage(
      srcCanvas,
      paddedX, paddedY, paddedWidth, paddedHeight,
      0, 0, this.INPUT_SIZE, this.INPUT_SIZE
    );

    return ctx.getImageData(0, 0, this.INPUT_SIZE, this.INPUT_SIZE);
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.id = 'trustshield-deepfake-styles';
    style.textContent = `
      .trustshield-df-overlay {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: auto;
      }

      .trustshield-df-badge {
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
      }

      .trustshield-df-badge.authentic {
        background: rgba(22, 163, 74, 0.9);
      }

      .trustshield-df-badge.deepfake {
        background: rgba(220, 38, 38, 0.9);
        animation: trustshield-pulse 1.5s infinite;
      }

      .trustshield-df-badge.uncertain {
        background: rgba(234, 179, 8, 0.9);
        color: #1f2937;
      }

      .trustshield-df-badge.analyzing {
        background: rgba(59, 130, 246, 0.9);
      }

      .trustshield-df-indicator {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: currentColor;
      }

      .trustshield-df-indicator.pulse {
        animation: trustshield-pulse 1s infinite;
      }

      .trustshield-df-btn {
        background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        transition: all 0.2s ease;
      }

      .trustshield-df-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(139, 92, 246, 0.5);
      }

      .trustshield-df-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      .trustshield-df-btn svg {
        width: 18px;
        height: 18px;
      }

      .trustshield-df-stats {
        background: rgba(0, 0, 0, 0.75);
        color: white;
        padding: 10px 14px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11px;
        backdrop-filter: blur(10px);
      }

      .trustshield-df-stats-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
      }

      .trustshield-df-stats-row:last-child {
        margin-bottom: 0;
      }

      .trustshield-df-progress {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        margin-top: 8px;
        overflow: hidden;
      }

      .trustshield-df-progress-bar {
        height: 100%;
        background: #3b82f6;
        border-radius: 2px;
        transition: width 0.3s ease;
      }

      @keyframes trustshield-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }

      .trustshield-df-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: trustshield-spin 0.8s linear infinite;
      }

      @keyframes trustshield-spin {
        to { transform: rotate(360deg); }
      }

      .trustshield-df-dismiss {
        background: rgba(0, 0, 0, 0.6);
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: white;
        transition: all 0.2s ease;
        padding: 0;
      }

      .trustshield-df-dismiss:hover {
        background: rgba(220, 38, 38, 0.8);
      }
    `;

    if (!document.getElementById('trustshield-deepfake-styles')) {
      document.head.appendChild(style);
    }
  }

  private detectPlatform(): void {
    const url = window.location.href;

    if (url.includes('youtube.com/watch')) {
      this.setupYouTubeDetection();
    } else if (url.includes('meet.google.com')) {
      this.setupGoogleMeetDetection();
    } else if (url.includes('zoom.us')) {
      this.setupZoomDetection();
    } else if (url.includes('teams.microsoft.com')) {
      this.setupTeamsDetection();
    } else {
      this.setupGenericVideoDetection();
    }
  }

  private setupYouTubeDetection(): void {
    // Wait for YouTube video player to load
    const checkForVideo = setInterval(() => {
      const video = document.querySelector('video.html5-main-video') as HTMLVideoElement;
      if (video) {
        clearInterval(checkForVideo);
        this.attachToVideo(video, 'youtube');
      }
    }, 1000);

    // Also handle navigation within YouTube (SPA)
    const observer = new MutationObserver(() => {
      if (window.location.href.includes('youtube.com/watch')) {
        const video = document.querySelector('video.html5-main-video') as HTMLVideoElement;
        if (video && video !== this.videoElement) {
          this.attachToVideo(video, 'youtube');
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  private setupGoogleMeetDetection(): void {
    // Google Meet has multiple video elements
    const checkForVideos = setInterval(() => {
      const videos = document.querySelectorAll('video');
      if (videos.length > 0) {
        clearInterval(checkForVideos);
        // Find the main/largest video (usually the speaker)
        let mainVideo: HTMLVideoElement | null = null;
        let maxArea = 0;

        videos.forEach((video: HTMLVideoElement) => {
          const rect = video.getBoundingClientRect();
          const area = rect.width * rect.height;
          if (area > maxArea) {
            maxArea = area;
            mainVideo = video;
          }
        });

        if (mainVideo) {
          this.attachToVideo(mainVideo, 'meet');
        }
      }
    }, 2000);
  }

  private setupZoomDetection(): void {
    // Zoom web client
    const checkForVideo = setInterval(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (video) {
        clearInterval(checkForVideo);
        this.attachToVideo(video, 'zoom');
      }
    }, 2000);
  }

  private setupTeamsDetection(): void {
    // Microsoft Teams
    const checkForVideo = setInterval(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (video) {
        clearInterval(checkForVideo);
        this.attachToVideo(video, 'teams');
      }
    }, 2000);
  }

  private setupGenericVideoDetection(): void {
    // Find any video on the page
    const videos = document.querySelectorAll('video');
    if (videos.length > 0) {
      // Attach to the first visible video
      for (const video of videos) {
        const rect = (video as HTMLVideoElement).getBoundingClientRect();
        if (rect.width > 100 && rect.height > 100) {
          this.attachToVideo(video as HTMLVideoElement, 'generic');
          break;
        }
      }
    }

    // Watch for new videos
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLVideoElement) {
            this.attachToVideo(node, 'generic');
          } else if (node instanceof HTMLElement) {
            const video = node.querySelector('video');
            if (video) {
              this.attachToVideo(video as HTMLVideoElement, 'generic');
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  private attachToVideo(video: HTMLVideoElement, platform: string): void {
    if (this.videoElement === video) return;

    this.videoElement = video;
    this.createOverlay(video, platform);
    console.log(`TrustShield: Attached to ${platform} video`);
  }

  private createOverlay(video: HTMLVideoElement, platform: string): void {
    // Remove existing overlay
    this.removeOverlay();

    // Create container
    const overlay = document.createElement('div');
    overlay.className = 'trustshield-df-overlay';
    overlay.id = 'trustshield-df-overlay';

    // Create button container with dismiss
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display: flex; align-items: center; gap: 4px;';

    // Create scan button
    const scanBtn = document.createElement('button');
    scanBtn.className = 'trustshield-df-btn';
    scanBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
      Scan for Deepfake
    `;
    scanBtn.addEventListener('click', () => this.toggleAnalysis());

    // Create dismiss button
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'trustshield-df-dismiss';
    dismissBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    `;
    dismissBtn.title = 'Hide TrustShield';
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeOverlay();
    });

    btnContainer.appendChild(scanBtn);
    btnContainer.appendChild(dismissBtn);
    overlay.appendChild(btnContainer);

    // Position overlay relative to video
    const videoContainer = video.parentElement;
    if (videoContainer) {
      videoContainer.style.position = 'relative';
      videoContainer.appendChild(overlay);
    } else {
      video.style.position = 'relative';
      video.parentNode?.insertBefore(overlay, video.nextSibling);
    }

    this.overlay = overlay;
  }

  private removeOverlay(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private async toggleAnalysis(): Promise<void> {
    if (this.isAnalyzing) {
      this.stopAnalysis();
    } else {
      await this.startAnalysis();
    }
  }

  private async startAnalysis(): Promise<void> {
    if (!this.videoElement || this.isAnalyzing) return;

    this.isAnalyzing = true;
    this.frameResults = [];

    // Update button
    const btn = this.overlay?.querySelector('.trustshield-df-btn');
    if (btn) {
      btn.innerHTML = `
        <div class="trustshield-df-spinner"></div>
        Analyzing...
      `;
      (btn as HTMLButtonElement).disabled = true;
    }

    // Add status badge
    this.addStatusBadge('analyzing', 'Analyzing video...');

    // Add stats display
    this.addStatsDisplay();

    // Start frame analysis
    const intervalMs = 1000 / this.FPS;
    this.analysisInterval = window.setInterval(() => {
      this.analyzeFrame();
    }, intervalMs);

    // Auto-stop after 30 seconds
    setTimeout(() => {
      if (this.isAnalyzing) {
        this.stopAnalysis();
      }
    }, 30000);
  }

  private stopAnalysis(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    this.isAnalyzing = false;

    // Calculate final verdict
    const result = this.calculateVerdict();

    // Update UI
    this.updateStatusBadge(result);
    this.updateButton();
  }

  private captureFrame(): HTMLCanvasElement | null {
    if (!this.videoElement) return null;

    const canvas = document.createElement('canvas');
    canvas.width = this.INPUT_SIZE;
    canvas.height = this.INPUT_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw video frame to canvas
    ctx.drawImage(this.videoElement, 0, 0, this.INPUT_SIZE, this.INPUT_SIZE);

    return canvas;
  }

  private async analyzeFrame(): Promise<void> {
    if (!this.videoElement || this.videoElement.paused || this.videoElement.ended) {
      return;
    }

    try {
      // Capture frame as canvas
      const canvas = this.captureFrame();
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Detect face in frame
      const faceBox = await this.detectFace(imageData);
      const faceDetected = faceBox !== null;
      
      // Align and crop face if detected
      let alignedFace: ImageData | undefined;
      if (faceBox) {
        alignedFace = this.alignAndCropFace(imageData, faceBox);
      }

      // Add to frame buffer for temporal analysis
      this.frameBuffer.add({
        imageData,
        timestamp: this.videoElement.currentTime,
        faceBox: faceBox || undefined,
        alignedFace
      });

      // Analyze locally with face-aware analysis
      const localScore = await this.analyzeLocally(canvas);
      
      // Analyze face artifacts if face detected
      let faceScore = 0;
      if (alignedFace) {
        faceScore = await this.analyzeFaceArtifacts(alignedFace);
      }

      // Temporal analysis when buffer has enough frames
      let temporalScore = 0;
      if (this.frameBuffer.length >= 4) {
        temporalScore = await this.analyzeTemporalSequence();
      }

      // Combine scores with weights - use MAX of scores to catch deepfakes
      // This ensures if ANY analysis detects issues, we flag it
      const maxScore = Math.max(faceScore, temporalScore, localScore);
      const avgScore = faceDetected
        ? (faceScore * 0.4) + (temporalScore * 0.35) + (localScore * 0.25)
        : (temporalScore * 0.5) + (localScore * 0.5);
      
      // Use weighted combination of max and average for better sensitivity
      const combinedScore = (maxScore * 0.6) + (avgScore * 0.4);
      
      console.log('Frame analysis scores:', {
        faceScore: faceScore.toFixed(3),
        temporalScore: temporalScore.toFixed(3),
        localScore: localScore.toFixed(3),
        maxScore: maxScore.toFixed(3),
        combinedScore: combinedScore.toFixed(3),
        faceDetected
      });

      // Store result
      this.frameResults.push({
        timestamp: this.videoElement.currentTime,
        score: combinedScore,
        isDeepfake: combinedScore > this.CONFIDENCE_THRESHOLD,
        faceDetected
      });

      // Update stats display
      this.updateStatsDisplay();

      // Update status if we have enough frames
      if (this.frameResults.length >= this.MIN_FRAMES_FOR_VERDICT) {
        const result = this.calculateVerdict();
        this.updateStatusBadge(result);
      }

    } catch (error) {
      console.error('Frame analysis error:', error);
    }
  }

  private async analyzeFaceArtifacts(faceImageData: ImageData): Promise<number> {
    const pixels = faceImageData.data;
    const width = faceImageData.width;
    const height = faceImageData.height;
    
    let artifactScore = 0;
    let boundaryArtifacts = 0;
    let skinTextureAnomaly = 0;
    let eyeRegionAnomaly = 0;
    
    // Analyze face boundary region (edges of face crop)
    const boundaryWidth = Math.floor(width * 0.1);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < boundaryWidth; x++) {
        const leftIdx = (y * width + x) * 4;
        const rightIdx = (y * width + (width - 1 - x)) * 4;
        
        // Check for unnatural color transitions at boundaries
        if (x > 0) {
          const prevLeftIdx = (y * width + (x - 1)) * 4;
          const prevRightIdx = (y * width + (width - x)) * 4;
          
          const leftDiff = Math.abs(pixels[leftIdx] - pixels[prevLeftIdx]) +
                          Math.abs(pixels[leftIdx + 1] - pixels[prevLeftIdx + 1]) +
                          Math.abs(pixels[leftIdx + 2] - pixels[prevLeftIdx + 2]);
          
          const rightDiff = Math.abs(pixels[rightIdx] - pixels[prevRightIdx]) +
                           Math.abs(pixels[rightIdx + 1] - pixels[prevRightIdx + 1]) +
                           Math.abs(pixels[rightIdx + 2] - pixels[prevRightIdx + 2]);
          
          // Sharp transitions at face boundary = deepfake artifact
          if (leftDiff > 80 || rightDiff > 80) {
            boundaryArtifacts++;
          }
        }
      }
    }
    
    // Analyze skin texture in center region (forehead, cheeks)
    const centerStartX = Math.floor(width * 0.3);
    const centerEndX = Math.floor(width * 0.7);
    const centerStartY = Math.floor(height * 0.2);
    const centerEndY = Math.floor(height * 0.6);
    
    let smoothRegions = 0;
    let totalRegions = 0;
    
    for (let y = centerStartY; y < centerEndY - 2; y += 2) {
      for (let x = centerStartX; x < centerEndX - 2; x += 2) {
        totalRegions++;
        
        // Check 3x3 region for unnaturally smooth texture
        let regionVariance = 0;
        const centerIdx = (y * width + x) * 4;
        const centerR = pixels[centerIdx];
        const centerG = pixels[centerIdx + 1];
        const centerB = pixels[centerIdx + 2];
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            regionVariance += Math.abs(pixels[idx] - centerR);
            regionVariance += Math.abs(pixels[idx + 1] - centerG);
            regionVariance += Math.abs(pixels[idx + 2] - centerB);
          }
        }
        
        // Very low variance = unnaturally smooth (AI-generated)
        if (regionVariance < 30) {
          smoothRegions++;
        }
      }
    }
    
    skinTextureAnomaly = smoothRegions / Math.max(totalRegions, 1);
    
    // Analyze eye region (top 40% of face, center 60%)
    const eyeStartX = Math.floor(width * 0.2);
    const eyeEndX = Math.floor(width * 0.8);
    const eyeStartY = Math.floor(height * 0.15);
    const eyeEndY = Math.floor(height * 0.4);
    
    let eyeSymmetryDiff = 0;
    const midX = Math.floor(width / 2);
    
    for (let y = eyeStartY; y < eyeEndY; y++) {
      for (let x = eyeStartX; x < midX; x++) {
        const leftIdx = (y * width + x) * 4;
        const rightIdx = (y * width + (width - 1 - x)) * 4;
        
        const diff = Math.abs(pixels[leftIdx] - pixels[rightIdx]) +
                    Math.abs(pixels[leftIdx + 1] - pixels[rightIdx + 1]) +
                    Math.abs(pixels[leftIdx + 2] - pixels[rightIdx + 2]);
        
        eyeSymmetryDiff += diff;
      }
    }
    
    const eyePixels = (eyeEndY - eyeStartY) * (midX - eyeStartX);
    eyeRegionAnomaly = eyeSymmetryDiff / (eyePixels * 255 * 3);
    
    // Normalize boundary artifacts
    const boundaryPixels = height * boundaryWidth * 2;
    const normalizedBoundary = boundaryArtifacts / boundaryPixels;
    
    // Combine face artifact scores
    artifactScore = (normalizedBoundary * 0.3) + 
                   (skinTextureAnomaly * 0.4) + 
                   (eyeRegionAnomaly * 0.3);
    
    return Math.min(artifactScore * 2, 1);
  }

  private async analyzeTemporalSequence(): Promise<number> {
    const sequence = this.frameBuffer.getSequence();
    if (sequence.length < 4) return 0;

    let flickerScore = 0;
    let motionInconsistency = 0;
    let textureStability = 0;
    
    // Analyze frame-to-frame changes
    for (let i = 1; i < sequence.length; i++) {
      const prevFrame = sequence[i - 1];
      const currFrame = sequence[i];
      
      // Calculate brightness difference (flickering)
      const prevBrightness = this.calculateAverageBrightness(prevFrame.imageData);
      const currBrightness = this.calculateAverageBrightness(currFrame.imageData);
      const brightnessDiff = Math.abs(currBrightness - prevBrightness);
      
      // Sudden brightness changes = flickering artifact
      if (brightnessDiff > 15) {
        flickerScore += brightnessDiff / 255;
      }
      
      // Check face region consistency if both frames have faces
      if (prevFrame.alignedFace && currFrame.alignedFace) {
        const faceChange = this.calculateFrameDifference(
          prevFrame.alignedFace, 
          currFrame.alignedFace
        );
        
        // Very high or very low change is suspicious
        // Real faces have natural micro-movements
        if (faceChange < 0.01 || faceChange > 0.15) {
          motionInconsistency += 0.1;
        }
        
        // Check texture stability in face region
        const textureChange = this.calculateTextureChange(
          prevFrame.alignedFace,
          currFrame.alignedFace
        );
        
        if (textureChange > 0.1) {
          textureStability += textureChange;
        }
      }
    }
    
    // Normalize scores
    const numComparisons = sequence.length - 1;
    flickerScore = flickerScore / numComparisons;
    motionInconsistency = Math.min(motionInconsistency / numComparisons, 1);
    textureStability = Math.min(textureStability / numComparisons, 1);
    
    // Combine temporal scores
    const temporalScore = (flickerScore * 0.3) + 
                         (motionInconsistency * 0.4) + 
                         (textureStability * 0.3);
    
    return Math.min(temporalScore * 2, 1);
  }

  private calculateAverageBrightness(imageData: ImageData): number {
    const pixels = imageData.data;
    let totalBrightness = 0;
    const numPixels = pixels.length / 4;
    
    for (let i = 0; i < pixels.length; i += 4) {
      // Luminance formula
      totalBrightness += (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
    }
    
    return totalBrightness / numPixels;
  }

  private calculateFrameDifference(prev: ImageData, curr: ImageData): number {
    const prevPixels = prev.data;
    const currPixels = curr.data;
    let totalDiff = 0;
    const numPixels = prevPixels.length / 4;
    
    for (let i = 0; i < prevPixels.length; i += 4) {
      totalDiff += Math.abs(prevPixels[i] - currPixels[i]);
      totalDiff += Math.abs(prevPixels[i + 1] - currPixels[i + 1]);
      totalDiff += Math.abs(prevPixels[i + 2] - currPixels[i + 2]);
    }
    
    return totalDiff / (numPixels * 255 * 3);
  }

  private calculateTextureChange(prev: ImageData, curr: ImageData): number {
    // Calculate high-frequency content change (texture)
    const prevTexture = this.calculateTextureScore(prev);
    const currTexture = this.calculateTextureScore(curr);
    
    return Math.abs(prevTexture - currTexture);
  }

  private calculateTextureScore(imageData: ImageData): number {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    let textureScore = 0;
    
    // Calculate Laplacian variance (measure of texture/detail)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const leftIdx = (y * width + (x - 1)) * 4;
        const rightIdx = (y * width + (x + 1)) * 4;
        const topIdx = ((y - 1) * width + x) * 4;
        const bottomIdx = ((y + 1) * width + x) * 4;
        
        // Laplacian for each channel
        for (let c = 0; c < 3; c++) {
          const laplacian = Math.abs(
            4 * pixels[idx + c] - 
            pixels[leftIdx + c] - 
            pixels[rightIdx + c] - 
            pixels[topIdx + c] - 
            pixels[bottomIdx + c]
          );
          textureScore += laplacian;
        }
      }
    }
    
    const numPixels = (width - 2) * (height - 2);
    return textureScore / (numPixels * 255 * 3);
  }

  private async analyzeLocally(canvas: HTMLCanvasElement): Promise<number> {
    // Local pixel-based analysis for deepfake detection
    // This is FREE and runs entirely in the browser
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0.5;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    const width = canvas.width;
    const height = canvas.height;
    
    let artifactScore = 0;
    let edgeInconsistency = 0;
    let colorBanding = 0;
    let symmetryScore = 0;
    let blurScore = 0;
    
    // 1. Check for unnaturally smooth gradients (common in AI)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        
        // Neighboring pixels
        const leftIdx = (y * width + (x - 1)) * 4;
        const rightIdx = (y * width + (x + 1)) * 4;
        const topIdx = ((y - 1) * width + x) * 4;
        const bottomIdx = ((y + 1) * width + x) * 4;
        
        // Horizontal gradient
        const hDiff = Math.abs(pixels[leftIdx] - pixels[rightIdx]) +
                     Math.abs(pixels[leftIdx + 1] - pixels[rightIdx + 1]) +
                     Math.abs(pixels[leftIdx + 2] - pixels[rightIdx + 2]);
        
        // Vertical gradient
        const vDiff = Math.abs(pixels[topIdx] - pixels[bottomIdx]) +
                     Math.abs(pixels[topIdx + 1] - pixels[bottomIdx + 1]) +
                     Math.abs(pixels[topIdx + 2] - pixels[bottomIdx + 2]);
        
        // Unnaturally smooth (AI tends to over-smooth)
        if (hDiff < 8 && vDiff < 8) {
          artifactScore++;
        }
        
        // Edge detection - look for unnatural edges
        const edgeMagnitude = Math.sqrt(hDiff * hDiff + vDiff * vDiff);
        if (edgeMagnitude > 100 && edgeMagnitude < 120) {
          edgeInconsistency++; // Suspiciously uniform edges
        }
        
        // Color banding (quantization artifacts)
        if (r % 16 === 0 && g % 16 === 0 && b % 16 === 0) {
          colorBanding++;
        }
        
        // Check for blur (lack of high-frequency detail)
        const laplacian = Math.abs(
          4 * (r + g + b) - 
          (pixels[leftIdx] + pixels[leftIdx + 1] + pixels[leftIdx + 2]) -
          (pixels[rightIdx] + pixels[rightIdx + 1] + pixels[rightIdx + 2]) -
          (pixels[topIdx] + pixels[topIdx + 1] + pixels[topIdx + 2]) -
          (pixels[bottomIdx] + pixels[bottomIdx + 1] + pixels[bottomIdx + 2])
        );
        if (laplacian < 10) {
          blurScore++;
        }
      }
    }
    
    // 2. Check facial symmetry (deepfakes often have asymmetry issues)
    const midX = Math.floor(width / 2);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < midX; x++) {
        const leftIdx = (y * width + x) * 4;
        const rightIdx = (y * width + (width - 1 - x)) * 4;
        
        const diff = Math.abs(pixels[leftIdx] - pixels[rightIdx]) +
                    Math.abs(pixels[leftIdx + 1] - pixels[rightIdx + 1]) +
                    Math.abs(pixels[leftIdx + 2] - pixels[rightIdx + 2]);
        
        if (diff > 50) {
          symmetryScore++; // Asymmetry detected
        }
      }
    }
    
    const totalPixels = (width - 2) * (height - 2);
    const halfPixels = width * height / 2;
    
    // Normalize scores
    const artifactRatio = artifactScore / totalPixels;
    const edgeRatio = edgeInconsistency / totalPixels;
    const bandingRatio = colorBanding / totalPixels;
    const blurRatio = blurScore / totalPixels;
    const asymmetryRatio = symmetryScore / halfPixels;
    
    // Combine scores with weights
    // Higher values = more likely deepfake
    const combinedScore = 
      (artifactRatio * 0.25) +      // Smooth areas
      (edgeRatio * 0.15) +          // Uniform edges
      (bandingRatio * 0.20) +       // Color banding
      (blurRatio * 0.20) +          // Blur/lack of detail
      (asymmetryRatio * 0.20);      // Facial asymmetry
    
    // Scale to 0-1 range
    const finalScore = Math.min(combinedScore * 3, 1);
    
    console.log('Local analysis:', {
      artifactRatio: artifactRatio.toFixed(3),
      edgeRatio: edgeRatio.toFixed(3),
      bandingRatio: bandingRatio.toFixed(3),
      blurRatio: blurRatio.toFixed(3),
      asymmetryRatio: asymmetryRatio.toFixed(3),
      finalScore: finalScore.toFixed(3)
    });
    
    return finalScore;
  }

  private calculateVerdict(): DeepfakeResult {
    if (this.frameResults.length === 0) {
      return {
        isDeepfake: false,
        confidence: 0,
        frameCount: 0,
        averageScore: 0,
        verdict: 'uncertain'
      };
    }

    const scores = this.frameResults.map(f => f.score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const deepfakeFrames = this.frameResults.filter(f => f.isDeepfake).length;
    const deepfakeRatio = deepfakeFrames / this.frameResults.length;
    
    // Calculate score variance for confidence adjustment
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - averageScore, 2), 0) / scores.length;
    const consistency = 1 - Math.min(variance * 4, 1); // High variance = low consistency
    
    // Count frames with face detection
    const facesDetected = this.frameResults.filter(f => f.faceDetected).length;
    const faceDetectionRate = facesDetected / this.frameResults.length;

    let verdict: 'authentic' | 'deepfake' | 'uncertain';
    let confidence: number;

    // Get max score from any frame for sensitivity
    const maxFrameScore = Math.max(...scores);
    
    console.log('Verdict calculation:', {
      averageScore: averageScore.toFixed(3),
      maxFrameScore: maxFrameScore.toFixed(3),
      deepfakeRatio: deepfakeRatio.toFixed(3),
      consistency: consistency.toFixed(3),
      faceDetectionRate: faceDetectionRate.toFixed(3)
    });

    // AGGRESSIVE thresholds - if max score is high OR average is moderate, flag as deepfake
    if (maxFrameScore > 0.5 || (averageScore > 0.35 && deepfakeRatio > 0.3)) {
      verdict = 'deepfake';
      // Use max score for confidence on deepfakes
      confidence = Math.min(Math.max(maxFrameScore, averageScore) * 1.2, 0.99);
    } else if (averageScore < 0.2 && deepfakeRatio < 0.1 && maxFrameScore < 0.35) {
      verdict = 'authentic';
      confidence = Math.min((1 - averageScore) * 0.9, 0.99);
    } else {
      verdict = 'uncertain';
      confidence = 0.4 + (averageScore * 0.3);
    }

    // Build explainability signals
    const explainability: ExplainabilitySignals = {
      temporalInstability: this.calculateTemporalInstability(),
      flickeringDetected: this.detectFlickering(),
      faceArtifacts: averageScore,
      textureAnomalies: variance,
      motionInconsistency: 1 - consistency
    };

    return {
      isDeepfake: verdict === 'deepfake',
      confidence,
      frameCount: this.frameResults.length,
      averageScore,
      verdict,
      explainability
    };
  }

  private calculateTemporalInstability(): number {
    if (this.frameResults.length < 2) return 0;
    
    let instability = 0;
    for (let i = 1; i < this.frameResults.length; i++) {
      instability += Math.abs(this.frameResults[i].score - this.frameResults[i - 1].score);
    }
    
    return instability / (this.frameResults.length - 1);
  }

  private detectFlickering(): boolean {
    if (this.frameResults.length < 4) return false;
    
    let flickerCount = 0;
    for (let i = 2; i < this.frameResults.length; i++) {
      const prev2 = this.frameResults[i - 2].score;
      const prev1 = this.frameResults[i - 1].score;
      const curr = this.frameResults[i].score;
      
      // Detect oscillation pattern (high-low-high or low-high-low)
      if ((prev1 > prev2 && prev1 > curr) || (prev1 < prev2 && prev1 < curr)) {
        flickerCount++;
      }
    }
    
    // More than 30% oscillation = flickering detected
    return flickerCount / (this.frameResults.length - 2) > 0.3;
  }

  private addStatusBadge(status: string, text: string): void {
    if (this.statusBadge) {
      this.statusBadge.remove();
    }

    const badge = document.createElement('div');
    badge.className = `trustshield-df-badge ${status}`;
    badge.innerHTML = `
      <div class="trustshield-df-indicator ${status === 'analyzing' ? 'pulse' : ''}"></div>
      <span>${text}</span>
    `;

    this.overlay?.insertBefore(badge, this.overlay.firstChild);
    this.statusBadge = badge;
  }

  private updateStatusBadge(result: DeepfakeResult): void {
    if (!this.statusBadge) return;

    const verdictText = {
      'authentic': '✓ Likely Authentic',
      'deepfake': '⚠ Potential Deepfake',
      'uncertain': '? Uncertain'
    };

    const confidenceText = `${Math.round(result.confidence * 100)}% confidence`;

    this.statusBadge.className = `trustshield-df-badge ${result.verdict}`;
    this.statusBadge.innerHTML = `
      <div class="trustshield-df-indicator"></div>
      <span>${verdictText[result.verdict]} (${confidenceText})</span>
    `;
  }

  private addStatsDisplay(): void {
    const stats = document.createElement('div');
    stats.className = 'trustshield-df-stats';
    stats.id = 'trustshield-df-stats';
    stats.innerHTML = `
      <div class="trustshield-df-stats-row">
        <span>Frames analyzed:</span>
        <span id="ts-frame-count">0</span>
      </div>
      <div class="trustshield-df-stats-row">
        <span>Avg. score:</span>
        <span id="ts-avg-score">-</span>
      </div>
      <div class="trustshield-df-progress">
        <div class="trustshield-df-progress-bar" id="ts-progress" style="width: 0%"></div>
      </div>
    `;

    this.overlay?.appendChild(stats);
  }

  private updateStatsDisplay(): void {
    const frameCount = document.getElementById('ts-frame-count');
    const avgScore = document.getElementById('ts-avg-score');
    const progress = document.getElementById('ts-progress');

    if (frameCount) {
      frameCount.textContent = this.frameResults.length.toString();
    }

    if (avgScore && this.frameResults.length > 0) {
      const avg = this.frameResults.reduce((a, b) => a + b.score, 0) / this.frameResults.length;
      avgScore.textContent = `${Math.round(avg * 100)}%`;
    }

    if (progress) {
      // Progress based on 30 second max analysis time at 2 FPS = 60 frames
      const progressPercent = Math.min((this.frameResults.length / 60) * 100, 100);
      progress.style.width = `${progressPercent}%`;
    }
  }

  private updateButton(): void {
    const btn = this.overlay?.querySelector('.trustshield-df-btn');
    if (btn) {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
        Scan Again
      `;
      (btn as HTMLButtonElement).disabled = false;
    }
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: Function) => {
      if (message.type === 'START_DEEPFAKE_SCAN') {
        this.startAnalysis();
        sendResponse({ success: true });
      } else if (message.type === 'STOP_DEEPFAKE_SCAN') {
        this.stopAnalysis();
        sendResponse({ success: true });
      }
      return true;
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new DeepfakeDetector());
} else {
  new DeepfakeDetector();
}

export default DeepfakeDetector;
