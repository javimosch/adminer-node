/**
 * connections.js
 * Utilities for working with saved connection presets loaded from config.
 * Connections are read-only at runtime (config is loaded once at startup).
 */

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
  // Try explicit id field first, then fall back to index
  const byId = conns.find(c => String(c.id) === String(id));
  if (byId) return byId;
  const idx = parseInt(id, 10);
  if (!isNaN(idx) && conns[idx]) return conns[idx];
  return null;
}
