// Performance Monitoring and Resource Management for TrustShield

import { PerformanceMetrics, SecurityEvent } from '@/types';
import TRUSTSHIELD_CONFIG from '@/lib/constants';

// Chrome extension types
declare const chrome: any;

export interface PerformanceConfig {
  maxCpuUsage: number;
  maxMemoryUsage: number;
  monitoringInterval: number;
  enableAutoOptimization: boolean;
  enableTelemetry: boolean;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private config: PerformanceConfig;
  private isMonitoring: boolean = false;
  private monitoringInterval: number | null = null;
  private metricsHistory: PerformanceMetrics[] = [];
  private performanceObserver: PerformanceObserver | null = null;

  private constructor() {
    this.config = {
      maxCpuUsage: TRUSTSHIELD_CONFIG.PERFORMANCE.MAX_CPU_USAGE,
      maxMemoryUsage: TRUSTSHIELD_CONFIG.PERFORMANCE.MAX_MEMORY_USAGE,
      monitoringInterval: 5000, // 5 seconds
      enableAutoOptimization: true,
      enableTelemetry: false,
    };
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Initialize performance monitoring
  async initialize(config?: Partial<PerformanceConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Setup performance observers
    this.setupPerformanceObservers();

    // Start monitoring
    this.startMonitoring();

    console.log('Performance monitor initialized');
  }

  // Setup performance observers
  private setupPerformanceObservers(): void {
    try {
      // Observe long tasks
      if ('PerformanceObserver' in window) {
        this.performanceObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'longtask') {
              this.handleLongTask(entry as PerformanceEntry);
            }
          });
        });

        this.performanceObserver.observe({ entryTypes: ['longtask'] });
      }
    } catch (error) {
      console.warn('Performance observer not available:', error);
    }
  }

  // Start performance monitoring
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = window.setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoringInterval);

    console.log('Performance monitoring started');
  }

  // Stop performance monitoring
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    console.log('Performance monitoring stopped');
  }

  // Collect performance metrics
  private async collectMetrics(): Promise<void> {
    try {
      const metrics: PerformanceMetrics = {
        cpuUsage: await this.getCpuUsage(),
        memoryUsage: await this.getMemoryUsage(),
        networkLatency: await this.getNetworkLatency(),
        frameProcessingRate: this.getFrameProcessingRate(),
        apiCallSuccessRate: this.getApiCallSuccessRate(),
        errorRates: {
          deepfake: this.getErrorRate('deepfake'),
          misinfo: this.getErrorRate('misinfo'),
          transcription: this.getErrorRate('transcription'),
        },
        timestamp: Date.now(),
      };

      // Store metrics
      this.metricsHistory.push(metrics);

      // Keep history size limited
      if (this.metricsHistory.length > 100) {
        this.metricsHistory.shift();
      }

      // Check for performance issues
      this.checkPerformanceThresholds(metrics);

      // Send metrics to background script
      this.sendMetricsToBackground(metrics);

    } catch (error) {
      console.error('Failed to collect performance metrics:', error);
    }
  }

  // Get CPU usage (approximation)
  private async getCpuUsage(): Promise<number> {
    try {
      // Use performance timing to estimate CPU usage
      const start = performance.now();
      
      // Perform a small computation
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.random();
      }
      
      const end = performance.now();
      const computationTime = end - start;
      
      // Estimate CPU usage based on computation time
      // This is a rough approximation
      return Math.min(computationTime / 10, 100); // Normalize to 0-100%
    } catch (error) {
      return 0;
    }
  }

  // Get memory usage
  private async getMemoryUsage(): Promise<number> {
    try {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMemory = memory.usedJSHeapSize / 1024 / 1024; // MB
        return usedMemory;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  // Get network latency
  private async getNetworkLatency(): Promise<number> {
    try {
      const start = performance.now();
      
      // Make a small request to measure latency
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
      });
      
      const end = performance.now();
      return end - start;
    } catch (error) {
      return -1; // Indicates network error
    }
  }

  // Get frame processing rate
  private getFrameProcessingRate(): number {
    // This would be calculated from actual frame processing data
    // For now, return a placeholder
    return 5; // FPS
  }

  // Get API call success rate
  private getApiCallSuccessRate(): number {
    // This would be calculated from actual API call data
    // For now, return a placeholder
    return 0.95; // 95% success rate
  }

  // Get error rate for a specific component
  private getErrorRate(component: string): number {
    // This would be calculated from actual error data
    // For now, return placeholders
    switch (component) {
      case 'deepfake':
        return 0.02; // 2% error rate
      case 'misinfo':
        return 0.05; // 5% error rate
      case 'transcription':
        return 0.03; // 3% error rate
      default:
        return 0;
    }
  }

  // Check performance thresholds
  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    // Check CPU usage
    if (metrics.cpuUsage > this.config.maxCpuUsage) {
      this.handleHighCpuUsage(metrics);
    }

    // Check memory usage
    if (metrics.memoryUsage > this.config.maxMemoryUsage) {
      this.handleHighMemoryUsage(metrics);
    }

    // Check network latency
    if (metrics.networkLatency > 5000) { // 5 seconds
      this.handleHighNetworkLatency(metrics);
    }

    // Check error rates
    Object.entries(metrics.errorRates).forEach(([component, rate]) => {
      if (rate > 0.1) { // 10% error rate
        this.handleHighErrorRate(component, rate, metrics);
      }
    });
  }

  // Handle high CPU usage
  private handleHighCpuUsage(metrics: PerformanceMetrics): void {
    console.warn(`High CPU usage detected: ${metrics.cpuUsage}%`);
    
    if (this.config.enableAutoOptimization) {
      // Reduce frame rate
      chrome.runtime.sendMessage({
        type: 'OPTIMIZE_PERFORMANCE',
        payload: {
          action: 'reduce_fps',
          value: Math.max(1, Math.floor(metrics.frameProcessingRate / 2)),
        }
      });
    }

    // Log security event
    this.logPerformanceEvent('HIGH_CPU_USAGE', 'high', {
      cpuUsage: metrics.cpuUsage,
      timestamp: metrics.timestamp,
    });
  }

  // Handle high memory usage
  private handleHighMemoryUsage(metrics: PerformanceMetrics): void {
    console.warn(`High memory usage detected: ${metrics.memoryUsage}MB`);
    
    if (this.config.enableAutoOptimization) {
      // Clear caches and reduce buffer sizes
      chrome.runtime.sendMessage({
        type: 'OPTIMIZE_PERFORMANCE',
        payload: {
          action: 'clear_caches',
        }
      });
    }

    // Log security event
    this.logPerformanceEvent('HIGH_MEMORY_USAGE', 'high', {
      memoryUsage: metrics.memoryUsage,
      timestamp: metrics.timestamp,
    });
  }

  // Handle high network latency
  private handleHighNetworkLatency(metrics: PerformanceMetrics): void {
    console.warn(`High network latency detected: ${metrics.networkLatency}ms`);
    
    if (this.config.enableAutoOptimization) {
      // Switch to offline mode or reduce API calls
      chrome.runtime.sendMessage({
        type: 'OPTIMIZE_PERFORMANCE',
        payload: {
          action: 'reduce_api_calls',
        }
      });
    }

    // Log security event
    this.logPerformanceEvent('HIGH_NETWORK_LATENCY', 'medium', {
      networkLatency: metrics.networkLatency,
      timestamp: metrics.timestamp,
    });
  }

  // Handle high error rate
  private handleHighErrorRate(component: string, rate: number, metrics: PerformanceMetrics): void {
    console.warn(`High error rate detected in ${component}: ${(rate * 100).toFixed(1)}%`);
    
    if (this.config.enableAutoOptimization) {
      // Disable problematic component or reduce its usage
      chrome.runtime.sendMessage({
        type: 'OPTIMIZE_PERFORMANCE',
        payload: {
          action: 'handle_high_error_rate',
          component,
          rate,
        }
      });
    }

    // Log security event
    this.logPerformanceEvent('HIGH_ERROR_RATE', 'medium', {
      component,
      errorRate: rate,
      timestamp: metrics.timestamp,
    });
  }

  // Handle long tasks
  private handleLongTask(entry: PerformanceEntry): void {
    console.warn(`Long task detected: ${entry.duration}ms`);
    
    // Log security event
    this.logPerformanceEvent('LONG_TASK', 'low', {
      duration: entry.duration,
      startTime: entry.startTime,
      timestamp: Date.now(),
    });
  }

  // Send metrics to background script
  private sendMetricsToBackground(metrics: PerformanceMetrics): void {
    try {
      chrome.runtime.sendMessage({
        type: 'PERFORMANCE_UPDATE',
        payload: metrics
      });
    } catch (error) {
      console.error('Failed to send performance metrics:', error);
    }
  }

  // Log performance event
  private logPerformanceEvent(type: string, severity: 'low' | 'medium' | 'high', metadata: any): void {
    const securityEvent: SecurityEvent = {
      eventId: this.generateEventId(),
      type: 'performance' as any,
      severity,
      timestamp: Date.now(),
      metadata: {
        performanceType: type,
        ...metadata,
      },
      sessionId: this.getCurrentSessionId(),
    };

    chrome.runtime.sendMessage({
      type: 'SECURITY_EVENT',
      payload: securityEvent
    });
  }

  // Get performance statistics
  getPerformanceStats(): {
    currentMetrics?: PerformanceMetrics;
    averageCpuUsage: number;
    averageMemoryUsage: number;
    peakCpuUsage: number;
    peakMemoryUsage: number;
    totalSamples: number;
  } {
    if (this.metricsHistory.length === 0) {
      return {
        averageCpuUsage: 0,
        averageMemoryUsage: 0,
        peakCpuUsage: 0,
        peakMemoryUsage: 0,
        totalSamples: 0,
      };
    }

    const currentMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    const cpuUsages = this.metricsHistory.map(m => m.cpuUsage);
    const memoryUsages = this.metricsHistory.map(m => m.memoryUsage);

    return {
      currentMetrics,
      averageCpuUsage: cpuUsages.reduce((sum, cpu) => sum + cpu, 0) / cpuUsages.length,
      averageMemoryUsage: memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length,
      peakCpuUsage: Math.max(...cpuUsages),
      peakMemoryUsage: Math.max(...memoryUsages),
      totalSamples: this.metricsHistory.length,
    };
  }

  // Get metrics history
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  // Clear metrics history
  clearMetricsHistory(): void {
    this.metricsHistory = [];
  }

  // Update configuration
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Generate event ID
  private generateEventId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get current session ID
  private getCurrentSessionId(): string {
    return `session_${Date.now()}`;
  }

  // Cleanup
  destroy(): void {
    this.stopMonitoring();
    this.metricsHistory = [];
  }
}

