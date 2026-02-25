# adminer-node — REST API Reference

## Design Principles

- All endpoints return `application/json`
- All mutating endpoints (`POST`, `PUT`, `DELETE`) require `X-CSRF-Token` header
- Authentication is session-based (cookie `adminer_sid`)
- Errors always return `{ error: string, code?: string }` with an appropriate HTTP status
- Database context is passed as `?db=` query param (not in session) — keeps URLs bookmarkable
- Schema context (PostgreSQL) is `?ns=` query param

---

## Authentication Endpoints

### `GET /api/status`
Returns server status (always public — no auth required).

**Response 200:**
```json
{
  "version": "1.0.0",
  "authenticated": true,
  "conn": {
    "driver": "mysql",
    "server": "localhost",
    "username": "root",
    "db": "mydb"
  }
}
```

### `GET /api/drivers`
List available (installed) drivers. Always public.

**Response 200:**
```json
{
  "drivers": [
    { "id": "mysql",  "name": "MySQL / MariaDB" },
    { "id": "pgsql",  "name": "PostgreSQL" },
    { "id": "sqlite", "name": "SQLite" }
  ]
}
```

### `POST /api/auth/login`
**Request body:**
```json
{
  "driver":   "mysql",
  "server":   "localhost:3306",
  "username": "root",
  "password": "secret",
  "db":       "mydb"
}
```

**Response 200:**
```json
{
  "csrfToken": "abc123",
  "conn": {
    "driver": "mysql",
    "server": "localhost",
    "username": "root",
    "db": "mydb"
  },
  "driverConfig": {
    "jush": "sql",
    "types": { "Numbers": ["int","bigint",...], "Strings": [...], ... },
    "operators": ["=","<",">","LIKE","REGEXP","IS NULL","IS NOT NULL","IN","BETWEEN"],
    "functions": ["abs","ceil","floor","round",...],
    "grouping": ["COUNT","SUM","AVG","MIN","MAX"],
    "editFunctions": [["MD5","SHA1","NOW","UUID"],["MD5","SHA1","NOW","UUID","original"]]
  }
}
```

**Response 401:** `{ "error": "Invalid credentials" }`
**Response 429:** `{ "error": "Too many failed attempts. Try again in 5 minutes." }`

### `POST /api/auth/logout`
**Response 200:** `{ "ok": true }`

---

## Database Endpoints

### `GET /api/databases`
List all databases on the server.

**Response 200:**
```json
{
  "server": {
    "version": "8.0.32",
    "user": "root@localhost",
    "engine": "MySQL",
    "charset": "utf8mb4"
  },
  "databases": [
    { "name": "mydb", "tables": 12, "size": 2097152, "collation": "utf8mb4_unicode_ci" }
  ]
}
```

### `POST /api/databases`
Create a database.

**Request body:**
```json
{ "name": "newdb", "collation": "utf8mb4_unicode_ci" }
```
**Response 200:** `{ "ok": true }`

### `DELETE /api/databases/:db`
Drop a database.

**Response 200:** `{ "ok": true }`

---

## Table Endpoints

### `GET /api/tables?db=`
List tables in a database.

**Response 200:**
```json
{
  "tables": [
    {
      "name": "users",
      "type": "table",
      "engine": "InnoDB",
      "rows": 1500,
      "size": 114688,
      "collation": "utf8mb4_unicode_ci",
      "comment": "",
      "auto_increment": 1501
    }
  ]
}
```

### `GET /api/table/:name?db=`
Get full structure of a table.

**Response 200:**
```json
{
  "status": { "name": "users", "engine": "InnoDB", "rows": 1500, "comment": "" },
  "fields": [
    {
      "name": "id", "type": "int", "fullType": "int(11)", "length": "11",
      "nullable": false, "default": null, "autoIncrement": true,
      "unsigned": true, "collation": null, "comment": "",
      "primary": true, "generated": false,
      "privileges": { "select": true, "insert": true, "update": true }
    }
  ],
  "indexes": [
    { "name": "PRIMARY", "type": "PRIMARY", "columns": ["id"], "lengths": [null], "descs": [false] }
  ],
  "foreignKeys": [],
  "triggers": []
}
```

### `POST /api/table?db=`
Create a table.

