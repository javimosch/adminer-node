# adminer-node — Project Overview

## What Is It?

`adminer-node` is a Node.js port of [AdminerEvo](https://github.com/adminerevo/adminerevo) — a full-featured database management web UI. It supports MySQL/MariaDB, PostgreSQL, and SQLite via a unified driver interface, and is served as a single-command tool runnable via:

```bash
npx adminer-node
```

The browser UI is built with **Vue 3 (CDN, no bundler)**, **Tailwind CSS (CDN)**, and **DaisyUI (CDN)** — zero frontend build step required.

---

## Goals

| Goal | Detail |
|---|---|
| **Zero-install UX** | `npx adminer-node` starts a local HTTP server, opens the browser |
| **No bundler** | Vue 3, Tailwind, DaisyUI loaded from CDN; server sends HTML shells |
| **Modular codebase** | Every file ≤ 500 LOC (non-negotiable) |
| **Feature parity** | Match AdminerEvo's core feature set for MySQL, PostgreSQL, SQLite |
| **Extensible** | Plugin/driver interface mirrors AdminerEvo's architecture |
| **Secure by default** | CSRF tokens, session auth, no open-proxy, brute-force protection |

---

## Tech Stack

### Server (Node.js)
| Layer | Choice | Reason |
|---|---|---|
| HTTP | Node.js `http` built-in + lightweight router | No heavy framework needed |
| Sessions | `express-session` or hand-rolled cookie+HMAC | Minimal dependencies |
| MySQL | `mysql2` | Promise API, prepared statements |
| PostgreSQL | `pg` (node-postgres) | Standard, well-maintained |
| SQLite | `better-sqlite3` | Synchronous API simplifies driver code |
| Package runner | npm `bin` field → `npx adminer-node` | Standard Node convention |

### Frontend (CDN, no bundler)
| Layer | Choice | CDN |
|---|---|---|
| UI Framework | Vue 3 (Composition API) | `unpkg.com/vue@3/dist/vue.esm-browser.prod.js` |
| CSS Utility | Tailwind CSS | `cdn.tailwindcss.com` |
| Component Library | DaisyUI | `cdn.jsdelivr.net/npm/daisyui` |
| Syntax Highlight | highlight.js (CDN) | For SQL display in command page |

---

## Repository Structure (Target)

```
adminer-node/
├── package.json              # name: adminer-node, bin: adminer-node
├── bin/
│   └── adminer-node.js       # CLI entrypoint — starts server, opens browser
├── src/
│   ├── server.js             # HTTP server bootstrap, routing table
│   ├── session.js            # Session middleware (cookie + HMAC)
│   ├── auth.js               # Login, logout, CSRF, brute-force
│   ├── config.js             # CLI args, env vars, defaults
│   ├── router.js             # Request dispatch (maps URL → handler)
│   ├── response.js           # HTML page shell builder (sends CDN-linked HTML)
│   ├── drivers/
│   │   ├── base.js           # Abstract Driver interface + registry
│   │   ├── mysql.js          # MySQL/MariaDB driver (mysql2)
│   │   ├── pgsql.js          # PostgreSQL driver (pg)
│   │   └── sqlite.js         # SQLite driver (better-sqlite3)
│   ├── api/
│   │   ├── index.js          # API router (mounts all API handlers)
│   │   ├── auth.js           # POST /api/auth/login, logout
│   │   ├── databases.js      # GET/POST /api/databases
│   │   ├── tables.js         # GET /api/tables, /api/table/:name
│   │   ├── select.js         # GET /api/select/:table (browse rows)
│   │   ├── edit.js           # GET/POST /api/edit/:table (row CRUD)
│   │   ├── sql.js            # POST /api/sql (execute SQL)
│   │   ├── dump.js           # GET /api/dump (export)
│   │   ├── structure.js      # GET/POST /api/structure/:table (DDL)
│   │   ├── indexes.js        # GET/POST /api/indexes/:table
│   │   ├── foreign.js        # GET/POST /api/foreign/:table
│   │   ├── users.js          # GET/POST /api/users
│   │   └── variables.js      # GET /api/variables
│   └── pages/
│       ├── shell.js          # HTML shell template (CDN links, Vue mount point)
│       └── assets.js         # Static asset serving (favicon, etc.)
├── public/
│   └── app/
│       ├── main.js           # Vue app root (createApp, router)
│       ├── router.js         # Vue Router (hash-based client routing)
│       ├── store.js          # Reactive global state (connection info, flash msgs)
│       ├── api.js            # Fetch wrapper (adds CSRF header, handles errors)
│       ├── components/
│       │   ├── AppLayout.vue      # Sidebar + content layout shell
│       │   ├── Sidebar.vue        # DB/table navigation
│       │   ├── Breadcrumb.vue     # Breadcrumb trail
│       │   ├── DataTable.vue      # Reusable paginated table
│       │   ├── SqlEditor.vue      # SQL textarea with highlight.js
│       │   ├── FieldInput.vue     # Smart input (enum select, date picker, etc.)
│       │   ├── Modal.vue          # Confirm dialog
│       │   └── FlashMessage.vue   # Toast notifications
│       └── views/
│           ├── LoginView.vue
│           ├── HomeView.vue       # Server/DB overview
│           ├── DatabaseView.vue   # Create/drop/alter DB
│           ├── TableListView.vue  # Tables in a database
│           ├── TableStructureView.vue
│           ├── SelectView.vue     # Browse + filter + sort rows
│           ├── EditView.vue       # Insert / edit row
│           ├── SqlView.vue        # SQL command / import
│           ├── DumpView.vue       # Export
│           ├── IndexesView.vue
│           ├── ForeignView.vue
│           ├── CreateTableView.vue
│           ├── UsersView.vue
│           └── VariablesView.vue
└── docs/
    └── plan/                 # This planning directory
```

---

## Key Design Decisions

### 1. CDN-only Frontend
No `npm run build`. Vue 3 is loaded as an ES module from CDN. Each `.vue`-style component is written as a plain JS object or inline template string in `.js` files. The server sends a thin HTML shell; Vue mounts and drives all UI.

### 2. REST API Backend
The Node.js server exposes a JSON REST API under `/api/`. The Vue frontend talks exclusively to this API. This clean separation means:
- The server has zero templating logic
- The API can be used independently (e.g., by scripts)
- Each API file stays focused and ≤ 500 LOC

### 3. Driver Abstraction
Every DB driver implements the same JS interface (defined in `src/drivers/base.js`). The active driver is selected per-connection at login time and stored in the session. No global mutable state — each request reconstructs a connection from session credentials.

### 4. Session Security
- CSRF: Double-submit cookie pattern (or HMAC-signed header token)
- Password: Stored encrypted in session (AES-256-GCM with per-browser key cookie)
- Brute force: In-memory (or file-backed) attempt counter per IP
- No open proxy: Server validates that the DB host is not a privileged port and only allows configured hosts

### 5. ≤ 500 LOC Per File
Every file in `src/` and `public/app/` is budgeted. Large pages (Select, SQL) split concerns into sub-modules. The roadmap tracks LOC budgets per file.
