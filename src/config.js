import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version ?? '1.0.0';
  } catch {
    return '1.0.0';
  }
}

const DEFAULTS = {
  port: 8080,
  host: '127.0.0.1',
  openBrowser: true,
  driver: null,
  maxUploadMb: 50,
  sessionTtlMs: 60 * 60 * 1000, // 1 hour
  bruteForceMax: 10,
  bruteForceTtlMs: 5 * 60 * 1000, // 5 minutes
};

export function buildConfig(cliOpts = {}) {
  const env = {
    port: process.env.ADMINER_PORT ? parseInt(process.env.ADMINER_PORT, 10) : undefined,
    host: process.env.ADMINER_HOST,
    driver: process.env.ADMINER_DRIVER,
    openBrowser: process.env.ADMINER_NO_OPEN === '1' ? false : undefined,
  };

  // CLI overrides env overrides defaults; filter out undefined values
  const merged = { ...DEFAULTS };
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) merged[k] = v;
  }
  for (const [k, v] of Object.entries(cliOpts)) {
    if (v !== undefined) merged[k] = v;
  }

  // Generate a per-process session secret (ephemeral)
  merged.sessionSecret = randomBytes(32);
  merged.version = readVersion();

  return merged;
}
