// LocalONNXDetector.ts - Local ONNX-based Deepfake Detection using Transformers.js
// Uses CLIP for zero-shot classification to detect deepfakes

import { BaseDetector } from './BaseDetector';
import { DetectorResult } from '../types';
import { pipeline, env } from '@xenova/transformers';

interface FramePrediction {
  frameIndex: number;
  score: number;
  label: string;
  timestamp: number;
}

// Configure Transformers.js for browser extension environment
env.allowLocalModels = false;
env.useBrowserCache = true;

export class LocalONNXDetector extends BaseDetector {
  // Use CLIP for zero-shot classification (Transformers.js compatible)
  private readonly MODEL_ID = 'Xenova/clip-vit-base-patch32';
  private classifier: any = null;
  private isModelLoading = false;
  
  // Labels for zero-shot classification
  private readonly LABELS = [
    'a real authentic photo of a person',
    'a deepfake or AI-generated synthetic image of a person',
  ];
  
  // Frame capture settings
  private readonly FRAME_COUNT = 8;
  private readonly FRAME_INTERVAL_MS = 500;
  private readonly FACE_CROP_SIZE = 224; // ViT expects 224x224
  
  // Aggregation thresholds
  private readonly FAKE_THRESHOLD = 0.65;
  private readonly SUSPICIOUS_THRESHOLD = 0.45;

  constructor(config: { threshold: number; timeout?: number }) {
    super('LocalONNXDetector', config);
  }

  async detect(videoElement: HTMLVideoElement): Promise<DetectorResult> {
    const startTime = performance.now();
    
    try {
      this.log('Starting local ONNX deepfake detection');
      console.log('🤖 LocalONNXDetector: Starting analysis...');

      // Step 1: Load model if not loaded
      await this.loadModel();

      // Step 2: Capture frames from video
      const frames = await this.captureFrames(videoElement);
      console.log(`📸 Captured ${frames.length} frames`);

      if (frames.length === 0) {
        throw new Error('No frames captured from video');
      }

      // Step 3: Get predictions for each frame
      const predictions = await this.getPredictions(frames);
      console.log(`🔮 Received ${predictions.length} predictions`);

      // Step 4: Aggregate predictions
      const aggregatedResult = this.aggregatePredictions(predictions);
      
      const processingTime = performance.now() - startTime;

      console.log('🎯 LocalONNXDetector result:', {
        isFake: aggregatedResult.isFake,
        confidence: aggregatedResult.confidence,
        verdict: aggregatedResult.verdict,
        framesAnalyzed: predictions.length,
      });

      return {
        isFake: aggregatedResult.isFake,
        confidence: aggregatedResult.confidence,
        details: {
          verdict: aggregatedResult.verdict,
          averageScore: aggregatedResult.averageScore,
          maxScore: aggregatedResult.maxScore,
          framesAnalyzed: predictions.length,
          framePredictions: predictions,
        },
        processingTime,
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ LocalONNXDetector error:', errorMessage);
      this.log(`Detection failed: ${errorMessage}`);

      return {
        isFake: false,
        confidence: 0,
        details: { error: errorMessage },
        processingTime,
      };
    }
  }

  /**
   * Load the ONNX model using Transformers.js
   */
  private async loadModel(): Promise<void> {
    if (this.classifier) {
      return; // Already loaded
    }

    if (this.isModelLoading) {
      // Wait for existing load to complete
      while (this.isModelLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isModelLoading = true;
    console.log('📦 Loading deepfake detection model...');
    this.log('Loading ONNX model...');

    try {
      // Use zero-shot-image-classification with CLIP
      this.classifier = await pipeline(
        'zero-shot-image-classification',
        this.MODEL_ID,
        { 
          quantized: true,
        }
      );
      console.log('✅ CLIP model loaded successfully');
      this.log('Model loaded');
    } finally {
      this.isModelLoading = false;
    }
  }

  /**
   * Capture multiple frames from video at regular intervals
   */
  private async captureFrames(videoElement: HTMLVideoElement): Promise<string[]> {
    const frames: string[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    const width = videoElement.videoWidth || 640;
    const height = videoElement.videoHeight || 480;
    
    // Calculate center crop for face region
    const cropSize = Math.min(width, height);
    const cropX = (width - cropSize) / 2;
    const cropY = (height - cropSize) / 2;
    
    canvas.width = this.FACE_CROP_SIZE;
    canvas.height = this.FACE_CROP_SIZE;

    this.log(`Capturing ${this.FRAME_COUNT} frames at ${width}x${height}`);

    for (let i = 0; i < this.FRAME_COUNT; i++) {
      // Draw cropped and resized frame
      ctx.drawImage(
        videoElement,
        cropX, cropY, cropSize, cropSize,
        0, 0, this.FACE_CROP_SIZE, this.FACE_CROP_SIZE
      );
      
      // Convert to data URL for Transformers.js
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      frames.push(dataUrl);

      // Wait before capturing next frame
      if (i < this.FRAME_COUNT - 1) {
        await new Promise(resolve => setTimeout(resolve, this.FRAME_INTERVAL_MS));
      }
    }

    return frames;
  }

  /**
   * Get predictions for all frames using CLIP zero-shot classification
   */
  private async getPredictions(frames: string[]): Promise<FramePrediction[]> {
    const predictions: FramePrediction[] = [];

    for (let i = 0; i < frames.length; i++) {
      try {
        // CLIP zero-shot classification with candidate labels
        const result = await this.classifier(frames[i], this.LABELS);
        
        // Result format: [{ label: 'a deepfake...', score: 0.7 }, { label: 'a real...', score: 0.3 }]
        const deepfakeResult = result.find((r: any) => 
          r.label.toLowerCase().includes('deepfake') || 
          r.label.toLowerCase().includes('synthetic') ||
          r.label.toLowerCase().includes('ai-generated')
        );
        const score = deepfakeResult ? deepfakeResult.score : 0;

        predictions.push({
          frameIndex: i,
          score,
          label: score > 0.5 ? 'Deepfake' : 'Real',
          timestamp: Date.now(),
        });

        console.log(`Frame ${i}: ${score > 0.5 ? 'Deepfake' : 'Real'} (${(score * 100).toFixed(1)}%)`);
      } catch (error) {
        console.warn(`Frame ${i} prediction failed:`, error);
        this.log(`Frame ${i} prediction failed: ${error}`);
      }
    }

    return predictions;
  }

  /**
   * Aggregate multiple frame predictions into final result
   */
  private aggregatePredictions(predictions: FramePrediction[]): {
    isFake: boolean;
    confidence: number;
    verdict: string;
    averageScore: number;
    maxScore: number;
  } {
    if (predictions.length === 0) {
      return {
        isFake: false,
        confidence: 0,
        verdict: 'No predictions available',
        averageScore: 0,
        maxScore: 0,
      };
    }

    const scores = predictions.map(p => p.score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);

    let verdict: string;
    let isFake: boolean;
    let confidence: number;

    if (averageScore >= this.FAKE_THRESHOLD) {
      verdict = 'Likely Manipulated';
      isFake = true;
      confidence = averageScore;
    } else if (averageScore >= this.SUSPICIOUS_THRESHOLD) {
      verdict = 'Suspicious / Uncertain';
      isFake = false;
      confidence = averageScore;
    } else {
      verdict = 'Likely Authentic';
      isFake = false;
      confidence = 1 - averageScore;
    }

    return {
      isFake,
      confidence,
      verdict,
      averageScore,
      maxScore,
    };
  }
}
