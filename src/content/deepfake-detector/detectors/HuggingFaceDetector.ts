// HuggingFaceDetector.ts - Pretrained Deepfake Detection via HuggingFace Space
// Uploads face crops to a HuggingFace Gradio API and aggregates predictions

import { BaseDetector } from './BaseDetector';
import { DetectorResult } from '../types';

interface FramePrediction {
  frameIndex: number;
  score: number; // 0-1, higher = more likely fake
  label: string;
  timestamp: number;
}

interface HFApiResponse {
  label: string;
  confidence: number;
}

export class HuggingFaceDetector extends BaseDetector {
  // HuggingFace Space API endpoint (Gradio API format)
  private readonly API_URL = 'https://jabrave-deepfake-api.hf.space';
  private readonly API_ENDPOINT = '/gradio_api/call/predict';
  
  // Frame capture settings
  private readonly FRAME_COUNT = 8;
  private readonly FRAME_INTERVAL_MS = 500;
  private readonly FACE_CROP_SIZE = 224;
  
  // Aggregation thresholds
  private readonly FAKE_THRESHOLD = 0.65;
  private readonly SUSPICIOUS_THRESHOLD = 0.45;

  constructor(config: { threshold: number; timeout?: number }) {
    super('HuggingFaceDetector', config);
  }

  async detect(videoElement: HTMLVideoElement): Promise<DetectorResult> {
    const startTime = performance.now();
    
    try {
      this.log('Starting HuggingFace deepfake detection');
      console.log('🤖 HuggingFaceDetector: Starting analysis...');

      // Step 1: Capture frames from video
      const frames = await this.captureFrames(videoElement);
      console.log(`📸 Captured ${frames.length} frames`);

      if (frames.length === 0) {
        throw new Error('No frames captured from video');
      }

      // Step 2: Detect and crop faces from each frame
      const faceCrops = await this.extractFaceCrops(frames, videoElement);
      console.log(`👤 Extracted ${faceCrops.length} face crops`);

      if (faceCrops.length === 0) {
        throw new Error('No faces detected in video frames');
      }

      // Step 3: Upload each face crop to HuggingFace API
      const predictions = await this.getPredictions(faceCrops);
      console.log(`🔮 Received ${predictions.length} predictions`);

      // Step 4: Aggregate predictions
      const aggregatedResult = this.aggregatePredictions(predictions);
      
      const processingTime = performance.now() - startTime;

      console.log('🎯 HuggingFaceDetector result:', {
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
      console.error('❌ HuggingFaceDetector error:', errorMessage);
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
   * Capture multiple frames from video at regular intervals
   */
  private async captureFrames(videoElement: HTMLVideoElement): Promise<ImageData[]> {
    const frames: ImageData[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    const width = videoElement.videoWidth || 640;
    const height = videoElement.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;

    this.log(`Capturing ${this.FRAME_COUNT} frames at ${width}x${height}`);

    for (let i = 0; i < this.FRAME_COUNT; i++) {
      ctx.drawImage(videoElement, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      frames.push(imageData);

      // Wait before capturing next frame
      if (i < this.FRAME_COUNT - 1) {
        await new Promise(resolve => setTimeout(resolve, this.FRAME_INTERVAL_MS));
      }
    }

    return frames;
  }

  /**
   * Extract face crops from frames using simple face detection
   * For MVP, we'll use the center crop as a fallback if no face detection is available
   */
  private async extractFaceCrops(
    frames: ImageData[],
    videoElement: HTMLVideoElement
  ): Promise<Blob[]> {
    const crops: Blob[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    canvas.width = this.FACE_CROP_SIZE;
    canvas.height = this.FACE_CROP_SIZE;

    for (let i = 0; i < frames.length; i++) {
      // For MVP: Use center crop (assumes face is roughly centered)
      // TODO: Integrate BlazeFace or MediaPipe for proper face detection
      const frame = frames[i];
      const srcSize = Math.min(frame.width, frame.height);
      const srcX = (frame.width - srcSize) / 2;
      const srcY = (frame.height - srcSize) / 2;

      // Create temporary canvas for the frame
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = frame.width;
      tempCanvas.height = frame.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) continue;
      
      tempCtx.putImageData(frame, 0, 0);

      // Draw cropped and resized face region
      ctx.drawImage(
        tempCanvas,
        srcX, srcY, srcSize, srcSize,
        0, 0, this.FACE_CROP_SIZE, this.FACE_CROP_SIZE
      );

      // Convert to blob
      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.9);
      });

      if (blob) {
        crops.push(blob);
      }
    }

    return crops;
  }

  /**
   * Upload face crops to HuggingFace API and get predictions
   */
  private async getPredictions(faceCrops: Blob[]): Promise<FramePrediction[]> {
    const predictions: FramePrediction[] = [];

    for (let i = 0; i < faceCrops.length; i++) {
      try {
        const prediction = await this.uploadAndPredict(faceCrops[i], i);
        if (prediction) {
          predictions.push(prediction);
        }
      } catch (error) {
        console.warn(`Frame ${i} prediction failed:`, error);
        this.log(`Frame ${i} prediction failed: ${error}`);
      }

      // Small delay between API calls to avoid rate limiting
      if (i < faceCrops.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return predictions;
  }

  /**
   * Upload a single image to HuggingFace Gradio API
   */
  private async uploadAndPredict(
    imageBlob: Blob,
    frameIndex: number
  ): Promise<FramePrediction | null> {
    const timestamp = Date.now();

    // Convert blob to base64 data URL
    const base64 = await this.blobToBase64(imageBlob);

    // Step 1: POST to initiate prediction
    const postResponse = await fetch(`${this.API_URL}${this.API_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [base64],
      }),
    });

    if (!postResponse.ok) {
      throw new Error(`API POST failed: ${postResponse.status}`);
    }

    const postResult = await postResponse.json();
    const eventId = postResult.event_id;

    if (!eventId) {
      throw new Error('No event_id returned from API');
    }

    // Step 2: GET to retrieve result
    const getResponse = await fetch(
      `${this.API_URL}${this.API_ENDPOINT}/${eventId}`
    );

    if (!getResponse.ok) {
      throw new Error(`API GET failed: ${getResponse.status}`);
    }

    // Parse SSE response
    const responseText = await getResponse.text();
    const result = this.parseSSEResponse(responseText);

    if (!result) {
      throw new Error('Failed to parse API response');
    }

    // Parse the prediction result
    // Expected format: { label: "fake" | "real", confidence: 0.XX }
    const score = result.label?.toLowerCase() === 'fake' 
      ? result.confidence 
      : 1 - result.confidence;

    return {
      frameIndex,
      score,
      label: result.label || 'unknown',
      timestamp,
    };
  }

  /**
   * Convert Blob to base64 data URL
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Parse Server-Sent Events response from Gradio API
   */
  private parseSSEResponse(responseText: string): HFApiResponse | null {
    const lines = responseText.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const dataStr = line.substring(5).trim();
        try {
          const data = JSON.parse(dataStr);
          // Gradio returns array of outputs
          if (Array.isArray(data) && data.length > 0) {
            const output = data[0];
            // Handle different response formats
            if (typeof output === 'object' && output !== null) {
              return {
                label: output.label || output.prediction || 'unknown',
                confidence: output.confidence || output.score || 0.5,
              };
            } else if (typeof output === 'string') {
              // Simple string response like "fake" or "real"
              return {
                label: output,
                confidence: 0.8, // Default confidence for simple responses
              };
            }
          }
        } catch (e) {
          // Continue to next line
        }
      }
    }

    return null;
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
      isFake = false; // Not confident enough to flag as fake
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
