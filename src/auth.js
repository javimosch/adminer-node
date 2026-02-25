import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { getDriver } from './drivers/base.js';
import { destroySession, getBrowserKey } from './session.js';

// Brute-force store: Map<ip, { count, until }>
const bruteStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of bruteStore) {
    if (entry.until < now) bruteStore.delete(ip);
  }
}, 60 * 1000).unref();

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

export function checkBruteForce(req, config) {
  const ip = clientIp(req);
  const entry = bruteStore.get(ip);
  if (entry && entry.until > Date.now()) {
    const secs = Math.ceil((entry.until - Date.now()) / 1000);
    return `Too many failed attempts. Try again in ${secs} seconds.`;
  }
  return null;
}

export function recordFailedLogin(req, config) {
  const ip = clientIp(req);
  const entry = bruteStore.get(ip) || { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= config.bruteForceMax) {
    entry.until = Date.now() + config.bruteForceTtlMs;
  }
  bruteStore.set(ip, entry);
}

export function resetBruteForce(req) {
  bruteStore.delete(clientIp(req));
}

// AES-256-GCM encrypt/decrypt using a per-browser key
function encryptPassword(plain, key) {
  const keyBuf = Buffer.from(key.padEnd(32).slice(0, 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptPassword(stored, key) {
  try {
    const buf = Buffer.from(stored, 'base64');
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const enc = buf.slice(28);
    const keyBuf = Buffer.from(key.padEnd(32).slice(0, 32));
    const decipher = createDecipheriv('aes-256-gcm', keyBuf, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function generateCsrfToken(session) {
  const rand = Math.floor(Math.random() * 1e9);
  return { rand, token: (rand ^ session.token).toString(36) };
}

export function verifyCsrfToken(session, token) {
  if (!token || !session.token) return false;
  const candidate = parseInt(token, 36);
  // XOR with stored token seed — result should be a sane random number
  const rand = candidate ^ session.token;
  return rand >= 0 && rand < 1e9;
}

export function connKey(driver, server, username) {
  return `${driver}:${server}:${username}`;
}

export async function loginHandler(req, res, config) {
  const { driver, server, username, password, db } = req.body || {};
  // username may be empty string for SQLite; password must be present (can be empty for SQLite)
  if (!driver || username == null || password == null) {
    return res.error('driver, username and password are required', 400);
  }

  const bruteMsg = checkBruteForce(req, config);
  if (bruteMsg) return res.error(bruteMsg, 429, { code: 'BRUTE_FORCE' });

  const driverDef = getDriver(driver);
  if (!driverDef) return res.error('Unknown driver', 400);

  let conn;
  try {
    conn = new driverDef.Driver();
    const err = await conn.connect(server || '', username, password);
    if (err) {
      recordFailedLogin(req, config);
      return res.error(err, 401, { code: 'NOT_AUTHENTICATED' });
    }
  } catch (e) {
    recordFailedLogin(req, config);
    return res.error(e.message, 503, { code: 'DB_UNAVAILABLE' });
  }

  resetBruteForce(req);

  const browserKey = getBrowserKey(req, res);
  const encPwd = encryptPassword(password, browserKey);
  const key = connKey(driver, server || '', username);

  if (!req.session.connections) req.session.connections = {};
  req.session.connections[key] = {
    driver, server: server || '', username,
    encryptedPassword: encPwd,
    db: db || '',
  };
  req.session.currentConn = key;

  // Generate new CSRF token seed on login
  req.session.token = Math.floor(Math.random() * 1e9);
  const { token: csrfToken } = generateCsrfToken(req.session);

  // Get driver config
  const driverConfig = conn.config();
  let serverInfo = {};
  try { serverInfo = await conn.serverInfo(); } catch {}
  await conn.disconnect();

  res.json({
    csrfToken,
    conn: { driver, server: server || '', username, db: db || '' },
    driverConfig,
    serverInfo,
  });
}

export async function logoutHandler(req, res) {
  destroySession(req, res);
  res.json({ ok: true });
}

export async function authMiddleware(req, res, config) {
  req.conn = null;

  // Parse pathname here since route() hasn't run yet
  const pathname = req.pathname || new URL(req.url, 'http://localhost').pathname;

  const publicPaths = ['/', '/api/drivers', '/api/status', '/api/auth/login', '/api/auth/logout'];
  if (publicPaths.includes(pathname)) return;
  if (pathname.startsWith('/app/')) return;
  // Non-API paths are SPA routes — serve shell without auth check
  if (!pathname.startsWith('/api/')) return;

  const session = req.session;
  const key = session?.currentConn;
  const connInfo = session?.connections?.[key];
  if (!connInfo) {
    res.error('Not authenticated', 401, { code: 'NOT_AUTHENTICATED' });
    return false; // signal router to stop
  }

  // Verify CSRF on mutating requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.headers['x-csrf-token'];
    if (!verifyCsrfToken(session, token)) {
      res.error('Invalid CSRF token', 403, { code: 'CSRF_MISMATCH' });
      return false;
    }
  }

  // Reconstruct connection
  const browserKey = req._cookies?.adminer_key;
  if (!browserKey) {
    res.error('Not authenticated', 401, { code: 'NOT_AUTHENTICATED' });
    return false;
  }
  const password = decryptPassword(connInfo.encryptedPassword, browserKey);
  if (password === null) {
    res.error('Not authenticated', 401, { code: 'NOT_AUTHENTICATED' });
    return false;
  }

  const driverDef = getDriver(connInfo.driver);
  if (!driverDef) {
    res.error('Driver not available', 503, { code: 'DB_UNAVAILABLE' });
    return false;
  }

  try {
    const conn = new driverDef.Driver();
    const err = await conn.connect(connInfo.server, connInfo.username, password);
    if (err) {
      res.error(err, 503, { code: 'DB_UNAVAILABLE' });
      return false;
    }
    req.conn = conn;
    req.connInfo = connInfo;
  } catch (e) {
    res.error(e.message, 503, { code: 'DB_UNAVAILABLE' });
    return false;
  }

  return true;
}
