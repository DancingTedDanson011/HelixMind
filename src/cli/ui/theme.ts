import chalk from 'chalk';

export const theme = {
  // Brand colors
  primary: chalk.hex('#00d4ff'),     // Cyan
  secondary: chalk.hex('#4169e1'),   // Royal blue
  accent: chalk.hex('#8a2be2'),      // Blue violet

  // Semantic colors
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.cyan,
  dim: chalk.gray,
  bold: chalk.bold,

  // UI elements
  userLabel: chalk.hex('#00d4ff').bold('You'),
  aiLabel: chalk.hex('#8a2be2').bold('HelixMind'),
  get separator() { return chalk.gray('─'.repeat(Math.max(20, (process.stdout.columns || 80) - 4))); },

  // Spiral indicators (5 levels)
  spiralL1: chalk.hex('#00d4ff'),    // Cyan for Focus
  spiralL2: chalk.hex('#00ff88'),    // Green for Active
  spiralL3: chalk.hex('#4169e1'),    // Blue for Reference
  spiralL4: chalk.hex('#8a2be2'),    // Violet for Archive
  spiralL5: chalk.hex('#6c757d'),    // Gray for Deep Archive
};
