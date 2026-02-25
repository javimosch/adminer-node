import { createHmac, randomBytes } from 'crypto';

// In-memory session store: Map<id, { data, expires }>
const store = new Map();

// Clean up expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.expires < now) store.delete(id);
  }
}, 10 * 60 * 1000).unref();

const COOKIE_NAME = 'adminer_sid';
const COOKIE_KEY_NAME = 'adminer_key';

function sign(id, secret) {
  return createHmac('sha256', secret).update(id).digest('base64url');
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k.trim()] = decodeURIComponent(v.join('=').trim());
  }
  return cookies;
}

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  const existing = res.getHeader('Set-Cookie') || [];
  const arr = Array.isArray(existing) ? existing : [existing];
  res.setHeader('Set-Cookie', [...arr, parts.join('; ')]);
}

function expireCookie(res, name) {
  const existing = res.getHeader('Set-Cookie') || [];
  const arr = Array.isArray(existing) ? existing : [existing];
  res.setHeader('Set-Cookie', [
    ...arr,
    `${name}=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/`,
  ]);
}

export function parseSession(req, res, config) {
  const cookies = parseCookies(req.headers['cookie']);
  req._cookies = cookies;

  const raw = cookies[COOKIE_NAME];
  if (raw) {
    const dotIdx = raw.lastIndexOf('.');
    if (dotIdx !== -1) {
      const id = raw.slice(0, dotIdx);
      const sig = raw.slice(dotIdx + 1);
      if (sign(id, config.sessionSecret) === sig) {
        const entry = store.get(id);
        if (entry && entry.expires > Date.now()) {
          // Slide expiry
          entry.expires = Date.now() + config.sessionTtlMs;
          req.session = entry.data;
          req._sessionId = id;
          return;
        }
      }
    }
  }

  // New session
  const id = randomBytes(16).toString('hex');
  const data = { connections: {}, currentConn: null, messages: {}, token: Math.floor(Math.random() * 1e9) };
  store.set(id, { data, expires: Date.now() + config.sessionTtlMs });
  req.session = data;
  req._sessionId = id;
  req._sessionNew = true;
}

export function saveSession(req, res, config) {
  const id = req._sessionId;
  if (!id) return;
  const entry = store.get(id);
  if (entry) {
    entry.data = req.session;
    entry.expires = Date.now() + config.sessionTtlMs;
  }
  // Always refresh cookie
  const sig = sign(id, config.sessionSecret);
  const value = `${id}.${sig}`;
  setCookie(res, COOKIE_NAME, value, {
    maxAge: Math.floor(config.sessionTtlMs / 1000),
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
  });
}

export function destroySession(req, res) {
  if (req._sessionId) {
    store.delete(req._sessionId);
    req._sessionId = null;
  }
  req.session = { connections: {}, currentConn: null, messages: {}, token: 0 };
  expireCookie(res, COOKIE_NAME);
}

export function getBrowserKey(req, res) {
  const existing = req._cookies?.[COOKIE_KEY_NAME];
  if (existing) return existing;
  const key = randomBytes(24).toString('base64url');
  setCookie(res, COOKIE_KEY_NAME, key, {
    maxAge: 365 * 24 * 60 * 60,
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
  });
  return key;
}
