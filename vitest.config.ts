// Vitest Configuration for TrustShield

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    include: [
      'src/**/*.{test,spec}.{js,ts,tsx}',
    ],
    exclude: [
      'node_modules/',
      'dist/',
      '**/*.config.*',
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/lib': resolve(__dirname, './src/lib'),
      '@/types': resolve(__dirname, './src/types'),
      '@/panel': resolve(__dirname, './src/panel'),
      '@/content': resolve(__dirname, './src/content'),
      '@/background': resolve(__dirname, './src/background'),
      '@/worker': resolve(__dirname, './src/worker'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'test'),
  },
})
