import { BaseDriver, registerDriver, normalizeField } from './base.js';

// Persistent connection cache for SQLite (keyed by file path).
// This is necessary because :memory: databases and WAL-mode files
// work correctly only when the same Database instance is reused.
const connCache = new Map(); // filePath → Database instance

export function getSQLiteConn(filePath) { return connCache.get(filePath) || null; }
export function setSQLiteConn(filePath, db) { connCache.set(filePath, db); }

const SUPPORTED = new Set([
  'databases', 'indexes', 'foreign_keys', 'drop_col', 'dump',
  'multi_query', 'explain', 'trigger', 'variables',
]);

class SQLiteDriver extends BaseDriver {
  constructor() { super(); this._db = null; this._file = null; }

  async connect(server, username, password) {
    try {
      this._file = server || ':memory:';
      // Reuse cached connection (critical for :memory: DBs across requests)
      const cached = connCache.get(this._file);
      if (cached) { this._db = cached; return null; }
      const { default: Database } = await import('better-sqlite3');
      this._db = new Database(this._file);
      this._db.pragma('journal_mode = WAL');
      this._db.pragma('foreign_keys = ON');
      connCache.set(this._file, this._db);
      return null;
    } catch (e) { return e.message; }
  }

  async disconnect() {
    // Do NOT close — keep connection alive in cache for next request.
    // For file-based DBs this avoids reconnect overhead.
    // For :memory: DBs this preserves the database across requests.
    this._db = null;
  }

  async selectDb(db) {
    // SQLite: reconnect to different file
    await this.disconnect();
    return this.connect(db, '', '');
  }

  // SQLite has no databases concept — return the file name
  async databases() { return [this._file || ':memory:']; }

  async tablesList() {
    const rows = this._db.prepare(
      "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all();
    return rows.map(r => ({ name: r.name, type: r.type }));
  }

  async tableStatus(table) {
    const rows = this._db.prepare("SELECT * FROM sqlite_master WHERE name = ?").all(table);
    return rows[0] || {};
  }

  async fields(table) {
    const rows = this._db.prepare(`PRAGMA table_info(${this.escapeId(table)})`).all();
    // Get primary key columns
    const pks = new Set(rows.filter(r => r.pk > 0).map(r => r.name));
    return rows.map(r => normalizeField({
      name: r.name,
      type: r.type.toLowerCase().split('(')[0].trim(),
      fullType: r.type,
      length: (() => { const m = r.type.match(/\(([^)]+)\)/); return m ? m[1] : ''; })(),
      nullable: !r.notnull,
      default: r.dflt_value,
      autoIncrement: pks.has(r.name) && /integer/i.test(r.type),
      collation: null, unsigned: false, comment: '',
      primary: pks.has(r.name), generated: false,
    }));
  }

  async indexes(table) {
    const rows = this._db.prepare(`PRAGMA index_list(${this.escapeId(table)})`).all();
    return rows.map(r => {
      const cols = this._db.prepare(`PRAGMA index_info(${this.escapeId(r.name)})`).all();
      return {
        name: r.name,
        type: r.origin === 'pk' ? 'PRIMARY' : r.unique ? 'UNIQUE' : 'INDEX',
        columns: cols.map(c => c.name), lengths: [], descs: [],
      };
    });
  }

