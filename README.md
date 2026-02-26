# adminer-node

A lightweight database management UI for **MySQL**, **MariaDB**, **PostgreSQL** and **SQLite** — inspired by [AdminerEvo](https://github.com/adminerevo/adminerevo), built with Node.js, Vue 3, Tailwind CSS and DaisyUI.

Developed by **[intrane.fr](https://intrane.fr)** (Javier Leandro Arancibia).

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

## Docker

### Run with Docker

```bash
docker run -p 8080:8080 javimosch/adminer-node:latest
```

Then open `http://localhost:8080` in your browser.

### Docker Compose

Save as `compose.yml` and run `docker compose up`:

```yaml
services:
  adminer-node:
    image: javimosch/adminer-node:latest
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - HOST=0.0.0.0
    restart: unless-stopped
```

Or clone the repo and use the included `compose.yml`:

```bash
git clone https://github.com/javimosch/adminer-node.git
cd adminer-node
docker compose up
```

### Build & Push (maintainers)

```bash
npm run deploy        # build + push to javimosch/adminer-node:latest
npm run docker:build  # build only
npm run docker:push   # push only
npm run docker:run    # quick local run
```

## Configuration & Saved Connections

Create `~/.config/adminer-node/config.json` (auto-loaded on startup):

```json
{
  "port": 8080,
  "connections": [
    {
      "id": "local-mysql",
      "label": "Local MySQL",
      "driver": "mysql",
      "server": "127.0.0.1",
      "username": "root",
      "password": "secret",
      "db": "mydb"
    },
    {
      "id": "dev-sqlite",
      "label": "Dev SQLite",
      "driver": "sqlite",
      "server": "/tmp/dev.db",
      "username": "",
      "password": ""
    }
  ]
}
```

Saved connections appear as **one-click cards** on the home screen — the password never leaves the server.

Or pass via environment variable (JSON array):

```bash
ADMINER_CONNECTIONS='[{"label":"Local MySQL","driver":"mysql","server":"127.0.0.1","username":"root","password":"secret","db":"mydb"}]' \
  npx adminer-node
```

Or with a custom config file path:

```bash
npx adminer-node --config /path/to/my-config.json
```

See `config.example.json` in this repo for a full reference.

## HTTP Basic Auth

Protect a publicly-exposed adminer-node instance with HTTP Basic Auth:

**Via config file:**
```json
{
  "basicAuth": { "username": "admin", "password": "changeme" }
}
```

**Via environment variables:**
```bash
ADMINER_BASIC_USER=admin ADMINER_BASIC_PASS=changeme npx adminer-node
```

> Note: Basic Auth is intended as a **secondary layer** — your primary protection is the DB login form. Enable it when deploying adminer-node on a public URL (e.g., behind a reverse proxy).

## Docker — Advanced: Pre-configured connections

Mount your config file or pass connections via environment:

```yaml
services:
  adminer-node:
    image: javimosch/adminer-node:latest
    ports:
      - "8080:8080"
    environment:
      HOST: 0.0.0.0
      # Optional: basic auth for public URL protection
      ADMINER_BASIC_USER: admin
      ADMINER_BASIC_PASS: changeme
      # Pre-configure connections (JSON array)
      ADMINER_CONNECTIONS: |
        [{"label":"App DB","driver":"mysql","server":"mariadb","username":"root","password":"secret","db":"myapp"}]
    depends_on:
      - mariadb

  mariadb:
    image: mariadb:11
    environment:
      MARIADB_ROOT_PASSWORD: secret
      MARIADB_DATABASE: myapp
```

Or mount a config file:

```yaml
services:
  adminer-node:
    image: javimosch/adminer-node:latest
    ports:
      - "8080:8080"
    environment:
      HOST: 0.0.0.0
      ADMINER_CONFIG: /config/adminer-node.json
    volumes:
      - ./adminer-node.json:/config/adminer-node.json:ro
```

## Development

```bash
git clone https://github.com/javimosch/adminer-node.git
cd adminer-node
npm install
npm run dev           # starts with --watch
```

## Requirements

- Node.js >= 18

## License

Apache-2.0 © [Javier Leandro Arancibia](https://github.com/javimosch) — [intrane.fr](https://intrane.fr)
