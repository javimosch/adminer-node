import { createReadStream, statSync } from 'fs';
import { extname } from 'path';

const MIME_TYPES = {
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
};

/**
 * Attach helper methods to res and parse the request body.
 * Called once per request before routing.
 */
export function attachHelpers(req, res) {
  // Pre-end hook: run before any response is finalized
  res._preEndHooks = [];
  res.addPreEndHook = (fn) => res._preEndHooks.push(fn);

  const _runHooks = () => {
    for (const fn of res._preEndHooks) {
      try { fn(); } catch {}
    }
    res._preEndHooks = [];
  };

  res.json = (data, status = 200) => {
    _runHooks();
    const body = JSON.stringify(data);
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
  };

  res.html = (str, status = 200) => {
    _runHooks();
    const body = typeof str === 'string' ? str : String(str);
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
  };

  res.error = (message, status = 400, extra = {}) => {
    res.json({ error: message, ...extra }, status);
  };

  res.notFound = (message = 'Not found') => {
    res.json({ error: message }, 404);
  };

  res.redirect = (url, status = 302) => {
    _runHooks();
    res.writeHead(status, { Location: url });
    res.end();
  };

  res.sendFile = (filePath) => {
    let stat;
    try { stat = statSync(filePath); } catch {
      res.notFound();
      return;
    }
    _runHooks();
    const ext = extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=3600',
    });
    createReadStream(filePath).pipe(res);
  };

  res.stream = (contentType, filename) => {
    _runHooks();
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache',
    });
  };
}

/**
 * Parse the request body as JSON or URL-encoded form data.
 * Returns parsed object or null if no body / unsupported content type.
 */
export async function parseBody(req) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('error', reject);
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        if (ct.includes('application/json')) {
          resolve(JSON.parse(raw));
        } else if (ct.includes('application/x-www-form-urlencoded')) {
          resolve(Object.fromEntries(new URLSearchParams(raw)));
        } else {
          resolve({});
        }
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * Set security headers on every response.
 */
export function setSecurityHeaders(res) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-cache, no-store');
}