**Request body:**
```json
{
  "name": "orders",
  "fields": [
    { "name": "id", "type": "int", "length": "", "unsigned": true, "nullable": false,
      "autoIncrement": true, "default": null, "comment": "" },
    { "name": "user_id", "type": "int", "length": "", "unsigned": true, "nullable": false,
      "autoIncrement": false, "default": null, "comment": "" }
  ],
  "indexes": [
    { "type": "PRIMARY", "columns": ["id"] }
  ]
}
```
**Response 200:** `{ "ok": true, "sql": "CREATE TABLE ..." }`

### `PUT /api/table/:name?db=`
Alter a table (rename, add/modify/drop columns).

**Request body:**
```json
{
  "fields": [...],       // full new field list
  "renamedFrom": null,   // null = no rename; string = old table name
  "tableComment": ""
}
```
**Response 200:** `{ "ok": true, "sql": "ALTER TABLE ..." }`

### `DELETE /api/table/:name?db=`
Drop a table.

**Response 200:** `{ "ok": true }`

### `POST /api/table/:name/truncate?db=`
Truncate a table.

**Response 200:** `{ "ok": true }`

---

## Row Browse Endpoints

### `GET /api/select/:table?db=&page=&limit=&order=&dir=&cols=&where[col][op]=val`
Browse rows with filtering, sorting, and pagination.

**Query params:**
| Param | Example | Description |
|---|---|---|
| `db` | `mydb` | Database name |
| `page` | `0` | Zero-based page index |
| `limit` | `50` | Rows per page (max 10000) |
| `order` | `id` | Sort column |
| `dir` | `ASC` | Sort direction |
| `cols` | `id,name,email` | Comma-separated columns (empty = all) |
| `where[name][LIKE]` | `%john%` | WHERE conditions (col + operator + value) |

**Response 200:**
```json
{
  "rows": [ { "id": 1, "name": "Alice", "email": "alice@example.com" } ],
  "fields": [
    { "name": "id", "type": "int", "primary": true }
  ],
  "total": 1500,
  "page": 0,
  "limit": 50,
  "pages": 30,
  "sql": "SELECT `id`, `name` FROM `users` WHERE `name` LIKE '%john%' LIMIT 50",
  "time": 4
}
```

### `POST /api/select/:table/delete?db=`
Bulk delete rows by primary key.

**Request body:**
```json
{ "keys": [{"id": 1}, {"id": 2}] }
```
**Response 200:** `{ "ok": true, "deleted": 2 }`

### `POST /api/select/:table/clone?db=`
Clone (duplicate) a row.

**Request body:**
```json
{ "key": {"id": 1} }
```
**Response 200:** `{ "ok": true, "insertId": 42 }`

---

## Row Edit Endpoints

### `GET /api/edit/:table?db=&[pk]=val`
Fetch a row for editing, or just field metadata for insert.

**Response 200:**
```json
{
  "fields": [...],
  "row": { "id": 1, "name": "Alice" },
  "foreignKeys": {
    "user_id": { "table": "users", "column": "id" }
  }
}
```
If no PK params: `"row": null` (insert mode).

### `POST /api/edit/:table?db=`
Insert a row.

**Request body:**
```json
{
  "values": {
    "name": { "value": "Bob", "function": null },
    "created_at": { "value": null, "function": "NOW()" }
  }
}
```
**Response 200:** `{ "ok": true, "insertId": 43 }`

### `PUT /api/edit/:table?db=`
Update a row.

**Request body:**
```json
{
  "where": { "id": 1 },
  "values": {
    "name": { "value": "Bobby", "function": null }
  }
}
```
**Response 200:** `{ "ok": true, "rowsAffected": 1 }`

### `DELETE /api/edit/:table?db=`
Delete a single row.

**Request body:**
```json
{ "where": { "id": 1 } }
```
**Response 200:** `{ "ok": true }`

---

## SQL Command Endpoints

### `POST /api/sql?db=`
Execute one or more SQL statements.

**Request body:**
```json
{
  "query": "SELECT 1; SELECT 2;",
  "limit": 100,
  "errorStop": true,
  "delimiter": ";"
}
```

**Response 200:**
```json
{
  "results": [
    {
      "sql": "SELECT 1",
      "rows": [{"1": 1}],
      "fields": [{"name": "1", "type": "int"}],
      "rowsAffected": null,
      "insertId": null,
      "error": null,
      "time": 1
    }
  ],
  "totalTime": 3
}
```

### `POST /api/sql/import?db=`
Import SQL from uploaded file (multipart/form-data, field name `file`).

**Response 200:** Same shape as `/api/sql`.

