/**
 * Sentiment Analyzer — Keyword-based emotional intelligence for user messages.
 * Detects sentiment (DE + EN), tracks mood over time, generates response guidance.
 * No LLM calls — instant, runs on every user message.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type {
  UserSentiment, SentimentReading, MoodAnalysis, SentimentData,
} from './types.js';

const MAX_HISTORY = 200;
const TREND_WINDOW = 10;
// FIX: JARVIS-MEDIUM-4 — single readings are too reactive for trait updates.
// We require CONFIRM_WINDOW_REQUIRED of the last CONFIRM_WINDOW_SIZE readings
// to agree before flipping the "confirmed" sentiment state.
const CONFIRM_WINDOW_SIZE = 5;
const CONFIRM_WINDOW_REQUIRED = 3;

// ─── Keyword Patterns ────────────────────────────────────────────────

interface SentimentPattern {
  sentiment: UserSentiment;
  keywords: RegExp[];
  weight: number; // higher = stronger signal
}

const PATTERNS: SentimentPattern[] = [
  {
    sentiment: 'frustrated',
    keywords: [
      /\b(error|bug|broken|kaputt|funktioniert\s*nicht|wtf|schei[sß]+e?|damn|shit|fuck|again|immer\s*noch|noch\s*immer|not\s*working|doesn'?t\s*work|geht\s*nicht|klappt\s*nicht|nerv(t|ig)|argh|ugh)\b/i,
    ],
    weight: 0.85,
  },
  {
    sentiment: 'satisfied',
    keywords: [
      /\b(danke|thanks?|perfect|great|super|genau|works|l[aä]uft|nice|gut\s*gemacht|awesome|excellent|amazing|toll|wunderbar|prima|cool|love\s*it|well\s*done|geil)\b/i,
    ],
    weight: 0.80,
  },
  {
    sentiment: 'curious',
    keywords: [
      /\b(how|why|was\s*ist|wie\s*geht|explain|zeig\s*mal|kannst\s*du|what\s*if|warum|wieso|could\s*you|tell\s*me|show\s*me|what\s*about|interessant|curious)\b/i,
    ],
    weight: 0.70,
  },
  {
    sentiment: 'stressed',
    keywords: [
      /\b(urgent|asap|schnell|sofort|deadline|hurry|eilig|dringend|immediately|now|jetzt|quick|rush|zeit\s*drängt|no\s*time|keine\s*zeit)\b/i,
    ],
    weight: 0.80,
  },
  {
    sentiment: 'confused',
    keywords: [
      /\b(verstehe?\s*nicht|what\??|huh|unclear|was\s*meinst\s*du|don'?t\s*understand|confused|unklar|macht\s*keinen\s*sinn|doesn'?t\s*make\s*sense|lost|verwirrt|keine\s*ahnung)\b/i,
    ],
    weight: 0.75,
  },
];

// ─── Response Guidance ───────────────────────────────────────────────

const GUIDANCE: Record<UserSentiment, string> = {
  frustrated: 'The user seems frustrated. Be solutions-focused. Skip lengthy explanations, give direct fixes. Acknowledge the issue briefly, then act.',
  stressed: 'The user is under time pressure. Be concise. Minimize output. Prioritize critical actions. Skip nice-to-haves.',
  confused: 'The user seems confused. Explain step-by-step. Use concrete examples. Ask clarifying questions if needed.',
  curious: 'The user is in exploration mode. Provide depth. Share alternatives and trade-offs. Encourage exploration.',
  satisfied: 'The user is happy with results. Match positive energy. Suggest next steps proactively.',
  neutral: '',
};

// ─── SentimentAnalyzer ───────────────────────────────────────────────

export class SentimentAnalyzer {
  private filePath: string;
  private data: SentimentData;
  private onShift?: (from: UserSentiment, to: UserSentiment, frustrationLevel: number) => void;
  // FIX: JARVIS-MEDIUM-4 — track the last confirmed sentiment separately
  // from the raw rolling buffer. analyzeMood().current still reports the
  // latest reading for UI, but trait adjustments should key off this.
  private lastConfirmedSentiment: UserSentiment = 'neutral';

  constructor(
    projectRoot: string,
    opts?: {
      onShift?: (from: UserSentiment, to: UserSentiment, frustrationLevel: number) => void;
    },
  ) {
    this.filePath = join(projectRoot, '.helixmind', 'jarvis', 'sentiment.json');
    this.onShift = opts?.onShift;
    this.data = this.load();
  }

  // ─── Public API ──────────────────────────────────────────────────

  /**
   * Detect sentiment from a user message via keyword matching.
   */
  detectSentiment(message: string): SentimentReading {
    let bestMatch: { sentiment: UserSentiment; confidence: number; trigger: string } | null = null;

    for (const pattern of PATTERNS) {
      for (const re of pattern.keywords) {
        const match = message.match(re);
        if (match) {
          const confidence = pattern.weight;
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { sentiment: pattern.sentiment, confidence, trigger: match[0] };
          }
        }
      }
    }

    return {
      sentiment: bestMatch?.sentiment ?? 'neutral',
      confidence: bestMatch?.confidence ?? 0.5,
      timestamp: Date.now(),
      trigger: bestMatch?.trigger,
    };
  }

  /**
   * Record a reading and check for sentiment shifts.
   *
   * FIX: JARVIS-MEDIUM-4 — only fire onShift (which drives trait updates)
   * when the new sentiment is *confirmed* by a rolling window: at least
   * CONFIRM_WINDOW_REQUIRED of the last CONFIRM_WINDOW_SIZE readings must
   * share the new sentiment. This prevents a single frustrated swear-word
   * from durably shifting Jarvis' perception of the user's mood.
   * analyzeMood() still returns the raw latest reading for UI display.
   */
  recordReading(reading: SentimentReading): void {
    this.data.history.push(reading);

    // Prune to max history
    if (this.data.history.length > MAX_HISTORY) {
      this.data.history = this.data.history.slice(-MAX_HISTORY);
    }

    // Confirmation check over the rolling window.
    const window = this.data.history.slice(-CONFIRM_WINDOW_SIZE);
    const counts = new Map<UserSentiment, number>();
    for (const r of window) {
      counts.set(r.sentiment, (counts.get(r.sentiment) || 0) + 1);
    }
    let confirmedCandidate: UserSentiment = this.lastConfirmedSentiment;
    for (const [s, c] of counts) {
      if (s === 'neutral') continue;
      if (c >= CONFIRM_WINDOW_REQUIRED) {
        confirmedCandidate = s;
        break;
      }
    }

    if (confirmedCandidate !== this.lastConfirmedSentiment) {
      const from = this.lastConfirmedSentiment;
      this.lastConfirmedSentiment = confirmedCandidate;
      const mood = this.analyzeMood();
      this.onShift?.(from, confirmedCandidate, mood.frustrationLevel);
    }

    this.save();
  }

  /** FIX: JARVIS-MEDIUM-4 — expose confirmed sentiment for callers that
   * need the stable signal (e.g. trait adjustment) vs the latest reading. */
  getConfirmedSentiment(): UserSentiment {
    return this.lastConfirmedSentiment;
  }

  /**
   * Analyze mood trend from recent readings.
   */
  analyzeMood(): MoodAnalysis {
    const history = this.data.history;
    const recent = history.slice(-TREND_WINDOW);

    if (recent.length === 0) {
      return {
        current: 'neutral',
        trend: 'stable',
        dominantSentiment: 'neutral',
        frustrationLevel: 0,
        sessionReadings: 0,
      };
    }

    const current = recent[recent.length - 1].sentiment;

    // Count sentiments in window
    const counts: Record<UserSentiment, number> = {
      frustrated: 0, satisfied: 0, curious: 0,
      stressed: 0, neutral: 0, confused: 0,
    };
    for (const r of recent) {
      counts[r.sentiment]++;
    }

    // Dominant sentiment
    let dominant: UserSentiment = 'neutral';
    let maxCount = 0;
    for (const [s, c] of Object.entries(counts) as [UserSentiment, number][]) {
      if (c > maxCount) { maxCount = c; dominant = s; }
    }

    // Frustration level: ratio of frustrated+stressed in recent window
    const negativeCount = counts.frustrated + counts.stressed;
    const frustrationLevel = recent.length > 0 ? negativeCount / recent.length : 0;

    // Trend: compare first half vs second half of window
    const trend = this.computeTrend(recent);

    return {
      current,
      trend,
      dominantSentiment: dominant,
      frustrationLevel,
      sessionReadings: history.length,
    };
  }

  /**
   * Get response guidance text for system prompt injection.
   */
  getResponseGuidance(): string {
    const mood = this.analyzeMood();
    const guidance = GUIDANCE[mood.current];
    if (!guidance) return '';

    let text = `\n## Emotional Context\nDetected user mood: ${mood.current} (trend: ${mood.trend})`;
    if (mood.frustrationLevel > 0.5) {
      text += `\nFrustration level: ${(mood.frustrationLevel * 100).toFixed(0)}% — prioritize empathy and directness.`;
    }
    text += `\nGuidance: ${guidance}`;
    return text;
  }

  // ─── Internals ───────────────────────────────────────────────────

  private computeTrend(recent: SentimentReading[]): 'improving' | 'stable' | 'declining' {
    if (recent.length < 4) return 'stable';

    const mid = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, mid);
    const secondHalf = recent.slice(mid);

    const score = (readings: SentimentReading[]) => {
      let s = 0;
      for (const r of readings) {
        if (r.sentiment === 'satisfied' || r.sentiment === 'curious') s += 1;
        if (r.sentiment === 'frustrated' || r.sentiment === 'stressed') s -= 1;
        if (r.sentiment === 'confused') s -= 0.5;
      }
      return readings.length > 0 ? s / readings.length : 0;
    };

    const firstScore = score(firstHalf);
    const secondScore = score(secondHalf);
    const delta = secondScore - firstScore;

    if (delta > 0.3) return 'improving';
    if (delta < -0.3) return 'declining';
    return 'stable';
  }

  private load(): SentimentData {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as SentimentData;
        if (parsed.version === 1 && Array.isArray(parsed.history)) {
          return parsed;
        }
      }
    } catch {
      // Corrupted — use defaults
    }
    return { version: 1, history: [], sessionStart: Date.now() };
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }
}
