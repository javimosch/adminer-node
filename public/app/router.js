// Hash-based SPA router — no bundler required
// Routes use hash: /#/login, /#/home, /#/db/mydb/tables, etc.

const routes = [];

export function addRoute(path, component) {
  // Convert :param segments to named groups
  const keys = [];
  const pattern = path
    .replace(/\//g, '\\/')
    .replace(/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
  routes.push({ regex: new RegExp(`^${pattern}$`), keys, component, path });
}

export function parseHash() {
  const hash = window.location.hash || '#/';
  return hash.replace(/^#/, '') || '/';
}

export function matchRoute(pathname) {
  for (const r of routes) {
    const m = pathname.match(r.regex);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    return { component: r.component, params };
  }
  return null;
}

export function navigate(path) {
  window.location.hash = '#' + path;
}

export function buildPath(template, params = {}) {
  return template.replace(/:([a-zA-Z_]+)/g, (_, k) => encodeURIComponent(params[k] || ''));
}