### `GET /api/sql/history?db=`
**Response 200:**
```json
{ "history": ["SELECT * FROM users LIMIT 10", "SHOW TABLES"] }
```

---

## Export (Dump) Endpoint

### `GET /api/dump?db=&tables=users,orders&format=sql&tableStyle=CREATE&dataStyle=INSERT`
Streams the export file directly. Sets `Content-Disposition: attachment`.

**Query params:**
| Param | Values | Description |
|---|---|---|
| `db` | `mydb` | Database |
| `tables` | `t1,t2` | Comma-separated table names (empty = all) |
| `format` | `sql`, `csv`, `json` | Output format |
| `tableStyle` | `none`, `drop`, `create` | DDL style |
| `dataStyle` | `none`, `insert`, `truncate` | Data style |
| `noAutoInc` | `1` | Strip AUTO_INCREMENT values |
| `routines` | `1` | Include routines |
| `triggers` | `1` | Include triggers |

**Response:** Binary stream with appropriate Content-Type.

---

## Index Endpoints

### `GET /api/indexes/:table?db=`
**Response 200:**
```json
{
  "indexes": [
    { "name": "PRIMARY", "type": "PRIMARY", "columns": ["id"], "lengths": [null], "descs": [false] }
  ],
  "fields": ["id", "name", "email", "created_at"]
}
```

### `POST /api/indexes/:table?db=`
**Request body:**
```json
{
  "add": [{ "name": "idx_email", "type": "UNIQUE", "columns": ["email"], "lengths": [null] }],
  "drop": ["idx_old"]
}
```
**Response 200:** `{ "ok": true, "sql": "ALTER TABLE ..." }`

---

## Foreign Key Endpoints

### `GET /api/foreign/:table?db=`
**Response 200:**
```json
{
  "foreignKeys": [
    {
      "name": "fk_user", "sourceColumns": ["user_id"],
      "targetDb": "mydb", "targetTable": "users", "targetColumns": ["id"],
      "onDelete": "CASCADE", "onUpdate": "NO ACTION"
    }
  ],
  "sourceFields": ["id", "user_id", "product_id"],
  "targetTables": [
    { "name": "users", "columns": ["id"] }
  ]
}
```

### `POST /api/foreign/:table?db=`
**Request body:**
```json
{
  "add": [{
    "name": "fk_product",
    "sourceColumns": ["product_id"],
    "targetTable": "products",
    "targetColumns": ["id"],
    "onDelete": "SET NULL",
    "onUpdate": "CASCADE"
  }],
  "drop": ["fk_old"]
}
```
**Response 200:** `{ "ok": true, "sql": "ALTER TABLE ..." }`

---

## User / Privilege Endpoints

### `GET /api/users`
**Response 200:**
```json
{
  "users": [
    { "user": "root", "host": "localhost", "privileges": ["ALL PRIVILEGES"] }
  ]
}
```

### `POST /api/users`
Create or update a user.

**Request body:**
```json
{
  "user": "alice",
  "host": "%",
  "password": "newpassword",
  "privileges": ["SELECT", "INSERT", "UPDATE"],
  "db": "mydb",
  "grant": false
}
```
**Response 200:** `{ "ok": true }`

### `DELETE /api/users/:user?host=`
**Response 200:** `{ "ok": true }`

---

## Variables / Process List Endpoints

### `GET /api/variables`
**Response 200:**
```json
{
  "variables": [
    { "name": "max_connections", "value": "151" },
    { "name": "innodb_buffer_pool_size", "value": "134217728" }
  ]
}
```

### `GET /api/processlist`
**Response 200:**
```json
{
  "processes": [
    { "id": 42, "user": "root", "host": "localhost", "db": "mydb",
      "command": "Query", "time": 0, "state": "", "info": "SHOW FULL PROCESSLIST" }
  ]
}
```

### `DELETE /api/processlist/:id`
**Response 200:** `{ "ok": true }`

---

## Error Response Format

All errors follow this shape:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_CODE",
  "field": "fieldName"
}
```

| HTTP Status | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/invalid request param |
| 400 | `SQL_ERROR` | Database returned SQL error |
| 401 | `NOT_AUTHENTICATED` | No valid session |
| 403 | `CSRF_MISMATCH` | Missing/invalid CSRF token |
| 403 | `ACCESS_DENIED` | DB user lacks privilege |
| 404 | `NOT_FOUND` | Table/DB/row not found |
| 429 | `BRUTE_FORCE` | Too many login attempts |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `DB_UNAVAILABLE` | Cannot connect to database |
