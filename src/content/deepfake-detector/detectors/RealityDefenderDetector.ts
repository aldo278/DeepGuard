// RealityDefenderDetector.ts - Enterprise-grade Deepfake Detection via Reality Defender API
// Uses Reality Defender's ensemble models for accurate deepfake detection

import { BaseDetector } from './BaseDetector';
import { DetectorResult } from '../types';

// Chrome extension types
declare const chrome: any;

interface RealityDefenderResult {
  status: 'AUTHENTIC' | 'FAKE' | 'SUSPICIOUS' | 'NOT_APPLICABLE' | 'UNABLE_TO_EVALUATE' | 'PROCESSING';
  finalScore: number;
  requestId: string;
}

export class RealityDefenderDetector extends BaseDetector {
  private readonly API_BASE = 'https://api.prd.realitydefender.xyz/api';
  private readonly API_KEY: string;
  
  // Image capture settings (free tier only supports images, not video)
  private readonly FRAME_COUNT = 5;          // Analyze 5 frames
  private readonly FRAME_INTERVAL_MS = 500;  // 500ms between frames
  private readonly MAX_POLL_ATTEMPTS = 30;   // Max polling attempts per frame
  private readonly POLL_INTERVAL_MS = 2000;  // Poll every 2 seconds

  constructor(config: { threshold: number; timeout?: number }) {
    super('RealityDefenderDetector', config);
    this.API_KEY = import.meta.env.VITE_REALITYDEFENDER_API_KEY || '';
    
    if (!this.API_KEY) {
      console.warn('⚠️ Reality Defender API key not found in environment variables');
    }
  }

