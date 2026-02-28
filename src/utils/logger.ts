type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  debug(message: string): void {
    if (shouldLog('debug')) {
      process.stderr.write(formatMessage('debug', message) + '\n');
    }
  },

  info(message: string): void {
    if (shouldLog('info')) {
      process.stderr.write(formatMessage('info', message) + '\n');
    }
  },

  warn(message: string): void {
    if (shouldLog('warn')) {
      process.stderr.write(formatMessage('warn', message) + '\n');
    }
  },

  error(message: string): void {
    if (shouldLog('error')) {
      process.stderr.write(formatMessage('error', message) + '\n');
    }
  },
};
