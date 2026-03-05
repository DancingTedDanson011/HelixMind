'use client';

import { useState, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseVoiceCaptureParams {
  onUtterance: (audioBase64: string, sampleRate: number, utteranceId: string) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  vadSensitivity?: number;
}

export interface UseVoiceCaptureReturn {
  isListening: boolean;
  isSpeechDetected: boolean;
  audioLevel: number;
  startListening: () => Promise<void>;
  stopListening: () => void;
}

// ---------------------------------------------------------------------------
// PCM16 conversion helper
// ---------------------------------------------------------------------------

function float32ToPCM16(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Captures microphone audio using @ricky0123/vad-web (Silero VAD).
 * Records complete utterances (speech start → silence → speech end) and
 * converts them to base64-encoded PCM16 for WebSocket transport.
 */
export function useVoiceCapture(params: UseVoiceCaptureParams): UseVoiceCaptureReturn {
  const { onUtterance, onSpeechStart, onSpeechEnd, vadSensitivity = 0.5 } = params;

  const [isListening, setIsListening] = useState(false);
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const vadRef = useRef<{ pause: () => void; start: () => void; destroy: () => void } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // ---------------------------------------------------------------------------
  // Audio level polling via AnalyserNode
  // ---------------------------------------------------------------------------
  const startLevelPolling = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    audioContextRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyzerRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);

    function poll() {
      if (!mountedRef.current) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length / 255;
      setAudioLevel(avg);
      animFrameRef.current = requestAnimationFrame(poll);
    }

    animFrameRef.current = requestAnimationFrame(poll);
  }, []);

  const stopLevelPolling = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyzerRef.current = null;
    setAudioLevel(0);
  }, []);

  // ---------------------------------------------------------------------------
  // Start listening
  // ---------------------------------------------------------------------------
  const startListening = useCallback(async () => {
    if (isListening) return;

    try {
      // Dynamic import to avoid SSR issues
      const { MicVAD } = await import('@ricky0123/vad-web');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startLevelPolling(stream);

      const vad = await MicVAD.new({
        positiveSpeechThreshold: vadSensitivity,
        negativeSpeechThreshold: Math.max(0, vadSensitivity - 0.15),
        onSpeechStart: () => {
          if (!mountedRef.current) return;
          setIsSpeechDetected(true);
          onSpeechStart?.();
        },
        onSpeechEnd: (audio: Float32Array) => {
          if (!mountedRef.current) return;
          setIsSpeechDetected(false);
          onSpeechEnd?.();

          // Convert Float32 PCM to PCM16 base64
          const pcm16 = float32ToPCM16(audio);
          const base64 = arrayBufferToBase64(pcm16);
          const utteranceId = crypto.randomUUID();
          // VAD resamples to 16kHz internally
          onUtterance(base64, 16000, utteranceId);
        },
      });

      vad.start();
      vadRef.current = vad;
      setIsListening(true);
    } catch (err) {
      console.error('[useVoiceCapture] Failed to start VAD:', err);
      stopLevelPolling();
    }
  }, [isListening, vadSensitivity, onUtterance, onSpeechStart, onSpeechEnd, startLevelPolling, stopLevelPolling]);

  // ---------------------------------------------------------------------------
  // Stop listening
  // ---------------------------------------------------------------------------
  const stopListening = useCallback(() => {
    if (vadRef.current) {
      vadRef.current.pause();
      vadRef.current.destroy();
      vadRef.current = null;
    }
    stopLevelPolling();
    setIsListening(false);
    setIsSpeechDetected(false);
  }, [stopLevelPolling]);

  return {
    isListening,
    isSpeechDetected,
    audioLevel,
    startListening,
    stopListening,
  };
}
