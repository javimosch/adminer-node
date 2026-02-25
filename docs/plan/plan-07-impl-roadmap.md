# adminer-node — Implementation Roadmap

## Phased Delivery

The project is split into 5 phases, each producing a working (if incomplete) tool that can be run via `npx adminer-node`.

---

## Phase 1 — Scaffold & Login (Week 1)

**Goal:** `npx adminer-node` starts a server, opens browser, shows login form, connects to MySQL/PostgreSQL/SQLite, lists databases.

### Files to create

| File | LOC Budget | Description |
|---|---|---|
| `package.json` | 30 | `name`, `version`, `bin`, `dependencies`, `type: "module"` |
| `bin/adminer-node.js` | 80 | CLI entrypoint, arg parse, startServer(), open browser |
| `src/server.js` | 150 | http.createServer, middleware chain, body parsing |
| `src/router.js` | 120 | Route registry, param extraction, dispatch |
| `src/response.js` | 80 | res.json(), res.html(), res.error(), res.redirect(), parseBody() |
| `src/session.js` | 120 | Cookie-based session, HMAC signing, in-memory store |
| `src/config.js` | 60 | CLI flags + env vars + defaults |
| `src/auth.js` | 200 | Login, logout, CSRF, brute-force, authMiddleware |
| `src/drivers/base.js` | 150 | BaseDriver class, driver registry |
| `src/drivers/index.js` | 60 | Lazy driver loader |
| `src/drivers/mysql.js` | 450 | MySQL/MariaDB driver (mysql2) |
| `src/drivers/pgsql.js` | 450 | PostgreSQL driver (pg) |
| `src/drivers/sqlite.js` | 350 | SQLite driver (better-sqlite3) |
| `src/api/index.js` | 80 | API sub-router, mounts all api/* handlers |
| `src/api/auth.js` | 200 | POST /login, POST /logout, GET /drivers |
| `src/api/databases.js` | 200 | GET/POST /databases, DELETE /databases/:db |
| `src/pages/shell.js` | 80 | HTML shell with CDN links + importmap |
| `src/pages/assets.js` | 60 | Static file serving from public/app/ |
| `public/app/main.js` | 80 | createApp, router, provide store, mount |
| `public/app/router.js` | 120 | Vue Router hash mode, auth guard |
| `public/app/store.js` | 120 | reactive global state |
| `public/app/api.js` | 100 | fetch wrapper, CSRF header, error handling |
| `public/app/utils.js` | 100 | format, escape, debounce helpers |
| `public/app/components/AppLayout.js` | 150 | drawer + navbar + sidebar slot |
| `public/app/components/Sidebar.js` | 200 | DB list + table list nav |
| `public/app/components/Breadcrumb.js` | 60 | Breadcrumb bar |
| `public/app/components/FlashMessage.js` | 80 | Toast notifications |
| `public/app/components/Modal.js` | 80 | Confirm dialog |
| `public/app/views/LoginView.js` | 200 | Login form, driver select |
| `public/app/views/HomeView.js` | 200 | Server overview + DB list |
| `public/app/views/DatabaseView.js` | 150 | Create/drop/rename DB |

**Phase 1 total:** ~4,200 LOC across 30 files  
**Deliverable:** Login → connect → list + create + drop databases

---

## Phase 2 — Table Browse & Row CRUD (Week 2)

**Goal:** Browse tables, view structure, insert/edit/delete rows.

### Files to create

| File | LOC Budget | Description |
|---|---|---|
| `src/api/tables.js` | 200 | GET /tables, table list with status |
| `src/api/structure.js` | 300 | GET/PUT/DELETE /table/:name, POST /table (create), truncate |
| `src/api/select.js` | 400 | GET /select/:table, POST /delete, POST /clone |
| `src/api/edit.js` | 250 | GET/POST/PUT/DELETE /edit/:table |
| `public/app/components/DataTable.js` | 300 | Sortable paginated table |
| `public/app/components/Pagination.js` | 80 | Page number bar |
| `public/app/components/FieldInput.js` | 250 | Smart field input widget |
| `public/app/components/FieldEditor.js` | 300 | Column definition row editor |
| `public/app/views/TableListView.js` | 200 | Tables in DB, bulk actions |
| `public/app/views/TableStructureView.js` | 300 | Fields + indexes + FKs + triggers |
| `public/app/views/CreateTableView.js` | 400 | DDL builder form |
| `public/app/views/SelectView.js` | 450 | Browse rows, filter, sort, paginate |
| `public/app/views/EditView.js` | 300 | Insert / edit row form |

**Phase 2 total:** ~3,730 LOC across 13 files  
**Deliverable:** Full row CRUD, table structure view, create table

---

## Phase 3 — SQL Command & Export (Week 3)

**Goal:** Run arbitrary SQL, import files, export databases/tables.

### Files to create

| File | LOC Budget | Description |
|---|---|---|
| `src/api/sql.js` | 300 | POST /sql, POST /sql/import, GET /sql/history |
| `src/api/dump.js` | 300 | GET /dump — streaming export (SQL/CSV/JSON) |
| `public/app/components/SqlEditor.js` | 120 | Textarea + highlight.js |
| `public/app/views/SqlView.js` | 350 | SQL command + results + history |
| `public/app/views/DumpView.js` | 250 | Export options form |

**Phase 3 total:** ~1,320 LOC across 5 files  
**Deliverable:** SQL execution with multi-statement support, file import, SQL/CSV/JSON export

---

## Phase 4 — Schema Management (Week 4)

**Goal:** Manage indexes, foreign keys, users, and server variables.

### Files to create

| File | LOC Budget | Description |
|---|---|---|
| `src/api/indexes.js` | 150 | GET/POST /indexes/:table |
| `src/api/foreign.js` | 150 | GET/POST /foreign/:table |
| `src/api/users.js` | 250 | GET/POST /users, DELETE /users/:user |
| `src/api/variables.js` | 100 | GET /variables, GET+DELETE /processlist |
| `public/app/views/IndexesView.js` | 250 | Manage indexes |
| `public/app/views/ForeignView.js` | 250 | Manage foreign keys |
| `public/app/views/UsersView.js` | 300 | User + privilege management |
| `public/app/views/VariablesView.js` | 200 | Variables + processlist |

**Phase 4 total:** ~1,650 LOC across 8 files  
**Deliverable:** Complete schema management, user management, server monitoring

---

## Phase 5 — Polish & Package (Week 5)

**Goal:** Production-ready `npx` experience, dark mode, keyboard shortcuts, README.

### Tasks

| Task | Files touched |
|---|---|
| Dark mode toggle | `AppLayout.js`, `store.js` |
| Keyboard shortcut: Ctrl+Enter in SQL editor | `SqlEditor.js` |
| Table search/filter in sidebar | `Sidebar.js` |
| Column visibility toggle in Select | `SelectView.js` |
| Inline cell editing (Ctrl+click) | `DataTable.js` |
| Export result set from SQL page | `SqlView.js`, `src/api/dump.js` |
| EXPLAIN output display | `SqlView.js`, `src/api/sql.js` |
| PostgreSQL schemas (namespace) support | `src/api/*.js`, `Sidebar.js` |
| SQLite: file picker on login | `LoginView.js` |
| Error page for lost DB connection | `router.js`, `AppLayout.js` |
| README.md with usage + screenshots | `README.md` |
| `npm publish` preparation | `package.json`, `.npmignore` |

**Phase 5 total:** ~500 LOC of edits across existing files, plus README

---

## Complete File List & LOC Budget

### `src/` — Server

| File | LOC |
|---|---|
| `src/server.js` | 150 |
| `src/router.js` | 120 |
| `src/response.js` | 80 |
| `src/session.js` | 120 |
| `src/config.js` | 60 |
| `src/auth.js` | 200 |
| `src/drivers/base.js` | 150 |
| `src/drivers/index.js` | 60 |
| `src/drivers/mysql.js` | 450 |
| `src/drivers/pgsql.js` | 450 |
| `src/drivers/sqlite.js` | 350 |
| `src/api/index.js` | 80 |
| `src/api/auth.js` | 200 |
| `src/api/databases.js` | 200 |
| `src/api/tables.js` | 200 |
| `src/api/structure.js` | 300 |
| `src/api/select.js` | 400 |
| `src/api/edit.js` | 250 |
| `src/api/sql.js` | 300 |
| `src/api/dump.js` | 300 |
| `src/api/indexes.js` | 150 |
| `src/api/foreign.js` | 150 |
| `src/api/users.js` | 250 |
| `src/api/variables.js` | 100 |
| `src/pages/shell.js` | 80 |
| `src/pages/assets.js` | 60 |
| **Subtotal** | **5,010** |

### `bin/` and root

| File | LOC |
|---|---|
| `bin/adminer-node.js` | 80 |
| `package.json` | 30 |
| **Subtotal** | **110** |

### `public/app/` — Frontend

| File | LOC |
|---|---|
| `public/app/main.js` | 80 |
| `public/app/router.js` | 120 |
| `public/app/store.js` | 120 |
| `public/app/api.js` | 100 |
| `public/app/utils.js` | 100 |
| `public/app/components/AppLayout.js` | 150 |
| `public/app/components/Sidebar.js` | 200 |
| `public/app/components/Breadcrumb.js` | 60 |
| `public/app/components/DataTable.js` | 300 |
| `public/app/components/Pagination.js` | 80 |
| `public/app/components/SqlEditor.js` | 120 |
| `public/app/components/FieldInput.js` | 250 |
| `public/app/components/FieldEditor.js` | 300 |
| `public/app/components/Modal.js` | 80 |
| `public/app/components/FlashMessage.js` | 80 |
| `public/app/views/LoginView.js` | 200 |
| `public/app/views/HomeView.js` | 200 |
| `public/app/views/DatabaseView.js` | 150 |
| `public/app/views/TableListView.js` | 200 |
| `public/app/views/TableStructureView.js` | 300 |
| `public/app/views/CreateTableView.js` | 400 |
| `public/app/views/SelectView.js` | 450 |
| `public/app/views/EditView.js` | 300 |
| `public/app/views/SqlView.js` | 350 |
| `public/app/views/DumpView.js` | 250 |
| `public/app/views/IndexesView.js` | 250 |
| `public/app/views/ForeignView.js` | 250 |
| `public/app/views/UsersView.js` | 300 |
| `public/app/views/VariablesView.js` | 200 |
| **Subtotal** | **5,970** |

### Grand Total

| Section | Files | LOC |
|---|---|---|
| Server (`src/`) | 26 | 5,010 |
| Bin + root | 2 | 110 |
| Frontend (`public/app/`) | 29 | 5,970 |
| **Total** | **57** | **11,090** |

Every single file is under 500 LOC. ✓

---

## `package.json` Outline

```json
{
  "name": "adminer-node",
  "version": "1.0.0",
  "description": "Database management UI for MySQL, PostgreSQL and SQLite — runnable via npx",
  "type": "module",
  "bin": {
    "adminer-node": "./bin/adminer-node.js"
  },
  "files": ["bin/", "src/", "public/"],
  "dependencies": {
    "mysql2": "^3.6.0",
    "pg": "^8.11.0",
    "better-sqlite3": "^9.4.0",
    "open": "^10.0.0"
  },
  "engines": { "node": ">=18.0.0" },
  "keywords": ["adminer", "database", "mysql", "postgresql", "sqlite", "admin"],
  "license": "Apache-2.0"
}
```

**No dev dependencies required** — no bundler, no transpiler, no test runner beyond Node's built-in `node:test`.

---

## Key Implementation Notes

### ES Modules Throughout
All server-side code uses `"type": "module"` in `package.json` so `import`/`export` work natively. No CommonJS (`require()`). Node 18+ required.

### No Express
The HTTP server uses only Node's built-in `http` module. Body parsing, routing, and static file serving are hand-rolled in `src/server.js`, `src/router.js`, and `src/pages/assets.js`. This keeps the dependency count minimal and the code transparent.

### Streaming Exports
`/api/dump` uses Node.js `res.write()` streaming — it never buffers the entire export in memory. Large databases can be exported without OOM risk.

### Vue 3 Import Maps
The `importmap` in the HTML shell maps `"vue"` to the CDN URL. All frontend `.js` files can do `import { ref } from 'vue'` and it resolves correctly in modern browsers (Chrome 89+, Firefox 108+, Safari 16.4+).

### Security Checklist
- [x] CSRF: `X-CSRF-Token` header required on all mutations
- [x] Session: HMAC-signed cookie, server-side store
- [x] Password: AES-256-GCM encrypted in session, key in per-browser cookie
- [x] Brute force: IP-based lockout after 10 failures
- [x] Host validation: Only allow connections to non-privileged ports; configurable allowlist
- [x] Path traversal: Static file serving sanitizes path against `public/app/` root
- [x] SQL injection: Parameterized queries everywhere; user-supplied identifiers always escaped via `escapeId()`
- [x] Headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`

### Testing Strategy
- Unit tests for driver `escapeId()`, field parsing, WHERE builder, delimiter parser
- Integration tests spin up real DB instances (Docker) and hit the API
- Use Node's built-in `node:test` runner — zero extra dependencies

---

## Minimum Viable `npx` Session

```bash
$ npx adminer-node
Adminer Node v1.0.0
Listening on http://127.0.0.1:8080
Opening browser...
Press Ctrl+C to stop.
```

Browser opens → Login form → Select driver → Enter credentials → Connected → Browse databases → Done.
