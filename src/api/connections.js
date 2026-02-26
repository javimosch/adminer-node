import { register } from '../router.js';
import { listConnections, findConnection, addConnection, removeConnection } from '../connections.js';
import { loginWithCredentials } from '../auth.js';

export function registerConnectionRoutes(config) {
  /**
   * GET /api/connections
   * Returns saved presets — passwords stripped.
   */
  register('GET', '/api/connections', (req, res) => {
    res.json({ connections: listConnections(config, false) });
  });

  /**
   * POST /api/connections
   * Save a new connection preset to the config file.
   * Body: { label, driver, server, username, password, db }
   * Called from LoginView when "save connection" is checked.
   */
  register('POST', '/api/connections', (req, res) => {
    const { label, driver, server, username, password, db } = req.body || {};
    if (!driver || server == null) {
      return res.error('driver and server are required', 400);
    }
    const result = addConnection(config, {
      label:    label || `${driver}@${server}`,
      driver,
      server:   server || '',
      username: username || '',
      password: password || '',
      db:       db || '',
    });
    if (result.error) return res.error(result.error, 500, { code: 'CONFIG_ERROR' });
    res.json({ ok: true, id: result.id });
  });

  /**
   * DELETE /api/connections/:id
   * Remove a saved preset from the config file.
   * Called from HomeView when user clicks the ✕ button.
   */
  register('DELETE', '/api/connections/:id', (req, res) => {
    const result = removeConnection(config, req.params.id);
    if (result.error) return res.error(result.error, 500, { code: 'CONFIG_ERROR' });
    res.json({ ok: true });
  });

  /**
   * POST /api/connections/:id/connect
   * Auto-login using a saved preset — password never sent to client.
   */
  register('POST', '/api/connections/:id/connect', async (req, res) => {
    const conn = findConnection(config, req.params.id);
    if (!conn) return res.error('Connection preset not found', 404);

    const result = await loginWithCredentials(req, res, config, {
      driver:   conn.driver,
      server:   conn.server,
      username: conn.username || '',
      password: conn.password || '',
      db:       conn.db       || '',
    });

    if (result.error) return res.error(result.error, 401, { code: 'AUTH_ERROR' });

    res.json({
      csrfToken:    result.csrfToken,
      conn:         result.conn,
      driverConfig: result.driverConfig,
      serverInfo:   result.serverInfo,
      label:        conn.label || conn.driver,
      connId:       req.params.id,
    });
  });
}
