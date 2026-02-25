# adminer-node — Driver Architecture

## Overview

Each database driver is a self-contained module in `src/drivers/`. All drivers implement the same interface defined in `src/drivers/base.js`. The active driver is instantiated per-request from session credentials — no global connection state.

---

## `src/drivers/base.js` (≤ 150 LOC)

Defines the abstract driver interface and the driver registry.

### Driver Registry

```js
const registry = new Map(); // id → { name, module }

export function registerDriver(id, name, factory) {
  registry.set(id, { name, factory });
}
export function getDriver(id) { return registry.get(id); }
export function listDrivers() {
  return [...registry.entries()].map(([id, { name }]) => ({ id, name }));
}
```

Drivers self-register by calling `registerDriver()` at module load time.

### Abstract Driver Class

```js
export class BaseDriver {
  // ── Connection ──────────────────────────────────────────────────
  async connect(server, username, password) { throw new Error('not implemented'); }
  async disconnect() {}
  async selectDb(db) { throw new Error('not implemented'); }

  // ── Introspection ───────────────────────────────────────────────
  async databases() { throw new Error('not implemented'); }
  async tablesList(db) { throw new Error('not implemented'); }   // → [{name, type}]
  async tableStatus(table, db) { throw new Error('not implemented'); } // → metadata obj
  async fields(table) { throw new Error('not implemented'); }    // → [{name, type, ...}]
  async indexes(table) { throw new Error('not implemented'); }   // → [{name, type, columns}]
  async foreignKeys(table) { throw new Error('not implemented'); }
  async triggers(table) { throw new Error('not implemented'); }

  // ── Query execution ─────────────────────────────────────────────
  async query(sql, params=[]) { throw new Error('not implemented'); }
  // Returns: { rows: [], fields: [], rowsAffected: 0, insertId: null, error: null }

  async multiQuery(sql) { throw new Error('not implemented'); }
  // Returns: Array of query() result objects

  async explain(sql) { throw new Error('not implemented'); }

  // ── Data operations ─────────────────────────────────────────────
  async select(table, { columns, where, order, limit, offset }) {}
  async insert(table, data) {}         // data: { col: value }
  async update(table, data, where) {}
  async delete(table, where) {}
  async insertUpdate(table, rows, primaryKeys) {} // upsert

  // ── Schema operations ───────────────────────────────────────────
  async createDatabase(name, collation) { throw new Error('not implemented'); }
  async dropDatabase(name) { throw new Error('not implemented'); }
  async createTable(table, fields, indexes) { throw new Error('not implemented'); }
  async alterTable(table, changes) { throw new Error('not implemented'); }
  async dropTable(table) { throw new Error('not implemented'); }
  async truncateTable(table) { throw new Error('not implemented'); }
  async alterIndexes(table, add, drop) { throw new Error('not implemented'); }
  async addForeignKey(table, fk) { throw new Error('not implemented'); }
  async dropForeignKey(table, name) { throw new Error('not implemented'); }

  // ── Dump/export ─────────────────────────────────────────────────
  async createSql(table) { throw new Error('not implemented'); } // DDL string
  async truncateSql(table) { return `TRUNCATE ${this.escapeId(table)};`; }

  // ── Server info ─────────────────────────────────────────────────
  async serverInfo() { throw new Error('not implemented'); }
  // → { version, user, engine, charset, collation }
  async variables() { throw new Error('not implemented'); } // → [{name, value}]
  async processList() { throw new Error('not implemented'); }
  async killProcess(id) { throw new Error('not implemented'); }
  async users() { throw new Error('not implemented'); }

  // ── Capabilities ────────────────────────────────────────────────
  support(feature) { return false; }
  // feature strings: 'databases', 'schemes', 'routine', 'trigger', 'event',
  //   'processlist', 'users', 'variables', 'indexes', 'foreign_keys',
  //   'drop_col', 'move_col', 'comment', 'collation', 'unsigned',
  //   'auto_increment', 'explain', 'dump', 'multi_query'

  // ── Driver metadata ─────────────────────────────────────────────
  config() {
    return {
      jush: 'sql',              // syntax highlighter mode
      types: {},                // structured type registry
      operators: [],            // WHERE filter operators
      functions: [],            // scalar functions for SELECT
      grouping: [],             // aggregate functions
      editFunctions: [[], []],  // [insert functions, update functions]
    };
  }

  // ── Identifier escaping ─────────────────────────────────────────
  escapeId(id) { return `\`${id.replace(/`/g, '``')}\``; }
  escapeValue(v) { /* driver-specific */ }
}
```

### Field Descriptor Shape

All drivers return fields in this normalized shape:

```js
{
  name: string,
  type: string,           // 'int', 'varchar', 'text', etc.
  fullType: string,       // 'varchar(255)'
  length: string,         // '255', '10,2', "'a','b'" (enum)
  nullable: bool,
  default: string|null,
  autoIncrement: bool,
  collation: string|null,
  unsigned: bool,
  comment: string,
  primary: bool,
  generated: bool,
  privileges: {           // what current user can do
    select: bool, insert: bool, update: bool, references: bool
  }
}
```

### Index Descriptor Shape
```js
{
  name: string,
  type: 'PRIMARY'|'UNIQUE'|'INDEX'|'FULLTEXT'|'SPATIAL',
  columns: string[],
  lengths: (number|null)[],
  descs: bool[],          // descending flags per column
}
```

### Foreign Key Descriptor Shape
```js
{
  name: string,
  sourceColumns: string[],
  targetDb: string,
  targetTable: string,
  targetColumns: string[],
  onDelete: 'NO ACTION'|'CASCADE'|'SET NULL'|'RESTRICT',
  onUpdate: 'NO ACTION'|'CASCADE'|'SET NULL'|'RESTRICT',
}
```

---

## `src/drivers/mysql.js` (≤ 450 LOC)

Uses `mysql2` with promise API. Handles MySQL 5.7+, MySQL 8+, and MariaDB 10+.

### Connection
```js
import mysql from 'mysql2/promise';

