import { describe, expect, it } from 'vitest';
import { classifyShellCommand } from '../../../../src/cli/agent/shell/classifier.js';

describe('classifyShellCommand', () => {
  it('classifies read, search, and list commands as auto', () => {
    expect(classifyShellCommand('ls -la')).toMatchObject({
      kind: 'list',
      risk: 'auto',
    });
    expect(classifyShellCommand('rg PermissionManager src')).toMatchObject({
      kind: 'search',
      risk: 'auto',
    });
    expect(classifyShellCommand('cat package.json')).toMatchObject({
      kind: 'read',
      risk: 'auto',
    });
  });

  it('classifies read-only git commands as auto', () => {
    expect(classifyShellCommand('git status')).toMatchObject({
      kind: 'git',
      risk: 'auto',
    });
    expect(classifyShellCommand('git diff --stat')).toMatchObject({
      kind: 'git',
      risk: 'auto',
    });
  });

  it('classifies mutating and network commands as ask', () => {
    expect(classifyShellCommand('git push origin main')).toMatchObject({
      kind: 'git',
      risk: 'ask',
      touchesNetwork: false,
    });
    expect(classifyShellCommand('curl https://example.com')).toMatchObject({
      kind: 'network',
      risk: 'ask',
      touchesNetwork: true,
    });
    expect(classifyShellCommand('npm install')).toMatchObject({
      kind: 'package_manager',
      risk: 'ask',
      writesFiles: true,
    });
  });

  it('classifies dangerous and blocked commands explicitly', () => {
    expect(classifyShellCommand('sudo apt install foo')).toMatchObject({
      risk: 'dangerous',
    });
    expect(classifyShellCommand('rm -rf /')).toMatchObject({
      risk: 'blocked',
    });
  });

  it('detects PowerShell semantics on Windows commands', () => {
    expect(classifyShellCommand('Get-Content README.md', { platform: 'win32' })).toMatchObject({
      shell: 'powershell',
      kind: 'read',
      risk: 'auto',
    });
    expect(classifyShellCommand('Remove-Item .\\dist -Recurse', { platform: 'win32' })).toMatchObject({
      shell: 'powershell',
      risk: 'dangerous',
    });
  });
});
