// Deepfake Detector Content Script - Pre-trained Model Approach
// Uses Hugging Face Deep-Fake-Detector-v2-Model (ViT) for accurate detection
// 92% accuracy on deepfake classification

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js for browser
env.allowLocalModels = false;
env.useBrowserCache = true;

declare const chrome: any;

// Confidence levels instead of binary fake/authentic
type ConfidenceLevel = 'low' | 'medium' | 'high';

interface DeepfakeResult {
  isDeepfake: boolean;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  frameCount: number;
  averageScore: number;
  verdict: 'authentic' | 'deepfake' | 'uncertain';
  explainability?: ExplainabilitySignals;
}

interface ExplainabilitySignals {
  embeddingVariance: number;
  temporalConsistency: number;
  faceDetectionRate: number;
  predictionStability: number;
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
  
  // Hugging Face deepfake classifier (pre-trained ViT model)
  private deepfakeClassifier: any = null;
  private classifierLoaded: boolean = false;
  private predictionBuffer: number[] = []; // Store frame predictions
  
  // Face detection model (BlazeFace via TensorFlow.js)
  private faceDetector: any = null;
  private faceDetectorLoaded: boolean = false;
  
  // Configuration
  private readonly FPS = 4;
  private readonly MIN_FRAMES_FOR_VERDICT = 8;
  private readonly INPUT_SIZE = 224;
  private readonly SEQUENCE_LENGTH = 16;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.injectStyles();
    await this.initTensorFlow();
    await this.initDeepfakeClassifier();
    await this.initFaceDetector();
    this.detectPlatform();
    this.setupMessageListener();
    console.log('TrustShield Deepfake Detector: Ready (Hugging Face ViT Model)');
  }

  private async initTensorFlow(): Promise<void> {
    try {
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

  private async initDeepfakeClassifier(): Promise<void> {
    try {
      // Load pre-trained deepfake detection model from Hugging Face
      console.log('Loading Hugging Face deepfake classifier...');
      this.deepfakeClassifier = await pipeline(
        'image-classification',
        'onnx-community/Deep-Fake-Detector-v2-Model-ONNX'
      );
      this.classifierLoaded = true;
      console.log('Hugging Face deepfake classifier loaded (92% accuracy)');
    } catch (error) {
      console.error('Deepfake classifier loading failed:', error);
      console.log('Falling back to heuristic-based detection');
      // Mark as loaded but will use fallback
      this.classifierLoaded = false;
    }
  }

  private async initFaceDetector(): Promise<void> {
    try {
      const blazeface = await import('@tensorflow-models/blazeface');
      this.faceDetector = await blazeface.load();
      this.faceDetectorLoaded = true;
      console.log('BlazeFace face detector loaded');
    } catch (error) {
      console.warn('BlazeFace loading failed:', error);
    }
  }

  private async classifyFrame(canvas: HTMLCanvasElement): Promise<{ label: string; score: number } | null> {
    if (!this.classifierLoaded || !this.deepfakeClassifier) {
      console.warn('Classifier not loaded yet');
      return null;
    }
    
    try {
      // Convert canvas to blob for the classifier
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9);
      });
      
      // Run inference with the pre-trained deepfake model
      const results = await this.deepfakeClassifier(blob);
      
      console.log('Raw classifier results:', results);
      
      if (results && results.length > 0) {
        // Log all labels to understand the output format
        console.log('Labels found:', results.map((r: any) => `${r.label}: ${r.score.toFixed(4)}`));
        
        // Find the deepfake prediction
        const deepfakeResult = results.find((r: any) => 
          r.label.toLowerCase().includes('deepfake') || 
          r.label.toLowerCase().includes('fake')
        );
        const realResult = results.find((r: any) => 
          r.label.toLowerCase().includes('real') || 
          r.label.toLowerCase().includes('realism')
        );
        
        if (deepfakeResult) {
          return { label: 'deepfake', score: deepfakeResult.score };
        } else if (realResult) {
          // If real has high score, deepfake score is low
          return { label: 'real', score: 1 - realResult.score };
        }
        
        // Fallback: use first result
        return { label: results[0].label, score: results[0].score };
      }
      
      return null;
    } catch (error) {
      console.error('Frame classification failed:', error);
      return null;
    }
  }

  private computePredictionVariance(): number {
    if (this.predictionBuffer.length < 2) return 0;
    
    const mean = this.predictionBuffer.reduce((a, b) => a + b, 0) / this.predictionBuffer.length;
    const variance = this.predictionBuffer.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / this.predictionBuffer.length;
    return variance;
  }

  private computePredictionConsistency(): number {
    if (this.predictionBuffer.length < 2) return 1;
    
    // Check how consistent predictions are
    let changes = 0;
    for (let i = 1; i < this.predictionBuffer.length; i++) {
      if (Math.abs(this.predictionBuffer[i] - this.predictionBuffer[i-1]) > 0.3) {
        changes++;
      }
    }
    
    return 1 - (changes / (this.predictionBuffer.length - 1));
  }

  // Heuristic-based analysis fallback when ML model unavailable
  private async analyzeWithHeuristics(imageData: ImageData, faceDetected: boolean): Promise<number> {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    if (width < 10 || height < 10) return 0.5;
    
    // 1. Skin tone unnaturalness - deepfakes often have unnatural skin colors
    let skinScore = 0;
    let skinPixels = 0;
    let unnaturalSkin = 0;
    
    for (let i = 0; i < pixels.length; i += 16) { // Sample every 4th pixel
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      
      // Detect skin-like pixels (simplified skin detection)
      const isSkinLike = r > 95 && g > 40 && b > 20 && 
                         r > g && r > b && 
                         Math.abs(r - g) > 15 && 
                         r - b > 15;
      
      if (isSkinLike) {
        skinPixels++;
        
        // Check for unnatural skin tones (too saturated, wrong hue)
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max > 0 ? (max - min) / max : 0;
        
        // Deepfakes often have oversaturated or undersaturated skin
        if (saturation > 0.6 || saturation < 0.1) {
          unnaturalSkin++;
        }
        
        // Check for plastic-like smoothness (low local variance)
        if (i > width * 4 && i < pixels.length - width * 4) {
          const above = pixels[i - width * 4];
          const below = pixels[i + width * 4];
          const localVar = Math.abs(r - above) + Math.abs(r - below);
          if (localVar < 5) { // Too smooth = suspicious
            unnaturalSkin++;
          }
        }
      }
    }
    
    skinScore = skinPixels > 100 ? unnaturalSkin / (skinPixels * 2) : 0;
    
    // 2. Edge sharpness anomaly - deepfakes have unnatural edge patterns
    let edgeScore = 0;
    let edgeSamples = 0;
    let sharpEdges = 0;
    let blurryEdges = 0;
    
    for (let y = 2; y < height - 2; y += 4) {
      for (let x = 2; x < width - 2; x += 4) {
        const idx = (y * width + x) * 4;
        const c = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
        
        // Sobel-like edge detection
        const left = (pixels[idx - 4] + pixels[idx - 3] + pixels[idx - 2]) / 3;
        const right = (pixels[idx + 4] + pixels[idx + 5] + pixels[idx + 6]) / 3;
        const up = (pixels[idx - width * 4] + pixels[idx - width * 4 + 1] + pixels[idx - width * 4 + 2]) / 3;
        const down = (pixels[idx + width * 4] + pixels[idx + width * 4 + 1] + pixels[idx + width * 4 + 2]) / 3;
        
        const gradX = Math.abs(right - left);
        const gradY = Math.abs(down - up);
        const gradient = Math.sqrt(gradX * gradX + gradY * gradY);
        
        if (gradient > 30) { // Edge detected
          edgeSamples++;
          if (gradient > 80) sharpEdges++; // Very sharp edge
          if (gradient < 40) blurryEdges++; // Soft edge
        }
      }
    }
    
    // Deepfakes often have inconsistent edge sharpness
    const sharpRatio = edgeSamples > 0 ? sharpEdges / edgeSamples : 0;
    const blurryRatio = edgeSamples > 0 ? blurryEdges / edgeSamples : 0;
    edgeScore = Math.abs(sharpRatio - blurryRatio); // Imbalance is suspicious
    
    // 3. Color channel correlation - deepfakes often have unusual RGB relationships
    let colorScore = 0;
    let rTotal = 0, gTotal = 0, bTotal = 0;
    let rgCorr = 0, rbCorr = 0, gbCorr = 0;
    const sampleCount = Math.floor(pixels.length / 16);
    
    for (let i = 0; i < pixels.length; i += 16) {
      rTotal += pixels[i];
      gTotal += pixels[i + 1];
      bTotal += pixels[i + 2];
    }
    
    const rMean = rTotal / sampleCount;
    const gMean = gTotal / sampleCount;
    const bMean = bTotal / sampleCount;
    
    for (let i = 0; i < pixels.length; i += 16) {
      const rDev = pixels[i] - rMean;
      const gDev = pixels[i + 1] - gMean;
      const bDev = pixels[i + 2] - bMean;
      rgCorr += rDev * gDev;
      rbCorr += rDev * bDev;
      gbCorr += gDev * bDev;
    }
    
    // Normalize correlations
    rgCorr = Math.abs(rgCorr) / (sampleCount * 10000);
    rbCorr = Math.abs(rbCorr) / (sampleCount * 10000);
    gbCorr = Math.abs(gbCorr) / (sampleCount * 10000);
    
    // Unusual correlation patterns are suspicious
    colorScore = Math.abs(rgCorr - gbCorr) + Math.abs(rbCorr - gbCorr);
    colorScore = Math.min(colorScore, 1);
    
    // 4. Temporal analysis from prediction buffer
    let temporalScore = 0;
    if (this.predictionBuffer.length >= 4) {
      // Check for oscillating predictions (sign of inconsistent detection)
      let oscillations = 0;
      for (let i = 2; i < this.predictionBuffer.length; i++) {
        const prev2 = this.predictionBuffer[i - 2];
        const prev1 = this.predictionBuffer[i - 1];
        const curr = this.predictionBuffer[i];
        if ((prev1 > prev2 && prev1 > curr) || (prev1 < prev2 && prev1 < curr)) {
          oscillations++;
        }
      }
      temporalScore = oscillations / (this.predictionBuffer.length - 2);
    }
    
    // Combine scores with aggressive weighting
    let finalScore: number;
    if (faceDetected) {
      // Face detected: skin and edge analysis more important
      finalScore = (skinScore * 0.35) + (edgeScore * 0.30) + (colorScore * 0.20) + (temporalScore * 0.15);
    } else {
      // No face: rely on edge and color
      finalScore = (skinScore * 0.15) + (edgeScore * 0.35) + (colorScore * 0.35) + (temporalScore * 0.15);
    }
    
    // Amplify the score - be more aggressive in detection
    // Map 0.1-0.3 range to 0.4-0.7 range for better discrimination
    finalScore = 0.3 + (finalScore * 2.5);
    finalScore = Math.min(1, Math.max(0, finalScore));
    
    console.log('Heuristic analysis:', {
      skinScore: skinScore.toFixed(4),
      edgeScore: edgeScore.toFixed(4),
      colorScore: colorScore.toFixed(4),
      temporalScore: temporalScore.toFixed(4),
      finalScore: finalScore.toFixed(4),
      faceDetected
    });
    
    return finalScore;
  }

  // Keep for backwards compatibility but simplified
  private extractFrameFeatures(imageData: ImageData): number[] {
    // Extract a compact feature vector from the frame for LSTM input
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const features: number[] = [];
    
    // 1. Color histogram features (16 bins per channel = 48 features)
    const histR = new Array(16).fill(0);
    const histG = new Array(16).fill(0);
    const histB = new Array(16).fill(0);
    
    for (let i = 0; i < pixels.length; i += 4) {
      histR[Math.floor(pixels[i] / 16)]++;
      histG[Math.floor(pixels[i + 1] / 16)]++;
      histB[Math.floor(pixels[i + 2] / 16)]++;
    }
    
    const numPixels = pixels.length / 4;
    for (let i = 0; i < 16; i++) {
      features.push(histR[i] / numPixels);
      features.push(histG[i] / numPixels);
      features.push(histB[i] / numPixels);
    }
    
    // 2. Edge density features (4 quadrants = 4 features)
    const quadrantEdges = [0, 0, 0, 0];
    const midX = Math.floor(width / 2);
    const midY = Math.floor(height / 2);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const leftIdx = (y * width + (x - 1)) * 4;
        const rightIdx = (y * width + (x + 1)) * 4;
        
        const edgeMag = Math.abs(pixels[idx] - pixels[leftIdx]) + 
                       Math.abs(pixels[idx] - pixels[rightIdx]);
        
        if (edgeMag > 30) {
          const quadrant = (y < midY ? 0 : 2) + (x < midX ? 0 : 1);
          quadrantEdges[quadrant]++;
        }
      }
    }
    
    const quadrantPixels = (width / 2) * (height / 2);
    for (let i = 0; i < 4; i++) {
      features.push(quadrantEdges[i] / quadrantPixels);
    }
    
    // 3. Texture variance features (4 regions = 4 features)
    const regions = [
      { x: 0, y: 0, w: midX, h: midY },
      { x: midX, y: 0, w: width - midX, h: midY },
      { x: 0, y: midY, w: midX, h: height - midY },
      { x: midX, y: midY, w: width - midX, h: height - midY }
    ];
    
    for (const region of regions) {
      let sum = 0, sumSq = 0, count = 0;
      for (let y = region.y; y < region.y + region.h; y++) {
        for (let x = region.x; x < region.x + region.w; x++) {
          const idx = (y * width + x) * 4;
          const gray = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
          sum += gray;
          sumSq += gray * gray;
          count++;
        }
      }
      const mean = sum / count;
      const variance = (sumSq / count) - (mean * mean);
      features.push(variance / 10000); // Normalize
    }
    
    // 4. Brightness and contrast (2 features)
    let totalBrightness = 0;
    let minBrightness = 255, maxBrightness = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      totalBrightness += brightness;
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
    }
    features.push(totalBrightness / (numPixels * 255)); // Normalized brightness
    features.push((maxBrightness - minBrightness) / 255); // Contrast
    
    // 5. Symmetry score (1 feature)
    let symmetryDiff = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < midX; x++) {
        const leftIdx = (y * width + x) * 4;
        const rightIdx = (y * width + (width - 1 - x)) * 4;
        symmetryDiff += Math.abs(pixels[leftIdx] - pixels[rightIdx]);
      }
    }
    features.push(symmetryDiff / (midX * height * 255));
    
    // 6. High frequency content (1 feature) - Laplacian variance
    let laplacianSum = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const gray = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
        
        const neighbors = [
          ((y - 1) * width + x) * 4,
          ((y + 1) * width + x) * 4,
          (y * width + (x - 1)) * 4,
          (y * width + (x + 1)) * 4
        ];
        
        let neighborSum = 0;
        for (const nIdx of neighbors) {
          neighborSum += (pixels[nIdx] + pixels[nIdx + 1] + pixels[nIdx + 2]) / 3;
        }
        
        laplacianSum += Math.abs(4 * gray - neighborSum);
      }
    }
    features.push(laplacianSum / ((width - 2) * (height - 2) * 255));
    
    // Pad or truncate to 64 features
    while (features.length < 64) {
      features.push(0);
    }
    
    return features.slice(0, 64);
  }

  // FFT Frequency Analysis (kept as secondary signal only)
  // Deepfakes have different frequency signatures due to GAN artifacts
  private analyzeFFTFeatures(imageData: ImageData): number {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Guard against invalid dimensions
    if (width < 8 || height < 8 || pixels.length === 0) {
      return 0.5; // Neutral score if image too small
    }
    
    // Convert to grayscale for frequency analysis
    const grayscale: number[] = [];
    for (let i = 0; i < pixels.length; i += 4) {
      grayscale.push((pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) / 255);
    }
    
    // Compute DCT-like frequency features (simplified FFT approximation)
    // Real FFT requires complex math, so we use gradient-based frequency estimation
    
    // 1. High-frequency energy (edges, fine details)
    let highFreqEnergy = 0;
    let lowFreqEnergy = 0;
    let totalEnergy = 0;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const center = grayscale[idx];
        
        // Laplacian for high-frequency content
        const laplacian = Math.abs(
          4 * center -
          grayscale[idx - 1] - grayscale[idx + 1] -
          grayscale[idx - width] - grayscale[idx + width]
        );
        
        // Gradient magnitude
        const gx = Math.abs(grayscale[idx + 1] - grayscale[idx - 1]);
        const gy = Math.abs(grayscale[idx + width] - grayscale[idx - width]);
        const gradient = Math.sqrt(gx * gx + gy * gy);
        
        highFreqEnergy += laplacian;
        lowFreqEnergy += center;
        totalEnergy += gradient;
      }
    }
    
    const numPixels = (width - 2) * (height - 2);
    const avgHighFreq = highFreqEnergy / numPixels;
    const avgLowFreq = lowFreqEnergy / numPixels;
    const avgGradient = totalEnergy / numPixels;
    
    // 2. Frequency distribution analysis
    // Deepfakes often have unnaturally uniform high-frequency content
    let freqVariance = 0;
    const blockSize = 16;
    const blockFreqs: number[] = [];
    
    for (let by = 0; by < height - blockSize; by += blockSize) {
      for (let bx = 0; bx < width - blockSize; bx += blockSize) {
        let blockHighFreq = 0;
        for (let y = by; y < by + blockSize - 1; y++) {
          for (let x = bx; x < bx + blockSize - 1; x++) {
            const idx = y * width + x;
            const laplacian = Math.abs(
              4 * grayscale[idx] -
              grayscale[idx - 1] - grayscale[idx + 1] -
              grayscale[idx - width] - grayscale[idx + width]
            );
            blockHighFreq += laplacian;
          }
        }
        blockFreqs.push(blockHighFreq / (blockSize * blockSize));
      }
    }
    
    // Calculate variance of block frequencies
    if (blockFreqs.length > 0) {
      const meanBlockFreq = blockFreqs.reduce((a, b) => a + b, 0) / blockFreqs.length;
      freqVariance = blockFreqs.reduce((sum, f) => sum + Math.pow(f - meanBlockFreq, 2), 0) / blockFreqs.length;
    }
    
    // 3. GAN artifact detection
    // GANs often produce checkerboard patterns in frequency domain
    let checkerboardCount = 0;
    let checkerboardTotal = 0;
    for (let y = 2; y < height - 2; y += 2) {
      for (let x = 2; x < width - 2; x += 2) {
        const idx = y * width + x;
        // Bounds check
        if (idx + width + 1 < grayscale.length) {
          // Check for 2x2 checkerboard pattern
          const pattern = Math.abs(
            grayscale[idx] + grayscale[idx + width + 1] -
            grayscale[idx + 1] - grayscale[idx + width]
          );
          if (pattern > 0.1) {
            checkerboardCount++;
          }
          checkerboardTotal++;
        }
      }
    }
    const checkerboardScore = checkerboardTotal > 0 ? checkerboardCount / checkerboardTotal : 0;
    
    // Combine FFT features into a score
    // Real videos: natural frequency variation, low checkerboard
    // Deepfakes: uniform high-freq, high checkerboard, low variance
    
    // Normalize features with NaN protection
    const normalizedHighFreq = isNaN(avgHighFreq) ? 0.5 : Math.min(avgHighFreq * 10, 1);
    const normalizedVariance = isNaN(freqVariance) ? 0.5 : Math.min(freqVariance * 100, 1);
    const normalizedCheckerboard = isNaN(checkerboardScore) ? 0 : Math.min(checkerboardScore * 5, 1);
    
    // Low variance + high checkerboard = likely deepfake
    // High variance + low checkerboard = likely real
    const fftScore = (
      (1 - normalizedVariance) * 0.4 +  // Low variance = suspicious
      normalizedCheckerboard * 0.4 +     // Checkerboard = suspicious
      normalizedHighFreq * 0.2           // Excessive high-freq = suspicious
    );
    
    // Final NaN check
    const safeFftScore = isNaN(fftScore) ? 0.5 : fftScore;
    
    console.log('FFT analysis:', {
      avgHighFreq: avgHighFreq.toFixed(4),
      freqVariance: freqVariance.toFixed(4),
      checkerboardScore: checkerboardScore.toFixed(4),
      normalizedVariance: normalizedVariance.toFixed(3),
      normalizedCheckerboard: normalizedCheckerboard.toFixed(3),
      fftScore: safeFftScore.toFixed(3)
    });
    
    return safeFftScore;
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
    this.frameBuffer.clear();
    this.predictionBuffer = [];

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

      // Try Hugging Face classifier first, fall back to heuristics
      let finalScore = 0.5;
      let analysisMethod = 'none';
      
      if (this.classifierLoaded && this.deepfakeClassifier) {
        const classification = await this.classifyFrame(canvas);
        if (classification) {
          finalScore = classification.label === 'deepfake' ? classification.score : (1 - classification.score);
          analysisMethod = 'huggingface';
        }
      }
      
      // Fallback: Use heuristic analysis if classifier not available
      if (analysisMethod === 'none') {
        finalScore = await this.analyzeWithHeuristics(alignedFace || imageData, faceDetected);
        analysisMethod = 'heuristics';
      }
      
      // Store prediction for temporal analysis
      this.predictionBuffer.push(finalScore);
      if (this.predictionBuffer.length > this.SEQUENCE_LENGTH * 2) {
        this.predictionBuffer.shift();
      }
      
      console.log('Frame analysis:', {
        method: analysisMethod,
        finalScore: finalScore.toFixed(4),
        predictionBufferSize: this.predictionBuffer.length,
        faceDetected
      });

      // Store result
      this.frameResults.push({
        timestamp: this.videoElement.currentTime,
        score: finalScore,
        isDeepfake: finalScore > 0.5,
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
    if (sequence.length < 4) return 0.3; // Return baseline score if not enough frames

    let flickerScore = 0;
    let motionInconsistency = 0;
    let textureInstability = 0;
    let totalFramePairs = 0;
    
    // Analyze frame-to-frame changes
    for (let i = 1; i < sequence.length; i++) {
      const prevFrame = sequence[i - 1];
      const currFrame = sequence[i];
      totalFramePairs++;
      
      // Calculate brightness difference (flickering)
      const prevBrightness = this.calculateAverageBrightness(prevFrame.imageData);
      const currBrightness = this.calculateAverageBrightness(currFrame.imageData);
      const brightnessDiff = Math.abs(currBrightness - prevBrightness);
      
      // ANY brightness change contributes to flicker score (scaled)
      flickerScore += brightnessDiff / 50; // More sensitive
      
      // Check face region consistency if both frames have faces
      if (prevFrame.alignedFace && currFrame.alignedFace) {
        const faceChange = this.calculateFrameDifference(
          prevFrame.alignedFace, 
          currFrame.alignedFace
        );
        
        // Deepfakes often have EITHER too little change (frozen) OR too much (jitter)
        // Real faces have moderate, natural micro-movements (0.02-0.08 range)
        if (faceChange < 0.02) {
          motionInconsistency += 0.3; // Too static = suspicious
        } else if (faceChange > 0.08) {
          motionInconsistency += 0.2; // Too jumpy = suspicious
        }
        // Natural range (0.02-0.08) adds nothing
        
        // Check texture stability in face region
        const textureChange = this.calculateTextureChange(
          prevFrame.alignedFace,
          currFrame.alignedFace
        );
        
        // Texture changes indicate deepfake artifacts
        textureInstability += textureChange;
      } else {
        // No face detected - add some baseline suspicion
        motionInconsistency += 0.1;
      }
    }
    
    // Normalize scores
    const avgFlicker = flickerScore / totalFramePairs;
    const avgMotion = motionInconsistency / totalFramePairs;
    const avgTexture = textureInstability / totalFramePairs;
    
    // Combine temporal scores - weight motion inconsistency heavily
    const temporalScore = 
      Math.min(avgFlicker, 1) * 0.25 + 
      Math.min(avgMotion, 1) * 0.50 + 
      Math.min(avgTexture, 1) * 0.25;
    
    console.log('Temporal analysis:', {
      avgFlicker: avgFlicker.toFixed(3),
      avgMotion: avgMotion.toFixed(3),
      avgTexture: avgTexture.toFixed(3),
      temporalScore: temporalScore.toFixed(3)
    });
    
    return Math.min(temporalScore, 1);
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
        confidenceLevel: 'low',
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

    // Log all scores for debugging
    console.log('ALL FRAME SCORES:', scores);
    
    // VERY aggressive thresholds - lower bar for deepfake detection
    if (maxFrameScore > 0.35 || averageScore > 0.25) {
      verdict = 'deepfake';
      // Scale confidence: 0.25 avg -> 60%, 0.5 avg -> 90%
      confidence = Math.min(0.5 + (averageScore * 1.5), 0.99);
    } else if (averageScore < 0.15 && maxFrameScore < 0.25) {
      verdict = 'authentic';
      confidence = Math.min((1 - averageScore) * 0.9, 0.99);
    } else {
      verdict = 'uncertain';
      confidence = 0.4 + (averageScore * 0.3);
    }

    // Determine confidence level based on prediction buffer
    let confidenceLevel: ConfidenceLevel = 'low';
    if (this.predictionBuffer.length >= 12) {
      confidenceLevel = 'high';
    } else if (this.predictionBuffer.length >= 8) {
      confidenceLevel = 'medium';
    }

    // Build explainability signals
    const explainability: ExplainabilitySignals = {
      embeddingVariance: this.computePredictionVariance(),
      temporalConsistency: this.computePredictionConsistency(),
      faceDetectionRate,
      predictionStability: consistency
    };

    return {
      isDeepfake: verdict === 'deepfake',
      confidence,
      confidenceLevel,
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
