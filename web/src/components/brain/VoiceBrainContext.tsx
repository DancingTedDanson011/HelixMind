'use client';

import { createContext, useContext } from 'react';
import type { VoiceSessionState } from '@/lib/cli-types';

export interface VoiceBrainState {
  voiceState: VoiceSessionState;
  audioLevel: number;
}

const defaultState: VoiceBrainState = { voiceState: 'idle', audioLevel: 0 };

export const VoiceBrainContext = createContext<VoiceBrainState>(defaultState);

export function useVoiceBrain() {
  return useContext(VoiceBrainContext);
}
