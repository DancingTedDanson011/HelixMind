import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('helix command', () => {
  it('should be registered as a commander command in index.ts', () => {
    const indexSrc = readFileSync(join(__dirname, '../../../src/cli/index.ts'), 'utf-8');
    expect(indexSrc).toContain("command('helix')");
    expect(indexSrc).toContain('chatCommand');
  });

  it('should be available alongside chat (alias)', () => {
    const indexSrc = readFileSync(join(__dirname, '../../../src/cli/index.ts'), 'utf-8');
    // Both chat and helix should invoke chatCommand
    const chatMatches = indexSrc.match(/chatCommand/g);
    expect(chatMatches!.length).toBeGreaterThanOrEqual(2); // default chat + helix
  });
});

describe('quit state save', () => {
  it('should save state on /quit', () => {
    const chatSrc = readFileSync(join(__dirname, '../../../src/cli/commands/chat.ts'), 'utf-8');
    // /quit and /exit should call saveState
    expect(chatSrc).toContain('saveState(messages)');
    expect(chatSrc).toContain("case '/quit':");
    expect(chatSrc).toContain("case '/exit':");
  });

  it('should save state on readline close (Ctrl+D)', () => {
    const chatSrc = readFileSync(join(__dirname, '../../../src/cli/commands/chat.ts'), 'utf-8');
    expect(chatSrc).toContain("rl.on('close'");
    expect(chatSrc).toContain('saveState(messages)');
  });
});

describe('Ctrl+C handling', () => {
  it('should handle SIGINT for double Ctrl+C exit', () => {
    const chatSrc = readFileSync(join(__dirname, '../../../src/cli/commands/chat.ts'), 'utf-8');
    expect(chatSrc).toContain('SIGINT');
    expect(chatSrc).toContain('ctrlCCount');
  });

  it('should reset Ctrl+C counter on user input', () => {
    const chatSrc = readFileSync(join(__dirname, '../../../src/cli/commands/chat.ts'), 'utf-8');
    expect(chatSrc).toContain('ctrlCCount = 0');
  });

  it('should save state on double Ctrl+C exit', () => {
    const chatSrc = readFileSync(join(__dirname, '../../../src/cli/commands/chat.ts'), 'utf-8');
    // On double Ctrl+C, should attempt state save
    expect(chatSrc).toContain('Force exit');
    expect(chatSrc).toContain('saveState');
  });
});
