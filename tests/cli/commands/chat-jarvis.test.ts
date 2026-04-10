import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const chatSource = readFileSync(
  resolve(__dirname, '../../../src/cli/commands/chat.ts'),
  'utf-8',
);

describe('chat jarvis onboarding integration', () => {
  it('uses non-buffered screen deactivation for onboarding', () => {
    expect(chatSource).toContain("chrome?.deactivate({ suspend: false });");
  });
});
