// Environment Configuration - API Keys from .env file

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENROUTER_API_KEY?: string
  readonly VITE_CLAIMBUSTER_API_KEY?: string
  readonly VITE_GOOGLE_FACT_CHECK_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export const ENV = {
  // API Keys - loaded from environment variables at build time
  // IMPORTANT: Vite requires VITE_ prefix for env vars to be exposed
  OPENROUTER_API_KEY: (import.meta as ImportMeta).env.VITE_OPENROUTER_API_KEY || '',
  CLAIMBUSTER_API_KEY: (import.meta as ImportMeta).env.VITE_CLAIMBUSTER_API_KEY || '',
  GOOGLE_FACT_CHECK_API_KEY: (import.meta as ImportMeta).env.VITE_GOOGLE_FACT_CHECK_API_KEY || '',
}

// Helper to check if API keys are configured
export const hasOpenRouterKey = (): boolean => !!ENV.OPENROUTER_API_KEY
export const hasClaimBusterKey = (): boolean => !!ENV.CLAIMBUSTER_API_KEY
export const hasGoogleFactCheckKey = (): boolean => !!ENV.GOOGLE_FACT_CHECK_API_KEY

// Get API key status for display
export const getApiKeyStatus = () => ({
  openRouter: hasOpenRouterKey() ? 'configured' : 'not configured',
  claimBuster: hasClaimBusterKey() ? 'configured' : 'not configured',
  googleFactCheck: hasGoogleFactCheckKey() ? 'configured' : 'not configured',
})

export default ENV
