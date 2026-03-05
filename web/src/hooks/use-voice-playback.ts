'use client';

import { useState, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseVoicePlaybackReturn {
  isSpeaking: boolean;
  playChunk: (audioBase64: string, format: string, sampleRate: number) => void;
  stop: () => void;
}

interface AudioChunk {
  audioBase64: string;
  sampleRate: number;
}

// ---------------------------------------------------------------------------
// Base64 → Float32Array decoder
// ---------------------------------------------------------------------------

function base64ToFloat32(audioBase64: string, sampleRate: number, audioCtx: AudioContext): Promise<AudioBuffer> {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  // Detect if it's PCM16 (raw) or encoded audio (WAV/MP3/etc.)
  // PCM16 raw: 2 bytes per sample, no header
  // We attempt decodeAudioData first; if it fails, treat as raw PCM16
  return audioCtx.decodeAudioData(bytes.buffer.slice(0)).catch(() => {
    // Raw PCM16 fallback
    const samples = bytes.length / 2;
    const buffer = audioCtx.createBuffer(1, samples, sampleRate);
    const channelData = buffer.getChannelData(0);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < samples; i++) {
      const int16 = view.getInt16(i * 2, true);
      channelData[i] = int16 / 0x8000;
    }
    return buffer;
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Queue-based audio playback using Web Audio API.
 * Accepts incoming PCM chunks and plays them gaplessly in order.
 * Supports instant stop for barge-in.
 */
export function useVoicePlayback(): UseVoicePlaybackReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<AudioChunk[]>([]);
  const isPlayingRef = useRef(false);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef(0);
  const mountedRef = useRef(true);

  // ---------------------------------------------------------------------------
  // Ensure AudioContext exists and is running
  // ---------------------------------------------------------------------------
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  // ---------------------------------------------------------------------------
  // Internal: play next chunk from queue
  // ---------------------------------------------------------------------------
  const playNextChunk = useCallback(async () => {
    if (queueRef.current.length === 0) {
      isPlayingRef.current = false;
      if (mountedRef.current) setIsSpeaking(false);
      return;
    }

    const chunk = queueRef.current.shift()!;
    const ctx = getAudioContext();

    try {
      const audioBuffer = await base64ToFloat32(chunk.audioBase64, chunk.sampleRate, ctx);

      if (!mountedRef.current || !isPlayingRef.current) return;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      // Gapless scheduling: start at nextStartTimeRef or now (whichever is later)
      const now = ctx.currentTime;
      const startAt = Math.max(now, nextStartTimeRef.current);
      source.start(startAt);
      nextStartTimeRef.current = startAt + audioBuffer.duration;

      activeSourcesRef.current.push(source);

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        if (mountedRef.current && isPlayingRef.current) {
          playNextChunk();
        }
      };
    } catch (err) {
      console.error('[useVoicePlayback] Chunk decode error:', err);
      // Skip bad chunk and try next
      if (mountedRef.current && isPlayingRef.current) {
        playNextChunk();
      }
    }
  }, [getAudioContext]);

  // ---------------------------------------------------------------------------
  // Public: enqueue a chunk
  // ---------------------------------------------------------------------------
  const playChunk = useCallback((audioBase64: string, _format: string, sampleRate: number) => {
    queueRef.current.push({ audioBase64, sampleRate });

    if (!isPlayingRef.current) {
      isPlayingRef.current = true;
      if (mountedRef.current) setIsSpeaking(true);
      // Reset scheduling cursor
      const ctx = getAudioContext();
      nextStartTimeRef.current = ctx.currentTime;
      playNextChunk();
    }
  }, [getAudioContext, playNextChunk]);

  // ---------------------------------------------------------------------------
  // Public: instant stop (barge-in)
  // ---------------------------------------------------------------------------
  const stop = useCallback(() => {
    isPlayingRef.current = false;
    queueRef.current = [];
    nextStartTimeRef.current = 0;

    for (const source of activeSourcesRef.current) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped
      }
    }
    activeSourcesRef.current = [];

    if (mountedRef.current) setIsSpeaking(false);
  }, []);

  return { isSpeaking, playChunk, stop };
}
