import { describe, it, expect } from 'vitest';
import { CONTROL_REQUEST_TYPES } from '../../src/cli/brain/control-protocol.js';
import type {
  VoiceConfig, VoiceSessionState, VoiceProvider, STTProvider,
} from '../../src/shared/protocol-types.js';

describe('Voice Protocol Types', () => {
  describe('CONTROL_REQUEST_TYPES', () => {
    const voiceRequestTypes = [
      'voice_audio_chunk',
      'voice_interrupt',
      'voice_config_update',
      'voice_clone_upload',
      'get_voice_config',
    ] as const;

    it.each(voiceRequestTypes)('should include "%s"', (type) => {
      expect(CONTROL_REQUEST_TYPES.has(type)).toBe(true);
    });

    it('should include all 5 voice request types', () => {
      for (const t of voiceRequestTypes) {
        expect(CONTROL_REQUEST_TYPES.has(t)).toBe(true);
      }
    });
  });

  describe('VoiceConfig interface', () => {
    it('should accept a complete config object', () => {
      const config: VoiceConfig = {
        sttProvider: 'whisper',
        ttsProvider: 'elevenlabs',
        elevenLabsApiKey: 'sk-test-key',
        clonedVoiceId: 'voice-123',
        whisperModel: 'Xenova/whisper-tiny.en',
        vadSensitivity: 0.5,
        enabled: true,
      };

      expect(config.sttProvider).toBe('whisper');
      expect(config.ttsProvider).toBe('elevenlabs');
      expect(config.elevenLabsApiKey).toBe('sk-test-key');
      expect(config.clonedVoiceId).toBe('voice-123');
      expect(config.whisperModel).toBe('Xenova/whisper-tiny.en');
      expect(config.vadSensitivity).toBe(0.5);
      expect(config.enabled).toBe(true);
    });

    it('should accept a minimal config (only required fields)', () => {
      const config: VoiceConfig = {
        sttProvider: 'web_speech',
        ttsProvider: 'web_speech',
        enabled: false,
      };

      expect(config.sttProvider).toBe('web_speech');
      expect(config.ttsProvider).toBe('web_speech');
      expect(config.enabled).toBe(false);
      expect(config.elevenLabsApiKey).toBeUndefined();
      expect(config.clonedVoiceId).toBeUndefined();
      expect(config.whisperModel).toBeUndefined();
      expect(config.vadSensitivity).toBeUndefined();
    });
  });

  describe('VoiceSessionState type', () => {
    it('should allow all valid states', () => {
      const states: VoiceSessionState[] = ['idle', 'listening', 'processing', 'speaking'];
      expect(states).toHaveLength(4);
      expect(states).toContain('idle');
      expect(states).toContain('listening');
      expect(states).toContain('processing');
      expect(states).toContain('speaking');
    });
  });

  describe('VoiceProvider type', () => {
    it('should allow valid providers', () => {
      const providers: VoiceProvider[] = ['elevenlabs', 'web_speech'];
      expect(providers).toHaveLength(2);
    });
  });

  describe('STTProvider type', () => {
    it('should allow valid STT providers', () => {
      const providers: STTProvider[] = ['whisper', 'web_speech'];
      expect(providers).toHaveLength(2);
    });
  });

  describe('Voice message type properties', () => {
    it('should construct voice_audio_chunk request', () => {
      const msg = {
        type: 'voice_audio_chunk' as const,
        audioBase64: 'AAAA',
        sampleRate: 16000,
        utteranceId: 'utt-1',
        isFinal: false,
        timestamp: Date.now(),
      };
      expect(msg.type).toBe('voice_audio_chunk');
      expect(msg.sampleRate).toBe(16000);
    });

    it('should construct voice_interrupt request', () => {
      const msg = {
        type: 'voice_interrupt' as const,
        timestamp: Date.now(),
      };
      expect(msg.type).toBe('voice_interrupt');
    });

    it('should construct voice_config_update request', () => {
      const msg = {
        type: 'voice_config_update' as const,
        config: { enabled: true },
        timestamp: Date.now(),
      };
      expect(msg.type).toBe('voice_config_update');
      expect(msg.config.enabled).toBe(true);
    });

    it('should construct voice_clone_upload request', () => {
      const msg = {
        type: 'voice_clone_upload' as const,
        audioBase64: 'base64data',
        name: 'my-clone',
        timestamp: Date.now(),
      };
      expect(msg.type).toBe('voice_clone_upload');
      expect(msg.name).toBe('my-clone');
    });

    it('should construct get_voice_config request', () => {
      const msg = {
        type: 'get_voice_config' as const,
        timestamp: Date.now(),
      };
      expect(msg.type).toBe('get_voice_config');
    });
  });
});
