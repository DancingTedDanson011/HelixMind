'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useVoiceCapture } from './use-voice-capture';
import { useVoicePlayback } from './use-voice-playback';
import type { VoiceSessionState, VoiceConfig } from '@/lib/cli-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseVoiceSessionParams {
  /** Send a raw WS message (fire-and-forget) */
  sendRaw: (type: string, payload?: Record<string, unknown>) => void;
  /** Subscribe to WS events; returns an unsubscribe function */
  onWsMessage: (handler: (msg: Record<string, unknown>) => void) => () => void;
  /** Whether the WS connection is active */
  isConnected: boolean;
  voiceConfig?: Partial<VoiceConfig>;
}

export interface UseVoiceSessionReturn {
  voiceState: VoiceSessionState;
  isVoiceActive: boolean;
  toggleVoice: () => void;
  transcript: string;
  audioLevel: number;
  voiceConfig: VoiceConfig;
  updateConfig: (config: Partial<VoiceConfig>) => void;
  uploadClone: (audioBase64: string, name: string) => void;
  error: string | null;
}

const DEFAULT_CONFIG: VoiceConfig = {
  sttProvider: 'whisper',
  ttsProvider: 'web_speech',
  enabled: false,
  vadSensitivity: 0.5,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Orchestrates voice capture + playback + WebSocket signaling.
 *
 * CLI-connected mode:
 *   - Utterances → WS `voice_audio_chunk` → CLI processes → receives
 *     `voice_transcript`, `voice_tts_chunk`, `voice_tts_start`, `voice_tts_end`,
 *     `voice_state`, `voice_error` events.
 *
 * Barge-in:
 *   - VAD onSpeechStart while speaking → send `voice_interrupt` → stop playback
 *     → record new utterance.
 */
export function useVoiceSession(params: UseVoiceSessionParams): UseVoiceSessionReturn {
  const { sendRaw, onWsMessage, isConnected, voiceConfig: configOverride } = params;

  const [voiceState, setVoiceState] = useState<VoiceSessionState>('idle');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const voiceConfig: VoiceConfig = { ...DEFAULT_CONFIG, ...configOverride };
  const voiceStateRef = useRef<VoiceSessionState>('idle');
  const isVoiceActiveRef = useRef(false);
  const mountedRef = useRef(true);

  const updateVoiceState = useCallback((state: VoiceSessionState) => {
    voiceStateRef.current = state;
    if (mountedRef.current) setVoiceState(state);
  }, []);

  // ---------------------------------------------------------------------------
  // Playback hook
  // ---------------------------------------------------------------------------
  const { isSpeaking, playChunk, stop: stopPlayback } = useVoicePlayback();

  // Sync isSpeaking → voiceState
  useEffect(() => {
    if (!isVoiceActiveRef.current) return;
    if (isSpeaking && voiceStateRef.current !== 'speaking') {
      updateVoiceState('speaking');
    } else if (!isSpeaking && voiceStateRef.current === 'speaking') {
      updateVoiceState('listening');
    }
  }, [isSpeaking, updateVoiceState]);

  // ---------------------------------------------------------------------------
  // Capture hook
  // ---------------------------------------------------------------------------
  const handleUtterance = useCallback((audioBase64: string, sampleRate: number, utteranceId: string) => {
    if (!isVoiceActiveRef.current || !isConnected) return;
    updateVoiceState('processing');
    sendRaw('voice_audio_chunk', {
      audioBase64,
      sampleRate,
      utteranceId,
      encoding: 'pcm16',
    });
  }, [isConnected, sendRaw, updateVoiceState]);

  const handleSpeechStart = useCallback(() => {
    if (!isVoiceActiveRef.current) return;
    // Barge-in: if AI is speaking, interrupt it
    if (voiceStateRef.current === 'speaking') {
      stopPlayback();
      sendRaw('voice_interrupt', {});
    }
    updateVoiceState('listening');
  }, [sendRaw, stopPlayback, updateVoiceState]);

  const handleSpeechEnd = useCallback(() => {
    if (!isVoiceActiveRef.current) return;
    // State transitions to processing once utterance is sent
  }, []);

  const {
    isListening,
    isSpeechDetected,
    audioLevel,
    startListening,
    stopListening,
  } = useVoiceCapture({
    onUtterance: handleUtterance,
    onSpeechStart: handleSpeechStart,
    onSpeechEnd: handleSpeechEnd,
    vadSensitivity: voiceConfig.vadSensitivity ?? 0.5,
  });

  // ---------------------------------------------------------------------------
  // WS event listener
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onWsMessage((msg) => {
      if (!mountedRef.current) return;
      const type = msg.type as string;

      if (type === 'voice_transcript') {
        const text = msg.text as string;
        if (text) setTranscript(text);
        return;
      }

      if (type === 'voice_tts_start') {
        updateVoiceState('speaking');
        return;
      }

      if (type === 'voice_tts_chunk') {
        const audioBase64 = msg.audioBase64 as string;
        const format = (msg.format as string) ?? 'pcm16';
        const sampleRate = (msg.sampleRate as number) ?? 22050;
        if (audioBase64) playChunk(audioBase64, format, sampleRate);
        return;
      }

      if (type === 'voice_tts_end') {
        // Playback hook will transition state once audio drains
        return;
      }

      if (type === 'voice_state') {
        const state = msg.state as VoiceSessionState;
        if (state) updateVoiceState(state);
        return;
      }

      if (type === 'voice_error') {
        const errorMsg = msg.error as string;
        setError(errorMsg ?? 'Voice error');
        updateVoiceState('idle');
        return;
      }
    });

    return unsubscribe;
  }, [onWsMessage, playChunk, updateVoiceState]);

  // ---------------------------------------------------------------------------
  // Toggle voice on/off
  // ---------------------------------------------------------------------------
  const toggleVoice = useCallback(async () => {
    if (isVoiceActiveRef.current) {
      // Turn off
      stopListening();
      stopPlayback();
      sendRaw('voice_session_end', {});
      isVoiceActiveRef.current = false;
      setIsVoiceActive(false);
      updateVoiceState('idle');
      setTranscript('');
      setError(null);
    } else {
      // Turn on
      setError(null);
      isVoiceActiveRef.current = true;
      setIsVoiceActive(true);
      updateVoiceState('listening');
      sendRaw('voice_session_start', {
        sttProvider: voiceConfig.sttProvider,
        ttsProvider: voiceConfig.ttsProvider,
        voiceId: voiceConfig.clonedVoiceId,
        whisperModel: voiceConfig.whisperModel,
      });
      try {
        await startListening();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Microphone access denied';
        setError(msg);
        isVoiceActiveRef.current = false;
        setIsVoiceActive(false);
        updateVoiceState('idle');
      }
    }
  }, [
    sendRaw,
    startListening,
    stopListening,
    stopPlayback,
    updateVoiceState,
    voiceConfig.clonedVoiceId,
    voiceConfig.sttProvider,
    voiceConfig.ttsProvider,
    voiceConfig.whisperModel,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopListening();
      stopPlayback();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Suppress unused variable warnings — these are exposed for consumers
  void isListening;
  void isSpeechDetected;

  const updateConfig = useCallback((config: Partial<VoiceConfig>) => {
    sendRaw('voice_config_update', { config });
  }, [sendRaw]);

  const uploadClone = useCallback((audioBase64: string, name: string) => {
    sendRaw('voice_clone_upload', { audioBase64, name });
  }, [sendRaw]);

  return {
    voiceState,
    isVoiceActive,
    toggleVoice,
    transcript,
    audioLevel,
    voiceConfig,
    updateConfig,
    uploadClone,
    error,
  };
}