  async foreignKeys(table) {
    const rows = this._db.prepare(`PRAGMA foreign_key_list(${this.escapeId(table)})`).all();
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.id)) {
        map.set(r.id, { name: `fk_${table}_${r.id}`, sourceColumns: [], targetDb: '', targetTable: r.table, targetColumns: [], onDelete: r.on_delete, onUpdate: r.on_update });
      }
      const fk = map.get(r.id);
      fk.sourceColumns.push(r.from);
      fk.targetColumns.push(r.to);
    }
    return [...map.values()];
  }

  async triggers(table) {
    const rows = this._db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?").all(table);
    return rows.map(r => ({ name: r.name, sql: r.sql }));
  }

  async query(sql, params = []) {
    const t = Date.now();
    try {
      const stmt = this._db.prepare(sql);
      if (stmt.reader) {
        const rows = stmt.all(params);
        const fields = rows.length ? Object.keys(rows[0]).map(n => ({ name: n })) : [];
        return { rows, fields, rowsAffected: rows.length, insertId: null, error: null, time: Date.now() - t };
      } else {
        const info = stmt.run(params);
        return { rows: [], fields: [], rowsAffected: info.changes, insertId: info.lastInsertRowid, error: null, time: Date.now() - t };
      }
    } catch (e) {
      return { rows: [], fields: [], rowsAffected: 0, insertId: null, error: e.message, time: Date.now() - t };
    }
  }

  async multiQuery(sql) {
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    const results = [];
    for (const s of stmts) results.push(await this.query(s));
    return results;
  }

  async explain(sql) {
    const r = await this.query(`EXPLAIN QUERY PLAN ${sql}`);
    return r.error ? null : r.rows;
  }

  async select(table, { columns = ['*'], where = [], order = null, dir = 'ASC', limit = 50, offset = 0 } = {}) {
    const cols = columns.map(c => c === '*' ? '*' : this.escapeId(c)).join(', ');
    let sql = `SELECT ${cols} FROM ${this.escapeId(table)}`;
    const params = [];
    if (where.length) {
      sql += ' WHERE ' + where.map(w => `${this.escapeId(w.col)} ${w.op || '='} ?`).join(' AND ');
      where.forEach(w => params.push(w.val));
    }
    if (order) sql += ` ORDER BY ${this.escapeId(order)} ${dir === 'DESC' ? 'DESC' : 'ASC'}`;
    sql += ` LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
    return this.query(sql, params);
  }

  async insert(table, data) {
    const keys = Object.keys(data);
    const sql = `INSERT INTO ${this.escapeId(table)} (${keys.map(k => this.escapeId(k)).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    return this.query(sql, Object.values(data));
  }

  async update(table, data, where) {
    const sets = Object.keys(data).map(k => `${this.escapeId(k)} = ?`).join(', ');
    const whereSql = where.map(w => `${this.escapeId(w.col)} ${w.op || '='} ?`).join(' AND ');
    return this.query(`UPDATE ${this.escapeId(table)} SET ${sets} WHERE ${whereSql}`, [...Object.values(data), ...where.map(w => w.val)]);
  }

  async delete(table, where) {
    const whereSql = where.map(w => `${this.escapeId(w.col)} ${w.op || '='} ?`).join(' AND ');
    return this.query(`DELETE FROM ${this.escapeId(table)} WHERE ${whereSql}`, where.map(w => w.val));
  }

  async insertUpdate(table, rows, primaryKeys) {
    if (!rows.length) return { rows: [], rowsAffected: 0, error: null };
    const keys = Object.keys(rows[0]);
    const placeholders = `(${keys.map(() => '?').join(', ')})`;
    const sql = `INSERT OR REPLACE INTO ${this.escapeId(table)} (${keys.map(k => this.escapeId(k)).join(', ')}) VALUES ${placeholders}`;
    let last;
    for (const row of rows) last = await this.query(sql, keys.map(k => row[k]));
    return last;
  }

  begin() { this._db.prepare('BEGIN').run(); }
  commit() { this._db.prepare('COMMIT').run(); }
  rollback() { this._db.prepare('ROLLBACK').run(); }

  async createDatabase(name) {
    // SQLite: "creating a database" means attaching a new file
    return { rows: [], rowsAffected: 0, error: null };
  }

  async dropDatabase(name) { return { rows: [], rowsAffected: 0, error: null }; }

  async dropTable(table) { return this.query(`DROP TABLE ${this.escapeId(table)}`); }
  async truncateTable(table) { return this.query(`DELETE FROM ${this.escapeId(table)}`); }

  async createTable(table, fieldDefs, indexDefs = []) {
    const cols = fieldDefs.map(f => {
      let s = `${this.escapeId(f.name)} ${f.fullType || f.type}`;
      if (f.primary && fieldDefs.filter(x => x.primary).length === 1) s += ' PRIMARY KEY';
      if (f.autoIncrement) s += ' AUTOINCREMENT';
      if (!f.nullable) s += ' NOT NULL';
      if (f.default !== null && f.default !== undefined && !f.autoIncrement) s += ` DEFAULT ${f.default}`;
      return s;
    });
    return this.query(`CREATE TABLE ${this.escapeId(table)} (${cols.join(', ')})`);
  }

  async createSql(table) {
    const rows = this._db.prepare("SELECT sql FROM sqlite_master WHERE name = ? AND type IN ('table','view')").all(table);
    return rows[0]?.sql || '';
  }

  async serverInfo() {
    const rows = this._db.prepare('SELECT sqlite_version() AS v').all();
    return { version: rows[0].v, user: '', file: this._file };
  }

  async variables() {
    const pragmas = ['cache_size','foreign_keys','journal_mode','page_size','synchronous','temp_store','wal_autocheckpoint'];
    const result = [];
    for (const p of pragmas) {
      try {
        const rows = this._db.prepare(`PRAGMA ${p}`).all();
        result.push({ name: p, value: String(rows[0]?.[p] ?? '') });
      } catch {}
    }
    return result;
  }

  support(feature) { return SUPPORTED.has(feature); }
  escapeId(id) { return `"${String(id).replace(/"/g, '""')}"`; }

  config() {
    return {
      jush: 'sqlite',
      types: {
        'Numeric': ['integer','real','numeric','boolean'],
        'Text': ['text','char','varchar','clob'],
        'Binary': ['blob'],
        'Date': ['date','datetime','timestamp'],
      },
      operators: ['=','<','>','<=','>=','!=','LIKE','GLOB','IS NULL','IS NOT NULL','IN','NOT IN','sql'],
      functions: ['COUNT','SUM','AVG','MIN','MAX','GROUP_CONCAT','TOTAL'],
      grouping: ['COUNT','SUM','AVG','MIN','MAX','GROUP_CONCAT'],
      editFunctions: [["datetime('now')","strftime('%s','now')"], ["datetime('now')","strftime('%s','now')",'original']],
    };
  }
}

registerDriver('sqlite', 'SQLite', SQLiteDriver);
