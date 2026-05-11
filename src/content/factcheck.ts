// Fact Check Content Script - Text Selection Based Fact Checking

declare const chrome: any;

// API key will be fetched from background script
let cachedApiKey: string = '';

interface FactCheckResult {
  verdict: 'true' | 'false' | 'partially-true' | 'unverifiable';
  confidence: number;
  summary: string;
  sources?: string[];
}

class FactCheckSelector {
  private floatingButton: HTMLElement | null = null;
  private resultsPopup: HTMLElement | null = null;
  private selectedText: string = '';
  private isChecking: boolean = false;

  constructor() {
    this.init();
  }

  private init(): void {
    // Listen for text selection
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    
    // Listen for keyboard selection
    document.addEventListener('keyup', (e) => {
      if (e.shiftKey) {
        this.handleMouseUp(e as any);
      }
    });

    // Inject styles
    this.injectStyles();
    
    console.log('TrustShield Fact Check: Ready');
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.id = 'trustshield-factcheck-styles';
    style.textContent = `
      .trustshield-factcheck-btn {
        position: absolute;
        z-index: 2147483647;
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
        animation: trustshield-fadein 0.2s ease;
      }

      .trustshield-factcheck-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5);
      }

      .trustshield-factcheck-btn:disabled {
        opacity: 0.7;
        cursor: wait;
      }

      .trustshield-factcheck-btn svg {
        width: 16px;
        height: 16px;
      }

      .trustshield-results-popup {
        position: absolute;
        z-index: 2147483647;
        background: white;
        border-radius: 12px;
        padding: 16px;
        min-width: 320px;
        max-width: 400px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: trustshield-fadein 0.2s ease;
      }

      .trustshield-results-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e5e7eb;
      }

      .trustshield-results-title {
        font-size: 14px;
        font-weight: 600;
        color: #1f2937;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .trustshield-close-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        color: #6b7280;
        border-radius: 4px;
      }

      .trustshield-close-btn:hover {
        background: #f3f4f6;
        color: #1f2937;
      }

      .trustshield-verdict {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 12px;
      }

      .trustshield-verdict-true {
        background: #dcfce7;
        color: #166534;
      }

      .trustshield-verdict-false {
        background: #fee2e2;
        color: #991b1b;
      }

      .trustshield-verdict-partially-true {
        background: #fef3c7;
        color: #92400e;
      }

      .trustshield-verdict-unverifiable {
        background: #f3f4f6;
        color: #4b5563;
      }

      .trustshield-summary {
        font-size: 14px;
        line-height: 1.6;
        color: #374151;
        margin-bottom: 12px;
      }

      .trustshield-claim {
        font-size: 12px;
        color: #6b7280;
        background: #f9fafb;
        padding: 8px 12px;
        border-radius: 6px;
        margin-bottom: 12px;
        border-left: 3px solid #3b82f6;
      }

      .trustshield-claim-label {
        font-weight: 600;
        color: #374151;
        margin-bottom: 4px;
      }

      .trustshield-loading {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px;
        color: #6b7280;
      }

      .trustshield-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #e5e7eb;
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: trustshield-spin 0.8s linear infinite;
      }

      .trustshield-error {
        color: #dc2626;
        font-size: 13px;
        padding: 12px;
        background: #fef2f2;
        border-radius: 8px;
      }

      @keyframes trustshield-fadein {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes trustshield-spin {
        to { transform: rotate(360deg); }
      }
    `;
    
    if (!document.getElementById('trustshield-factcheck-styles')) {
      document.head.appendChild(style);
    }
  }

  private handleMouseDown(event: MouseEvent): void {
    // Don't hide if clicking on our own elements
    const target = event.target as HTMLElement;
    if (target?.closest('.trustshield-factcheck-btn') || target?.closest('.trustshield-results-popup')) {
      return;
    }
    // Hide button on new selection start
    this.hideFloatingButton();
  }

