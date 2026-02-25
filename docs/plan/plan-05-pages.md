# adminer-node — Page Modules

Each page is split into:
- A **server-side API handler** in `src/api/` (returns JSON)
- A **Vue view** in `public/app/views/` (renders the UI)

This document describes both halves for every page.

---

## Login Page

### `src/api/auth.js` (≤ 200 LOC)

**`POST /api/auth/login`**
```
Body: { driver, server, username, password, db? }
→ Validate input fields present
→ Check brute-force lock
→ driver.connect(server, username, password)
→ Encrypt password → session
→ Return: { csrfToken, conn: { driver, server, username, db } }
```

**`POST /api/auth/logout`**
```
→ Clear session.connections[currentConn]
→ Return: { ok: true }
```

**`GET /api/drivers`**
```
→ Return: [{ id: 'mysql', name: 'MySQL' }, ...]
```

### `LoginView.js` (≤ 200 LOC)

- Driver `<select>` (populated from `/api/drivers`)
- Server input (hidden for SQLite — file path shown instead)
- Username / Password inputs
- Database input (optional, can be selected after login)
- Submit → `api.post('/auth/login', ...)` → store conn → navigate to `/#/home`
- Show error alert on failure
- DaisyUI: `card`, `form-control`, `input`, `btn-primary`

---

## Home / Server Overview

### `src/api/databases.js` (≤ 200 LOC)

**`GET /api/databases`**
```
→ driver.databases()
→ For each DB: driver.tablesList(db) count, optional size info
→ Return: { server: { version, user }, databases: [{ name, tables, size, collation }] }
```

**`POST /api/databases`**
```
Body: { name, collation }
→ driver.createDatabase(name, collation)
→ Return: { ok: true }
```

**`DELETE /api/databases/:db`**
```
→ driver.dropDatabase(db)
→ Return: { ok: true }
```

### `HomeView.js` (≤ 200 LOC)

- Server info panel: version, current user
- Table of databases: name | table count | size | collation | [Select] [Drop] buttons
- "Create database" form inline at bottom
- DaisyUI: `stats`, `table`, `btn-error` for drop

---

## Database / Table List

### `src/api/tables.js` (≤ 200 LOC)

**`GET /api/tables?db=`**
```
→ driver.selectDb(db)
→ driver.tablesList(db)
→ For each table: driver.tableStatus(name)
→ Return: { tables: [{ name, type, rows, size, engine, comment, collation }] }
```

### `TableListView.js` (≤ 200 LOC)

- Tabs or filter: All | Tables | Views
- Search/filter input (client-side filter on table name)
- Table: Name | Type | Rows | Size | Engine | Comment | Actions
- Actions per row: [Select] [Structure] [New item] [Search] [Drop] [Truncate]
- Bulk actions: Drop selected, Truncate selected
- "Create table" button → `/#/create-table?db=`
- DaisyUI: `table-zebra`, `badge` for type (table/view), `btn-xs`

---

## Table Structure

### `src/api/structure.js` (≤ 300 LOC)

**`GET /api/table/:name?db=`**
```
→ driver.fields(name)
→ driver.indexes(name)
→ driver.foreignKeys(name)
→ driver.triggers(name)
→ driver.tableStatus(name)
→ Return: { fields, indexes, foreignKeys, triggers, status }
```

**`PUT /api/table/:name?db=`** (ALTER TABLE)
```
Body: { fields: [...], renamedFrom? }
→ Diff incoming fields vs current → generate ALTER TABLE SQL
→ driver.alterTable(name, changes)
→ Return: { ok: true, sql: '...' }
```

**`DELETE /api/table/:name?db=`**
```
→ driver.dropTable(name)
→ Return: { ok: true }
```

**`POST /api/table/:name/truncate?db=`**
```
→ driver.truncateTable(name)
→ Return: { ok: true }
```

### `TableStructureView.js` (≤ 300 LOC)

- Top links: [Select] [New item] [Alter] [Add column] [Indexes] [Foreign keys] [Triggers]
- **Fields section**: table with Name | Type | Length | Nullable | Default | Auto Inc | Comment
- **Indexes section**: Name | Type | Columns | [Drop]
- **Foreign keys section**: Name | Source | → Target | ON DELETE | ON UPDATE | [Drop]
- **Triggers section**: Name | Timing | Event | Statement | [Drop]
- Each section has an "Add" link leading to the appropriate form

---

## Create / Alter Table

### `src/api/structure.js` (continued)

**`POST /api/table?db=`** (CREATE TABLE)
```
Body: { name, fields: [...], indexes: [...] }
→ driver.createTable(name, fields, indexes)
→ Return: { ok: true }
```

### `CreateTableView.js` (≤ 400 LOC)

- Table name input
- **Column editor** (uses `FieldEditor` component per row):
  - Name, Type (grouped select), Length/Values, Collation, Unsigned, Nullable, Default, Auto Increment, Comment
  - [+] Add row, [×] Remove, [↑] [↓] Move
- **Index editor** (simple table):
  - Index name, Type (PRIMARY/UNIQUE/INDEX/FULLTEXT), Columns (multi-select)