async connect(server, username, password) {
  const [host, port] = parseServer(server, 3306);
  this._conn = await mysql.createConnection({ host, port, user: username,
    password, multipleStatements: true, charset: 'UTF8MB4' });
}
```

### Key Implementations

**`databases()`** → `SHOW DATABASES`

**`tablesList(db)`** → `SHOW FULL TABLES FROM \`db\`` — returns `{name, type}` where type is `'table'` or `'view'`

**`fields(table)`** → Parse `SHOW FULL COLUMNS FROM \`table\`` + supplement with `information_schema` for generated columns, privileges

**`indexes(table)`** → `SHOW INDEX FROM \`table\``

**`foreignKeys(table)`** → Query `information_schema.KEY_COLUMN_USAGE` + `REFERENTIAL_CONSTRAINTS`

**`serverInfo()`** → `SELECT VERSION(), USER(), @@character_set_server, @@collation_server`

**`variables()`** → `SHOW VARIABLES` + `SHOW STATUS`

**`processList()`** → `SHOW FULL PROCESSLIST`

**`insertUpdate()`** → `INSERT INTO ... ON DUPLICATE KEY UPDATE ...`

**`explain(sql)`** → `EXPLAIN` + `EXPLAIN FORMAT=JSON` (MySQL 8+ / MariaDB)

**`createSql(table)`** → `SHOW CREATE TABLE \`table\``

**`multiQuery(sql)`** → Uses `mysql2` multi-statement mode, iterates result sets

**`support(feature)`**:
```js
const supported = new Set([
  'databases', 'routine', 'trigger', 'event', 'processlist',
  'users', 'variables', 'indexes', 'foreign_keys', 'drop_col',
  'move_col', 'comment', 'collation', 'unsigned', 'auto_increment',
  'explain', 'dump', 'multi_query'
]);
return supported.has(feature);
```

**`config()`** returns MySQL-specific:
- `jush: 'sql'`
- `types`: integer types (TINYINT→BIGINT), float types, string types, date/time, binary, JSON, spatial
- `operators`: `=`, `<`, `>`, `LIKE`, `REGEXP`, `IS NULL`, `IS NOT NULL`, `IN`, `NOT IN`, `BETWEEN`, `FIND_IN_SET`, `sql`
- `editFunctions`: `[['MD5','SHA1','NOW','UUID',...], ['MD5','SHA1','NOW','UUID','original',...]]`

**`escapeId(id)`** → `` `id` ``

---

## `src/drivers/pgsql.js` (≤ 450 LOC)

Uses `pg` (node-postgres).

### Connection
```js
import pg from 'pg';

async connect(server, username, password) {
  const [host, port] = parseServer(server, 5432);
  this._pool = new pg.Pool({ host, port, user: username, password,
    database: 'postgres', // connect to default db first
    ssl: this._ssl });
  this._conn = await this._pool.connect();
}
async selectDb(db) {
  // Re-connect to specific database (pg requires per-db connections)
  this._conn.release();
  this._pool = new pg.Pool({ ...opts, database: db });
  this._conn = await this._pool.connect();
}
```

### Key Implementations

**`databases()`** → `SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`

**`tablesList(db)`** → Query `information_schema.tables` filtered by `table_schema = current_schema()`

**`fields(table)`** → Query `information_schema.columns` + `pg_attribute` + `pg_attrdef` for defaults + `pg_class` for primary key

**`indexes(table)`** → Query `pg_index` + `pg_class` + `pg_attribute`

**`foreignKeys(table)`** → Query `information_schema.referential_constraints` + `key_column_usage`

**`serverInfo()`** → `SELECT version(), current_user, current_database(), pg_encoding_to_char(encoding) FROM pg_database WHERE datname = current_database()`

**`schemas()`** → `SELECT nspname FROM pg_namespace ORDER BY nspname` (PostgreSQL-specific)

**`setSchema(schema)`** → `SET search_path TO schema`

**`variables()`** → `SHOW ALL`

