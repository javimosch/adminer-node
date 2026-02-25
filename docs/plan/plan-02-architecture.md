# adminer-node — Server Architecture

## Request Lifecycle

```
npx adminer-node
  └── bin/adminer-node.js          # parse CLI args, call startServer(), open browser
        └── src/server.js          # create http.Server, attach middleware chain
              ├── session.js       # parse cookie → session object
              ├── auth.js          # attach req.session.conn; redirect if unauthenticated
              ├── router.js        # match pathname → handler
              │     ├── /          → pages/shell.js   (HTML shell for SPA)
              │     ├── /app/*     → pages/assets.js  (static JS files in public/app/)
              │     └── /api/*     → api/index.js     (JSON REST handlers)
              └── response.js      # shared res helpers (json, html, redirect, error)
```

Every request goes through **session → auth-check → route**. API routes return JSON. The root `/` and any unmatched non-API path return the SPA shell.

---

## `bin/adminer-node.js` (≤ 80 LOC)

Entry point registered in `package.json` `"bin"` field.

```js
#!/usr/bin/env node
// Responsibilities:
// 1. Parse CLI flags: --port (default 8080), --host (default 127.0.0.1),
//    --no-open (suppress browser open), --driver (pre-select driver)
// 2. Call startServer({ port, host, ... })
// 3. Print "Adminer running at http://host:port" 
// 4. Optionally open browser via `open` package (tiny, no heavy deps)
```

CLI flags:
| Flag | Default | Purpose |
|---|---|---|
| `--port` | `8080` | HTTP listen port |
| `--host` | `127.0.0.1` | Bind address (localhost only by default for safety) |
| `--no-open` | — | Skip auto-opening browser |
| `--driver` | (none) | Pre-select driver: `mysql`, `pgsql`, `sqlite` |
| `--help` | — | Print usage |

---

## `src/server.js` (≤ 150 LOC)

Creates the HTTP server and composes the middleware chain manually (no Express).

```js
import http from 'http';
import { parseSession, saveSession } from './session.js';
import { authMiddleware } from './auth.js';
import { route } from './router.js';

export function startServer(opts) {
  const server = http.createServer(async (req, res) => {
    try {
      await parseSession(req, res);     // attach req.session
      await authMiddleware(req, res);   // attach req.conn (driver instance) or null
      await route(req, res);            // dispatch to handler
      await saveSession(req, res);      // flush session changes to cookie
    } catch (err) {
      handleError(res, err);
    }
  });
  server.listen(opts.port, opts.host);
  return server;
}
```

Responsibilities:
- Body parsing for `application/json` and `application/x-www-form-urlencoded` (built-in, no body-parser)
- Multipart/file upload for SQL import (streaming, using built-in `busboy`-style logic or `formidable`)
- Error boundary: uncaught handler errors → `500 Internal Server Error` JSON

---

## `src/router.js` (≤ 120 LOC)

A minimal radix-style router. Routes are registered as:

```js
{ method: 'GET',  pattern: '/api/tables',        handler: tablesHandler }
{ method: 'GET',  pattern: '/api/select/:table',  handler: selectHandler }
{ method: 'POST', pattern: '/api/sql',            handler: sqlHandler }
// etc.
```

Pattern matching: simple `:param` segments extracted into `req.params`. Query string parsed into `req.query`. No regex magic.

Route table (full list in `api/index.js`):

```
GET  /                          → SPA shell
GET  /app/*                     → static file from public/app/
GET  /api/status                → server info, version
GET  /api/drivers               → list available drivers
POST /api/auth/login            → create session
POST /api/auth/logout           → destroy session
GET  /api/databases             → list databases
POST /api/databases             → create database
DELETE /api/databases/:db       → drop database
GET  /api/tables                → list tables in ?db=
GET  /api/table/:name           → table structure (fields, indexes, FK)
POST /api/table                 → create table
PUT  /api/table/:name           → alter table
DELETE /api/table/:name         → drop table
GET  /api/select/:table         → browse rows (paginated)
POST /api/select/:table         → bulk actions (delete, export subset)
GET  /api/edit/:table           → fetch single row
POST /api/edit/:table           → insert row
PUT  /api/edit/:table           → update row
DELETE /api/edit/:table         → delete row
POST /api/sql                   → execute SQL statement(s)
GET  /api/dump                  → stream export (SQL/CSV)
GET  /api/indexes/:table        → list indexes
POST /api/indexes/:table        → alter indexes
GET  /api/foreign/:table        → list foreign keys
POST /api/foreign/:table        → alter foreign keys
GET  /api/users                 → list users/privileges
POST /api/users                 → create/alter user
GET  /api/variables             → server variables/status
GET  /api/processlist           → running processes
DELETE /api/processlist/:id     → kill process
GET  /api/triggers/:table       → list triggers
POST /api/triggers/:table       → create/alter trigger
```

---

## `src/session.js` (≤ 120 LOC)

