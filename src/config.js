import { randomBytes } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version ?? '1.0.0';
  } catch { return '1.0.0'; }
}

/**
 * Resolve config file path in priority order:
 *  1. --config <path> CLI / ADMINER_CONFIG env
 *  2. ~/.config/adminer-node/config.json
 */
function resolveConfigFile(cliPath) {
  const candidates = [
    cliPath,
    process.env.ADMINER_CONFIG,
    join(homedir(), '.config', 'adminer-node', 'config.json'),
  ].filter(Boolean).map(p => resolve(p));

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Load and parse the JSON config file.
 * Returns {} on any error.
 */
function loadConfigFile(path) {
  if (!path) return {};
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    console.log(`[config] Loaded config from ${path}`);
    return parsed;
  } catch (e) {
    console.warn(`[config] Could not read config file: ${e.message}`);
    return {};
  }
}

/**
 * Parse ADMINER_CONNECTIONS env var.
 * Format (JSON array):
 *   [{"label":"Local MySQL","driver":"mysql","server":"127.0.0.1","username":"root","password":"secret","db":"mydb"}]
 *
 * Or a simple comma-separated DSN list (future):
 *   mysql://root:secret@127.0.0.1/mydb,sqlite:///tmp/app.db
 */
function parseEnvConnections() {
  const raw = process.env.ADMINER_CONNECTIONS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

const DEFAULTS = {
  port: 8080,
  host: '127.0.0.1',
  openBrowser: true,
  driver: null,
  maxUploadMb: 50,
  sessionTtlMs: 60 * 60 * 1000,   // 1 hour
  bruteForceMax: 10,
  bruteForceTtlMs: 5 * 60 * 1000, // 5 minutes
  connections: [],    // saved connection presets
  basicAuth: null,    // { username, password } or null
};

/**
 * Build the final runtime config.
 *
 * Priority (highest → lowest):
 *   CLI flags  >  environment variables  >  config file  >  defaults
 *
 * @param {object} cliOpts  - parsed from argv
 * @param {string|null} configFilePath - explicit --config path from argv
 */
export function buildConfig(cliOpts = {}, configFilePath = null) {
  const filePath = resolveConfigFile(configFilePath);
  const fileConf = loadConfigFile(filePath);

  // Env vars
  const env = {
    port:        process.env.PORT              ? parseInt(process.env.PORT, 10)          : (process.env.ADMINER_PORT ? parseInt(process.env.ADMINER_PORT, 10) : undefined),
    host:        process.env.HOST              || process.env.ADMINER_HOST               || undefined,
    driver:      process.env.ADMINER_DRIVER                                              || undefined,
    openBrowser: process.env.ADMINER_NO_OPEN === '1' ? false                            : undefined,
    // Basic auth via env
    basicAuth:   (process.env.ADMINER_BASIC_USER && process.env.ADMINER_BASIC_PASS)
      ? { username: process.env.ADMINER_BASIC_USER, password: process.env.ADMINER_BASIC_PASS }
      : undefined,
  };

  // Merge: defaults < file < env < cli
  const merged = { ...DEFAULTS };

  // File-level fields
  for (const k of ['port', 'host', 'driver', 'openBrowser', 'maxUploadMb',
                    'sessionTtlMs', 'bruteForceMax', 'bruteForceTtlMs', 'basicAuth']) {
    if (fileConf[k] !== undefined) merged[k] = fileConf[k];
  }

  // File-level connections (merged, not replaced, by env/cli below)
  if (Array.isArray(fileConf.connections)) {
    merged.connections = [...fileConf.connections];
  }

  // Env
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) merged[k] = v;
  }

  // Env connections appended on top of file connections
  const envConns = parseEnvConnections();
  if (envConns.length) {
    merged.connections = [...merged.connections, ...envConns];
  }

  // CLI
  for (const [k, v] of Object.entries(cliOpts)) {
    if (v !== undefined) merged[k] = v;
  }

  // Deduplicate connections by label (last wins)
  const connMap = new Map();
  for (const c of merged.connections) {
    if (c && c.label) connMap.set(c.label, c);
  }
  merged.connections = [...connMap.values()];

  // Validate connections
  merged.connections = merged.connections.filter(c => c.driver && c.server !== undefined);

  // Ephemeral session secret
  merged.sessionSecret = randomBytes(32);
  merged.version = readVersion();
  merged.configFile = filePath;

  return merged;
}
