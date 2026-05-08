// Video Tab Component - DeepGuard Interface

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, AlertTriangle, CheckCircle, XCircle, Activity, Settings } from 'lucide-react';
import { Platform } from '@/types';
import { formatTimestamp, formatDuration } from '@/lib/utils';

interface VideoTabProps {
  isActive: boolean;
  sessionId: string | null;
  platform: Platform;
}

interface VideoStatus {
  isProcessing: boolean;
  currentFrame: number;
  totalFrames: number;
  currentVerdict: 'real' | 'uncertain' | 'deepfake' | null;
  confidence: number;
  latency: number;
  fps: number;
  llmCalls: number;
  cost: number;
}

const VideoTab: React.FC<VideoTabProps> = ({ isActive, sessionId, platform }) => {
  const [videoStatus, setVideoStatus] = useState<VideoStatus>({
    isProcessing: false,
    currentFrame: 0,
    totalFrames: 0,
    currentVerdict: null,
    confidence: 0,
    latency: 0,
    fps: 5,
    llmCalls: 0,
    cost: 0,
  });

  const [history, setHistory] = useState<Array<{
    timestamp: number;
    verdict: string;
    confidence: number;
  }>>([]);

  // Simulate video processing updates
  useEffect(() => {
    if (!isActive || !sessionId) return;

    const interval = setInterval(() => {
      setVideoStatus(prev => {
        const newFrame = prev.currentFrame + 1;
        const mockVerdict = Math.random() > 0.8 ? 'deepfake' : Math.random() > 0.5 ? 'uncertain' : 'real';
        const mockConfidence = Math.random();
        
        return {
          ...prev,
          isProcessing: true,
          currentFrame: newFrame,
          totalFrames: Math.max(prev.totalFrames, newFrame),
          currentVerdict: mockVerdict as any,
          confidence: mockConfidence,
          latency: Math.random() * 100,
          llmCalls: mockVerdict === 'uncertain' ? prev.llmCalls + 1 : prev.llmCalls,
          cost: prev.cost + (mockVerdict === 'uncertain' ? 0.0003 : 0),
        };
      });

      // Add to history periodically
      if (Math.random() > 0.7) {
        setHistory(prev => [
          ...prev.slice(-9),
          {
            timestamp: Date.now(),
            verdict: videoStatus.currentVerdict || 'real',
            confidence: videoStatus.confidence,
          }
        ]);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, sessionId]);

  const getVerdictIcon = (verdict: string | null) => {
    switch (verdict) {
      case 'real':
        return <CheckCircle className="w-4 h-4 text-trust-green" />;
      case 'deepfake':
        return <XCircle className="w-4 h-4 text-trust-red" />;
      case 'uncertain':
        return <AlertTriangle className="w-4 h-4 text-trust-amber" />;
      default:
        return <Eye className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getVerdictBadge = (verdict: string | null) => {
    switch (verdict) {
      case 'real':
        return <Badge className="badge-real">Real</Badge>;
      case 'deepfake':
        return <Badge className="badge-deepfake">Deepfake</Badge>;
      case 'uncertain':
        return <Badge className="badge-uncertain">Uncertain</Badge>;
      default:
        return <Badge variant="outline">Inactive</Badge>;
    }
  };

  if (!isActive) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Eye className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <CardTitle>DeepGuard Inactive</CardTitle>
            <CardDescription>
              DeepGuard only works during live video calls. Start a call on {platform} to activate deepfake detection.
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
              <Activity className="w-5 h-5" />
              Live Detection
            </CardTitle>
            <CardDescription>
              Real-time deepfake detection for {platform}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {getVerdictIcon(videoStatus.currentVerdict)}
                <span className="font-medium">Current Verdict:</span>
                {getVerdictBadge(videoStatus.currentVerdict)}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatTimestamp(Date.now())}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Confidence:</span>
                <div className="font-medium">
                  {(videoStatus.confidence * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Latency:</span>
                <div className="font-medium">
                  {formatDuration(videoStatus.latency)}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Frames:</span>
                <div className="font-medium">
                  {videoStatus.currentFrame.toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">FPS:</span>
                <div className="font-medium">
                  {videoStatus.fps}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">LLM Calls:</span>
                <div className="font-medium">{videoStatus.llmCalls}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Session Cost:</span>
                <div className="font-medium">${videoStatus.cost.toFixed(4)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Verdicts</CardTitle>
            <CardDescription>
              Last 10 detection results
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No verdicts yet. Detection will start automatically during video calls.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {getVerdictIcon(item.verdict)}
                      <span>{item.verdict}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {(item.confidence * 100).toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatTimestamp(item.timestamp)}
                      </span>
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
                <strong>DeepGuard</strong> analyzes video frames in real-time to detect AI-generated faces.
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Local model processes frames at 5 FPS</li>
                <li>Ambiguous results are escalated to AI analysis</li>
                <li>All processing happens on-device for privacy</li>
                <li>Average cost: ~$0.04 per 30-minute session</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VideoTab;