**`processList()`** → `SELECT * FROM pg_stat_activity`

**`killProcess(id)`** → `SELECT pg_terminate_backend(id)`

**`users()`** → `SELECT * FROM pg_roles ORDER BY rolname`

**`insertUpdate()`** → `INSERT INTO ... ON CONFLICT (...) DO UPDATE SET ...`

**`explain(sql)`** → `EXPLAIN (ANALYZE, FORMAT JSON) sql`

**`support(feature)`**:
```js
const supported = new Set([
  'databases', 'schemes', 'routine', 'trigger', 'processlist',
  'users', 'variables', 'indexes', 'foreign_keys', 'drop_col',
  'comment', 'explain', 'dump', 'multi_query', 'materializedview',
  'sequence', 'type'
]);
return supported.has(feature);
```

**`escapeId(id)`** → `"id"`

**`config()`** → `jush: 'pgsql'`, PostgreSQL-specific types and operators

---

## `src/drivers/sqlite.js` (≤ 350 LOC)

Uses `better-sqlite3` (synchronous). All methods are sync internally but wrapped in async for interface compatibility.

### Connection
```js
import Database from 'better-sqlite3';

async connect(server, username, password) {
  // server = file path for SQLite
  this._db = new Database(server, { readonly: false, fileMustExist: false });
  this._db.pragma('journal_mode = WAL');
  this._db.pragma('foreign_keys = ON');
}
```

### Key Implementations

**`databases()`** → Returns `[server]` (SQLite = one file = one DB)

**`tablesList()`** → `SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name`

**`fields(table)`** → `PRAGMA table_xinfo(table)` (includes generated columns) + `PRAGMA table_info(table)`

**`indexes(table)`** → `PRAGMA index_list(table)` + `PRAGMA index_info(name)` for each

**`foreignKeys(table)`** → `PRAGMA foreign_key_list(table)`

**`serverInfo()`** → `SELECT sqlite_version()`, library version

**`variables()`** → Key PRAGMAs: `journal_mode`, `foreign_keys`, `page_size`, `cache_size`, `wal_checkpoint`, `integrity_check`

**`query(sql, params)`** → Detects SELECT vs mutation, uses `db.prepare(sql).all(params)` vs `.run(params)`

**`multiQuery(sql)`** → Split on `;`, execute each individually

**`insertUpdate()`** → `INSERT OR REPLACE INTO ...`

**`createSql(table)`** → `SELECT sql FROM sqlite_master WHERE name = table`

**`support(feature)`**:
```js
const supported = new Set([
  'databases', 'indexes', 'foreign_keys', 'drop_col', 'trigger',
  'view', 'dump', 'variables', 'explain'
]);
return supported.has(feature);
```

**`escapeId(id)`** → `"id"`

**`config()`** → `jush: 'sqlite'`, SQLite-specific types

---

## Driver Loading Strategy

Drivers are loaded lazily: the npm packages (`mysql2`, `pg`, `better-sqlite3`) are optional dependencies. At startup, `src/drivers/base.js` attempts to `import` each driver module; if the package is missing, that driver is silently skipped and not offered in the login form.

```js
// src/drivers/index.js (≤ 60 LOC)
const driverModules = ['mysql', 'pgsql', 'sqlite'];
export async function loadDrivers() {
  for (const d of driverModules) {
    try {
      await import(`./${d}.js`); // self-registers via registerDriver()
    } catch (e) {
      if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
      // package not installed — skip silently
    }
  }
}
```

When `npx adminer-node` is run, all three drivers are included as `dependencies` in `package.json`, so they are always available. The lazy-load path is for use as a library.

---

## Query Result Shape

All `query()` calls return a normalized result object:

```js
{
  rows: Array<Object>,       // array of row objects (col → value)
  fields: Array<{            // column metadata
    name: string,
    type: string,            // native type name
    tableAlias: string,
  }>,
  rowsAffected: number,
  insertId: number|null,
  error: null,               // null on success; Error object on failure
  time: number,              // execution time in ms
}
```

On SQL error, `query()` does NOT throw — it returns `{ rows: [], fields: [], error: Error, ... }`. Callers decide whether to surface the error or throw.

---

## Type Conversion

Each driver handles type conversion transparently:

| Concern | MySQL | PostgreSQL | SQLite |
|---|---|---|---|
| Booleans | `TINYINT(1)` → JS bool when field is named `is_*` | Native `BOOLEAN` → JS bool | `INTEGER` 0/1 |
| Dates | `DATE`/`DATETIME` → ISO string | `timestamp` → JS Date | String passthrough |
| Buffers | `BLOB` → `Buffer` → base64 in JSON | `bytea` → `Buffer` → base64 | `BLOB` → `Buffer` |
| BigInt | `BIGINT` → string (avoids precision loss) | `bigint` → string | passthrough |
| JSON | `JSON` → parsed object | `json`/`jsonb` → parsed object | string |
| Geometry | `GEOMETRY` → WKT string | `geometry` → WKT | — |
