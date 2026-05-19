// FrequencyDetector.ts - Frequency Domain Artifact Detector
// Analyzes images in frequency space using 2D FFT to detect GAN artifacts

import { BaseDetector } from './BaseDetector';
import { DetectorResult } from '../types';

export class FrequencyDetector extends BaseDetector {
  // Lowered threshold - compressed videos naturally have less high-freq energy
  private readonly HIGH_FREQ_THRESHOLD = 0.08;
  // Increased peak threshold - need more suspicious peaks to flag as fake
  private readonly PEAK_COUNT_THRESHOLD = 15;

  constructor(config: { threshold: number; timeout?: number }) {
    super('FrequencyDetector', config);
  }

  async detect(videoElement: HTMLVideoElement): Promise<DetectorResult> {
    return this.runWithTimeout(
      async () => this.analyzeFrequencyArtifacts(videoElement),
      await this.getFrequencyDetails()
    );
  }

  private async analyzeFrequencyArtifacts(
    videoElement: HTMLVideoElement
  ): Promise<boolean> {
    console.log('🔬 FrequencyDetector: Starting frequency analysis');

    // Capture frame from video
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('❌ FrequencyDetector: Failed to get canvas context');
      return false;
    }

    // Use smaller size for faster processing
    const analyzeWidth = Math.min(videoElement.videoWidth || 256, 256);
    const analyzeHeight = Math.min(videoElement.videoHeight || 256, 256);
    
    canvas.width = analyzeWidth;
    canvas.height = analyzeHeight;
    
    console.log(`📐 FrequencyDetector: Analyzing at ${analyzeWidth}x${analyzeHeight}`);

    // Analyze multiple frames
    const numFrames = 5;
    const frameResults: boolean[] = [];
    
    for (let frame = 0; frame < numFrames; frame++) {
      ctx.drawImage(videoElement, 0, 0, analyzeWidth, analyzeHeight);

      // Convert to grayscale
      const imageData = ctx.getImageData(0, 0, analyzeWidth, analyzeHeight);
      const grayscale = this.toGrayscale(imageData);

      // Apply 2D FFT
      const fftResult = this.fft2D(grayscale, analyzeWidth, analyzeHeight);
      
      // Shift zero frequency to center
      const shifted = this.fftShift(fftResult, analyzeWidth, analyzeHeight);
      
      // Calculate magnitude spectrum
      const magnitude = this.calculateMagnitude(shifted);

      // Calculate radial average profile
      const radialProfile = this.calculateRadialAverage(
        magnitude,
        analyzeWidth,
        analyzeHeight
      );

      // Analyze for artifacts
      const highFreqEnergy = this.calculateHighFrequencyEnergy(radialProfile);
      const suspiciousPeaks = this.findSuspiciousPeaks(radialProfile);

      console.log(`📊 FrequencyDetector Frame ${frame + 1}:`, {
        highFreqEnergy: highFreqEnergy.toFixed(4),
        suspiciousPeakCount: suspiciousPeaks.length,
        threshold: this.HIGH_FREQ_THRESHOLD,
        peakThreshold: this.PEAK_COUNT_THRESHOLD,
      });

      // Low high-frequency energy or many suspicious peaks indicates fake
      const frameFake =
        highFreqEnergy < this.HIGH_FREQ_THRESHOLD ||
        suspiciousPeaks.length > this.PEAK_COUNT_THRESHOLD;
      
      frameResults.push(frameFake);
      
      // Wait a bit before next frame
      if (frame < numFrames - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Majority vote
    const fakeCount = frameResults.filter(r => r).length;
    const isFake = fakeCount >= Math.ceil(numFrames / 2);
    
    console.log(`🎯 FrequencyDetector: ${fakeCount}/${numFrames} frames detected as fake. Final: ${isFake ? 'FAKE' : 'REAL'}`);

    return isFake;
  }

  private async getFrequencyDetails(): Promise<Record<string, any>> {
    return {
      method: '2D FFT radial analysis',
      highFreqThreshold: this.HIGH_FREQ_THRESHOLD,
      peakCountThreshold: this.PEAK_COUNT_THRESHOLD,
    };
  }

  private toGrayscale(imageData: ImageData): number[] {
    const grayscale: number[] = [];
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      grayscale.push(0.299 * r + 0.587 * g + 0.114 * b);
    }
    return grayscale;
  }

  private fft2D(
    data: number[],
    width: number,
    height: number
  ): { real: number[]; imag: number[] } {
    // Simplified 2D FFT using row-column decomposition
    const real = [...data];
    const imag = new Array(data.length).fill(0);

    // FFT on rows
    for (let y = 0; y < height; y++) {
      const rowReal = real.slice(y * width, (y + 1) * width);
      const rowImag = imag.slice(y * width, (y + 1) * width);
      const { real: fftReal, imag: fftImag } = this.fft1D(rowReal, rowImag);
      for (let x = 0; x < width; x++) {
        real[y * width + x] = fftReal[x];
        imag[y * width + x] = fftImag[x];
      }
    }

    // FFT on columns
    for (let x = 0; x < width; x++) {
      const colReal: number[] = [];
      const colImag: number[] = [];
      for (let y = 0; y < height; y++) {
        colReal.push(real[y * width + x]);
        colImag.push(imag[y * width + x]);
      }
      const { real: fftReal, imag: fftImag } = this.fft1D(colReal, colImag);
      for (let y = 0; y < height; y++) {
        real[y * width + x] = fftReal[y];
        imag[y * width + x] = fftImag[y];
      }
    }

    return { real, imag };
  }

