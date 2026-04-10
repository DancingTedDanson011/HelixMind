export interface TurnDirectives {
  input: string;
  displayInput: string;
  fastMode: boolean;
  skipValidation: boolean;
  forceValidation: boolean;
  skipSwarm: boolean;
  forceSwarm: boolean;
  strippedFlags: string[];
}

interface InlineDirective {
  regex: RegExp;
  apply: (state: MutableDirectiveState) => void;
  label: string;
}

interface MutableDirectiveState {
  fastMode: boolean;
  skipValidation: boolean;
  forceValidation: boolean;
  skipSwarm: boolean;
  forceSwarm: boolean;
}

const INLINE_DIRECTIVES: InlineDirective[] = [
  {
    regex: /(^|\s)--fast\b/gi,
    apply: (state) => {
      state.fastMode = true;
      state.skipValidation = true;
      state.skipSwarm = true;
    },
    label: '--fast',
  },
  {
    regex: /(^|\s)--(?:skip-validation|no-validation)\b/gi,
    apply: (state) => {
      state.skipValidation = true;
      state.forceValidation = false;
    },
    label: '--skip-validation',
  },
  {
    regex: /(^|\s)--validate\b/gi,
    apply: (state) => {
      state.forceValidation = true;
      state.skipValidation = false;
    },
    label: '--validate',
  },
  {
    regex: /(^|\s)--(?:no-swarm|skip-swarm)\b/gi,
    apply: (state) => {
      state.skipSwarm = true;
      state.forceSwarm = false;
    },
    label: '--no-swarm',
  },
  {
    regex: /(^|\s)--swarm\b/gi,
    apply: (state) => {
      state.forceSwarm = true;
      state.skipSwarm = false;
    },
    label: '--swarm',
  },
];

export function parseTurnDirectives(rawInput: string): TurnDirectives {
  let working = rawInput.trim();
  const state: MutableDirectiveState = {
    fastMode: false,
    skipValidation: false,
    forceValidation: false,
    skipSwarm: false,
    forceSwarm: false,
  };
  const strippedFlags: string[] = [];

  if (/^\/fast\b/i.test(working)) {
    state.fastMode = true;
    state.skipValidation = true;
    state.skipSwarm = true;
    strippedFlags.push('/fast');
    working = working.replace(/^\/fast\b/i, '').trim();
  } else if (/^\/swarm\b/i.test(working)) {
    state.forceSwarm = true;
    strippedFlags.push('/swarm');
    working = working.replace(/^\/swarm\b/i, '').trim();
  }

  for (const directive of INLINE_DIRECTIVES) {
    let matched = false;
    working = working.replace(directive.regex, (_match, leading: string) => {
      matched = true;
      directive.apply(state);
      return leading ?? '';
    });
    if (matched) strippedFlags.push(directive.label);
  }

  if (state.forceValidation) {
    state.skipValidation = false;
  }
  if (state.forceSwarm) {
    state.skipSwarm = false;
  }

  return {
    input: working.replace(/\s{2,}/g, ' ').trim(),
    displayInput: rawInput,
    strippedFlags,
    ...state,
  };
}