  async detect(videoElement: HTMLVideoElement): Promise<DetectorResult> {
    const startTime = performance.now();
    
    try {
      if (!this.API_KEY) {
        throw new Error('Reality Defender API key not configured');
      }

      this.log('Starting Reality Defender deepfake detection');
      console.log('🛡️ RealityDefenderDetector: Starting enterprise-grade analysis...');

      // Step 1: Capture frames from video (free tier only supports images)
      console.log(`📸 Capturing ${this.FRAME_COUNT} frames...`);
      const frames = await this.captureFrames(videoElement);
      console.log(`📸 Captured ${frames.length} frames`);

      // Step 2: Analyze each frame with Reality Defender
      const results: RealityDefenderResult[] = [];
      for (let i = 0; i < frames.length; i++) {
        console.log(`� Analyzing frame ${i + 1}/${frames.length}...`);
        try {
          const result = await this.analyzeFrame(frames[i], i);
          if (result) {
            results.push(result);
            console.log(`   Frame ${i + 1}: ${result.status} (score: ${result.finalScore})`);
          }
        } catch (error) {
          console.warn(`   Frame ${i + 1} analysis failed:`, error);
        }
      }

      if (results.length === 0) {
        throw new Error('No frames could be analyzed');
      }

      // Step 3: Aggregate results
      const aggregated = this.aggregateResults(results);
      console.log(`🎯 Analysis complete: ${aggregated.status} (score: ${aggregated.finalScore})`);

      const processingTime = performance.now() - startTime;

      // Convert Reality Defender result to our format
      // Treat both FAKE and SUSPICIOUS as fake (SUSPICIOUS indicates potential manipulation)
      const isFake = aggregated.status === 'FAKE' || aggregated.status === 'SUSPICIOUS';
      const confidence = aggregated.finalScore / 100;

      let verdict: string;
      if (aggregated.status === 'FAKE') {
        verdict = 'Deepfake Detected';
      } else if (aggregated.status === 'SUSPICIOUS') {
        verdict = 'Suspicious Content';
      } else if (aggregated.status === 'AUTHENTIC') {
        verdict = 'Likely Authentic';
      } else if (aggregated.status === 'NOT_APPLICABLE') {
        verdict = 'Unable to Analyze (no faces detected)';
      } else {
        verdict = 'Analysis Inconclusive';
      }

      console.log('🛡️ RealityDefenderDetector result:', {
        isFake,
        confidence,
        verdict,
        status: aggregated.status,
        score: aggregated.finalScore,
        framesAnalyzed: results.length,
      });

      return {
        isFake,
        confidence,
        details: {
          verdict,
          status: aggregated.status,
          finalScore: aggregated.finalScore,
          framesAnalyzed: results.length,
          frameResults: results,
        },
        processingTime,
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ RealityDefenderDetector error:', errorMessage);
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
   * Analyze a single frame with Reality Defender API
   */
  private async analyzeFrame(base64Image: string, frameIndex: number): Promise<RealityDefenderResult | null> {
    // Get presigned URL for this frame
    const { presignedUrl, requestId } = await this.getPresignedUrl(frameIndex);
    
    // Upload the image
    await this.uploadImage(presignedUrl, base64Image);
    
    // Poll for results
    const result = await this.pollForResults(requestId);
    
    return result;
  }

  /**
   * Aggregate results from multiple frames
   */
  private aggregateResults(results: RealityDefenderResult[]): RealityDefenderResult {
    if (results.length === 0) {
      return { status: 'UNABLE_TO_EVALUATE', finalScore: 0, requestId: '' };
    }

    // Count statuses
    const statusCounts: Record<string, number> = {};
    let totalScore = 0;
    
    for (const result of results) {
      statusCounts[result.status] = (statusCounts[result.status] || 0) + 1;
      totalScore += result.finalScore;
    }

    const avgScore = totalScore / results.length;

    // Determine final status based on majority and scores
    // If any frame is FAKE, consider it FAKE
    if (statusCounts['FAKE'] && statusCounts['FAKE'] > 0) {
      return { status: 'FAKE', finalScore: avgScore, requestId: results[0].requestId };
    }
    
    // If majority is SUSPICIOUS, consider it SUSPICIOUS
    if (statusCounts['SUSPICIOUS'] && statusCounts['SUSPICIOUS'] >= results.length / 2) {
      return { status: 'SUSPICIOUS', finalScore: avgScore, requestId: results[0].requestId };
    }
    
    // If majority is AUTHENTIC, consider it AUTHENTIC
    if (statusCounts['AUTHENTIC'] && statusCounts['AUTHENTIC'] >= results.length / 2) {
      return { status: 'AUTHENTIC', finalScore: avgScore, requestId: results[0].requestId };
    }

    // Default to the most common status
    const sortedStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
    return { 
      status: sortedStatuses[0][0] as RealityDefenderResult['status'], 
      finalScore: avgScore, 
      requestId: results[0].requestId 
    };
  }

  /**
   * Get a presigned URL from Reality Defender API (via background script to bypass CORS)
   */
  private async getPresignedUrl(frameIndex: number = 0): Promise<{ presignedUrl: string; requestId: string }> {
    const fileName = `deepguard_frame_${frameIndex}_${Date.now()}.jpg`;
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'RD_GET_PRESIGNED_URL', payload: { fileName } },
        (response: any) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve({
            presignedUrl: response.presignedUrl,
            requestId: response.requestId,
          });
        }
      );
    });
  }

  /**
   * Upload image to the presigned S3 URL (via background script to bypass CORS)
   */
  private async uploadImage(presignedUrl: string, base64Image: string): Promise<void> {
    // Extract raw base64 data (remove data URL prefix)
    const base64Data = base64Image.split(',')[1];
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'RD_UPLOAD_IMAGE', payload: { presignedUrl, imageData: base64Data } },
        (response: any) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve();
        }
      );
    });
  }

  /**
   * Convert blob to raw base64 (without data URL prefix)
   */
  private blobToBase64Raw(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Remove data URL prefix to get raw base64
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Poll for analysis results (via background script to bypass CORS)
   */
  private async pollForResults(requestId: string): Promise<RealityDefenderResult> {
    // Final statuses that indicate analysis is complete
    const FINAL_STATUSES = ['AUTHENTIC', 'FAKE', 'SUSPICIOUS', 'NOT_APPLICABLE', 'UNABLE_TO_EVALUATE'];
    // Intermediate statuses that mean analysis is still in progress
    const INTERMEDIATE_STATUSES = ['PROCESSING', 'ANALYZING', 'UPLOADING', 'QUEUED'];

    for (let attempt = 0; attempt < this.MAX_POLL_ATTEMPTS; attempt++) {
      console.log(`⏳ Polling for results (attempt ${attempt + 1}/${this.MAX_POLL_ATTEMPTS})...`);
      
      const response = await this.getResults(requestId);
      
      if (response.status === 'PROCESSING') {
        await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL_MS));
        continue;
      }

      if (response.data?.resultsSummary) {
        const status = response.data.resultsSummary.status;
        const finalScore = response.data.resultsSummary.metadata?.finalScore || 0;

        console.log(`   Current status: ${status}`);

        // If still processing/analyzing, continue polling
        if (INTERMEDIATE_STATUSES.includes(status) || !status) {
          await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL_MS));
          continue;
        }

        // If we have a final status, return the result
        if (FINAL_STATUSES.includes(status)) {
          console.log('📦 Reality Defender response:', response.data);

          return {
            status,
            finalScore,
            requestId,
          };
        }

        // Unknown status, log and continue
        console.warn(`   Unknown status: ${status}, continuing to poll...`);
        await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL_MS));
      }

      // Not ready yet, continue polling
      await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL_MS));
    }

    throw new Error('Analysis timed out - please try again');
  }

  /**
   * Get results from Reality Defender API (via background script)
   */
  private async getResults(requestId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'RD_GET_RESULTS', payload: { requestId } },
        (response: any) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        }
      );
    });
  }
}
