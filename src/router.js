const routes = [];

export function register(method, pattern, handler) {
  // Convert pattern like '/api/select/:table' into a regex with named groups
  const keys = [];
  const regexStr = pattern
    .replace(/\//g, '\\/')
    .replace(/\*/g, '.*')          // wildcard: /app/* matches /app/anything/deep
    .replace(/:([a-zA-Z_]+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    });
  const regex = new RegExp(`^${regexStr}$`);
  routes.push({ method: method.toUpperCase(), regex, keys, handler, pattern });
}

export function parseQuery(search) {
  const q = {};
  if (!search) return q;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const [key, val] of params) {
    // Support where[col][op]=val bracket notation
    const bracketMatch = key.match(/^([^\[]+)\[([^\]]*)\](?:\[([^\]]*)\])?$/);
    if (bracketMatch) {
      const [, base, sub, sub2] = bracketMatch;
      if (!q[base]) q[base] = {};
      if (sub2 !== undefined) {
        if (!q[base][sub]) q[base][sub] = {};
        q[base][sub][sub2] = val;
      } else {
        q[base][sub] = val;
      }
    } else {
      q[key] = val;
    }
  }
  return q;
}

export async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  req.pathname = url.pathname;
  req.query = parseQuery(url.search);

  const method = req.method.toUpperCase();

  for (const r of routes) {
    if (r.method !== method && r.method !== 'ALL') continue;
    const match = req.pathname.match(r.regex);
    if (!match) continue;
    req.params = {};
    r.keys.forEach((key, i) => {
      req.params[key] = decodeURIComponent(match[i + 1]);
    });
    await r.handler(req, res);
    return;
  }

  // No route matched
  if (req.pathname.startsWith('/api/')) {
    res.notFound('API endpoint not found');
  } else {
    // SPA fallback — serve the shell
    const { shellHandler } = await import('./pages/shell.js');
    await shellHandler(req, res);
  }
}
