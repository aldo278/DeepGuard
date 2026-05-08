// History Tab Component - Session History and Logs

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, Eye, FileText, Calendar, Download, Trash2, Filter } from 'lucide-react';
import { TrustShieldSession } from '@/types';
import { formatTimestamp, formatDuration, formatCost } from '@/lib/utils';

interface HistoryTabProps {
  // Props can be added later for filtering and pagination
}

const HistoryTab: React.FC<HistoryTabProps> = () => {
  const [sessions, setSessions] = useState<TrustShieldSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'live-call' | 'article' | 'embedded-video'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'duration' | 'cost'>('date');

  // Load session history
  useEffect(() => {
    loadSessionHistory();
  }, []);

  const loadSessionHistory = async () => {
    setIsLoading(true);
    try {
      // Simulate loading sessions from IndexedDB
      const mockSessions: TrustShieldSession[] = [
        {
          sessionId: 'session_1',
          startTime: Date.now() - 3600000, // 1 hour ago
          endTime: Date.now() - 1800000, // 30 minutes ago
          mode: 'live-call',
          platform: 'meet',
          url: 'https://meet.google.com/abc-def-ghi',
          privacyConfig: {
            biometricDataRetention: 30,
            transcriptRetention: 7,
            explicitConsent: true,
            dataProcessingLocation: 'on-device',
            gdprCompliant: true,
            allowTelemetry: false,
            encryptionEnabled: true,
          },
          deepguard: {
            framesProcessed: 9000,
            llmCallsMade: 15,
            verdictDistribution: { real: 8500, deepfake: 200, uncertain: 300 },
            averageLatency: 45,
          },
          misinfo: {
            claimsChecked: 25,
            llmCallsMade: 8,
            verdictDistribution: { true: 15, false: 5, disputed: 3, unverifiable: 2 },
            averageLatency: 1500,
          },
          totalLLMCalls: 23,
          estimatedCostUSD: 0.045,
          performanceMetrics: [],
          securityEvents: [],
        },
        {
          sessionId: 'session_2',
          startTime: Date.now() - 7200000, // 2 hours ago
          endTime: Date.now() - 6000000, // 1 hour 40 minutes ago
          mode: 'article',
          platform: 'other',
          url: 'https://example.com/news/article',
          privacyConfig: {
            biometricDataRetention: 30,
            transcriptRetention: 7,
            explicitConsent: true,
            dataProcessingLocation: 'on-device',
            gdprCompliant: true,
            allowTelemetry: false,
            encryptionEnabled: true,
          },
          deepguard: {
            framesProcessed: 0,
            llmCallsMade: 0,
            verdictDistribution: { real: 0, deepfake: 0, uncertain: 0 },
            averageLatency: 0,
          },
          misinfo: {
            claimsChecked: 12,
            llmCallsMade: 4,
            verdictDistribution: { true: 8, false: 2, disputed: 1, unverifiable: 1 },
            averageLatency: 1200,
          },
          totalLLMCalls: 4,
          estimatedCostUSD: 0.012,
          performanceMetrics: [],
          securityEvents: [],
        },
        {
          sessionId: 'session_3',
          startTime: Date.now() - 86400000, // 1 day ago
          endTime: Date.now() - 82800000, // 23 hours ago
          mode: 'embedded-video',
          platform: 'youtube',
          url: 'https://www.youtube.com/watch?v=example',
          privacyConfig: {
            biometricDataRetention: 30,
            transcriptRetention: 7,
            explicitConsent: true,
            dataProcessingLocation: 'on-device',
            gdprCompliant: true,
            allowTelemetry: false,
            encryptionEnabled: true,
          },
          deepguard: {
            framesProcessed: 0,
            llmCallsMade: 0,
            verdictDistribution: { real: 0, deepfake: 0, uncertain: 0 },
            averageLatency: 0,
          },
          misinfo: {
            claimsChecked: 18,
            llmCallsMade: 6,
            verdictDistribution: { true: 10, false: 4, disputed: 2, unverifiable: 2 },
            averageLatency: 1800,
          },
          totalLLMCalls: 6,
          estimatedCostUSD: 0.018,
          performanceMetrics: [],
          securityEvents: [],
        },
      ];

      setSessions(mockSessions);
    } catch (error) {
      console.error('Failed to load session history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSessions = sessions
    .filter(session => filter === 'all' || session.mode === filter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.startTime - a.startTime;
        case 'duration':
          const durationA = (a.endTime || Date.now()) - a.startTime;
          const durationB = (b.endTime || Date.now()) - b.startTime;
          return durationB - durationA;
        case 'cost':
          return b.estimatedCostUSD - a.estimatedCostUSD;
        default:
          return 0;
      }
    });

  const getSessionDuration = (session: TrustShieldSession): string => {
    const duration = (session.endTime || Date.now()) - session.startTime;
    return formatDuration(duration);
  };

  const getPlatformIcon = (platform: string): string => {
    switch (platform) {
      case 'meet': return '🎥';
      case 'zoom': return '📹';
      case 'teams': return '💼';
      case 'youtube': return '📺';
      default: return '🌐';
    }
  };

  const getModeIcon = (mode: string): React.ReactNode => {
    switch (mode) {
      case 'live-call':
        return <Eye className="w-4 h-4" />;
      case 'article':
        return <FileText className="w-4 h-4" />;
      case 'embedded-video':
        return <Eye className="w-4 h-4" />;
      default:
        return <History className="w-4 h-4" />;
    }
  };

  const exportSession = (session: TrustShieldSession) => {
    const dataStr = JSON.stringify(session, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trustshield-session-${session.sessionId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const deleteSession = async (sessionId: string) => {
    try {
      // In a real implementation, this would delete from IndexedDB
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const clearAllHistory = async () => {
    if (confirm('Are you sure you want to delete all session history? This cannot be undone.')) {
      try {
        // In a real implementation, this would clear the IndexedDB
        setSessions([]);
      } catch (error) {
        console.error('Failed to clear history:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading session history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto custom-scrollbar">
      <div className="space-y-4">
        {/* Header with Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Session History
            </CardTitle>
            <CardDescription>
              View and manage your TrustShield detection sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="all">All Sessions</option>
                  <option value="live-call">Live Calls</option>
                  <option value="article">Articles</option>
                  <option value="embedded-video">Videos</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="date">Sort by Date</option>
                  <option value="duration">Sort by Duration</option>
                  <option value="cost">Sort by Cost</option>
                </select>
              </div>
              <div className="text-sm text-muted-foreground">
                {filteredSessions.length} sessions
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session List */}
        {filteredSessions.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-2" />
                <p>No session history found.</p>
                <p className="text-sm">Start using TrustShield to see your detection history here.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((session) => (
              <Card key={session.sessionId} className="card-hover">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getModeIcon(session.mode)}
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <span>{getPlatformIcon(session.platform || 'other')}</span>
                          {session.platform === 'other' || !session.platform ? 'Web Page' : session.platform.charAt(0).toUpperCase() + session.platform.slice(1)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatTimestamp(session.startTime)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {session.mode.replace('-', ' ')}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <div className="font-medium">{getSessionDuration(session)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cost:</span>
                      <div className="font-medium">{formatCost(session.estimatedCostUSD)}</div>
                    </div>
                  </div>

                  {/* DeepGuard Stats */}
                  {session.deepguard.framesProcessed > 0 && (
                    <div className="mb-3">
                      <div className="text-sm font-medium mb-1 flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        DeepGuard
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>Frames: {session.deepguard.framesProcessed.toLocaleString()}</div>
                        <div>LLM Calls: {session.deepguard.llmCallsMade}</div>
                        <div>Latency: {session.deepguard.averageLatency}ms</div>
                      </div>
                    </div>
                  )}

                  {/* MisinfoShield Stats */}
                  {session.misinfo.claimsChecked > 0 && (
                    <div className="mb-3">
                      <div className="text-sm font-medium mb-1 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        MisinfoShield
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>Claims: {session.misinfo.claimsChecked}</div>
                        <div>LLM Calls: {session.misinfo.llmCallsMade}</div>
                        <div>Latency: {session.misinfo.averageLatency}ms</div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportSession(session)}
                      className="flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteSession(session.sessionId)}
                      className="flex items-center gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Clear All Button */}
        {sessions.length > 0 && (
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Sessions are retained for 30 days for privacy
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllHistory}
                  className="text-destructive hover:text-destructive"
                >
                  Clear All History
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default HistoryTab;
