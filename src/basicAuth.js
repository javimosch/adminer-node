import { timingSafeEqual, createHash } from 'crypto';

/**
 * HTTP Basic Auth middleware.
 *
 * Enabled when config.basicAuth = { username, password } is set.
 * Skips auth for the /health endpoint (useful for Docker health checks).
 *
 * Usage in config.json:
 *   { "basicAuth": { "username": "admin", "password": "secret" } }
 *
 * Usage via env:
 *   ADMINER_BASIC_USER=admin ADMINER_BASIC_PASS=secret npx adminer-node
 */

function safeCompare(a, b) {
  // Constant-time comparison to prevent timing attacks
  const bufA = Buffer.from(createHash('sha256').update(a).digest('hex'));
  const bufB = Buffer.from(createHash('sha256').update(b).digest('hex'));
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Returns a middleware function if basic auth is configured, otherwise null.
 * @param {object} config
 * @returns {Function|null}
 */
export function createBasicAuthMiddleware(config) {
  if (!config.basicAuth) return null;

  const { username, password } = config.basicAuth;
  if (!username || !password) {
    console.warn('[basicAuth] basicAuth configured but username or password is empty — skipping');
    return null;
  }

  const realm = config.basicAuth.realm || 'adminer-node';
  console.log(`[basicAuth] HTTP Basic Auth enabled (realm: ${realm})`);

  return function basicAuthMiddleware(req, res) {
    // Always allow health check (for Docker / compose healthcheck)
    if (req.pathname === '/health') return true;

    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
        const colon   = decoded.indexOf(':');
        if (colon !== -1) {
          const reqUser = decoded.slice(0, colon);
          const reqPass = decoded.slice(colon + 1);
          if (safeCompare(reqUser, username) && safeCompare(reqPass, password)) {
            return true; // authenticated
          }
        }
      } catch {}
    }

    // Challenge
    res.setHeader('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
    res.writeHead(401, { 'Content-Type': 'text/plain' });
    res.end('Unauthorized');
    return false;
  };
}
