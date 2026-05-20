// HuggingFaceDetector.ts - Pretrained Deepfake Detection via HuggingFace Space
// Uses PraneshJs/fakevideodetect image endpoint for frame-by-frame analysis

import { BaseDetector } from './BaseDetector';
import { DetectorResult } from '../types';

interface FramePrediction {
  frameIndex: number;
  score: number;
  label: string;
  timestamp: number;
}

interface HFApiResponse {
  label: string;
  confidence: number;
}

export class HuggingFaceDetector extends BaseDetector {
  // HuggingFace Gradio Space API (CORS-enabled)
  private readonly API_URL = 'https://iemsayan-deepfake-detector.hf.space';
  private readonly API_ENDPOINT = '/gradio_api/call/predict';
  
  // Frame capture settings
  private readonly FRAME_COUNT = 18;
  private readonly FRAME_INTERVAL_MS = 300;
  
  // Thresholds - more strict
  private readonly FAKE_THRESHOLD = 0.50;
  private readonly SUSPICIOUS_THRESHOLD = 0.35;

  constructor(config: { threshold: number; timeout?: number }) {
    super('HuggingFaceDetector', config);
  }

  async detect(videoElement: HTMLVideoElement): Promise<DetectorResult> {
    const startTime = performance.now();
    
    try {
      this.log('Starting HuggingFace deepfake detection');
      console.log('🤖 HuggingFaceDetector: Starting frame analysis...');

      // Step 1: Capture frames from video
      console.log(`📸 Capturing ${this.FRAME_COUNT} frames...`);
      const frames = await this.captureFrames(videoElement);
      console.log(`📸 Captured ${frames.length} frames`);

      if (frames.length === 0) {
        throw new Error('No frames captured from video');
      }

      // Step 2: Upload each frame to HuggingFace API
      console.log('⬆️ Analyzing frames with HuggingFace...');
      const predictions = await this.getPredictions(frames);
      console.log(`🔮 Received ${predictions.length} predictions`);

      // Step 3: Aggregate predictions
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
  private async captureFrames(videoElement: HTMLVideoElement): Promise<string[]> {
    const frames: string[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

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
   * Get predictions for all frames
   */
  private async getPredictions(frames: string[]): Promise<FramePrediction[]> {
    const predictions: FramePrediction[] = [];

    for (let i = 0; i < frames.length; i++) {
      try {
        const prediction = await this.uploadAndPredict(frames[i], i);
        if (prediction) {
          predictions.push(prediction);
        }
      } catch (error) {
        console.warn(`Frame ${i} prediction failed:`, error);
        this.log(`Frame ${i} prediction failed: ${error}`);
      }

      // Small delay between API calls to avoid rate limiting
      if (i < frames.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return predictions;
  }

  /**
   * Upload a single frame to HuggingFace Gradio API
   */
  private async uploadAndPredict(
    base64Image: string,
    frameIndex: number
  ): Promise<FramePrediction | null> {
    const timestamp = Date.now();

    // POST to initiate prediction
    const postResponse = await fetch(`${this.API_URL}${this.API_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [{
          url: base64Image,
          orig_name: `frame_${frameIndex}.jpg`,
          mime_type: 'image/jpeg',
          meta: { _type: 'gradio.FileData' }
        }],
      }),
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error('API POST error:', postResponse.status, errorText);
      throw new Error(`API POST failed: ${postResponse.status}`);
    }

    const postResult = await postResponse.json();
    const eventId = postResult.event_id;

    if (!eventId) {
      throw new Error('No event_id returned from API');
    }

    // GET to retrieve result
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

    // The API returns "FAKE (XX%)" or "REAL (XX%)"
    // For FAKE: fake score = confidence (e.g., FAKE 65% → 0.65 fake score)
    // For REAL: fake score = 1 - confidence (e.g., REAL 65% → 0.35 fake score)
    const isFake = result.label.toUpperCase().includes('FAKE');
    const fakeScore = isFake ? result.confidence : (1 - result.confidence);

    console.log(`Frame ${frameIndex}: ${result.label} (${(result.confidence * 100).toFixed(1)}%) → Fake score: ${(fakeScore * 100).toFixed(1)}%`);

    return {
      frameIndex,
      score: fakeScore,
      label: result.label,
      timestamp,
    };
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
          
          if (Array.isArray(data) && data.length > 0) {
            const output = data[0];
            
            if (typeof output === 'string') {
              // Format: "FAKE (54.27%)" or "REAL (53.06%)"
              const matchPercent = output.match(/(REAL|FAKE)\s*\((\d+\.?\d*)%?\)/i);
              if (matchPercent) {
                const label = matchPercent[1].toUpperCase();
                const confidence = parseFloat(matchPercent[2]) / 100;
                return { label, confidence };
              }
              
              // Fallback: check for FAKE/REAL keywords
              if (output.toUpperCase().includes('FAKE')) {
                const confMatch = output.match(/(\d+\.?\d*)/);
                const confidence = confMatch ? parseFloat(confMatch[1]) / 100 : 0.6;
                return { label: 'FAKE', confidence };
              } else if (output.toUpperCase().includes('REAL')) {
                const confMatch = output.match(/(\d+\.?\d*)/);
                const confidence = confMatch ? parseFloat(confMatch[1]) / 100 : 0.6;
                return { label: 'REAL', confidence };
              }
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
    
    // Count frames where the model said FAKE (score > 0.5)
    const fakeFrameCount = predictions.filter(p => p.score > 0.5).length;
    const fakeFrameRatio = fakeFrameCount / predictions.length;

    console.log(`📊 Aggregation: ${fakeFrameCount}/${predictions.length} frames flagged as FAKE (${(fakeFrameRatio * 100).toFixed(1)}%)`);
    console.log(`📊 Average score: ${(averageScore * 100).toFixed(1)}%, Max score: ${(maxScore * 100).toFixed(1)}%`);

    let verdict: string;
    let isFake: boolean;
    let confidence: number;

    // Use the higher of: average score OR fake frame ratio
    const effectiveScore = Math.max(averageScore, fakeFrameRatio);

    if (effectiveScore >= this.FAKE_THRESHOLD) {
      verdict = 'Likely Manipulated';
      isFake = true;
      confidence = effectiveScore;
    } else if (effectiveScore >= this.SUSPICIOUS_THRESHOLD) {
      verdict = 'Suspicious / Uncertain';
      isFake = true; // Flag as fake if suspicious (more strict)
      confidence = effectiveScore;
    } else {
      verdict = 'Likely Authentic';
      isFake = false;
      confidence = 1 - effectiveScore;
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
