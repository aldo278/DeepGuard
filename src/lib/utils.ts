// Utility functions for TrustShield

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format timestamp to readable string
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Format duration in milliseconds to readable string
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    return `${(ms / 60000).toFixed(1)}m`;
  }
}

// Format cost to USD string
export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

// Calculate confidence color based on value
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-trust-green';
  if (confidence >= 0.6) return 'text-trust-amber';
  return 'text-trust-red';
}

// Get verdict badge styling
export function getVerdictBadgeStyle(verdict: string): string {
  switch (verdict) {
    case 'real':
    case 'true':
      return 'badge-real';
    case 'deepfake':
    case 'false':
      return 'badge-deepfake';
    case 'uncertain':
    case 'disputed':
      return 'badge-uncertain';
    case 'unverifiable':
      return 'badge-unverifiable';
    default:
      return 'badge-uncertain';
  }
}

// Generate unique ID
export function generateId(prefix: string = ''): string {
  return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Check if URL matches platform pattern
export function matchesPlatform(url: string, platform: string): boolean {
  const patterns = {
    meet: /meet\.google\.com/,
    zoom: /zoom\.us/,
    teams: /teams\.microsoft\.com/,
    youtube: /youtube\.com/,
  };
  
  return patterns[platform as keyof typeof patterns]?.test(url) || false;
}

// Extract domain from URL
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

// Sanitize text for display
export function sanitizeText(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength - 3) + '...';
}

// Calculate percentage
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

// Check if value is within range
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

// Deep clone object
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  if (typeof obj === 'object') {
    const cloned = {} as any;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
}

// Retry function with exponential backoff
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Validate API key format
export function validateApiKey(apiKey: string): boolean {
  return apiKey.length > 20 && /^[a-zA-Z0-9_-]+$/.test(apiKey);
}

// Get file extension from MIME type
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'text/plain': '.txt',
    'application/json': '.json',
  };
  
  return mimeToExt[mimeType] || '.bin';
}

// Check if browser supports required features
export function checkBrowserSupport(): {
  webRTC: boolean;
  webSpeech: boolean;
  indexedDB: boolean;
  webWorkers: boolean;
  wasm: boolean;
} {
  return {
    webRTC: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    webSpeech: !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition),
    indexedDB: !!window.indexedDB,
    webWorkers: !!window.Worker,
    wasm: !!window.WebAssembly,
  };
}

// Get browser info
export function getBrowserInfo(): {
  name: string;
  version: string;
  platform: string;
} {
  const ua = navigator.userAgent;
  
  let name = 'unknown';
  let version = 'unknown';
  
  if (ua.includes('Chrome')) {
    name = 'Chrome';
    version = ua.match(/Chrome\/(\d+)/)?.[1] || 'unknown';
  } else if (ua.includes('Firefox')) {
    name = 'Firefox';
    version = ua.match(/Firefox\/(\d+)/)?.[1] || 'unknown';
  } else if (ua.includes('Safari')) {
    name = 'Safari';
    version = ua.match(/Version\/(\d+)/)?.[1] || 'unknown';
  }
  
  return {
    name,
    version,
    platform: navigator.platform || 'unknown',
  };
}

// Export all utilities
export default {
  cn,
  formatTimestamp,
  formatDuration,
  formatCost,
  getConfidenceColor,
  getVerdictBadgeStyle,
  generateId,
  debounce,
  throttle,
  matchesPlatform,
  extractDomain,
  sanitizeText,
  truncateText,
  calculatePercentage,
  isInRange,
  deepClone,
  retry,
  validateApiKey,
  getExtensionFromMimeType,
  checkBrowserSupport,
  getBrowserInfo,
};
