import { fileURLToPath } from 'url';
import { dirname, join, normalize, resolve } from 'path';
import { existsSync, statSync, createReadStream } from 'fs';
import { extname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(join(__dirname, '..', '..', 'public', 'app'));

const MIME = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

export function shellHandler(_req, res) {
  const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Adminer Node</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🗄️</text></svg>" />
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- DaisyUI CSS CDN -->
  <link href="https://cdn.jsdelivr.net/npm/daisyui@4/dist/full.min.css" rel="stylesheet" />
  <!-- Highlight.js for SQL syntax highlighting -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/sql.min.js"></script>
  <style>
    /* Ensure sidebar and content fill viewport */
    html, body, #app { height: 100%; margin: 0; }
    .hljs { background: transparent; padding: 0; }
    /* Smooth transitions */
    .fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
    .fade-enter-from, .fade-leave-to { opacity: 0; }
  </style>
</head>
<body class="bg-base-100 text-base-content">
  <div id="app"></div>

  <!-- Vue 3 ES Module from CDN -->
  <script type="importmap">
  {
    "imports": {
      "vue": "https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js"
    }
  }
  </script>
  <script type="module" src="/app/main.js"></script>
</body>
</html>`;

  const body = Buffer.from(html, 'utf8');
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-cache, no-store',
  });
  res.end(body);
}

export function assetsHandler(req, res) {
  let reqPath = req.pathname || '';
  // Strip /app prefix, keep leading slash
  if (reqPath.startsWith('/app/')) reqPath = reqPath.slice(4);      // /app/main.js → /main.js
  else if (reqPath === '/app') reqPath = '/';

  const normalized = normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = resolve(join(PUBLIC_DIR, normalized));

  if (!filePath.startsWith(PUBLIC_DIR + '/') && filePath !== PUBLIC_DIR) {
    res.notFound(); return;
  }
  if (!existsSync(filePath)) { res.notFound(); return; }

  let stat;
  try { stat = statSync(filePath); } catch { res.notFound(); return; }
  if (stat.isDirectory()) { res.notFound(); return; }

  const ext = extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
  });
  createReadStream(filePath).pipe(res);
}
