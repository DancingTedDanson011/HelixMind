import { classifyTask, type TaskClassification } from './classifier.js';
import type { TurnDirectives } from '../agent/turn-directives.js';

export interface ValidationOptions {
  enabled: boolean;
  verbose: boolean;
  strict: boolean;
}

export interface ValidationDecision extends ValidationOptions {
  classification: TaskClassification;
  reason: string;
}

export function resolveValidationDecision(
  input: string,
  base: ValidationOptions,
  directives?: Pick<TurnDirectives, 'fastMode' | 'skipValidation' | 'forceValidation'>,
): ValidationDecision {
  const classification = classifyTask(input);

  if (!base.enabled) {
    return { ...base, enabled: false, classification, reason: 'globally disabled' };
  }

  if (directives?.forceValidation || base.strict) {
    return {
      ...base,
      enabled: true,
      classification,
      reason: directives?.forceValidation ? 'forced for this turn' : 'strict mode',
    };
  }

  if (directives?.skipValidation) {
    return {
      ...base,
      enabled: false,
      classification,
      reason: directives.fastMode ? 'fast mode' : 'skipped for this turn',
    };
  }

  if (classification.category === 'chat_only') {
    return { ...base, enabled: false, classification, reason: 'chat-only request' };
  }

  if (classification.category === 'documentation' && classification.outputType === 'text') {
    return { ...base, enabled: false, classification, reason: 'text/documentation task' };
  }

  if (classification.complexity === 'trivial' && classification.outputType === 'text') {
    return { ...base, enabled: false, classification, reason: 'trivial text request' };
  }

  return { ...base, enabled: true, classification, reason: 'code-affecting task' };
}
