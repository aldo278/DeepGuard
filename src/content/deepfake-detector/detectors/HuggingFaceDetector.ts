// HuggingFaceDetector.ts - Pretrained Deepfake Detection via HuggingFace Space
// Uses divagar006/newmultimodal for both image frame analysis AND video analysis

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

interface VideoAnalysisResult {
  score: number;
  label: string;
  confidence: number;
}

export class HuggingFaceDetector extends BaseDetector {
  // HuggingFace Gradio Space API (divagar006/newmultimodal - multimodal deepfake detector)
  private readonly API_URL = 'https://divagar006-newmultimodal.hf.space';
  private readonly IMAGE_ENDPOINT = '/gradio_api/call/predict';    // Image analysis
  private readonly VIDEO_ENDPOINT = '/gradio_api/call/predict_1';  // Video analysis
  
  // Frame capture settings
  private readonly FRAME_COUNT = 18;
  private readonly FRAME_INTERVAL_MS = 300;
  
  // Thresholds
  private readonly FAKE_THRESHOLD = 0.50;
  private readonly SUSPICIOUS_THRESHOLD = 0.35;
  
  // Weight for combining frame and video analysis (0.6 = 60% frames, 40% video)
  private readonly FRAME_WEIGHT = 0.6;
  private readonly VIDEO_WEIGHT = 0.4;

  constructor(config: { threshold: number; timeout?: number }) {
    super('HuggingFaceDetector', config);
  }

