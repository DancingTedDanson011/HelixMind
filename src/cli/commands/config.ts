import { homedir } from 'node:os';
import { join } from 'node:path';
import { ConfigStore } from '../config/store.js';
import { theme } from '../ui/theme.js';

export function configSetCommand(key: string, value: string): void {
  const store = new ConfigStore(join(homedir(), '.helixmind'));

  // Parse boolean and number values
  let parsed: unknown = value;
  if (value === 'true') parsed = true;
  else if (value === 'false') parsed = false;
  else if (!isNaN(Number(value)) && value !== '') parsed = Number(value);

  store.set(key, parsed);
  process.stdout.write(`${theme.success('Set')} ${key} = ${JSON.stringify(parsed)}\n`);
}

export function configGetCommand(key: string): void {
  const store = new ConfigStore(join(homedir(), '.helixmind'));
  const value = store.get(key);

  if (value === undefined) {
    process.stdout.write(`${theme.warning('Not found:')} ${key}\n`);
  } else {
    process.stdout.write(`${key} = ${JSON.stringify(value)}\n`);
  }
}

export function configListCommand(): void {
  const store = new ConfigStore(join(homedir(), '.helixmind'));
  const entries = store.listFlat();

  process.stdout.write(`\n${theme.bold('HelixMind Configuration')}\n`);
  process.stdout.write(`${theme.separator}\n`);

  for (const { key, value } of entries) {
    const displayValue = key === 'apiKey' && typeof value === 'string' && value.length > 0
      ? value.slice(0, 8) + '...' + value.slice(-4)
      : JSON.stringify(value);
    process.stdout.write(`  ${theme.primary(key.padEnd(28))} ${displayValue}\n`);
  }
  process.stdout.write('\n');
}
