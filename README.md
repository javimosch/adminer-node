# adminer-node

A lightweight database management UI for **MySQL**, **MariaDB**, **PostgreSQL** and **SQLite** — inspired by [AdminerEvo](https://github.com/adminerevo/adminerevo), built with Node.js, Vue 3, Tailwind CSS and DaisyUI.

## Quick Start

```bash
npx adminer-node
```

Opens your browser at `http://127.0.0.1:8080` automatically.

## Options

```
Usage:
  npx adminer-node [options]

Options:
  --port <port>      HTTP port to listen on (default: 8080)
  --host <host>      Host to bind to (default: 127.0.0.1)
  --no-open          Do not open browser automatically
  --driver <driver>  Pre-select driver: mysql | pgsql | sqlite
  --help             Show this help message
```

## Features

- **MySQL / MariaDB** — browse databases, tables, run SQL, edit rows, manage indexes & foreign keys, export dumps
- **PostgreSQL** — full schema support, sequences, materialized views
- **SQLite** — file-based and in-memory databases
- **SQL Editor** — multi-statement execution with result tables
- **Table browser** — sortable, filterable, paginated rows with inline edit
- **Row editor** — insert / update / delete with type-aware inputs
- **Schema viewer** — column types, indexes, foreign keys
- **Export** — SQL dump per table or entire database
- **Security** — AES-256-GCM encrypted session passwords, CSRF protection, brute-force rate limiting

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js built-in `http` (zero framework) |
| Frontend | Vue 3 (CDN, no build step) |
| Styling | Tailwind CSS + DaisyUI (CDN) |
| MySQL/MariaDB | `mysql2` |
| PostgreSQL | `pg` |
| SQLite | `better-sqlite3` |

## Requirements

- Node.js >= 18

## License

Apache-2.0 © [Javier Leandro Arancibia](https://github.com/javimosch)