Lightweight session without Express. Uses a signed cookie (`adminer_sid`) containing a session ID. Session data stored **in-memory** (Map) by default; optionally file-backed for persistence.

```js
// Cookie: adminer_sid=<id>.<hmac-sha256-signature>
// Session store: Map<id, { data, expires }>
// Expiry: 1 hour sliding window (reset on each request)
```

Key functions:
- `parseSession(req, res)` — reads cookie, verifies signature, loads `req.session`
- `saveSession(req, res)` — serializes `req.session` to store, re-sets cookie if changed
- `destroySession(req, res)` — clears store entry, expires cookie

Session structure (`req.session`):
```js
{
  token: number,             // CSRF token seed
  connections: {             // keyed by "driver:server:username"
    [key]: {
      driver: 'mysql',
      server: 'localhost:3306',
      username: 'root',
      encryptedPassword: '...',  // AES-256-GCM, key from adminer_key cookie
      db: 'mydb',
      dbs: ['mydb', 'other'],   // cached database list
    }
  },
  currentConn: string,       // key into connections{}
  messages: { [url]: string[] }  // flash messages
}
```

---

## `src/auth.js` (≤ 200 LOC)

Handles login/logout and per-request connection reconstruction.

### CSRF
- `generateToken(session)` → `(rand ^ session.token)` stored in form/header
- `verifyToken(session, token)` → verify XOR relationship
- All mutating API calls (`POST`, `PUT`, `DELETE`) require `X-CSRF-Token` header

### Login flow (`POST /api/auth/login`)
1. Validate input: driver, server, username, password
2. Check brute-force counter (see below)
3. Call `driver.connect(server, username, password)` — if fails, increment counter, return 403
4. Encrypt password with per-browser key (AES-256-GCM, key from `adminer_key` cookie; create cookie if absent)
5. Store connection info in `req.session.connections`
6. Reset brute-force counter
7. Return `{ token, csrfToken, driver, server, username, db }`

### Brute-force protection
```js
// In-memory Map<ip, { count, until }>
// 10 failures → 5-minute lockout
// Checked in authMiddleware on every API call needing a DB connection
```

### Per-request connection (`authMiddleware`)
- Reads `session.currentConn`, decrypts password, calls `driver.connect()`
- Attaches `req.conn` (driver instance) to request
- For public routes (`/`, `/app/*`, `/api/auth/*`, `/api/drivers`, `/api/status`): skip

### Logout (`POST /api/auth/logout`)
- Remove connection entry from session, optionally destroy session entirely

---

## `src/config.js` (≤ 60 LOC)

Reads and merges configuration from:
1. CLI flags (highest priority)
2. Environment variables (`ADMINER_PORT`, `ADMINER_HOST`, etc.)
3. Defaults

```js
export const defaults = {
  port: 8080,
  host: '127.0.0.1',
  openBrowser: true,
  drivers: ['mysql', 'pgsql', 'sqlite'],  // enabled drivers
  sessionSecret: randomBytes(32),          // ephemeral per-process
  maxUploadMb: 50,
};
```

---

## `src/response.js` (≤ 80 LOC)

Shared response helpers attached to `res`:

```js
res.json(data, status=200)          // JSON stringify + Content-Type
res.html(str, status=200)           // text/html
res.error(message, status=400)      // { error: message }
res.notFound()                      // 404
res.redirect(url)                   // 302
res.stream(contentType, filename)   // set headers for file download
```

Also: `parseBody(req)` — async function that reads and parses request body (JSON or form-encoded).

---

## `pages/shell.js` (≤ 80 LOC)

Returns the HTML shell that bootstraps the Vue SPA:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Adminer Node</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- DaisyUI CDN -->
  <link href="https://cdn.jsdelivr.net/npm/daisyui@latest/dist/full.css" rel="stylesheet">
  <!-- highlight.js for SQL -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
</head>
<body>
  <div id="app"></div>
  <!-- Vue 3 ES Module -->
  <script type="module" src="/app/main.js"></script>
</body>
</html>
```

The `<meta name="csrf-token">` tag is injected with the current session's CSRF token so the Vue app can read it on first load.

---

## Static File Serving (`pages/assets.js`, ≤ 60 LOC)

Serves files from `public/app/` for requests matching `/app/*`. Uses `fs.createReadStream` with correct `Content-Type` headers. No directory traversal: path is sanitized and must be within `public/app/`.

---

## Error Handling Strategy

| Error type | Response |
|---|---|
| DB connection error | `{ error: "...", code: "DB_CONNECT" }` → 503 |
| Auth required | `{ error: "Not authenticated" }` → 401 |
| CSRF mismatch | `{ error: "Invalid CSRF token" }` → 403 |
| Not found | `{ error: "Not found" }` → 404 |
| Validation error | `{ error: "...", field: "..." }` → 400 |
| SQL error | `{ error: "...", sqlState: "..." }` → 400 |
| Unexpected | `{ error: "Internal error" }` → 500 (detail logged server-side) |
