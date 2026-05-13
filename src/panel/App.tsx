// TrustShield Main Application Component

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { AlertCircle, Shield, Eye, FileText, Clock, Settings, Activity } from 'lucide-react';

import VideoTab from './components/VideoTab';
import MisinfoTab from './components/MisinfoTab';
import TranscriptTab from './components/TranscriptTab';
import HistoryTab from './components/HistoryTab';
import SettingsTab from './components/SettingsTab';

import { TrustShieldSettings, PageType, Platform } from '@/types';
import TRUSTSHIELD_CONFIG from '@/lib/constants';

// Chrome extension types
declare const chrome: any;

interface AppState {
  settings: TrustShieldSettings;
  currentPageType: PageType;
  currentPlatform: Platform;
  isDeepGuardActive: boolean;
  isMisinfoShieldActive: boolean;
  sessionId: string | null;
  hasErrors: boolean;
  isLoading: boolean;
  consentRequired: boolean;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    settings: getDefaultSettings(),
    currentPageType: 'other',
    currentPlatform: 'other',
    isDeepGuardActive: false,
    isMisinfoShieldActive: false,
    sessionId: null,
    hasErrors: false,
    isLoading: true,
    consentRequired: false,
  });

  const [activeTab, setActiveTab] = useState('video');
  const [retryCount, setRetryCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get default settings
  function getDefaultSettings(): TrustShieldSettings {
    return {
      enableDeepGuard: false,
      enableMisinfoShield: false,
      
      deepguard: {
        fps: TRUSTSHIELD_CONFIG.MODELS.DEEPFAKE.FRAME_RATE,
        ambiguityGateMin: TRUSTSHIELD_CONFIG.MODELS.DEEPFAKE.AMBIGUITY_GATE_MIN,
        ambiguityGateMax: TRUSTSHIELD_CONFIG.MODELS.DEEPFAKE.AMBIGUITY_GATE_MAX,
        confidenceThreshold: TRUSTSHIELD_CONFIG.MODELS.DEEPFAKE.CONFIDENCE_THRESHOLD,
        enableVoiceAnalysis: false,
      },
      
      misinfo: {
        claimBusterThreshold: 0.5,
        factCheckThreshold: 0.8,
        enableAudioTranscription: true,
        enableTextAnalysis: true,
        transcriptionLanguage: 'en-US',
      },
      
      privacy: TRUSTSHIELD_CONFIG.PRIVACY.DEFAULT_CONFIG,
      
      ui: {
        theme: 'system',
        showNotifications: true,
        showOverlays: true,
        compactMode: false,
      },
      
      advanced: {
        debugMode: false,
        logLevel: 'info',
        enableTelemetry: false,
        maxSessionDuration: TRUSTSHIELD_CONFIG.PRIVACY.MAX_SESSION_DURATION,
      },
    };
  }

  // Initialize component
  useEffect(() => {
    // Wait for Chrome APIs to be ready
    const initializeWhenReady = () => {
      if (chrome?.runtime && chrome?.storage?.sync && chrome?.tabs) {
        initializePanel();
        setupMessageListeners();
      } else {
        console.log('Chrome APIs not ready, waiting...');
        setTimeout(initializeWhenReady, 500);
      }
    };

    initializeWhenReady();
    
    return () => {
      // Cleanup listeners
      if (chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  }, []);

  // Initialize panel
  const initializePanel = async () => {
    if (isInitialized) {
      console.log('Panel already initialized, skipping...');
      return;
    }

    try {
      // Load settings
      const result = await chrome.storage.sync.get(TRUSTSHIELD_CONFIG.STORAGE.SETTINGS);
      if (result[TRUSTSHIELD_CONFIG.STORAGE.SETTINGS]) {
        setState(prev => ({
          ...prev,
          settings: { ...prev.settings, ...result[TRUSTSHIELD_CONFIG.STORAGE.SETTINGS] }
        }));
      }

      // Get current tab info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.url) {
        detectPageType(tab.url);
      }

      setIsInitialized(true);
      setState(prev => ({ ...prev, isLoading: false }));
      
    } catch (error) {
      console.error('Failed to initialize panel:', error);
      setState(prev => ({ ...prev, isLoading: false, hasErrors: true }));
    }
  };

  // Detect page type and platform
  const detectPageType = (url: string) => {
    let pageType: PageType = 'other';
    let platform: Platform = 'other';

    // Check for live call platforms
    if (TRUSTSHIELD_CONFIG.PLATFORMS.GOOGLE_MEET.URL_PATTERN.test(url)) {
      pageType = 'live-call';
      platform = 'meet';
    } else if (TRUSTSHIELD_CONFIG.PLATFORMS.ZOOM.URL_PATTERN.test(url)) {
      pageType = 'live-call';
      platform = 'zoom';
    } else if (TRUSTSHIELD_CONFIG.PLATFORMS.TEAMS.URL_PATTERN.test(url)) {
      pageType = 'live-call';
      platform = 'teams';
    } else if (TRUSTSHIELD_CONFIG.PLATFORMS.YOUTUBE.URL_PATTERN.test(url)) {
      pageType = 'embedded-video';
      platform = 'youtube';
    } else {
      pageType = 'article';
    }

    setState(prev => ({
      ...prev,
      currentPageType: pageType,
      currentPlatform: platform,
      isDeepGuardActive: pageType === 'live-call' && prev.settings.enableDeepGuard,
      isMisinfoShieldActive: prev.settings.enableMisinfoShield,
    }));
  };

  // Setup message listeners
  const setupMessageListeners = () => {
    chrome.runtime.onMessage.addListener(messageListener);
  };

  // Handle messages from background script
  const messageListener = (message: any) => {
    switch (message.type) {
      case 'PAGE_DETECTED':
        setState(prev => ({
          ...prev,
          currentPageType: message.payload.pageType,
          currentPlatform: message.payload.platform,
          sessionId: message.payload.sessionId,
          isDeepGuardActive: message.payload.pageType === 'live-call' && prev.settings.enableDeepGuard,
          isMisinfoShieldActive: prev.settings.enableMisinfoShield,
        }));
        break;

      case 'PAGE_UPDATED':
        if (message.payload.url) {
          detectPageType(message.payload.url);
        }
        break;

      case 'SETTINGS_UPDATE':
        setState(prev => ({
          ...prev,
          settings: { ...prev.settings, ...message.payload }
        }));
        break;

      case 'PRIVACY_CONSENT_REQUEST':
        setState(prev => ({ ...prev, consentRequired: true }));
        break;

      case 'ERROR':
        console.error('TrustShield error:', message.payload);
        setState(prev => ({ ...prev, hasErrors: true }));
        break;

      default:
        console.log('Panel received message:', message);
    }
  };

  // Toggle shield settings
  const toggleDeepGuard = async (enabled: boolean) => {
    const newSettings = { ...state.settings, enableDeepGuard: enabled };
    setState(prev => ({
      ...prev,
      settings: newSettings,
      isDeepGuardActive: enabled
    }));

    // Update settings in background
    chrome.runtime.sendMessage({
      type: 'SETTINGS_UPDATE',
      payload: { enableDeepGuard: enabled }
    });

    // Send message to content script to start/stop deepfake detection
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: enabled ? 'START_DEEPFAKE_SCAN' : 'STOP_DEEPFAKE_SCAN'
        });
      }
    } catch (e) {
      console.log('Could not send message to content script');
    }
  };

  const toggleMisinfoShield = async (enabled: boolean) => {
    const newSettings = { ...state.settings, enableMisinfoShield: enabled };
    setState(prev => ({
      ...prev,
      settings: newSettings,
      isMisinfoShieldActive: enabled
    }));

    // Update settings in background
    chrome.runtime.sendMessage({
      type: 'SETTINGS_UPDATE',
      payload: { enableMisinfoShield: enabled }
    });
  };

  // Handle privacy consent
  const handlePrivacyConsent = async (granted: boolean, config?: any) => {
    setState(prev => ({ ...prev, consentRequired: false }));

    chrome.runtime.sendMessage({
      type: 'PRIVACY_CONSENT_RESPONSE',
      payload: { granted, config: config || state.settings.privacy }
    });
  };

  // Get platform icon
  const getPlatformIcon = () => {
    switch (state.currentPlatform) {
      case 'meet': return '🎥';
      case 'zoom': return '📹';
      case 'teams': return '💼';
      case 'youtube': return '📺';
      default: return '🌐';
    }
  };

  // Get platform name
  const getPlatformName = () => {
    switch (state.currentPlatform) {
      case 'meet': return 'Google Meet';
      case 'zoom': return 'Zoom';
      case 'teams': return 'Microsoft Teams';
      case 'youtube': return 'YouTube';
      default: return 'Web Page';
    }
  };

  if (state.isLoading) {
    return (
      <div className="trustshield-panel flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading TrustShield...</p>
        </div>
      </div>
    );
  }

  if (state.hasErrors) {
    return (
      <div className="trustshield-panel flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Extension Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              TrustShield encountered an error. This usually happens when Chrome APIs are not yet available.
            </p>
            <div className="space-y-2">
              <Button onClick={() => {
                setRetryCount(0);
                setState(prev => ({ ...prev, hasErrors: false, isLoading: true }));
                initializePanel();
              }} className="w-full">
                Retry Initialization
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                Reload Extension
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              If this persists, try reloading the extension in chrome://extensions/
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.consentRequired) {
    return (
      <div className="trustshield-panel flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Privacy Consent Required
            </CardTitle>
            <CardDescription>
              TrustShield needs your consent to process data for deepfake and misinformation detection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">TrustShield processes:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Video frames for deepfake detection</li>
                <li>Audio transcripts for claim verification</li>
                <li>Web page text for fact-checking</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => handlePrivacyConsent(false)}
                className="flex-1"
              >
                Decline
              </Button>
              <Button 
                onClick={() => handlePrivacyConsent(true)}
                className="flex-1"
              >
                Accept
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="trustshield-panel flex flex-col h-full">
      {/* Header */}
      <div className="trustshield-header">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-semibold">TrustShield</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{getPlatformIcon()}</span>
            <span className="text-sm text-muted-foreground">{getPlatformName()}</span>
          </div>
        </div>

        {/* Shield Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <span className="text-sm">DeepGuard</span>
              <Switch
                checked={state.isDeepGuardActive}
                onCheckedChange={toggleDeepGuard}
              />
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="text-sm">MisinfoShield</span>
              <Switch
                checked={state.isMisinfoShieldActive}
                onCheckedChange={toggleMisinfoShield}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {state.isDeepGuardActive && (
              <Badge variant="secondary" className="status-indicator status-active">
                Active
              </Badge>
            )}
            {state.isMisinfoShieldActive && (
              <Badge variant="secondary" className="status-indicator status-active">
                Active
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="trustshield-content flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="trustshield-tabs h-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="video" className="text-xs">
              <Eye className="w-3 h-3 mr-1" />
              Video
            </TabsTrigger>
            <TabsTrigger value="misinfo" className="text-xs">
              <FileText className="w-3 h-3 mr-1" />
              Misinfo
            </TabsTrigger>
            <TabsTrigger value="transcript" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              Transcript
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              <Activity className="w-3 h-3 mr-1" />
              History
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">
              <Settings className="w-3 h-3 mr-1" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="video" className="mt-0 h-full">
            <VideoTab 
              isActive={state.isDeepGuardActive}
              sessionId={state.sessionId}
              platform={state.currentPlatform}
            />
          </TabsContent>

          <TabsContent value="misinfo" className="mt-0 h-full">
            <MisinfoTab 
              isActive={state.isMisinfoShieldActive}
              sessionId={state.sessionId}
              pageType={state.currentPageType}
            />
          </TabsContent>

          <TabsContent value="transcript" className="mt-0 h-full">
            <TranscriptTab 
              sessionId={state.sessionId}
              isActive={state.isMisinfoShieldActive}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-0 h-full">
            <HistoryTab />
          </TabsContent>

          <TabsContent value="settings" className="mt-0 h-full">
            <SettingsTab 
              settings={state.settings}
              onSettingsUpdate={async (newSettings) => {
                setState(prev => ({ ...prev, settings: newSettings }));
                
                // Save directly to Chrome storage as backup
                try {
                  await chrome.storage.sync.set({
                    [TRUSTSHIELD_CONFIG.STORAGE.SETTINGS]: newSettings
                  });
                  console.log('Settings saved to Chrome storage:', newSettings.openRouterApiKey ? 'API key set' : 'No API key');
                } catch (error) {
                  console.error('Failed to save settings:', error);
                }
                
                // Also notify background script
                chrome.runtime.sendMessage({
                  type: 'SETTINGS_UPDATE',
                  payload: newSettings
                });
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default App;
