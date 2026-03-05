import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @huggingface/transformers before importing the module
const mockPipelineFn = vi.fn();
vi.mock('@huggingface/transformers', () => ({
  pipeline: mockPipelineFn,
}));

import { WhisperSTT, pcm16Base64ToFloat32 } from '../../src/cli/voice/whisper-stt.js';

describe('pcm16Base64ToFloat32', () => {
  it('should convert silent PCM16 to zero Float32', () => {
    // 4 bytes of zeros = 2 silent samples
    const base64 = Buffer.from([0, 0, 0, 0]).toString('base64');
    const result = pcm16Base64ToFloat32(base64);

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
  });

  it('should convert max positive PCM16 to ~1.0', () => {
    // Int16 max = 32767 → 0xFF7F in LE
    const buf = Buffer.alloc(2);
    buf.writeInt16LE(32767, 0);
    const base64 = buf.toString('base64');
    const result = pcm16Base64ToFloat32(base64);

    expect(result.length).toBe(1);
    // 32767 / 32768 ≈ 0.99997
    expect(result[0]).toBeCloseTo(32767 / 32768, 4);
  });

  it('should convert max negative PCM16 to -1.0', () => {
    // Int16 min = -32768 → 0x0080 in LE
    const buf = Buffer.alloc(2);
    buf.writeInt16LE(-32768, 0);
    const base64 = buf.toString('base64');
    const result = pcm16Base64ToFloat32(base64);

    expect(result.length).toBe(1);
    expect(result[0]).toBe(-1);
  });

  it('should handle multiple samples correctly', () => {
    const buf = Buffer.alloc(6);
    buf.writeInt16LE(0, 0);       // 0.0
    buf.writeInt16LE(16384, 2);   // 0.5
    buf.writeInt16LE(-16384, 4);  // -0.5
    const base64 = buf.toString('base64');

    const result = pcm16Base64ToFloat32(base64);
    expect(result.length).toBe(3);
    expect(result[0]).toBe(0);
    expect(result[1]).toBeCloseTo(0.5, 4);
    expect(result[2]).toBeCloseTo(-0.5, 4);
  });

  it('should return empty Float32Array for empty input', () => {
    const base64 = Buffer.alloc(0).toString('base64');
    const result = pcm16Base64ToFloat32(base64);
    expect(result.length).toBe(0);
  });
});

describe('WhisperSTT', () => {
  let stt: WhisperSTT;

  beforeEach(() => {
    vi.clearAllMocks();
    stt = new WhisperSTT('Xenova/whisper-tiny.en');
  });

  it('should lazy-load model on first transcribe call', async () => {
    const mockAsr = vi.fn().mockResolvedValue({ text: 'hello world' });
    mockPipelineFn.mockResolvedValue(mockAsr);

    const audio = new Float32Array(16000); // 1s of silence
    const result = await stt.transcribe(audio, 16000);

    expect(mockPipelineFn).toHaveBeenCalledOnce();
    expect(mockPipelineFn).toHaveBeenCalledWith(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en',
      expect.objectContaining({ dtype: 'q8' }),
    );
    expect(result.text).toBe('hello world');
    expect(result.confidence).toBe(0.85);
  });

  it('should reuse the loaded model on subsequent calls', async () => {
    const mockAsr = vi.fn().mockResolvedValue({ text: 'test' });
    mockPipelineFn.mockResolvedValue(mockAsr);

    const audio = new Float32Array(100);
    await stt.transcribe(audio, 16000);
    await stt.transcribe(audio, 16000);

    // pipeline() should be called only once (lazy-load)
    expect(mockPipelineFn).toHaveBeenCalledOnce();
    // But the ASR function should be called twice
    expect(mockAsr).toHaveBeenCalledTimes(2);
  });

  it('should pass sample rate to pipeline', async () => {
    const mockAsr = vi.fn().mockResolvedValue({ text: 'hi' });
    mockPipelineFn.mockResolvedValue(mockAsr);

    const audio = new Float32Array(100);
    await stt.transcribe(audio, 44100);

    expect(mockAsr).toHaveBeenCalledWith(audio, { sampling_rate: 44100 });
  });

  it('should return empty text with zero confidence on pipeline error', async () => {
    const mockAsr = vi.fn().mockRejectedValue(new Error('model error'));
    mockPipelineFn.mockResolvedValue(mockAsr);

    const audio = new Float32Array(100);
    const result = await stt.transcribe(audio, 16000);

    expect(result.text).toBe('');
    expect(result.confidence).toBe(0);
  });

  it('should return empty text if model fails to load', async () => {
    mockPipelineFn.mockRejectedValue(new Error('model not found'));

    const audio = new Float32Array(100);
    const result = await stt.transcribe(audio, 16000);

    expect(result.text).toBe('');
    expect(result.confidence).toBe(0);
  });

  it('should return zero confidence for empty transcription', async () => {
    const mockAsr = vi.fn().mockResolvedValue({ text: '   ' });
    mockPipelineFn.mockResolvedValue(mockAsr);

    const audio = new Float32Array(100);
    const result = await stt.transcribe(audio, 16000);

    expect(result.text).toBe('');
    expect(result.confidence).toBe(0);
  });

  it('should trim whitespace from transcription', async () => {
    const mockAsr = vi.fn().mockResolvedValue({ text: '  hello world  ' });
    mockPipelineFn.mockResolvedValue(mockAsr);

    const audio = new Float32Array(100);
    const result = await stt.transcribe(audio, 16000);

    expect(result.text).toBe('hello world');
  });

  it('should handle dispose correctly', async () => {
    const mockDispose = vi.fn();
    const mockAsr = Object.assign(vi.fn().mockResolvedValue({ text: 'test' }), {
      dispose: mockDispose,
    });
    mockPipelineFn.mockResolvedValue(mockAsr);

    const audio = new Float32Array(100);
    await stt.transcribe(audio, 16000);
    await stt.dispose();

    expect(mockDispose).toHaveBeenCalledOnce();
  });
});