// Resource Manager
export class ResourceManager {
  private static instance: ResourceManager;
  private resources: Map<string, any> = new Map();
  private resourceLimits: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  // Register a resource
  registerResource(name: string, resource: any, limit?: number): void {
    this.resources.set(name, resource);
    if (limit) {
      this.resourceLimits.set(name, limit);
    }
  }

  // Unregister a resource
  unregisterResource(name: string): void {
    const resource = this.resources.get(name);
    if (resource) {
      // Cleanup resource if it has a cleanup method
      if (typeof resource.destroy === 'function') {
        resource.destroy();
      } else if (typeof resource.close === 'function') {
        resource.close();
      }
    }
    this.resources.delete(name);
    this.resourceLimits.delete(name);
  }

  // Get resource usage
  getResourceUsage(name: string): number {
    const resource = this.resources.get(name);
    if (!resource) return 0;

    // Calculate usage based on resource type
    if (resource instanceof Map || resource instanceof Set) {
      return resource.size;
    } else if (Array.isArray(resource)) {
      return resource.length;
    } else if (typeof resource === 'object' && resource !== null) {
      return Object.keys(resource).length;
    }

    return 1;
  }

  // Check if resource is over limit
  isResourceOverLimit(name: string): boolean {
    const usage = this.getResourceUsage(name);
    const limit = this.resourceLimits.get(name);
    return limit ? usage > limit : false;
  }

