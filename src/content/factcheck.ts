// Fact Check Content Script
// Provides floating button for text selection fact-checking


interface FactCheckResult {
  verdict: 'true' | 'false' | 'partially-true' | 'unverifiable';
  confidence: number;
  summary: string;
}

class FactChecker {
  private selectedText: string = '';
  private isChecking: boolean = false;
  private floatingButton: HTMLElement | null = null;
  private resultsPopup: HTMLElement | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    this.injectStyles();
    this.setupTextSelection();
    console.log('TrustShield Fact Check: Ready');
  }

  private injectStyles(): void {
    const styleId = 'trustshield-factcheck-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* TrustShield Fact Checker - Redesigned */
 
      .trustshield-factcheck-container {
        position: absolute;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 6px;
        backdrop-filter: blur(12px);
        background: rgba(255, 255, 255, 0.92);
        border-radius: 12px;
        padding: 6px;
        box-shadow: 
          0 1px 3px rgba(0, 0, 0, 0.06),
          0 8px 24px rgba(0, 0, 0, 0.08);
      }
      
      .trustshield-factcheck-btn {
        display: flex;
        align-items: center;
        padding: 10px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none !important;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        letter-spacing: -0.01em;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        outline: none;
        box-shadow: 
          0 2px 4px rgba(102, 126, 234, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.2);
        position: relative;
        overflow: hidden;
      }
      
      .trustshield-factcheck-btn::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        transition: left 0.5s;
      }
      
      .trustshield-factcheck-btn:hover::before {
        left: 100%;
      }
      
      .trustshield-factcheck-btn:hover {
        transform: translateY(-2px);
        box-shadow: 
          0 4px 12px rgba(102, 126, 234, 0.35),
          inset 0 1px 0 rgba(255, 255, 255, 0.2);
      }
      
      .trustshield-factcheck-btn:active {
        transform: translateY(-1px);
        box-shadow: 
          0 2px 6px rgba(102, 126, 234, 0.25),
          inset 0 1px 0 rgba(255, 255, 255, 0.2);
      }
      
      .trustshield-factcheck-btn svg {
        width: 18px;
        height: 18px;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
      }
      
      .trustshield-factcheck-dismiss {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: rgba(0, 0, 0, 0.04);
        color: rgba(0, 0, 0, 0.5);
        border: none !important;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        outline: none;
      }
      
      .trustshield-factcheck-dismiss:hover {
        background: rgba(0, 0, 0, 0.08);
        color: rgba(0, 0, 0, 0.7);
        transform: scale(1.05);
      }
      
      .trustshield-factcheck-dismiss:active {
        transform: scale(0.95);
      }
      
      .trustshield-factcheck-dismiss svg {
        width: 16px;
        height: 16px;
        stroke-width: 2.5;
      }
      
      .trustshield-factcheck-popup {
        position: fixed;
        z-index: 2147483647;
        background: white;
        border: 0.5px solid rgba(0, 0, 0, 0.08);
        border-radius: 16px;
        padding: 24px;
        box-shadow: 
          0 2px 8px rgba(0, 0, 0, 0.04),
          0 12px 48px rgba(0, 0, 0, 0.12);
        max-width: 420px;
        min-width: 320px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
        animation: popupSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      @keyframes popupSlideIn {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      .trustshield-factcheck-popup h3 {
        margin: 0 0 16px 0;
        font-size: 17px;
        font-weight: 600;
        color: rgba(0, 0, 0, 0.85);
        letter-spacing: -0.02em;
      }
      
      .trustshield-factcheck-popup .verdict {
        padding: 12px 16px;
        border-radius: 10px;
        margin: 16px 0;
        font-weight: 500;
        font-size: 15px;
        text-align: center;
        letter-spacing: -0.01em;
        border: 1.5px solid;
      }
      
      .trustshield-factcheck-popup .verdict.true {
        background: linear-gradient(135deg, #d4f4dd 0%, #e1f5e8 100%);
        color: #1d663b;
        border-color: rgba(29, 102, 59, 0.15);
      }
      
      .trustshield-factcheck-popup .verdict.false {
        background: linear-gradient(135deg, #ffe5e5 0%, #fff0f0 100%);
        color: #b91c1c;
        border-color: rgba(185, 28, 28, 0.15);
      }
      
      .trustshield-factcheck-popup .verdict.partially-true {
        background: linear-gradient(135deg, #fef3c7 0%, #fef9e7 100%);
        color: #b45309;
        border-color: rgba(180, 83, 9, 0.15);
      }
      
      .trustshield-factcheck-popup .verdict.unverifiable {
        background: linear-gradient(135deg, #f3f4f6 0%, #f9fafb 100%);
        color: rgba(0, 0, 0, 0.6);
        border-color: rgba(0, 0, 0, 0.08);
      }
      
      .trustshield-factcheck-popup .summary {
        color: rgba(0, 0, 0, 0.65);
        font-size: 14px;
        line-height: 1.6;
        letter-spacing: -0.01em;
      }
      
      .trustshield-factcheck-popup .confidence {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 0.5px solid rgba(0, 0, 0, 0.08);
        font-size: 13px;
        color: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .trustshield-factcheck-popup .confidence::before {
        content: '';
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.25);
      }
      
      .trustshield-factcheck-popup .loading {
        text-align: center;
        padding: 32px 20px;
        color: rgba(0, 0, 0, 0.5);
        font-size: 14px;
      }
      
      .trustshield-factcheck-popup .loading::after {
        content: '';
        display: block;
        margin: 16px auto 0;
        width: 24px;
        height: 24px;
        border: 2.5px solid rgba(102, 126, 234, 0.2);
        border-top-color: #667eea;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      .trustshield-factcheck-popup .error {
        color: #b91c1c;
        background: linear-gradient(135deg, #ffe5e5 0%, #fff0f0 100%);
        padding: 14px 16px;
        border-radius: 10px;
        border: 1px solid rgba(185, 28, 28, 0.15);
        font-size: 14px;
        line-height: 1.5;
      }
      
      .trustshield-factcheck-popup .close-btn {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(0, 0, 0, 0.04);
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        padding: 0;
      }
      
      .trustshield-factcheck-popup .close-btn:hover {
        background: rgba(0, 0, 0, 0.08);
        transform: scale(1.05);
      }
      
      .trustshield-factcheck-popup .close-btn:active {
        transform: scale(0.95);
      }
      
      .trustshield-factcheck-popup .close-btn svg {
        stroke: rgba(0, 0, 0, 0.5);
        width: 16px;
        height: 16px;
        stroke-width: 2.5;
      }
      
      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .trustshield-factcheck-container {
          background: rgba(30, 30, 30, 0.92);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 
            0 1px 3px rgba(0, 0, 0, 0.3),
            0 8px 24px rgba(0, 0, 0, 0.4);
        }
      
        .trustshield-factcheck-dismiss {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.6);
        }
      
        .trustshield-factcheck-dismiss:hover {
          background: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.85);
        }
      
        .trustshield-factcheck-popup {
          background: #1e1e1e;
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 
            0 2px 8px rgba(0, 0, 0, 0.4),
            0 12px 48px rgba(0, 0, 0, 0.6);
        }
      
        .trustshield-factcheck-popup h3 {
          color: rgba(255, 255, 255, 0.92);
        }
      
        .trustshield-factcheck-popup .verdict.true {
          background: linear-gradient(135deg, #0f3a21 0%, #164430 100%);
          color: #86efac;
          border-color: rgba(134, 239, 172, 0.2);
        }
      
        .trustshield-factcheck-popup .verdict.false {
          background: linear-gradient(135deg, #3f1515 0%, #4c1d1d 100%);
          color: #fca5a5;
          border-color: rgba(252, 165, 165, 0.2);
        }
      
        .trustshield-factcheck-popup .verdict.partially-true {
          background: linear-gradient(135deg, #422006 0%, #52290a 100%);
          color: #fcd34d;
          border-color: rgba(252, 211, 77, 0.2);
        }
      
        .trustshield-factcheck-popup .verdict.unverifiable {
          background: linear-gradient(135deg, #2a2a2a 0%, #333333 100%);
          color: rgba(255, 255, 255, 0.6);
          border-color: rgba(255, 255, 255, 0.12);
        }
      
        .trustshield-factcheck-popup .summary {
          color: rgba(255, 255, 255, 0.7);
        }
      
        .trustshield-factcheck-popup .confidence {
          border-top-color: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.45);
        }
      
        .trustshield-factcheck-popup .confidence::before {
          background: rgba(255, 255, 255, 0.3);
        }
      
        .trustshield-factcheck-popup .loading {
          color: rgba(255, 255, 255, 0.5);
        }
      
        .trustshield-factcheck-popup .error {
          color: #fca5a5;
          background: linear-gradient(135deg, #3f1515 0%, #4c1d1d 100%);
          border-color: rgba(252, 165, 165, 0.2);
        }
      
        .trustshield-factcheck-popup .close-btn {
          background: rgba(255, 255, 255, 0.06);
        }
      
        .trustshield-factcheck-popup .close-btn:hover {
          background: rgba(255, 255, 255, 0.12);
        }
      
        .trustshield-factcheck-popup .close-btn svg {
          stroke: rgba(255, 255, 255, 0.6);
        }
      }
    `;
    document.head.appendChild(style);
  }

  private setupTextSelection(): void {
    document.addEventListener('mouseup', (e) => {
      // Don't trigger if clicking on our UI
      if ((e.target as HTMLElement).closest('.trustshield-factcheck-container, .trustshield-factcheck-popup')) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        this.hideFloatingButton();
        return;
      }

      this.selectedText = selection.toString().trim();
      if (this.selectedText.length < 10) {
        this.hideFloatingButton();
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Show floating button near selection
      this.showFloatingButton(rect.left + window.scrollX, rect.top + window.scrollY);
    });

    // Hide button when clicking elsewhere
    document.addEventListener('mousedown', (e) => {
      if (!this.floatingButton?.contains(e.target as Node)) {
        this.hideFloatingButton();
      }
    });
  }

  private showFloatingButton(x: number, y: number): void {
    this.hideFloatingButton();

    const container = document.createElement('div');
    container.className = 'trustshield-factcheck-container';
    container.style.cssText = `
      position: absolute;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 4px;
      left: ${x}px;
      top: ${y + 8}px;
    `;

    const button = document.createElement('button');
    button.className = 'trustshield-factcheck-btn';
    button.style.position = 'relative';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 12l2 2 4-4"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
      Fact Check
    `;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.performFactCheck();
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'trustshield-factcheck-dismiss';
    dismissBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    `;
    dismissBtn.title = 'Dismiss';
    dismissBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hideFloatingButton();
    });

    container.appendChild(button);
    container.appendChild(dismissBtn);
    document.body.appendChild(container);
    this.floatingButton = container;

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (this.floatingButton === container) {
        this.hideFloatingButton();
      }
    }, 5000);
  }

  private hideFloatingButton(): void {
    if (this.floatingButton) {
      this.floatingButton.remove();
      this.floatingButton = null;
    }
  }

  private async performFactCheck(): Promise<void> {
    if (this.isChecking || !this.selectedText) return;

    this.isChecking = true;
    const buttonRect = this.floatingButton?.getBoundingClientRect();
    const x = (buttonRect?.left || 100) + window.scrollX;
    const y = (buttonRect?.top || 100) + window.scrollY;

    this.hideFloatingButton();
    this.showResultsPopup(x, y, true);

    try {
      const result = await this.callFactCheckAPI(this.selectedText);
      this.showResultsPopup(x, y, false, result);
    } catch (error) {
      console.error('Fact check error:', error);
      this.showResultsPopup(x, y, false, undefined, error instanceof Error ? error.message : 'Failed to check claim');
    } finally {
      this.isChecking = false;
    }
  }

  private async getAvailableModel(apiKey: string): Promise<string> {
    // List of models to try in order of preference
    const models = [
      'anthropic/claude-3-haiku',
      'google/gemini-flash-1.5',
      'openai/gpt-4o-mini',
      'meta-llama/llama-3.2-3b-instruct',
      'microsoft/wizardlm-2-8x22b',
      'qwen/qwen-2.5-7b-instruct'
    ];

    // Try each model until one works
    for (const model of models) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'TrustShield Model Check'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'user', content: 'test' }
            ],
            max_tokens: 1,
            temperature: 0.1
          })
        });

        if (response.ok) {
          console.log(`Fact check using model: ${model}`);
          return model;
        }
      } catch (e) {
        console.log(`Model ${model} not available, trying next...`);
      }
    }

    throw new Error('No available models found');
  }

  private async callFactCheckAPI(text: string): Promise<FactCheckResult> {
    // Get API key from background script
    let cachedApiKey = '';
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
      cachedApiKey = response?.apiKey || '';
    } catch (e) {
      console.error('Failed to get API key from background:', e);
    }
    
    const apiKey = cachedApiKey;
    
    if (!apiKey) {
      throw new Error('API key not configured. Add VITE_OPENROUTER_API_KEY to your .env file.');
    }

    // Get available model
    const model = await this.getAvailableModel(apiKey);

    const prompt = `You are a fact-checker. Analyze the following claim and determine if it is true, false, partially true, or unverifiable.

CLAIM: "${text}"

Respond in this exact JSON format only, no other text:
{
  "verdict": "true" | "false" | "partially-true" | "unverifiable",
  "confidence": 0.0-1.0,
  "summary": "Brief 1-2 sentence explanation of your verdict"
}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'TrustShield Fact Check'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      verdict: result.verdict || 'unverifiable',
      confidence: result.confidence || 0.5,
      summary: result.summary || 'Unable to determine'
    };
  }

  private showResultsPopup(x: number, y: number, isLoading: boolean, result?: FactCheckResult, error?: string): void {
    // Hide existing popup
    if (this.resultsPopup) {
      this.resultsPopup.remove();
    }

    const popup = document.createElement('div');
    popup.className = 'trustshield-factcheck-popup';
    popup.style.cssText = `
      left: ${Math.min(x, window.innerWidth - 420)}px;
      top: ${Math.min(y, window.innerHeight - 300)}px;
    `;

    if (isLoading) {
      popup.innerHTML = `
        <div class="loading">
          <div class="spinner">Checking facts...</div>
        </div>
      `;
    } else if (error) {
      popup.innerHTML = `
        <h3>Fact Check Failed</h3>
        <div class="error">${error}</div>
      `;
    } else if (result) {
      popup.innerHTML = `
        <h3>Fact Check Result</h3>
        <div class="verdict ${result.verdict}">${this.formatVerdict(result.verdict)}</div>
        <div class="summary">${result.summary}</div>
        <div class="confidence">Confidence: ${Math.round(result.confidence * 100)}%</div>
      `;
    }

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    `;
    closeBtn.addEventListener('click', () => {
      popup.remove();
      this.resultsPopup = null;
    });
    popup.appendChild(closeBtn);

    document.body.appendChild(popup);
    this.resultsPopup = popup;

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (this.resultsPopup === popup) {
        popup.remove();
        this.resultsPopup = null;
      }
    }, 10000);
  }

  private formatVerdict(verdict: string): string {
    switch (verdict) {
      case 'true': return '✓ True';
      case 'false': return '✗ False';
      case 'partially-true': return '⚠ Partially True';
      case 'unverifiable': return '? Unverifiable';
      default: return verdict;
    }
  }
}

// Initialize fact checker
new FactChecker();
