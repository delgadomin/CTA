export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export class Logger {
  private readonly name: string;
  private level: LogLevel;

  constructor(name: string, level: LogLevel = 'info') {
    this.name = name;
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, details?: unknown): void {
    this.write('debug', message, details);
  }

  info(message: string, details?: unknown): void {
    this.write('info', message, details);
  }

  warn(message: string, details?: unknown): void {
    this.write('warn', message, details);
  }

  error(message: string, details?: unknown): void {
    this.write('error', message, details);
  }

  private write(level: LogLevel, message: string, details?: unknown): void {
    if (LEVELS[level] < LEVELS[this.level]) return;
    const prefix = `[${this.name}] ${message}`;
    if (details === undefined) {
      if (level === 'warn') console.warn(prefix);
      else if (level === 'error') console.error(prefix);
      else console.info(prefix);
      return;
    }
    if (level === 'warn') console.warn(prefix, details);
    else if (level === 'error') console.error(prefix, details);
    else console.info(prefix, details);
  }
}
