type Level = 'info' | 'warn' | 'error' | 'debug';

const PREFIX: Record<Level, string> = {
  info: '·',
  warn: '!',
  error: '✗',
  debug: '~',
};

function format(level: Level, message: string): string {
  return `${PREFIX[level]} ${message}`;
}

export const log = {
  info(message: string): void {
    console.log(format('info', message));
  },
  warn(message: string): void {
    console.warn(format('warn', message));
  },
  error(message: string): void {
    console.error(format('error', message));
  },
  debug(message: string): void {
    if (process.env['DOTCLAUDE_DEBUG']) {
      console.log(format('debug', message));
    }
  },
  raw(message: string): void {
    console.log(message);
  },
};