- Preview generated SQL (accordion collapse)
- Submit → `POST /api/table`
- DaisyUI: `collapse`, `join` for button groups

---

## Row Browse (Select)

### `src/api/select.js` (≤ 400 LOC)

**`GET /api/select/:table?db=&page=&limit=&where[col]=&order=&dir=&cols=`**
```
→ driver.fields(table) → determine selectable fields
→ Build SELECT with requested cols (or all), WHERE, ORDER BY, LIMIT/OFFSET
→ driver.select(table, { columns, where, order, limit, offset })
→ driver.foundRows() or COUNT(*) for pagination total
→ Return: {
    rows: [...],
    fields: [...],
    total: number,
    page: number,
    limit: number,
    sql: string,   // the executed SQL for display
    time: number,
  }
```

**`POST /api/select/:table/delete?db=`**
```
Body: { ids: [...] }   // row identifiers (primary key values)
→ driver.delete(table, whereFromIds(ids))
→ Return: { ok: true, deleted: number }
```

**`POST /api/select/:table/clone?db=`**
```
Body: { id: ... }
→ driver.select(table, { where: id }) → fetch row
→ driver.insert(table, row without PK)
→ Return: { ok: true, insertId: ... }
```

### `SelectView.js` (≤ 450 LOC)

Split into logical sections, kept within budget:

**Filter/Search bar** (collapsible):
- Column selector checkboxes (show/hide columns)
- WHERE builder: [Column ▾] [Operator ▾] [Value] rows, [+Add condition]
- ORDER BY: column + ASC/DESC
- LIMIT select (20/50/100/500/ALL)

**Results area**:
- SQL display (collapsible `<pre>` with highlight.js)
- `DataTable` component with checkbox column
- Row actions (per-row): [Edit] [Clone] [Delete]
- Bulk actions: [Delete selected] [Export selected]

**Pagination**: `Pagination` component

**Export footer** (collapsible):
- Format: SQL | CSV | JSON
- [Export] button → `/api/dump?table=...&where=...`

---

## Row Edit / Insert

### `src/api/edit.js` (≤ 250 LOC)

**`GET /api/edit/:table?db=&[pk_col]=[pk_val]`**
```
→ driver.fields(table) → filterable by insert/update privilege
→ If pk params provided: driver.select(table, { where: pk, limit: 1 })
→ Return: { fields, row: {...}|null, foreignKeys }
```

**`POST /api/edit/:table?db=`** (INSERT)
```
Body: { values: { col: { value, function? } } }
→ Process each field: apply SQL function if specified
→ driver.insert(table, processed)
→ Return: { ok: true, insertId: ... }
```

**`PUT /api/edit/:table?db=`** (UPDATE)
```
Body: { values: { col: { value, function? } }, where: {...} }
→ driver.update(table, processed, where)
→ Return: { ok: true, rowsAffected: number }
```

**`DELETE /api/edit/:table?db=`**
```
Body: { where: {...} }
→ driver.delete(table, where)
→ Return: { ok: true }
```

### `EditView.js` (≤ 300 LOC)

- Title: "Insert into [table]" or "Edit [table]"
- For each field (with insert/update privilege):
  - Label (field name + type badge)
  - `FieldInput` component (smart widget based on type)
  - Function `<select>` (NULL / NOW() / UUID / etc. from driverConfig.editFunctions)
  - Original value display (for UPDATE mode)
- [Save] [Save and continue editing] [Delete] buttons
- After save: flash message + redirect to SelectView

---

## SQL Command

### `src/api/sql.js` (≤ 300 LOC)

**`POST /api/sql?db=`**
```
Body: { query, limit?, errorStop?, delimiter? }
→ Split query by delimiter (default ';'), handle DELIMITER command
→ For each statement:
    → driver.query(stmt)
    → If SELECT: return rows + fields
    → If error: record error; if errorStop, break loop
→ Return: {
    results: [
      { sql, rows?, fields?, rowsAffected?, insertId?, error?, time }
    ],
    total_time: number
  }
```

**`POST /api/sql/file?db=`** (import from uploaded file)
```
→ Stream multipart file body
→ Parse SQL (same delimiter logic)
→ Execute same as above
→ Return: same shape
```

**`GET /api/sql/history?db=`**
```
→ Return last 20 queries from session
```

### `SqlView.js` (≤ 350 LOC)

- `SqlEditor` component (textarea with live SQL highlight)
- Options: Error stops | Limit rows (100/1000/∞) | Delimiter
- [Execute] [Import file] buttons
- **Results area**: For each executed statement:
  - `<pre>` with highlighted SQL
  - Time badge
  - If rows: `DataTable` + [Export result] button
  - If affected rows: "OK, N rows affected" badge
  - If error: `alert-error` DaisyUI alert
- **History** (collapsible): List of recent queries with [Repeat] links

---

## Export (Dump)

### `src/api/dump.js` (≤ 300 LOC)

