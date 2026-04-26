/**
 * Tiny environment-aware logger.
 *
 * - debug/info: silent in production (avoids leaking internal state and
 *   blowing up log volume)
 * - warn/error: always on
 *
 * Swap for pino/winston later if you need structured logs / log shipping.
 */

const isProd = process.env.NODE_ENV === "production";

function format(level: string, args: unknown[]): unknown[] {
  return [`[${level}]`, ...args];
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (!isProd) console.debug(...format("debug", args));
  },
  info: (...args: unknown[]) => {
    if (!isProd) console.info(...format("info", args));
  },
  warn: (...args: unknown[]) => {
    console.warn(...format("warn", args));
  },
  error: (...args: unknown[]) => {
    console.error(...format("error", args));
  },
};
