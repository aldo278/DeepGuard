// src/detectors/BaseDetector.ts

import { DetectorResult } from '../types';

export abstract class BaseDetector {
  protected debugMode: boolean = false;
  protected logs: string[] = [];

  constructor(
    public name: string,
    protected config: { threshold: number; timeout?: number }
  ) {}

  /**
   * Main detection method - must be implemented by each detector
   */
  abstract detect(videoElement: HTMLVideoElement): Promise<DetectorResult>;

  /**
   * Enable debug logging
   */
  enableDebug(): void {
    this.debugMode = true;
    this.logs = [];
  }

  /**
   * Get debug logs
   */
  getDebugLogs(): string[] {
    return this.logs;
  }

  /**
   * Log with timestamp (only if debug enabled)
   */
  protected log(message: string, data?: any): void {
    if (this.debugMode) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${this.name}] ${message}`;
      this.logs.push(logMessage);
      
      if (data) {
        console.log(logMessage, data);
      } else {
        console.log(logMessage);
      }
    }
  }

  /**
   * Wrap detection with timing and error handling
   */
  protected async runWithTimeout(
    fn: () => Promise<boolean>,
    details: Record<string, any>
  ): Promise<DetectorResult> {
    const startTime = performance.now();
    
    try {
      this.log('Starting detection');
      
      const timeoutMs = this.config.timeout || 10000;
      const isFake = await Promise.race([
        fn(),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        ),
      ]);

      const processingTime = performance.now() - startTime;
      this.log(`Detection complete: ${isFake ? 'FAKE' : 'REAL'}`, { processingTime });

      return {
        isFake,
        confidence: isFake ? 0.8 : 0.2, // Override in child classes
        details,
        processingTime,
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Detection failed: ${errorMessage}`, { error });
      
      return {
        isFake: false,
        confidence: 0,
        details: { error: errorMessage },
        processingTime,
      };
    }
  }
}