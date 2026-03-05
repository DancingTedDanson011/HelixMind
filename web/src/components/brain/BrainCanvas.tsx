'use client';

import { Suspense, lazy, useMemo } from 'react';
import { VoiceBrainContext, type VoiceBrainState } from './VoiceBrainContext';
import type { VoiceSessionState } from '@/lib/cli-types';

const BrainScene = lazy(() => import('./BrainScene').then((m) => ({ default: m.BrainScene })));

interface BrainCanvasProps {
  voiceState?: VoiceSessionState;
  audioLevel?: number;
}

export function BrainCanvas({ voiceState = 'idle', audioLevel = 0 }: BrainCanvasProps) {
  const voiceBrain = useMemo<VoiceBrainState>(
    () => ({ voiceState, audioLevel }),
    [voiceState, audioLevel],
  );

  return (
    <div className="absolute inset-0 z-0">
      <VoiceBrainContext.Provider value={voiceBrain}>
        <Suspense fallback={<BrainFallback />}>
          <BrainScene />
        </Suspense>
      </VoiceBrainContext.Provider>
    </div>
  );
}

function BrainFallback() {
  return (
    <div className="absolute inset-0 bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,212,255,0.05)_0%,transparent_70%)]" />
    </div>
  );
}
