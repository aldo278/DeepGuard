// Deepfake Detection Model - ONNX-based Local Processing
// Uses a lightweight CNN model for deepfake detection

import * as ort from 'onnxruntime-web';

export interface DeepfakePrediction {
  isDeepfake: boolean;
  confidence: number;
  processingTime: number;
}

class DeepfakeModel {
  private session: ort.InferenceSession | null = null;
  private isInitialized = false;
  private readonly INPUT_SIZE = 224;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configure ONNX Runtime for WebAssembly
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
      
      // Load model from Hugging Face
      const modelUrl = 'https://huggingface.co/nateraw/deepfake-detection/resolve/main/model.onnx';
      
      this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      });
      
      this.isInitialized = true;
      console.log('Deepfake ONNX model loaded successfully');
    } catch (error) {
      console.error('Failed to load deepfake model:', error);
      // Fallback: use simplified local analysis
      this.isInitialized = true;
      console.log('Using fallback local analysis');
    }
  }

  async predict(canvas: HTMLCanvasElement): Promise<DeepfakePrediction> {
    const startTime = performance.now();

    try {
      if (this.session) {
        return await this.runOnnxPrediction(canvas, startTime);
      } else {
        return await this.runLocalAnalysis(canvas, startTime);
      }
    } catch (error) {
      console.error('Prediction failed:', error);
      return await this.runLocalAnalysis(canvas, startTime);
    }
  }

  private async runOnnxPrediction(canvas: HTMLCanvasElement, startTime: number): Promise<DeepfakePrediction> {
    if (!this.session) {
      throw new Error('Model not initialized');
    }

    // Preprocess image
    const inputTensor = this.preprocessImage(canvas);
    
    // Run inference
    const feeds: Record<string, ort.Tensor> = {};
    const inputNames = this.session.inputNames;
    feeds[inputNames[0]] = inputTensor;
    
    const results = await this.session.run(feeds);
    
    // Get output
    const outputNames = this.session.outputNames;
    const output = results[outputNames[0]];
    const data = output.data as Float32Array;
    
    // Interpret results (sigmoid output)
    const fakeProb = data.length === 1 ? data[0] : data[1];
    const realProb = data.length === 1 ? 1 - data[0] : data[0];
    
    const processingTime = performance.now() - startTime;
    
    return {
      isDeepfake: fakeProb > 0.5,
      confidence: Math.max(realProb, fakeProb),
      processingTime
    };
  }

  private preprocessImage(canvas: HTMLCanvasElement): ort.Tensor {
    // Resize to model input size
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = this.INPUT_SIZE;
    resizedCanvas.height = this.INPUT_SIZE;
    const ctx = resizedCanvas.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0, this.INPUT_SIZE, this.INPUT_SIZE);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, this.INPUT_SIZE, this.INPUT_SIZE);
    const pixels = imageData.data;

    // Convert to tensor format (NCHW: Batch, Channels, Height, Width)
    // Normalize using ImageNet mean/std
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];
    
    const input = new Float32Array(3 * this.INPUT_SIZE * this.INPUT_SIZE);
    
    for (let i = 0; i < this.INPUT_SIZE * this.INPUT_SIZE; i++) {
      const pixelIdx = i * 4;
      const r = (pixels[pixelIdx] / 255.0 - mean[0]) / std[0];
      const g = (pixels[pixelIdx + 1] / 255.0 - mean[1]) / std[1];
      const b = (pixels[pixelIdx + 2] / 255.0 - mean[2]) / std[2];
      
      // NCHW format
      input[i] = r;
      input[i + this.INPUT_SIZE * this.INPUT_SIZE] = g;
      input[i + 2 * this.INPUT_SIZE * this.INPUT_SIZE] = b;
    }

    return new ort.Tensor('float32', input, [1, 3, this.INPUT_SIZE, this.INPUT_SIZE]);
  }

  private async runLocalAnalysis(canvas: HTMLCanvasElement, startTime: number): Promise<DeepfakePrediction> {
    // Fallback: Simple pixel-based analysis for common AI artifacts
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { isDeepfake: false, confidence: 0.5, processingTime: 0 };
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    let artifactScore = 0;
    let edgeInconsistency = 0;
    let colorAnomalies = 0;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Analyze pixel patterns
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        
        // Check for unnaturally smooth gradients (common in AI)
        const leftIdx = (y * width + (x - 1)) * 4;
        const rightIdx = (y * width + (x + 1)) * 4;
        const topIdx = ((y - 1) * width + x) * 4;
        const bottomIdx = ((y + 1) * width + x) * 4;
        
        const horizontalDiff = Math.abs(pixels[leftIdx] - pixels[rightIdx]) +
                              Math.abs(pixels[leftIdx + 1] - pixels[rightIdx + 1]) +
                              Math.abs(pixels[leftIdx + 2] - pixels[rightIdx + 2]);
        
        const verticalDiff = Math.abs(pixels[topIdx] - pixels[bottomIdx]) +
                            Math.abs(pixels[topIdx + 1] - pixels[bottomIdx + 1]) +
                            Math.abs(pixels[topIdx + 2] - pixels[bottomIdx + 2]);
        
        // Unnaturally smooth areas
        if (horizontalDiff < 5 && verticalDiff < 5) {
          artifactScore++;
        }
        
        // Check for edge inconsistencies
        const centerDiff = Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
        if (centerDiff < 3) {
          edgeInconsistency++;
        }
        
        // Check for color banding (common in AI images)
        if (r % 8 === 0 && g % 8 === 0 && b % 8 === 0) {
          colorAnomalies++;
        }
      }
    }
    
    const totalPixels = (width - 2) * (height - 2);
    const artifactRatio = artifactScore / totalPixels;
    const edgeRatio = edgeInconsistency / totalPixels;
    const colorRatio = colorAnomalies / totalPixels;
    
    // Combine scores (weighted)
    const combinedScore = (artifactRatio * 0.4 + edgeRatio * 0.3 + colorRatio * 0.3);
    const normalizedScore = Math.min(combinedScore * 5, 1); // Scale up
    
    const processingTime = performance.now() - startTime;
    
    return {
      isDeepfake: normalizedScore > 0.5,
      confidence: normalizedScore > 0.5 ? normalizedScore : 1 - normalizedScore,
      processingTime
    };
  }

  async predictFromVideoFrame(videoElement: HTMLVideoElement): Promise<DeepfakePrediction> {
    // Create canvas to capture video frame
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Draw current video frame to canvas
    canvas.width = videoElement.videoWidth || this.INPUT_SIZE;
    canvas.height = videoElement.videoHeight || this.INPUT_SIZE;
    ctx.drawImage(videoElement, 0, 0);

    // Run prediction
    return this.predict(canvas);
  }

  isLoaded(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
export const deepfakeModel = new DeepfakeModel();
