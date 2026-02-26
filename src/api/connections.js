import { register } from '../router.js';
import { listConnections, findConnection } from '../connections.js';
import { loginWithCredentials } from '../auth.js';

/**
 * GET /api/connections
 * Returns saved connection presets (passwords stripped).
 */
export function registerConnectionRoutes(config) {
  register('GET', '/api/connections', (req, res) => {
    res.json({ connections: listConnections(config, false) });
  });

  /**
   * POST /api/connections/:id/connect
   * Auto-login using a saved connection preset by id.
   * The password is read from the server-side config — never sent to the client.
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

    // Return the same shape as /api/auth/login so the frontend store.setAuth() works identically
    res.json({
      csrfToken:    result.csrfToken,
      conn:         result.conn,
      driverConfig: result.driverConfig,
      serverInfo:   result.serverInfo,
      label:        conn.label || conn.driver,
    });
  });
}
