// Settings Tab Component - Configuration and Preferences

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Settings, Shield, Eye, FileText, Lock, Info, Key, Save, CheckCircle, XCircle } from 'lucide-react';
import { TrustShieldSettings } from '@/types';
import { getApiKeyStatus, hasOpenRouterKey, hasClaimBusterKey, hasGoogleFactCheckKey } from '@/lib/env';

interface SettingsTabProps {
  settings: TrustShieldSettings;
  onSettingsUpdate: (settings: TrustShieldSettings) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onSettingsUpdate }) => {
  const [localSettings, setLocalSettings] = useState<TrustShieldSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  // Get API key status from environment
  const apiStatus = getApiKeyStatus();

  const updateSetting = <K extends keyof TrustShieldSettings>(
    section: K,
    value: TrustShieldSettings[K]
  ) => {
    setLocalSettings(prev => ({
      ...prev,
      [section]: value
    }));
  };

  const updateNestedSetting = <K extends keyof TrustShieldSettings>(
    section: K,
    field: string,
    value: any
  ) => {
    setLocalSettings(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as any),
        [field]: value
      }
    }));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      onSettingsUpdate(localSettings);
      setSaveMessage('Settings saved successfully');
      
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Failed to save settings');
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      // Reset to default values
      const defaultSettings: TrustShieldSettings = {
        openRouterApiKey: '',
        enableDeepGuard: true,
        enableMisinfoShield: true,
        
        deepguard: {
          fps: 5,
          ambiguityGateMin: 0.4,
          ambiguityGateMax: 0.7,
          confidenceThreshold: 0.5,
          enableVoiceAnalysis: false,
        },
        
        misinfo: {
          claimBusterThreshold: 0.5,
          factCheckThreshold: 0.8,
          enableAudioTranscription: true,
          enableTextAnalysis: true,
          transcriptionLanguage: 'en-US',
        },
        
        privacy: {
          biometricDataRetention: 30,
          transcriptRetention: 7,
          explicitConsent: false,
          dataProcessingLocation: 'on-device',
          gdprCompliant: true,
          allowTelemetry: false,
          encryptionEnabled: true,
        },
        
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
          maxSessionDuration: 180,
        },
      };

      setLocalSettings(defaultSettings);
    }
  };

  return (
    <div className="p-4 h-full overflow-y-auto custom-scrollbar">
      <div className="space-y-4">
        {/* API Configuration Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Configuration
            </CardTitle>
            <CardDescription>
              API keys are configured via .env file in the project root
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">OpenRouter API</span>
              </div>
              <div className="flex items-center gap-2">
                {hasOpenRouterKey() ? (
                  <><CheckCircle className="w-4 h-4 text-green-500" /><Badge variant="default">Configured</Badge></>
                ) : (
                  <><XCircle className="w-4 h-4 text-red-500" /><Badge variant="destructive">Not Set</Badge></>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">ClaimBuster API</span>
              </div>
              <div className="flex items-center gap-2">
                {hasClaimBusterKey() ? (
                  <><CheckCircle className="w-4 h-4 text-green-500" /><Badge variant="default">Configured</Badge></>
                ) : (
                  <><XCircle className="w-4 h-4 text-muted-foreground" /><Badge variant="secondary">Optional</Badge></>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Google Fact Check API</span>
              </div>
              <div className="flex items-center gap-2">
                {hasGoogleFactCheckKey() ? (
                  <><CheckCircle className="w-4 h-4 text-green-500" /><Badge variant="default">Configured</Badge></>
                ) : (
                  <><XCircle className="w-4 h-4 text-muted-foreground" /><Badge variant="secondary">Optional</Badge></>
                )}
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
              To configure API keys, add them to your <code className="bg-muted px-1 rounded">.env</code> file:
              <br />
              <code className="text-xs bg-muted px-1 rounded">VITE_OPENROUTER_API_KEY=sk-or-v1-...</code>
            </p>
          </CardContent>
        </Card>

        {/* Shield Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Detection Shields
            </CardTitle>
            <CardDescription>
              Enable/disable detection capabilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <div>
                  <div className="text-sm font-medium">DeepGuard</div>
                  <div className="text-xs text-muted-foreground">
                    Real-time deepfake detection in video calls
                  </div>
                </div>
              </div>
              <Switch
                checked={localSettings.enableDeepGuard}
                onCheckedChange={(checked: boolean) => updateSetting('enableDeepGuard', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <div>
                  <div className="text-sm font-medium">MisinfoShield</div>
                  <div className="text-xs text-muted-foreground">
                    Real-time misinformation detection and fact-checking
                  </div>
                </div>
              </div>
              <Switch
                checked={localSettings.enableMisinfoShield}
                onCheckedChange={(checked: boolean) => updateSetting('enableMisinfoShield', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* DeepGuard Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              DeepGuard Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Frame Rate (FPS): {localSettings.deepguard.fps}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={localSettings.deepguard.fps}
                onChange={(e) => updateNestedSetting('deepguard', 'fps', parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 (Low CPU)</span>
                <span>10 (High CPU)</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Confidence Threshold: {localSettings.deepguard.confidenceThreshold}
              </label>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.1"
                value={localSettings.deepguard.confidenceThreshold}
                onChange={(e) => updateNestedSetting('deepguard', 'confidenceThreshold', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Voice Analysis</div>
                <div className="text-xs text-muted-foreground">
                  Analyze voice patterns for deepfake detection
                </div>
              </div>
              <Switch
                checked={localSettings.deepguard.enableVoiceAnalysis}
                onCheckedChange={(checked: boolean) => updateNestedSetting('deepguard', 'enableVoiceAnalysis', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* MisinfoShield Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              MisinfoShield Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Claim Threshold: {localSettings.misinfo.claimBusterThreshold}
              </label>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.1"
                value={localSettings.misinfo.claimBusterThreshold}
                onChange={(e) => updateNestedSetting('misinfo', 'claimBusterThreshold', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Audio Transcription</div>
                <div className="text-xs text-muted-foreground">
                  Transcribe speech for claim analysis
                </div>
              </div>
              <Switch
                checked={localSettings.misinfo.enableAudioTranscription}
                onCheckedChange={(checked: boolean) => updateNestedSetting('misinfo', 'enableAudioTranscription', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Text Analysis</div>
                <div className="text-xs text-muted-foreground">
                  Analyze written content for claims
                </div>
              </div>
              <Switch
                checked={localSettings.misinfo.enableTextAnalysis}
                onCheckedChange={(checked: boolean) => updateNestedSetting('misinfo', 'enableTextAnalysis', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Privacy & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Biometric Data Retention: {localSettings.privacy.biometricDataRetention} minutes
              </label>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={localSettings.privacy.biometricDataRetention}
                onChange={(e) => updateNestedSetting('privacy', 'biometricDataRetention', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Transcript Retention: {localSettings.privacy.transcriptRetention} days
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={localSettings.privacy.transcriptRetention}
                onChange={(e) => updateNestedSetting('privacy', 'transcriptRetention', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Data Encryption</div>
                <div className="text-xs text-muted-foreground">
                  Encrypt stored data for additional security
                </div>
              </div>
              <Switch
                checked={localSettings.privacy.encryptionEnabled}
                onCheckedChange={(checked: boolean) => updateNestedSetting('privacy', 'encryptionEnabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">GDPR Compliance</div>
                <div className="text-xs text-muted-foreground">
                  Enable GDPR-compliant data handling
                </div>
              </div>
              <Switch
                checked={localSettings.privacy.gdprCompliant}
                onCheckedChange={(checked: boolean) => updateNestedSetting('privacy', 'gdprCompliant', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* UI Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              User Interface
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Theme</label>
              <select
                value={localSettings.ui.theme}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateNestedSetting('ui', 'theme', e.target.value as 'light' | 'dark' | 'system')}
                className="w-full text-sm border rounded px-3 py-2"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Show Notifications</div>
                <div className="text-xs text-muted-foreground">
                  Display browser notifications for detections
                </div>
              </div>
              <Switch
                checked={localSettings.ui.showNotifications}
                onCheckedChange={(checked: boolean) => updateNestedSetting('ui', 'showNotifications', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Show Overlays</div>
                <div className="text-xs text-muted-foreground">
                  Display detection badges on video/content
                </div>
              </div>
              <Switch
                checked={localSettings.ui.showOverlays}
                onCheckedChange={(checked: boolean) => updateNestedSetting('ui', 'showOverlays', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Actions */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <Info className="w-4 h-4 inline mr-1" />
                Settings are saved locally and synced across devices
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToDefaults}
                >
                  Reset to Defaults
                </Button>
                <Button
                  size="sm"
                  onClick={saveSettings}
                  disabled={isSaving}
                  className="flex items-center gap-1"
                >
                  <Save className="w-3 h-3" />
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </div>
            
            {saveMessage && (
              <div className={`mt-2 text-sm ${saveMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                {saveMessage}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsTab;
