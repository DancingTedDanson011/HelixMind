export interface FeedIntent {
  detected: boolean;
  confidence: number;
  scope: 'full_project' | 'directory' | 'file' | 'overview';
  path?: string;
}

const FEED_TRIGGERS_DE = [
  /schau\s*(dir\s*)?(mal\s*)?.*?(an|durch|rein)/i,
  /mach\s*dich\s*.*?vertraut/i,
  /lies\s*(dir\s*)?(mal\s*)?.*?(durch|ein)/i,
  /analysiere?\s*(das|den|die|mein)/i,
  /was\s+ist\s+das\s+für\s+ein\s+(projekt|repo)/i,
  /verschaff\s*(dir\s*)?.*?überblick/i,
  /versteh\s*(mal\s*)?.*?(code|projekt)/i,
  /check\s*(mal\s*)?.*?(code|projekt|repo)/i,
  /guck\s*(mal\s*)?.*?(rein|an|durch)/i,
  /erkunde?\s*(mal\s*)?.*?(code|projekt)/i,
];

const FEED_TRIGGERS_EN = [
  /look\s+at\s+(the\s+)?(\S+)/i,
  /understand\s+(this\s+)?(code|project|repo)/i,
  /get\s+(yourself\s+)?familiar/i,
  /analyze\s+(the\s+)?(\S+)/i,
  /what\s+(does\s+this|is\s+this)\s+(project|repo|code)/i,
  /explore\s+(the\s+)?(code|project|repo|codebase)/i,
  /read\s+(through\s+)?(the\s+)?(code|project|source)/i,
  /scan\s+(the\s+)?(code|project|repo|codebase)/i,
  /overview\s+of\s+(the\s+)?(project|code|repo)/i,
  /dig\s+into\s+(the\s+)?(code|project|codebase)/i,
];

const ALL_TRIGGERS = [...FEED_TRIGGERS_DE, ...FEED_TRIGGERS_EN];

// Match file paths like src/foo.ts, ./bar/baz.js
const FILE_PATH_PATTERN = /(?:^|\s)(\.?\/?\S+\.\w{1,5})(?:\s|$)/;
// Match directory paths like src/, ./lib/
const DIR_PATH_PATTERN = /(?:^|\s)(\.?\/?\S+\/)(?:\s|$)/;

export function detectFeedIntent(message: string): FeedIntent {
  if (!message.trim()) {
    return { detected: false, confidence: 0, scope: 'full_project' };
  }

  let matchCount = 0;
  for (const pattern of ALL_TRIGGERS) {
    if (pattern.test(message)) {
      matchCount++;
    }
  }

  if (matchCount === 0) {
    return { detected: false, confidence: 0, scope: 'full_project' };
  }

  // Confidence: 1 match = 0.8, 2+ matches = 0.95
  const confidence = matchCount >= 2 ? 0.95 : 0.8;

  // Detect scope from path mentions
  const fileMatch = message.match(FILE_PATH_PATTERN);
  const dirMatch = message.match(DIR_PATH_PATTERN);

  if (fileMatch) {
    return {
      detected: true,
      confidence,
      scope: 'file',
      path: fileMatch[1],
    };
  }

  if (dirMatch) {
    return {
      detected: true,
      confidence,
      scope: 'directory',
      path: dirMatch[1],
    };
  }

  return {
    detected: true,
    confidence,
    scope: 'full_project',
  };
}
