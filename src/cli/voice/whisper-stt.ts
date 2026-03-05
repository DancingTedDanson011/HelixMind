/**
 * WhisperSTT — Local speech-to-text using HuggingFace Transformers.js.
 * Lazy-loads the Whisper model on first transcription call.
 */

type ASRPipeline = (audio: Float32Array, options?: { sampling_rate?: number }) => Promise<{ text: string }>;

export class WhisperSTT {
  private pipeline: ASRPipeline | null = null;
  private loading: Promise<void> | null = null;
  private modelName: string;

  constructor(modelName = 'Xenova/whisper-tiny.en') {
    this.modelName = modelName;
  }

  /**
   * Transcribe a Float32Array audio buffer.
   * Model is loaded lazily on first call and cached for subsequent calls.
   */
  async transcribe(
    audioFloat32: Float32Array,
    sampleRate: number,
  ): Promise<{ text: string; confidence: number }> {
    await this.ensureModel();

    if (!this.pipeline) {
      return { text: '', confidence: 0 };
    }

    try {
      const result = await this.pipeline(audioFloat32, { sampling_rate: sampleRate });
      const text = (result.text ?? '').trim();
      // Whisper doesn't emit per-token confidence — use heuristic based on output length
      const confidence = text.length > 0 ? 0.85 : 0;
      return { text, confidence };
    } catch {
      return { text: '', confidence: 0 };
    }
  }

  private async ensureModel(): Promise<void> {
    if (this.pipeline) return;
    if (this.loading) return this.loading;

    this.loading = this.loadModel();
    return this.loading;
  }

  private async loadModel(): Promise<void> {
    try {
      const { pipeline } = await import('@huggingface/transformers');
      const asr = await pipeline('automatic-speech-recognition', this.modelName, {
        dtype: 'q8' as any,
      });
      this.pipeline = asr as unknown as ASRPipeline;
    } catch {
      this.pipeline = null;
    }
  }

  /** Dispose model to free memory. */
  async dispose(): Promise<void> {
    if (this.pipeline) {
      try {
        await (this.pipeline as any).dispose?.();
      } catch { /* ignore */ }
      this.pipeline = null;
      this.loading = null;
    }
  }
}

/**
 * Decode a base64-encoded PCM16LE buffer into a Float32Array suitable for Whisper.
 * PCM16LE: each sample is a signed 16-bit little-endian integer.
 */
export function pcm16Base64ToFloat32(base64: string): Float32Array {
  const buf = Buffer.from(base64, 'base64');
  const sampleCount = buf.length / 2;
  const float32 = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const int16 = buf.readInt16LE(i * 2);
    float32[i] = int16 / 32768;
  }

  return float32;
}
