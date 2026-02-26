import { register } from '../router.js';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

function resolveConfigWritePath(config) {
  if (config.configFile) return config.configFile;
  return join(homedir(), '.config', 'adminer-node', 'config.json');
}

function readConfigFile(filePath) {
  if (!existsSync(filePath)) return {};
  try { return JSON.parse(readFileSync(filePath, 'utf8')); } catch { return {}; }
}

function writeConfigFile(filePath, obj) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

export function registerConfigRoutes(config) {
  /**
   * POST /api/config/basic-auth
   * Set HTTP Basic Auth credentials in the config file.
   * Pass { username, password } to enable, or { remove: true } to disable.
   * Requires no DB auth — only accessible when no Basic Auth is set yet,
   * or when already authenticated via Basic Auth.
   */
  register('POST', '/api/config/basic-auth', (req, res) => {
    const { username, password, remove } = req.body || {};

    const filePath = resolveConfigWritePath(config);
    const fileObj  = readConfigFile(filePath);

    if (remove) {
      delete fileObj.basicAuth;
      config.basicAuth = null;
    } else {
      if (!username || !password) {
        return res.error('username and password are required', 400);
      }
      if (password.length < 3) {
        return res.error('password must be at least 3 characters', 400);
      }
      fileObj.basicAuth = { username, password };
      config.basicAuth = { username, password };
    }

    try {
      writeConfigFile(filePath, fileObj);
    } catch (e) {
      return res.error(`Could not write config file: ${e.message}`, 500, { code: 'CONFIG_ERROR' });
    }

    const action = remove ? 'disabled' : 'enabled';
    console.log(`[config] Basic Auth ${action} — saved to ${filePath}`);

    res.json({
      ok: true,
      basicAuthEnabled: !remove,
      configFile: filePath,
      message: remove
        ? 'Basic Auth disabled. Page will reload.'
        : `Basic Auth enabled (user: ${username}). Page will reload and prompt for credentials.`,
    });
  });
}
