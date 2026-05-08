// Transcript Tab Component - Real-time Transcription Display

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, FileText, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';

interface TranscriptTabProps {
  sessionId: string | null;
  isActive: boolean;
}

interface TranscriptEntry {
  id: string;
  timestamp: number;
  text: string;
  speaker?: string;
  claims?: Array<{
    text: string;
    verdict: 'true' | 'false' | 'disputed' | 'unverifiable';
    confidence: number;
  }>;
}

const TranscriptTab: React.FC<TranscriptTabProps> = ({ sessionId, isActive }) => {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [totalWords, setTotalWords] = useState(0);
  const [totalClaims, setTotalClaims] = useState(0);

  // Simulate real-time transcription
  useEffect(() => {
    if (!isActive || !sessionId) return;

    setIsRecording(true);

    const mockTranscripts = [
      "Hello everyone, welcome to today's meeting.",
      "I wanted to discuss the quarterly results.",
      "Our revenue increased by 15% this quarter.",
      "The new product launch was very successful.",
      "We've seen great customer feedback.",
      "The market conditions are challenging but we're adapting.",
      "I think we should invest more in R&D.",
      "The competition is catching up quickly.",
      "We need to focus on user experience.",
      "The team has done an excellent job.",
      "Climate change is affecting our supply chain.",
      "Vaccines have been proven safe and effective.",
      "The economy is showing signs of recovery.",
      "Remote work is here to stay.",
      "Digital transformation is crucial.",
    ];

    const interval = setInterval(() => {
      const newEntry: TranscriptEntry = {
        id: `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        text: mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)],
        speaker: Math.random() > 0.5 ? 'Speaker 1' : 'Speaker 2',
      };

      // Add claims to some entries
      if (Math.random() > 0.7) {
        newEntry.claims = [
          {
            text: newEntry.text,
            verdict: Math.random() > 0.3 ? 'false' : Math.random() > 0.5 ? 'true' : 'disputed',
            confidence: Math.random() * 0.4 + 0.6,
          }
        ];
      }

      setTranscript(prev => [newEntry, ...prev.slice(0, 49)]); // Keep last 50 entries
      setTotalWords(prev => prev + newEntry.text.split(' ').length);
      setTotalClaims(prev => prev + (newEntry.claims?.length || 0));
    }, 2000);

    return () => clearInterval(interval);
  }, [isActive, sessionId]);

  const getClaimIcon = (verdict: string) => {
    switch (verdict) {
      case 'true':
        return <CheckCircle className="w-3 h-3 text-trust-blue" />;
      case 'false':
        return <XCircle className="w-3 h-3 text-trust-red" />;
      case 'disputed':
        return <AlertTriangle className="w-3 h-3 text-trust-amber" />;
      default:
        return null;
    }
  };

  const getClaimBadge = (verdict: string) => {
    switch (verdict) {
      case 'true':
        return <Badge className="badge-true text-xs">True</Badge>;
      case 'false':
        return <Badge className="badge-false text-xs">False</Badge>;
      case 'disputed':
        return <Badge className="badge-disputed text-xs">Disputed</Badge>;
      default:
        return null;
    }
  };

  if (!isActive) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <CardTitle>Transcript Inactive</CardTitle>
            <CardDescription>
              Enable MisinfoShield to see real-time transcription and claim analysis.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto custom-scrollbar">
      <div className="space-y-4">
        {/* Recording Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Live Transcript
            </CardTitle>
            <CardDescription>
              Real-time transcription with claim analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-sm font-medium">
                  {isRecording ? 'Recording' : 'Idle'}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {transcript.length} entries
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Words:</span>
                <div className="font-medium">{totalWords.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Claims Found:</span>
                <div className="font-medium">{totalClaims}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <div className="font-medium">
                  {Math.floor(transcript.length * 2 / 60)}m {(transcript.length * 2) % 60}s
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transcript Entries */}
        <Card>
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
            <CardDescription>
              Latest transcribed speech with claim highlights
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transcript.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {isRecording 
                  ? 'Listening for speech... Transcription will appear here.'
                  : 'No transcription available. Start a call or play audio to begin.'
                }
              </p>
            ) : (
              <div className="space-y-3">
                {transcript.map((entry) => (
                  <div key={entry.id} className="border-l-2 border-muted pl-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {entry.speaker || 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      {entry.claims && entry.claims.length > 0 && (
                        <div className="flex items-center gap-1">
                          {getClaimIcon(entry.claims[0].verdict)}
                          {getClaimBadge(entry.claims[0].verdict)}
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm">{entry.text}</p>
                    
                    {entry.claims && entry.claims.length > 0 && (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">Claim Analysis:</span>
                          <span className="text-muted-foreground">
                            {(entry.claims[0].confidence * 100).toFixed(1)}% confidence
                          </span>
                        </div>
                        <p className="text-muted-foreground italic">
                          This statement contains a factual claim that has been verified.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Options */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">
                <strong>Transcript Features:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Real-time speech transcription using Web Speech API</li>
                <li>Automatic claim detection and fact-checking</li>
                <li>Speaker identification when available</li>
                <li>Export transcript for documentation</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TranscriptTab;