  async detect(videoElement: HTMLVideoElement): Promise<DetectorResult> {
    const startTime = performance.now();
    
    try {
      this.log('Starting HuggingFace deepfake detection (multimodal)');
      console.log('🤖 HuggingFaceDetector: Starting dual analysis (frames + video)...');

      // Step 1: Capture frames from video
      console.log(`📸 Capturing ${this.FRAME_COUNT} frames...`);
      const frames = await this.captureFrames(videoElement);
      console.log(`📸 Captured ${frames.length} frames`);

      if (frames.length === 0) {
        throw new Error('No frames captured from video');
      }

      // Step 2: Capture video clip for video analysis
      console.log('🎬 Capturing video clip...');
      const videoBlob = await this.captureVideoClip(videoElement);
      console.log(`🎬 Captured video clip: ${(videoBlob.size / 1024).toFixed(1)}KB`);

      // Step 3: Run frame analysis and video analysis in parallel
      console.log('⬆️ Analyzing with HuggingFace (frames + video)...');
      const [framePredictions, videoResult] = await Promise.all([
        this.getPredictions(frames),
        this.analyzeVideo(videoBlob),
      ]);
      
      console.log(`🔮 Received ${framePredictions.length} frame predictions`);
      if (videoResult) {
        console.log(`🎬 Video analysis: ${videoResult.label} (${(videoResult.confidence * 100).toFixed(1)}%)`);
      }

      // Step 4: Aggregate frame predictions
      const frameResult = this.aggregatePredictions(framePredictions);
      
      // Step 5: Combine frame and video results
      const combinedResult = this.combineResults(frameResult, videoResult);
      
      const processingTime = performance.now() - startTime;

      console.log('🎯 HuggingFaceDetector result:', {
        isFake: combinedResult.isFake,
        confidence: combinedResult.confidence,
        verdict: combinedResult.verdict,
        framesAnalyzed: framePredictions.length,
        videoAnalyzed: !!videoResult,
      });

      return {
        isFake: combinedResult.isFake,
        confidence: combinedResult.confidence,
        details: {
          verdict: combinedResult.verdict,
          averageScore: combinedResult.averageScore,
          maxScore: combinedResult.maxScore,
          framesAnalyzed: framePredictions.length,
          framePredictions: framePredictions,
          videoResult: videoResult,
          combinedScore: combinedResult.combinedScore,
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
   * Capture a video clip from the video element using MediaRecorder
   */
  private async captureVideoClip(videoElement: HTMLVideoElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context for video capture'));
        return;
      }

      const width = videoElement.videoWidth || 640;
      const height = videoElement.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;

      // Get a stream from the canvas
      const stream = canvas.captureStream(30); // 30 fps
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: 1000000, // 1 Mbps
      });

      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };

      mediaRecorder.onerror = (e) => {
        reject(new Error('MediaRecorder error'));
      };

      // Start recording
      mediaRecorder.start();

      // Record for ~3 seconds (capture frames to canvas)
      const recordDuration = 3000;
      const frameInterval = 33; // ~30fps
      let elapsed = 0;

      const captureFrame = () => {
        if (elapsed >= recordDuration) {
          mediaRecorder.stop();
          return;
        }
        
        ctx.drawImage(videoElement, 0, 0, width, height);
        elapsed += frameInterval;
        setTimeout(captureFrame, frameInterval);
      };

      captureFrame();
    });
  }

  /**
   * Analyze video using the video endpoint
   */
  private async analyzeVideo(videoBlob: Blob): Promise<VideoAnalysisResult | null> {
    try {
      // Convert blob to base64 data URL
      const base64Video = await this.blobToBase64(videoBlob);
      
      // POST to video endpoint
      const postResponse = await fetch(`${this.API_URL}${this.VIDEO_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: [{
            video: {
              url: base64Video,
              orig_name: 'capture.webm',
              mime_type: 'video/webm',
              meta: { _type: 'gradio.FileData' }
            }
          }],
        }),
      });

      if (!postResponse.ok) {
        console.warn('Video API POST failed:', postResponse.status);
        return null;
      }

      const postResult = await postResponse.json();
      const eventId = postResult.event_id;

      if (!eventId) {
        console.warn('No event_id for video analysis');
        return null;
      }

      // GET to retrieve result
      const getResponse = await fetch(
        `${this.API_URL}${this.VIDEO_ENDPOINT}/${eventId}`
      );

      if (!getResponse.ok) {
        console.warn('Video API GET failed:', getResponse.status);
        return null;
      }

      const responseText = await getResponse.text();
      console.log('🎬 Video API raw response:', responseText);
      const result = this.parseSSEResponse(responseText);

      if (!result) {
        console.warn('Failed to parse video API response:', responseText);
        return null;
      }

      const isFake = result.label.toUpperCase().includes('FAKE');
      const fakeScore = isFake ? result.confidence : (1 - result.confidence);

      return {
        score: fakeScore,
        label: result.label,
        confidence: result.confidence,
      };
    } catch (error) {
      console.warn('Video analysis failed:', error);
      return null;
    }
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
   * Combine frame analysis and video analysis results
   */
  private combineResults(
    frameResult: { isFake: boolean; confidence: number; verdict: string; averageScore: number; maxScore: number },
    videoResult: VideoAnalysisResult | null
  ): {
    isFake: boolean;
    confidence: number;
    verdict: string;
    averageScore: number;
    maxScore: number;
    combinedScore: number;
  } {
    // If no video result, use frame result only
    if (!videoResult) {
      console.log('📊 Using frame analysis only (video analysis unavailable)');
      return {
        ...frameResult,
        combinedScore: frameResult.averageScore,
      };
    }

    // Combine scores with weights
    const frameScore = frameResult.averageScore;
    const videoScore = videoResult.score;
    const combinedScore = (frameScore * this.FRAME_WEIGHT) + (videoScore * this.VIDEO_WEIGHT);

    console.log(`📊 Combined score: ${(combinedScore * 100).toFixed(1)}% (frames: ${(frameScore * 100).toFixed(1)}% × ${this.FRAME_WEIGHT}, video: ${(videoScore * 100).toFixed(1)}% × ${this.VIDEO_WEIGHT})`);

    let verdict: string;
    let isFake: boolean;
    let confidence: number;

    if (combinedScore >= this.FAKE_THRESHOLD) {
      verdict = 'Likely Manipulated';
      isFake = true;
      confidence = combinedScore;
    } else if (combinedScore >= this.SUSPICIOUS_THRESHOLD) {
      verdict = 'Suspicious / Uncertain';
      isFake = true;
      confidence = combinedScore;
    } else {
      verdict = 'Likely Authentic';
      isFake = false;
      confidence = 1 - combinedScore;
    }

    return {
      isFake,
      confidence,
      verdict,
      averageScore: frameResult.averageScore,
      maxScore: Math.max(frameResult.maxScore, videoScore),
      combinedScore,
    };
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

    // POST to initiate prediction (image endpoint)
    const postResponse = await fetch(`${this.API_URL}${this.IMAGE_ENDPOINT}`, {
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
      `${this.API_URL}${this.IMAGE_ENDPOINT}/${eventId}`
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
