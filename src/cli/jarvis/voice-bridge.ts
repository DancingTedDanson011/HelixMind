/**
 * Voice Bridge — Voice input parsing + TTS output for Jarvis.
 * Input: Natural language intent recognition (DE + EN).
 * Output: TTS via ElevenLabs API or Web Speech API fallback.
 * Follows the Bug Detector pattern (regex + keyword matching).
 */
import type { VoiceIntent, VoiceIntentType, TTSConfig } from './types.js';

// ─── Intent Patterns (DE + EN) ───────────────────────────────────────

const INTENT_PATTERNS: { pattern: RegExp; type: VoiceIntentType; extractParams?: (match: RegExpMatchArray) => Record<string, string | number> }[] = [
  // Approve/Deny proposals
  { pattern: /(?:approve|genehmig|akzeptier)\s+(?:proposal\s+)?#?(\d+)/i, type: 'approve_proposal', extractParams: m => ({ proposalId: parseInt(m[1], 10) }) },
  { pattern: /(?:deny|ablehn|verweiger)\s+(?:proposal\s+)?#?(\d+)/i, type: 'deny_proposal', extractParams: m => ({ proposalId: parseInt(m[1], 10) }) },

  // Task management
  { pattern: /(?:add\s+task|neue?\s+(?:aufgabe|task)):\s*(.+)/i, type: 'add_task', extractParams: m => ({ taskTitle: m[1].trim() }) },

  // Daemon control
  { pattern: /(?:start|starte?)\s+jarvis/i, type: 'start_jarvis' },
  { pattern: /(?:stop|stopp)\s+jarvis/i, type: 'stop_jarvis' },
  { pattern: /(?:pause|pausier)\s+jarvis/i, type: 'pause_jarvis' },
  { pattern: /(?:resume|weiter|fortsetzen)\s+jarvis/i, type: 'resume_jarvis' },

  // Emergency
  { pattern: /(?:notfall|emergency|halt|sofort\s+stop)/i, type: 'emergency_stop' },

  // Deep thinking
  { pattern: /(?:denk|think|analyse|analys)\s+(?:tief|deep|nach)/i, type: 'think_deep' },
  { pattern: /(?:was\s+denkst|what\s+(?:do\s+you\s+)?think)/i, type: 'query' },

  // General queries
  { pattern: /(?:status|wie\s+(?:geht|steht)|how\s+(?:are|is))/i, type: 'query' },
];

/**
 * Parse voice input text into a structured intent.
 * Returns the best matching intent with confidence.
 */
export function parseVoiceInput(text: string): VoiceIntent {
  const normalized = text.trim().toLowerCase();

  for (const { pattern, type, extractParams } of INTENT_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      return {
        type,
        confidence: 0.9,
        params: extractParams ? extractParams(match) : {},
        rawText: text,
      };
    }
  }

  // No specific intent matched — treat as general query
  return {
    type: 'query',
    confidence: 0.3,
    params: { text },
    rawText: text,
  };
}

// ─── TTS Output ───────────────────────────────────────────────────────

const DEFAULT_TTS_CONFIG: TTSConfig = {
  provider: 'web_speech',
  enabled: false,
};

/**
 * Text-to-Speech engine.
 * Supports ElevenLabs API and Web Speech API (via browser WebSocket).
 */
export class TTSEngine {
  private config: TTSConfig;
  private pushAudioToClient?: (audioBase64: string, text: string, duration: number) => void;

  constructor(
    config?: Partial<TTSConfig>,
    pushAudioToClient?: (audioBase64: string, text: string, duration: number) => void,
  ) {
    this.config = { ...DEFAULT_TTS_CONFIG, ...config };
    this.pushAudioToClient = pushAudioToClient;
  }

  /**
   * Speak text. Sends audio to browser via WebSocket.
   */
  async speak(text: string): Promise<void> {
    if (!this.config.enabled) return;

    switch (this.config.provider) {
      case 'elevenlabs':
        await this.speakElevenLabs(text);
        break;

      case 'web_speech':
        // Web Speech API is browser-side — send command to browser
        this.pushAudioToClient?.('', text, 0);  // Empty audio = use Web Speech
        break;
    }
  }

  /**
   * Update TTS configuration.
   */
  updateConfig(config: Partial<TTSConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Set the audio push callback.
   */
  setAudioPusher(pusher: (audioBase64: string, text: string, duration: number) => void): void {
    this.pushAudioToClient = pusher;
  }

  get isEnabled(): boolean {
    return this.config.enabled;
  }

  // ─── ElevenLabs Implementation ───────────────────────────────────

  private async speakElevenLabs(text: string): Promise<void> {
    if (!this.config.apiKey) return;

    const voiceId = this.config.voiceId || '21m00Tcm4TlvDq8ikWAM';  // Default: Rachel

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.config.apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!response.ok) return;

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      // Estimate duration (rough: ~150 words per minute)
      const words = text.split(/\s+/).length;
      const duration = (words / 150) * 60;

      this.pushAudioToClient?.(base64, text, duration);
    } catch {
      // TTS failure is non-critical
    }
  }
}

// ─── Voice Bridge Factory ─────────────────────────────────────────────

export interface VoiceBridgeDeps {
  onApproveProposal: (id: number) => void;
  onDenyProposal: (id: number, reason: string) => void;
  onAddTask: (title: string) => void;
  onStartJarvis: () => void;
  onStopJarvis: () => void;
  onPauseJarvis: () => void;
  onResumeJarvis: () => void;
  onEmergencyStop: () => void;
  onDeepThink: () => void;
  onQuery: (text: string) => void;
}

/**
 * Create a voice input handler that routes intents to actions.
 * Wire this to brain server's voice input handler.
 */
export function createVoiceBridge(deps: VoiceBridgeDeps): (text: string) => void {
  return (text: string) => {
    const intent = parseVoiceInput(text);

    switch (intent.type) {
      case 'approve_proposal':
        deps.onApproveProposal(intent.params.proposalId as number);
        break;
      case 'deny_proposal':
        deps.onDenyProposal(intent.params.proposalId as number, 'denied via voice');
        break;
      case 'add_task':
        deps.onAddTask(intent.params.taskTitle as string);
        break;
      case 'start_jarvis':
        deps.onStartJarvis();
        break;
      case 'stop_jarvis':
        deps.onStopJarvis();
        break;
      case 'pause_jarvis':
        deps.onPauseJarvis();
        break;
      case 'resume_jarvis':
        deps.onResumeJarvis();
        break;
      case 'emergency_stop':
        deps.onEmergencyStop();
        break;
      case 'think_deep':
        deps.onDeepThink();
        break;
      case 'query':
        deps.onQuery(intent.rawText);
        break;
    }
  };
}
