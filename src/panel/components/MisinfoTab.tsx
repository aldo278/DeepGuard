// Misinformation Tab Component - MisinfoShield Interface

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, AlertTriangle, CheckCircle, XCircle, ExternalLink, Clock } from 'lucide-react';
import { PageType } from '@/types';
import { formatTimestamp } from '@/lib/utils';

interface MisinfoTabProps {
  isActive: boolean;
  sessionId: string | null;
  pageType: PageType;
}

interface ClaimVerdict {
  claimId: string;
  claimText: string;
  verdict: 'true' | 'false' | 'disputed' | 'unverifiable';
  confidence: number;
  source?: string;
  reasoning: string;
  timestamp: number;
}

const MisinfoTab: React.FC<MisinfoTabProps> = ({ isActive, sessionId, pageType }) => {
  const [claims, setClaims] = useState<ClaimVerdict[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({
    totalChecked: 0,
    true: 0,
    false: 0,
    disputed: 0,
    unverifiable: 0,
    llmCalls: 0,
    cost: 0,
  });

  // Simulate claim detection and verification
  useEffect(() => {
    if (!isActive || !sessionId) return;

    setIsProcessing(true);

    const interval = setInterval(() => {
      // Simulate new claim detection
      if (Math.random() > 0.6) {
        const mockClaims = [
          "The moon landing was faked in 1969.",
          "Climate change is a hoax created by scientists.",
          "Vaccines contain microchips for government tracking.",
          "The Earth is flat and space agencies are hiding this fact.",
          "5G networks spread COVID-19 virus.",
          "Drinking bleach can cure diseases.",
          "The government is controlling weather through satellites.",
          "Chemtrails are used for population control.",
        ];

        const mockVerdicts: Array<'true' | 'false' | 'disputed' | 'unverifiable'> = ['false', 'true', 'disputed', 'unverifiable'];
        const mockSources = [
          'PolitiFact',
          'Snopes',
          'Reuters Fact Check',
          'AP Fact Check',
          'FactCheck.org',
        ];

        const newClaim: ClaimVerdict = {
          claimId: `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          claimText: mockClaims[Math.floor(Math.random() * mockClaims.length)],
          verdict: mockVerdicts[Math.floor(Math.random() * mockVerdicts.length)],
          confidence: Math.random() * 0.4 + 0.6, // 0.6 to 1.0
          source: Math.random() > 0.3 ? mockSources[Math.floor(Math.random() * mockSources.length)] : undefined,
          reasoning: 'This claim has been analyzed against multiple fact-checking sources and expert consensus.',
          timestamp: Date.now(),
        };

        setClaims(prev => [newClaim, ...prev.slice(0, 19)]); // Keep last 20 claims

        setStats(prev => {
          const newStats = { ...prev };
          newStats.totalChecked++;
          newStats[newClaim.verdict]++;
          newStats.llmCalls += Math.random() > 0.7 ? 1 : 0;
          newStats.cost += (Math.random() > 0.7 ? 0.0003 : 0);
          return newStats;
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isActive, sessionId]);

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'true':
        return <CheckCircle className="w-4 h-4 text-trust-blue" />;
      case 'false':
        return <XCircle className="w-4 h-4 text-trust-red" />;
      case 'disputed':
        return <AlertTriangle className="w-4 h-4 text-trust-amber" />;
      case 'unverifiable':
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'true':
        return <Badge className="badge-true">Verified True</Badge>;
      case 'false':
        return <Badge className="badge-false">False</Badge>;
      case 'disputed':
        return <Badge className="badge-disputed">Disputed</Badge>;
      case 'unverifiable':
        return <Badge className="badge-unverifiable">Unverifiable</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getPageTypeDescription = () => {
    switch (pageType) {
      case 'live-call':
        return 'Analyzing spoken content from video call audio';
      case 'embedded-video':
        return 'Analyzing audio and captions from video content';
      case 'article':
        return 'Analyzing text content from web page';
      default:
        return 'Analyzing content for factual claims';
    }
  };

  if (!isActive) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <CardTitle>MisinfoShield Inactive</CardTitle>
            <CardDescription>
              Enable MisinfoShield to detect and verify factual claims in real-time.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto custom-scrollbar">
      <div className="space-y-4">
        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Active Analysis
            </CardTitle>
            <CardDescription>
              {getPageTypeDescription()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Claims Checked:</span>
                <div className="font-medium">{stats.totalChecked}</div>
              </div>
              <div>
                <span className="text-muted-foreground">LLM Calls:</span>
                <div className="font-medium">{stats.llmCalls}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Session Cost:</span>
                <div className="font-medium">${stats.cost.toFixed(4)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <div className="font-medium text-trust-green">
                  {isProcessing ? 'Processing' : 'Idle'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Verdict Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-trust-blue" />
                <span>Verified True:</span>
                <span className="font-medium">{stats.true}</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-trust-red" />
                <span>False:</span>
                <span className="font-medium">{stats.false}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-trust-amber" />
                <span>Disputed:</span>
                <span className="font-medium">{stats.disputed}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span>Unverifiable:</span>
                <span className="font-medium">{stats.unverifiable}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Claims */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Claims</CardTitle>
            <CardDescription>
              Latest factual claims analyzed
            </CardDescription>
          </CardHeader>
          <CardContent>
            {claims.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {isProcessing 
                  ? 'Listening for claims... Detection will start automatically.'
                  : 'No claims detected yet. Start browsing or join a call to begin analysis.'
                }
              </p>
            ) : (
              <div className="space-y-3">
                {claims.map((claim) => (
                  <div key={claim.claimId} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm flex-1">{claim.claimText}</p>
                      {getVerdictBadge(claim.verdict)}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {getVerdictIcon(claim.verdict)}
                        <span>Confidence: {(claim.confidence * 100).toFixed(1)}%</span>
                      </div>
                      <span>{formatTimestamp(claim.timestamp)}</span>
                    </div>

                    {claim.source && (
                      <div className="flex items-center gap-2 text-xs">
                        <ExternalLink className="w-3 h-3" />
                        <span>Source: {claim.source}</span>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground italic">
                      {claim.reasoning}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">
                <strong>MisinfoShield</strong> analyzes claims in real-time using multiple fact-checking sources.
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Extracts factual claims from text and speech</li>
                <li>Cross-references with established fact-checkers</li>
                <li>Uses AI to analyze claims without existing fact-checks</li>
                <li>Average cost: ~$0.03 per hour of active analysis</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MisinfoTab;
