/**
 * VoiceEngine — Orchestrates STT → Agent → TTS pipeline.
 * State machine: idle → listening → processing → speaking → idle.
 */
import type { VoiceSessionState, VoiceConfig } from '@helixmind/protocol';
import type { WhisperSTT } from './whisper-stt.js';
import type { TTSEngine } from '../jarvis/voice-bridge.js';
import { pcm16Base64ToFloat32 } from './whisper-stt.js';

export interface VoiceEngineCallbacks {
  onTranscript: (utteranceId: string, text: string, confidence: number) => void;
  onTTSChunk: (utteranceId: string, audioBase64: string, format: string, sampleRate: number) => void;
  onTTSStart: (utteranceId: string, text: string) => void;
  onTTSEnd: (utteranceId: string) => void;
  onStateChange: (state: VoiceSessionState) => void;
  onError: (error: string, utteranceId?: string) => void;
  sendChat: (text: string, utteranceId: string) => Promise<string>;
}

export class VoiceEngine {
  private sttEngine: WhisperSTT;
  private ttsEngine: TTSEngine;
  private callbacks: VoiceEngineCallbacks;
  private state: VoiceSessionState = 'idle';
  private audioBuffers = new Map<string, string[]>();
  private currentAbortController: AbortController | null = null;

  constructor(opts: {
    sttEngine: WhisperSTT;
    ttsEngine: TTSEngine;
    callbacks: VoiceEngineCallbacks;
  }) {
    this.sttEngine = opts.sttEngine;
    this.ttsEngine = opts.ttsEngine;
    this.callbacks = opts.callbacks;
  }

  getState(): VoiceSessionState {
    return this.state;
  }

  private setState(next: VoiceSessionState): void {
    if (this.state !== next) {
      this.state = next;
      this.callbacks.onStateChange(next);
    }
  }

  /**
   * Handle an incoming audio chunk from the browser.
   * Chunks are buffered per utteranceId until isFinal is true.
   */
  async handleAudioChunk(
    audioBase64: string,
    sampleRate: number,
    utteranceId: string,
    isFinal: boolean,
  ): Promise<void> {
    // Buffer the chunk
    let chunks = this.audioBuffers.get(utteranceId);
    if (!chunks) {
      chunks = [];
      this.audioBuffers.set(utteranceId, chunks);
    }
    chunks.push(audioBase64);

    if (!isFinal) {
      this.setState('listening');
      return;
    }

    // Final chunk received — process the full utterance
    this.setState('processing');
    this.audioBuffers.delete(utteranceId);

    try {
      // Merge all chunks into one PCM buffer
      const merged = this.mergeChunks(chunks);
      const audioFloat32 = pcm16Base64ToFloat32(merged);

      // Run STT
      const { text, confidence } = await this.sttEngine.transcribe(audioFloat32, sampleRate);

      if (!text) {
        this.setState('idle');
        return;
      }

      this.callbacks.onTranscript(utteranceId, text, confidence);

      // Abort any previous in-flight operation
      this.currentAbortController?.abort();
      this.currentAbortController = new AbortController();

      // Send to agent and get response text
      const responseText = await this.callbacks.sendChat(text, utteranceId);

      if (this.currentAbortController.signal.aborted) {
        this.setState('idle');
        return;
      }

      // Stream TTS
      if (responseText && this.ttsEngine.isEnabled) {
        this.setState('speaking');
        this.callbacks.onTTSStart(utteranceId, responseText);

        try {
          await this.ttsEngine.speakStreaming(
            responseText,
            utteranceId,
            (base64, format, sr) => {
              this.callbacks.onTTSChunk(utteranceId, base64, format, sr);
            },
          );
        } catch {
          // TTS failure is non-critical
        }

        this.callbacks.onTTSEnd(utteranceId);
      }

      this.setState('idle');
    } catch (err) {
      this.callbacks.onError(
        err instanceof Error ? err.message : 'Voice processing failed',
        utteranceId,
      );
      this.setState('idle');
    }
  }

  /** Cancel any current processing or speaking. */
  interrupt(): void {
    this.currentAbortController?.abort();
    this.currentAbortController = null;
    this.ttsEngine.cancelSpeaking();
    this.audioBuffers.clear();
    this.setState('idle');
  }

  /** Update voice config (forwarded to TTS engine). */
  updateConfig(config: Partial<VoiceConfig>): void {
    if (config.ttsProvider || config.elevenLabsApiKey || config.clonedVoiceId) {
      this.ttsEngine.updateConfig({
        provider: config.ttsProvider,
        apiKey: config.elevenLabsApiKey,
        voiceId: config.clonedVoiceId,
      });
    }
  }

  /** Concatenate base64-encoded chunks into a single base64 string. */
  private mergeChunks(chunks: string[]): string {
    if (chunks.length === 1) return chunks[0];
    const buffers = chunks.map(c => Buffer.from(c, 'base64'));
    return Buffer.concat(buffers).toString('base64');
  }
}