**`GET /api/dump?db=&tables=&format=&dataStyle=&tableStyle=`**
```
→ Set response headers: Content-Disposition: attachment; filename=...
→ Stream export:
    For SQL format:
      → Emit header comment
      → For each table: emit CREATE TABLE DDL (if tableStyle includes it)
      → For each table: emit INSERT rows (if dataStyle includes it)
    For CSV format:
      → Emit header row
      → Stream rows from driver.select()
    For JSON format:
      → Emit JSON array of row objects
→ Stream ends → response ends
```

### `DumpView.js` (≤ 250 LOC)

- **Output**: Open in browser | Download file | (future: gzip)
- **Format**: SQL | CSV | JSON
- **Database style**: None | DROP+CREATE | CREATE
- **Table data style**: None | INSERT | TRUNCATE+INSERT
- **Table selection**: checkbox list of all tables, bulk select/deselect, prefix grouping
- [Export] → triggers download via `api.download('/dump', params)`

---

## Indexes Management

### `src/api/indexes.js` (≤ 150 LOC)

**`GET /api/indexes/:table?db=`**
```
→ driver.indexes(table)
→ driver.fields(table) → field names for column select
→ Return: { indexes, fields: [field names] }
```

**`POST /api/indexes/:table?db=`**
```
Body: { add: [...], drop: [...] }
→ driver.alterIndexes(table, add, drop)
→ Return: { ok: true }
```

### `IndexesView.js` (≤ 250 LOC)

- Table of existing indexes: Name | Type | Columns | [Drop]
- "Add index" section:
  - Name input (auto-generated from selected columns)
  - Type select: PRIMARY / UNIQUE / INDEX / FULLTEXT
  - Column checkboxes (with optional length per column for prefix indexes)
- [Save] button

---

## Foreign Keys

### `src/api/foreign.js` (≤ 150 LOC)

**`GET /api/foreign/:table?db=`**
```
→ driver.foreignKeys(table)
→ driver.fields(table) → source column options
→ referencable tables (tables with single-column PKs) → target options
→ Return: { foreignKeys, sourceFields, targetTables }
```

**`POST /api/foreign/:table?db=`**
```
Body: { add: [...fkDefs], drop: [...names] }
→ driver.addForeignKey() / driver.dropForeignKey()
→ Return: { ok: true }
```

### `ForeignView.js` (≤ 250 LOC)

- Existing FKs table: Name | Source cols | → Target table | Target cols | ON DELETE | ON UPDATE | [Drop]
- "Add foreign key" form:
  - Source column(s) multi-select
  - Target table select (filtered to referencable)
  - Target column(s) multi-select (populated when target table chosen)
  - ON DELETE / ON UPDATE selects (NO ACTION / CASCADE / SET NULL / RESTRICT)
- [Save]

---

## Users / Privileges

### `src/api/users.js` (≤ 250 LOC)

**`GET /api/users`**
```
→ driver.users()
→ Return: [{ user, host, privileges, passwordHash? }]
```

**`POST /api/users`**
```
Body: { user, host, password, privileges: [...], db? }
→ Generate GRANT / CREATE USER SQL
→ driver.query(...)
→ Return: { ok: true }
```

**`DELETE /api/users/:user`**
```
→ driver.query(`DROP USER '${user}'@'${host}'`)
→ Return: { ok: true }
```

### `UsersView.js` (≤ 300 LOC)

- Table of users: Username | Host | [Edit] [Drop]
- "Create user" form (or edit existing):
  - Username, Host, Password inputs
  - Privileges section: global or per-database
  - ALL PRIVILEGES toggle + individual privilege checkboxes

---

## Server Variables

### `src/api/variables.js` (≤ 100 LOC)

**`GET /api/variables`**
```
→ driver.variables()
→ Return: { variables: [{name, value}] }
```

**`GET /api/processlist`**
```
→ driver.processList()
→ Return: { processes: [{id, user, host, db, command, time, state, info}] }
```

**`DELETE /api/processlist/:id`**
```
→ driver.killProcess(id)
→ Return: { ok: true }
```

### `VariablesView.js` (≤ 200 LOC)

- Tabs: Variables | Status | Process List
- **Variables/Status**: searchable table Name | Value
- **Process List**: table with [Kill] button per process, auto-refresh toggle (every 5s)

---

## Shared Concerns

### Flash Messages

All mutating operations (insert, update, delete, create, drop) redirect back to a list view and pass a flash message via store:

```js
store.flashSuccess('Row inserted successfully.');
router.push(`/#/select/${table}?db=${db}`);
```

`FlashMessage.js` renders DaisyUI `toast` + `alert` positioned top-right, auto-dismiss after 5s.

### Confirmation Dialogs

Destructive actions (drop table, drop database, delete row) use the `Modal.js` confirm dialog before proceeding. No `window.confirm()` — always DaisyUI modal.

### Loading States

All async API calls set a `loading` ref. `DataTable` shows a `loading loading-spinner` overlay. Buttons show `loading` class during submission.

### SQL Preview

Wherever schema changes are submitted (CREATE TABLE, ALTER TABLE, ALTER INDEX), the API returns `{ sql: '...' }` in the response. The view shows this in a `SqlEditor` (read-only) so users can inspect what ran.
