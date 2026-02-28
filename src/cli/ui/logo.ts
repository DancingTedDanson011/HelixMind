import figlet from 'figlet';
import gradient from 'gradient-string';

const HELIX_GRADIENT = gradient(['#00d4ff', '#4169e1', '#8a2be2']);

export function renderLogo(): string {
  try {
    const ascii = figlet.textSync('HELIX', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
    });

    const lines: string[] = [];
    lines.push('');
    lines.push(HELIX_GRADIENT(ascii));
    lines.push(HELIX_GRADIENT('  ─── Mind ───'));
    lines.push('');
    return lines.join('\n');
  } catch {
    // Fallback if figlet fails
    return HELIX_GRADIENT('\n  ╦ ╦╔═╗╦  ╦═╗ ╦\n  ╠═╣║╣ ║  ║╠╦╝ ║\n  ╩ ╩╚═╝╩═╝╩╩╚  ╩  Mind\n');
  }
}

export function renderVersion(version: string): string {
  return `  ${gradient(['#00d4ff', '#4169e1'])(`v${version}`)}`;
}