  // Cleanup resources over limit
  cleanupOverLimitResources(): void {
    this.resourceLimits.forEach((limit, name) => {
      if (this.isResourceOverLimit(name)) {
        const resource = this.resources.get(name);
        if (resource) {
          // Remove oldest items
          if (resource instanceof Map) {
            const entries = Array.from(resource.entries());
            const toRemove = entries.slice(0, entries.length - limit);
            toRemove.forEach(([key]) => resource.delete(key));
          } else if (Array.isArray(resource)) {
            resource.splice(0, resource.length - limit);
          }
        }
      }
    });
  }

  // Get all resource usage
  getAllResourceUsage(): Record<string, { usage: number; limit?: number; overLimit: boolean }> {
    const usage: Record<string, { usage: number; limit?: number; overLimit: boolean }> = {};
    
    this.resources.forEach((resource, name) => {
      const resourceUsage = this.getResourceUsage(name);
      const limit = this.resourceLimits.get(name);
      
      usage[name] = {
        usage: resourceUsage,
        limit,
        overLimit: limit ? resourceUsage > limit : false,
      };
    });

    return usage;
  }

  // Cleanup all resources
  cleanup(): void {
    this.resources.forEach((resource, name) => {
      this.unregisterResource(name);
    });
  }
}

export default PerformanceMonitor;
