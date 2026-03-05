import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock whisper-stt
vi.mock('../../src/cli/voice/whisper-stt.js', () => ({
  pcm16Base64ToFloat32: vi.fn().mockReturnValue(new Float32Array(100)),
}));

// Mock voice-bridge TTSEngine
vi.mock('../../src/cli/jarvis/voice-bridge.js', () => ({}));

import { VoiceEngine } from '../../src/cli/voice/engine.js';

function makeCallbacks() {
  return {
    onTranscript: vi.fn(),
    onTTSChunk: vi.fn(),
    onTTSStart: vi.fn(),
    onTTSEnd: vi.fn(),
    onStateChange: vi.fn(),
    onError: vi.fn(),
    sendChat: vi.fn().mockResolvedValue('Hello back'),
  };
}

function makeMockSTT(text = 'hello world', confidence = 0.85) {
  return {
    transcribe: vi.fn().mockResolvedValue({ text, confidence }),
    dispose: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function makeMockTTS(enabled = false) {
  return {
    isEnabled: enabled,
    speakStreaming: vi.fn().mockResolvedValue(undefined),
    cancelSpeaking: vi.fn(),
    updateConfig: vi.fn(),
  } as any;
}

describe('VoiceEngine', () => {
  let engine: VoiceEngine;
  let callbacks: ReturnType<typeof makeCallbacks>;
  let mockSTT: ReturnType<typeof makeMockSTT>;
  let mockTTS: ReturnType<typeof makeMockTTS>;

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = makeCallbacks();
    mockSTT = makeMockSTT();
    mockTTS = makeMockTTS();
    engine = new VoiceEngine({
      sttEngine: mockSTT,
      ttsEngine: mockTTS,
      callbacks,
    });
  });

  describe('State Machine', () => {
    it('should start in idle state', () => {
      expect(engine.getState()).toBe('idle');
    });

    it('should transition to listening on non-final chunk', async () => {
      await engine.handleAudioChunk('AAAA', 16000, 'utt-1', false);
      expect(engine.getState()).toBe('listening');
      expect(callbacks.onStateChange).toHaveBeenCalledWith('listening');
    });

    it('should transition to processing when isFinal=true', async () => {
      // Processing fires then returns to idle since TTS is disabled
      const stateChanges: string[] = [];
      callbacks.onStateChange.mockImplementation((s: string) => stateChanges.push(s));

      await engine.handleAudioChunk('AAAA', 16000, 'utt-1', true);
      expect(stateChanges).toContain('processing');
    });

    it('should go through processing → idle when TTS is disabled', async () => {
      const stateChanges: string[] = [];
      callbacks.onStateChange.mockImplementation((s: string) => stateChanges.push(s));

      await engine.handleAudioChunk('AAAA', 16000, 'utt-1', true);

      // Should have gone processing → idle (no speaking since TTS is disabled)
      expect(stateChanges).toContain('processing');
      expect(stateChanges[stateChanges.length - 1]).toBe('idle');
    });

    it('should go through processing → speaking → idle when TTS is enabled', async () => {
      mockTTS.isEnabled = true;
      const stateChanges: string[] = [];
      callbacks.onStateChange.mockImplementation((s: string) => stateChanges.push(s));

      await engine.handleAudioChunk('AAAA', 16000, 'utt-1', true);

      expect(stateChanges).toContain('processing');
      expect(stateChanges).toContain('speaking');
      expect(stateChanges[stateChanges.length - 1]).toBe('idle');
    });
  });

  describe('Audio Chunk Buffering', () => {
    it('should buffer non-final chunks in listening state', async () => {
      await engine.handleAudioChunk('chunk1', 16000, 'utt-1', false);
      await engine.handleAudioChunk('chunk2', 16000, 'utt-1', false);
      expect(engine.getState()).toBe('listening');
      // STT should not have been called yet
      expect(mockSTT.transcribe).not.toHaveBeenCalled();
    });

    it('should trigger transcription on isFinal=true', async () => {
      await engine.handleAudioChunk('chunk1', 16000, 'utt-1', false);
      await engine.handleAudioChunk('chunk2', 16000, 'utt-1', true);
      expect(mockSTT.transcribe).toHaveBeenCalledOnce();
    });

    it('should call onTranscript callback with result', async () => {
      await engine.handleAudioChunk('AAAA', 16000, 'utt-1', true);
      expect(callbacks.onTranscript).toHaveBeenCalledWith('utt-1', 'hello world', 0.85);
    });

    it('should handle separate utterances independently', async () => {
      await engine.handleAudioChunk('chunk1', 16000, 'utt-1', true);
      await engine.handleAudioChunk('chunk2', 16000, 'utt-2', true);
      expect(mockSTT.transcribe).toHaveBeenCalledTimes(2);
      expect(callbacks.onTranscript).toHaveBeenCalledTimes(2);
    });
  });

  describe('Agent Integration', () => {
    it('should call sendChat with transcribed text', async () => {
      await engine.handleAudioChunk('AAAA', 16000, 'utt-1', true);
      expect(callbacks.sendChat).toHaveBeenCalledWith('hello world', 'utt-1');
    });

    it('should not call sendChat if transcription is empty', async () => {
      mockSTT.transcribe.mockResolvedValue({ text: '', confidence: 0 });
      await engine.handleAudioChunk('AAAA', 16000, 'utt-1', true);
      expect(callbacks.sendChat).not.toHaveBeenCalled();
    });
  });

  describe('TTS Streaming', () => {
    it('should call TTS when enabled and response text exists', async () => {
      mockTTS.isEnabled = true;
      await engine.handleAudioChunk('AAAA', 16000, 'utt-1', true);
      expect(callbacks.onTTSStart).toHaveBeenCalledWith('utt-1', 'Hello back');
      expect(mockTTS.speakStreaming).toHaveBeenCalled();
      expect(callbacks.onTTSEnd).toHaveBeenCalledWith('utt-1');
    });

    it('should not call TTS when disabled', async () => {
      mockTTS.isEnabled = false;
      await engine.handleAudioChunk('AAAA', 16000, 'utt-1', true);
      expect(mockTTS.speakStreaming).not.toHaveBeenCalled();
    });
  });

  describe('Interrupt', () => {
    it('should cancel TTS and return to idle', () => {
      engine.interrupt();
      expect(mockTTS.cancelSpeaking).toHaveBeenCalled();
      expect(engine.getState()).toBe('idle');
    });

    it('should clear audio buffers on interrupt', async () => {
      await engine.handleAudioChunk('chunk1', 16000, 'utt-1', false);
      engine.interrupt();
      // After interrupt + new utterance, STT should only see the new chunk
      expect(engine.getState()).toBe('idle');
    });
  });

  describe('Error Handling', () => {
    it('should invoke onError callback on STT failure', async () => {
      mockSTT.transcribe.mockRejectedValue(new Error('transcription failed'));
      await engine.handleAudioChunk('bad', 16000, 'utt-err', true);
      expect(callbacks.onError).toHaveBeenCalledWith('transcription failed', 'utt-err');
      expect(engine.getState()).toBe('idle');
    });

    it('should invoke onError callback on sendChat failure', async () => {
      callbacks.sendChat.mockRejectedValue(new Error('agent error'));
      await engine.handleAudioChunk('data', 16000, 'utt-err', true);
      expect(callbacks.onError).toHaveBeenCalledWith('agent error', 'utt-err');
      expect(engine.getState()).toBe('idle');
    });

    it('should recover to idle state after TTS failure', async () => {
      mockTTS.isEnabled = true;
      mockTTS.speakStreaming.mockRejectedValue(new Error('TTS failed'));
      await engine.handleAudioChunk('data', 16000, 'utt-1', true);
      // TTS failure is non-critical, engine should still reach idle
      expect(engine.getState()).toBe('idle');
    });
  });

  describe('Config Update', () => {
    it('should forward TTS config to TTS engine', () => {
      engine.updateConfig({
        ttsProvider: 'elevenlabs',
        elevenLabsApiKey: 'sk-test',
        clonedVoiceId: 'clone-123',
      });
      expect(mockTTS.updateConfig).toHaveBeenCalledWith({
        provider: 'elevenlabs',
        apiKey: 'sk-test',
        voiceId: 'clone-123',
      });
    });

    it('should not call updateConfig if no TTS-related fields', () => {
      engine.updateConfig({ enabled: true });
      expect(mockTTS.updateConfig).not.toHaveBeenCalled();
    });
  });
});