  private fft1D(
    real: number[],
    imag: number[]
  ): { real: number[]; imag: number[] } {
    const n = real.length;
    if (n <= 1) return { real, imag };

    // Pad to power of 2 if needed
    const paddedLength = Math.pow(2, Math.ceil(Math.log2(n)));
    const paddedReal = [...real, ...new Array(paddedLength - n).fill(0)];
    const paddedImag = [...imag, ...new Array(paddedLength - n).fill(0)];

    // Cooley-Tukey FFT
    this.cooleyTukeyFFT(paddedReal, paddedImag);

    return {
      real: paddedReal.slice(0, n),
      imag: paddedImag.slice(0, n),
    };
  }

  private cooleyTukeyFFT(real: number[], imag: number[]): void {
    const n = real.length;
    if (n <= 1) return;

    // Bit-reversal permutation
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    // Cooley-Tukey iterative FFT
    for (let len = 2; len <= n; len <<= 1) {
      const halfLen = len >> 1;
      const angle = (-2 * Math.PI) / len;
      const wReal = Math.cos(angle);
      const wImag = Math.sin(angle);

      for (let i = 0; i < n; i += len) {
        let curReal = 1;
        let curImag = 0;

        for (let k = 0; k < halfLen; k++) {
          const evenIdx = i + k;
          const oddIdx = i + k + halfLen;

          const tReal = curReal * real[oddIdx] - curImag * imag[oddIdx];
          const tImag = curReal * imag[oddIdx] + curImag * real[oddIdx];

          real[oddIdx] = real[evenIdx] - tReal;
          imag[oddIdx] = imag[evenIdx] - tImag;
          real[evenIdx] = real[evenIdx] + tReal;
          imag[evenIdx] = imag[evenIdx] + tImag;

          const newReal = curReal * wReal - curImag * wImag;
          const newImag = curReal * wImag + curImag * wReal;
          curReal = newReal;
          curImag = newImag;
        }
      }
    }
  }

  private fftShift(
    data: { real: number[]; imag: number[] },
    width: number,
    height: number
  ): { real: number[]; imag: number[] } {
    const shiftedReal = new Array(data.real.length);
    const shiftedImag = new Array(data.imag.length);

    const halfW = Math.floor(width / 2);
    const halfH = Math.floor(height / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = y * width + x;
        const newX = (x + halfW) % width;
        const newY = (y + halfH) % height;
        const dstIdx = newY * width + newX;

        shiftedReal[dstIdx] = data.real[srcIdx];
        shiftedImag[dstIdx] = data.imag[srcIdx];
      }
    }

    return { real: shiftedReal, imag: shiftedImag };
  }

  private calculateMagnitude(data: { real: number[]; imag: number[] }): number[] {
    return data.real.map((r, i) =>
      Math.log1p(Math.sqrt(r * r + data.imag[i] * data.imag[i]))
    );
  }

  private calculateRadialAverage(
    magnitude: number[],
    width: number,
    height: number
  ): number[] {
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const maxRadius = Math.floor(Math.min(width, height) / 2);

    const radialSum: number[] = new Array(maxRadius).fill(0);
    const radialCount: number[] = new Array(maxRadius).fill(0);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const radius = Math.floor(Math.sqrt(dx * dx + dy * dy));

        if (radius < maxRadius) {
          radialSum[radius] += magnitude[y * width + x];
          radialCount[radius]++;
        }
      }
    }

    return radialSum.map((sum, i) =>
      radialCount[i] > 0 ? sum / radialCount[i] : 0
    );
  }

  private calculateHighFrequencyEnergy(radialProfile: number[]): number {
    const highFreqStart = Math.floor(radialProfile.length * 0.7);
    const highFreqValues = radialProfile.slice(highFreqStart);
    const totalEnergy = radialProfile.reduce((a, b) => a + b, 0);
    const highFreqEnergy = highFreqValues.reduce((a, b) => a + b, 0);

    return totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;
  }

  private findSuspiciousPeaks(radialProfile: number[]): number[] {
    const peaks: number[] = [];
    const mean = radialProfile.reduce((a, b) => a + b, 0) / radialProfile.length;
    const threshold = mean * 2;

    for (let i = 1; i < radialProfile.length - 1; i++) {
      if (
        radialProfile[i] > radialProfile[i - 1] &&
        radialProfile[i] > radialProfile[i + 1] &&
        radialProfile[i] > threshold
      ) {
        peaks.push(i);
      }
    }

    return peaks;
  }
}
