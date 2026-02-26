/**
 * connections.js
 * Utilities for working with saved connection presets.
 * Supports runtime add/remove and persists changes back to the config file.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

/**
 * Return the list of saved connections, stripping passwords for public API.
 * @param {object} config
 * @param {boolean} includeSensitive - include password (only for auto-login flow)
 */
export function listConnections(config, includeSensitive = false) {
  const conns = config.connections || [];
  return conns.map((c, i) => {
    const out = {
      id:       c.id || String(i),
      label:    c.label || `Connection ${i + 1}`,
      driver:   c.driver,
      server:   c.server,
      username: c.username || '',
      db:       c.db || '',
    };
    if (includeSensitive) out.password = c.password || '';
    return out;
  });
}

/**
 * Find a connection preset by id (index or explicit id field).
 * Returns the full object including password, or null.
 */
export function findConnection(config, id) {
  const conns = config.connections || [];
  const byId = conns.find(c => String(c.id) === String(id));
  if (byId) return byId;
  const idx = parseInt(id, 10);
  if (!isNaN(idx) && conns[idx]) return conns[idx];
  return null;
}

/**
 * Resolve the config file path to write to.
 * Uses the path that was loaded at startup, or creates the default location.
 */
function resolveWritePath(config) {
  if (config.configFile) return config.configFile;
  const defaultDir = join(homedir(), '.config', 'adminer-node');
  return join(defaultDir, 'config.json');
}

/**
 * Persist the current config.connections array back to the config file.
 * Preserves all other fields in the file.
 */
function persistConnections(config) {
  const filePath = resolveWritePath(config);
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let fileObj = {};
  if (existsSync(filePath)) {
    try { fileObj = JSON.parse(readFileSync(filePath, 'utf8')); } catch {}
  }

  fileObj.connections = config.connections;
  writeFileSync(filePath, JSON.stringify(fileObj, null, 2) + '\n', 'utf8');
  return filePath;
}

/**
 * Add a new connection preset at runtime and persist to config file.
 * @returns {{ error: string|null, id: string }}
 */
export function addConnection(config, conn) {
  if (!conn.driver || conn.server == null) {
    return { error: 'driver and server are required', id: null };
  }

  // Generate stable id from label if not provided
  if (!conn.id) {
    conn.id = conn.label
      ? conn.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : `conn-${Date.now()}`;
  }

  // Ensure config.connections exists
  if (!Array.isArray(config.connections)) config.connections = [];

  // Deduplicate by id (last write wins)
  config.connections = config.connections.filter(c => String(c.id) !== String(conn.id));
  config.connections.push(conn);

  try {
    const filePath = persistConnections(config);
    console.log(`[connections] Saved "${conn.label}" to ${filePath}`);
    return { error: null, id: conn.id };
  } catch (e) {
    return { error: `Could not save to config file: ${e.message}`, id: null };
  }
}

/**
 * Remove a connection preset by id at runtime and persist to config file.
 * @returns {{ error: string|null }}
 */
export function removeConnection(config, id) {
  if (!Array.isArray(config.connections)) return { error: null };

  const before = config.connections.length;
  config.connections = config.connections.filter(c => String(c.id) !== String(id));

  // Fallback: try by numeric index
  if (config.connections.length === before) {
    const idx = parseInt(id, 10);
    if (!isNaN(idx) && idx >= 0 && idx < config.connections.length) {
      config.connections.splice(idx, 1);
    }
  }

  try {
    persistConnections(config);
    return { error: null };
  } catch (e) {
    return { error: `Could not save to config file: ${e.message}` };
  }
}
