// Test Setup for TrustShield

import { vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    id: 'test-extension-id',
  },
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  sidePanel: {
    open: vi.fn(),
  },
  action: {
    onClicked: {
      addListener: vi.fn(),
    },
  },
}

// Mock Web APIs
;(global as any).chrome = mockChrome as any

// Mock Web Speech API
;(global as any).SpeechRecognition = vi.fn().mockImplementation(() => ({
  continuous: true,
  interimResults: true,
  lang: 'en-US',
  start: vi.fn(),
  stop: vi.fn(),
  onresult: null,
  onerror: null,
  onend: null,
}))

;(global as any).webkitSpeechRecognition = (global as any).SpeechRecognition

// Mock Performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB
      jsHeapSizeLimit: 2048 * 1024 * 1024, // 2GB
    },
    getEntriesByType: vi.fn(() => []),
    mark: vi.fn(),
    measure: vi.fn(),
  },
  writable: true,
})

// Mock Fetch API
global.fetch = vi.fn()

// Mock IndexedDB
const indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  databases: vi.fn(),
}

Object.defineProperty(window, 'indexedDB', {
  value: indexedDB,
  writable: true,
})

// Mock Canvas API
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  drawImage: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  drawFocusIfNeeded: vi.fn(),
  createLinearGradient: vi.fn(),
  createRadialGradient: vi.fn(),
  createPattern: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  rect: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  transform: vi.fn(),
  setLineDash: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 200 })),
  strokeText: vi.fn(),
})

// Mock Web Workers
;(global as any).Worker = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  terminate: vi.fn(),
  onmessage: null,
  onerror: null,
}))

// Mock MutationObserver
;(global as any).MutationObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => []),
}))

// Mock IntersectionObserver
;(global as any).IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}))

// Mock ResizeObserver
;(global as any).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}))

// Mock URL constructor
global.URL = {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
} as any

// Mock File and Blob
;(global as any).File = vi.fn().mockImplementation(() => ({
  name: 'mock-file.txt',
  size: 1024,
  type: 'text/plain',
}))

;(global as any).Blob = vi.fn().mockImplementation(() => ({
  size: 1024,
  type: 'text/plain',
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
})

// Mock requestAnimationFrame
;(global as any).requestAnimationFrame = vi.fn((cb: any) => setTimeout(cb, 16))
;(global as any).cancelAnimationFrame = vi.fn()

// Mock console methods to reduce noise in tests
const originalConsole = { ...console }

beforeEach(() => {
  vi.clearAllMocks()
  
  // Reset console mocks
  console.error = vi.fn()
  console.warn = vi.fn()
  console.log = vi.fn()
  console.info = vi.fn()
  console.debug = vi.fn()
})

afterEach(() => {
  // Restore original console methods
  Object.assign(console, originalConsole)
})

// Mock environment variables
process.env.NODE_ENV = 'test'

// Setup test utilities
export const createMockVideoElement = () => {
  const video = document.createElement('video')
  Object.defineProperty(video, 'videoWidth', { value: 640, writable: true })
  Object.defineProperty(video, 'videoHeight', { value: 480, writable: true })
  Object.defineProperty(video, 'readyState', { value: 4, writable: true })
  Object.defineProperty(video, 'paused', { value: false, writable: true })
  Object.defineProperty(video, 'ended', { value: false, writable: true })
  Object.defineProperty(video, 'src', { value: 'mock-video-src', writable: true })
  return video
}

export const createMockAudioElement = () => {
  const audio = document.createElement('audio')
  Object.defineProperty(audio, 'readyState', { value: 4, writable: true })
  Object.defineProperty(audio, 'paused', { value: false, writable: true })
  Object.defineProperty(audio, 'ended', { value: false, writable: true })
  return audio
}

export const createMockCanvas = () => {
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'width', { value: 640, writable: true })
  Object.defineProperty(canvas, 'height', { value: 480, writable: true })
  return canvas
}

export const createMockImageData = () => {
  const data = new Uint8ClampedArray(640 * 480 * 4)
  return {
    data,
    width: 640,
    height: 480,
  }
}

export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const flushPromises = () => new Promise(resolve => setImmediate(resolve))

// Mock constants for testing
export const MOCK_CONSTANTS = {
  API_KEY: 'sk-or-v1-mock-api-key',
  SESSION_ID: 'test-session-123',
  FRAME_ID: 'test-frame-456',
  CLAIM_ID: 'test-claim-789',
  EVENT_ID: 'test-event-012',
}

export default {
  createMockVideoElement,
  createMockAudioElement,
  createMockCanvas,
  createMockImageData,
  waitFor,
  flushPromises,
  MOCK_CONSTANTS,
}
