import http from 'http';
import { attachHelpers, parseBody, setSecurityHeaders } from './response.js';
import { parseSession, saveSession } from './session.js';
import { authMiddleware } from './auth.js';
import { createBasicAuthMiddleware } from './basicAuth.js';
import { route, register } from './router.js';
import { loadDrivers } from './drivers/index.js';
import { listDrivers } from './drivers/base.js';

// Page handlers
import { shellHandler } from './pages/shell.js';
import { assetsHandler } from './pages/assets.js';

// API route registrars
import { registerAuthRoutes } from './api/auth.js';
import { registerDatabaseRoutes } from './api/databases.js';
import { registerTableRoutes } from './api/tables.js';
import { registerSelectRoutes } from './api/select.js';
import { registerEditRoutes } from './api/edit.js';
import { registerSqlRoutes } from './api/sql.js';
import { registerDumpRoutes } from './api/dump.js';
import { registerIndexRoutes } from './api/indexes.js';
import { registerForeignRoutes } from './api/foreign.js';
import { registerUserRoutes } from './api/users.js';
import { registerVariableRoutes } from './api/variables.js';
import { registerConnectionRoutes } from './api/connections.js';

export async function startServer(config) {
  // Load DB drivers (may fail silently if npm package not installed)
  await loadDrivers();

  // Create optional basic auth middleware
  const basicAuth = createBasicAuthMiddleware(config);

  // ── Static / SPA routes ──────────────────────────────────────────────────
  register('GET', '/app/*', assetsHandler);
  register('GET', '/',      shellHandler);

  // ── Health check (always public, used by Docker/compose healthcheck) ──────
  register('GET', '/health', (_req, res) => res.json({ ok: true, version: config.version }));

  // ── Public API routes ────────────────────────────────────────────────────
  register('GET', '/api/drivers', (_req, res) => res.json(listDrivers()));

  register('GET', '/api/status', (req, res) => {
    const session = req.session;
    const key = session?.currentConn;
    const connInfo = session?.connections?.[key];
    res.json({
      version: config.version,
      authenticated: !!connInfo,
      conn: connInfo
        ? { driver: connInfo.driver, server: connInfo.server, username: connInfo.username, db: connInfo.db }
        : null,
    });
  });

  // ── Auth routes ──────────────────────────────────────────────────────────
  registerAuthRoutes(config);

  // ── Authenticated API routes ─────────────────────────────────────────────
  registerDatabaseRoutes();
  registerTableRoutes();
  registerSelectRoutes();
  registerEditRoutes();
  registerSqlRoutes();
  registerDumpRoutes();
  registerIndexRoutes();
  registerForeignRoutes();
  registerUserRoutes();
  registerVariableRoutes();
  registerConnectionRoutes(config);

  // ── HTTP Server ──────────────────────────────────────────────────────────
  const server = http.createServer(async (req, res) => {
    setSecurityHeaders(res);
    attachHelpers(req, res);

    // Parse URL early so auth middleware can inspect pathname
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    req.pathname = url.pathname;
    req.search = url.search;

    try {
      // Basic Auth gate (optional — only if configured)
      if (basicAuth && req.pathname !== '/health') {
        const allowed = basicAuth(req, res);
        if (!allowed) return; // basicAuth already sent 401
      }

      parseSession(req, res, config);
      // Register session save as a pre-end hook so cookie is set before headers flush
      res.addPreEndHook(() => saveSession(req, res, config));

      await parseBodyIfNeeded(req);

      const ok = await authMiddleware(req, res, config);
      if (ok === false) return; // authMiddleware already sent response

      await route(req, res);
    } catch (err) {
      console.error('Unhandled error:', err);
      if (!res.headersSent) {
        res.error('Internal server error', 500, { code: 'INTERNAL_ERROR' });
      }
    } finally {
      await disconnectConn(req);
      if (!res.headersSent) res.end();
    }
  });

  await new Promise((resolve, reject) => {
    server.listen(config.port, config.host, resolve);
    server.once('error', reject);
  });

  return server;
}

async function parseBodyIfNeeded(req) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    req.body = await parseBody(req);
  } else {
    req.body = {};
  }
}

async function disconnectConn(req) {
  if (req.conn) {
    try { await req.conn.disconnect(); } catch {}
    req.conn = null;
  }
}