  private handleMouseUp(event: MouseEvent): void {
    // Ignore clicks on our own button
    const target = event.target as HTMLElement;
    if (target?.closest('.trustshield-factcheck-btn') || target?.closest('.trustshield-results-popup')) {
      return;
    }

    // Small delay to let selection complete
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || '';

      if (text.length > 10 && text.length < 1000) {
        this.selectedText = text;
        
        // Get selection position from the selection range, not mouse position
        const range = selection?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        
        if (rect) {
          // Position below the selection
          const x = rect.left + window.scrollX;
          const y = rect.bottom + window.scrollY;
          this.showFloatingButton(x, y);
        }
      } else {
        this.hideFloatingButton();
      }
    }, 10);
  }

  private showFloatingButton(x: number, y: number): void {
    this.hideFloatingButton();

    const button = document.createElement('button');
    button.className = 'trustshield-factcheck-btn';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 12l2 2 4-4"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
      Fact Check
    `;
    
    // Position below the selection (fixed position)
    button.style.left = `${x}px`;
    button.style.top = `${y + 8}px`;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.performFactCheck();
    });

    document.body.appendChild(button);
    this.floatingButton = button;

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (this.floatingButton === button) {
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

  private async callFactCheckAPI(text: string): Promise<FactCheckResult> {
    // Get API key from background script if not cached
    if (!cachedApiKey) {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
        cachedApiKey = response?.apiKey || '';
      } catch (e) {
        console.error('Failed to get API key from background:', e);
      }
    }
    
    const apiKey = cachedApiKey;
    
    if (!apiKey) {
      throw new Error('API key not configured. Add VITE_OPENROUTER_API_KEY to your .env file.');
    }

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
        model: 'google/gemini-2.0-flash-001',
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
      summary: result.summary || 'Unable to determine verdict.'
    };
  }

  private showResultsPopup(x: number, y: number, loading: boolean, result?: FactCheckResult, error?: string): void {
    this.hideResultsPopup();

    const popup = document.createElement('div');
    popup.className = 'trustshield-results-popup';
    
    // Adjust position to stay in viewport
    const viewportWidth = window.innerWidth;
    const popupWidth = 360;
    let adjustedX = x;
    if (x + popupWidth > viewportWidth - 20) {
      adjustedX = viewportWidth - popupWidth - 20;
    }
    
    popup.style.left = `${adjustedX}px`;
    popup.style.top = `${y + 30}px`;

    if (loading) {
      popup.innerHTML = `
        <div class="trustshield-loading">
          <div class="trustshield-spinner"></div>
          <span>Checking claim...</span>
        </div>
      `;
    } else if (error) {
      popup.innerHTML = `
        <div class="trustshield-results-header">
          <span class="trustshield-results-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Error
          </span>
          <button class="trustshield-close-btn" id="trustshield-close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="trustshield-error">${error}</div>
      `;
    } else if (result) {
      const verdictIcons: Record<string, string> = {
        'true': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>',
        'false': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        'partially-true': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        'unverifiable': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
      };

      const verdictLabels: Record<string, string> = {
        'true': 'True',
        'false': 'False',
        'partially-true': 'Partially True',
        'unverifiable': 'Unverifiable'
      };

      popup.innerHTML = `
        <div class="trustshield-results-header">
          <span class="trustshield-results-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
              <path d="M9 12l2 2 4-4"/>
              <circle cx="12" cy="12" r="10"/>
            </svg>
            Fact Check Result
          </span>
          <button class="trustshield-close-btn" id="trustshield-close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="trustshield-claim">
          <div class="trustshield-claim-label">Claim checked:</div>
          "${this.selectedText.substring(0, 150)}${this.selectedText.length > 150 ? '...' : ''}"
        </div>
        <div class="trustshield-verdict trustshield-verdict-${result.verdict}">
          ${verdictIcons[result.verdict] || ''}
          ${verdictLabels[result.verdict] || result.verdict}
        </div>
        <div class="trustshield-summary">${result.summary}</div>
      `;
    }

    document.body.appendChild(popup);
    this.resultsPopup = popup;

    // Add close button handler
    const closeBtn = popup.querySelector('#trustshield-close');
    closeBtn?.addEventListener('click', () => this.hideResultsPopup());

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick);
    }, 100);
  }

  private handleOutsideClick = (e: MouseEvent): void => {
    if (this.resultsPopup && !this.resultsPopup.contains(e.target as Node)) {
      this.hideResultsPopup();
    }
  };

  private hideResultsPopup(): void {
    if (this.resultsPopup) {
      this.resultsPopup.remove();
      this.resultsPopup = null;
      document.removeEventListener('click', this.handleOutsideClick);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new FactCheckSelector());
} else {
  new FactCheckSelector();
}

export default FactCheckSelector;
