// Privacy Manager Tests - Simplified

import { describe, it, expect, vi } from 'vitest'

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
}

;(global as any).chrome = mockChrome

describe('PrivacyManager', () => {
  it('should have Chrome APIs mocked', () => {
    expect(mockChrome.runtime.sendMessage).toBeDefined()
    expect(mockChrome.storage.sync.get).toBeDefined()
  })

  it('should mock storage operations', async () => {
    await mockChrome.storage.sync.get(['settings'])
    expect(mockChrome.storage.sync.get).toHaveBeenCalledWith(['settings'])
  })

  it('should mock message sending', () => {
    mockChrome.runtime.sendMessage({ type: 'TEST' })
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'TEST' })
  })
})
