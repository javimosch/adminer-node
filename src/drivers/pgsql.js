import { BaseDriver, registerDriver, normalizeField } from './base.js';

const SUPPORTED = new Set([
  'databases', 'schemes', 'indexes', 'foreign_keys', 'variables',
  'processlist', 'users', 'drop_col', 'comment', 'dump', 'multi_query',
  'explain', 'kill', 'routine', 'trigger', 'sequence',
]);

function parseServer(server, defaultPort) {
  if (!server) return ['127.0.0.1', defaultPort];
  const m = server.match(/^(?:\[([^\]]+)\]|([^:]+))(?::(\d+))?$/);
  if (!m) return [server, defaultPort];
  return [m[1] || m[2], m[3] ? parseInt(m[3], 10) : defaultPort];
}

class PgSQLDriver extends BaseDriver {
  constructor() { super(); this._client = null; this._opts = null; }

  async connect(server, username, password) {
    try {
      const { default: pg } = await import('pg');
      const [host, port] = parseServer(server, 5432);
      this._opts = { host, port, user: username || 'postgres', password: password || '', database: 'postgres', connectionTimeoutMillis: 10000 };
      this._client = new pg.Client(this._opts);
      await this._client.connect();
      return null;
    } catch (e) { return e.message; }
  }

  async disconnect() {
    if (this._client) { try { await this._client.end(); } catch {} this._client = null; }
  }

  async selectDb(db) {
    // pg requires reconnect for different DB
    try { await this._client.end(); } catch {}
    const { default: pg } = await import('pg');
    this._client = new pg.Client({ ...this._opts, database: db });
    await this._client.connect();
  }

  async _q(sql, params = []) {
    const r = await this._client.query(sql, params);
    return r.rows;
  }

  async databases() {
    const rows = await this._q("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname");
    return rows.map(r => r.datname);
  }

  async tablesList(db) {
    const rows = await this._q(
      "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name"
    );
    return rows.map(r => ({ name: r.table_name, type: r.table_type === 'VIEW' ? 'view' : 'table' }));
  }

  async fields(table) {
    const rows = await this._q(`
      SELECT c.column_name, c.data_type, c.udt_name, c.character_maximum_length,
             c.numeric_precision, c.numeric_scale, c.is_nullable, c.column_default,
             c.is_identity, c.identity_generation,
             pgd.description AS comment
      FROM information_schema.columns c
      LEFT JOIN pg_catalog.pg_statio_all_tables st ON st.relname = c.table_name AND st.schemaname = current_schema()
      LEFT JOIN pg_catalog.pg_description pgd ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
      WHERE c.table_name = $1 AND c.table_schema = current_schema()
      ORDER BY c.ordinal_position
    `, [table]);

    // Get primary keys
    const pkRows = await this._q(`
      SELECT kcu.column_name FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1 AND tc.table_schema = current_schema()
    `, [table]);
    const pks = new Set(pkRows.map(r => r.column_name));

    return rows.map(r => {
      const len = r.character_maximum_length
        ? String(r.character_maximum_length)
        : r.numeric_precision ? `${r.numeric_precision}${r.numeric_scale ? `,${r.numeric_scale}` : ''}` : '';
      const type = r.udt_name || r.data_type;
      return normalizeField({
        name: r.column_name, type, fullType: len ? `${type}(${len})` : type, length: len,
        nullable: r.is_nullable === 'YES', default: r.column_default,
        autoIncrement: r.is_identity === 'YES' || /^nextval/i.test(r.column_default || ''),
        collation: null, unsigned: false, comment: r.comment || '',
        primary: pks.has(r.column_name), generated: false,
      });
    });
  }

  async indexes(table) {
    const rows = await this._q(`
      SELECT i.relname AS index_name, ix.indisunique, ix.indisprimary,
             array_agg(a.attname ORDER BY k.pos) AS columns
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN lateral unnest(ix.indkey) WITH ORDINALITY AS k(attnum, pos) ON TRUE
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      WHERE t.relname = $1 AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
      GROUP BY i.relname, ix.indisunique, ix.indisprimary
    `, [table]);
    return rows.map(r => ({
      name: r.index_name,
      type: r.indisprimary ? 'PRIMARY' : r.indisunique ? 'UNIQUE' : 'INDEX',
      columns: r.columns, lengths: [], descs: [],
    }));
  }

  async foreignKeys(table) {
    const rows = await this._q(`
      SELECT tc.constraint_name, kcu.column_name, ccu.table_schema AS f_schema,
             ccu.table_name AS f_table, ccu.column_name AS f_column,
             rc.delete_rule, rc.update_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name AND tc.constraint_schema = rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name AND rc.unique_constraint_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1 AND tc.table_schema = current_schema()
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `, [table]);
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.constraint_name)) {
        map.set(r.constraint_name, { name: r.constraint_name, sourceColumns: [], targetDb: r.f_schema, targetTable: r.f_table, targetColumns: [], onDelete: r.delete_rule, onUpdate: r.update_rule });
      }
      const fk = map.get(r.constraint_name);
      fk.sourceColumns.push(r.column_name);
      fk.targetColumns.push(r.f_column);
    }
    return [...map.values()];
  }

  async query(sql, params = []) {
    const t = Date.now();
    try {
      const r = await this._client.query(sql, params);
      return { rows: r.rows, fields: (r.fields || []).map(f => ({ name: f.name })), rowsAffected: r.rowCount || 0, insertId: null, error: null, time: Date.now() - t };
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
    const r = await this.query(`EXPLAIN ${sql}`);
    return r.error ? null : r.rows;
  }

  async select(table, { columns = ['*'], where = [], order = null, dir = 'ASC', limit = 50, offset = 0 } = {}) {
    const cols = columns.map(c => c === '*' ? '*' : this.escapeId(c)).join(', ');
    let sql = `SELECT ${cols} FROM ${this.escapeId(table)}`;
    const params = [];
    if (where.length) {
      sql += ' WHERE ' + where.map((w, i) => `${this.escapeId(w.col)} ${w.op || '='} $${i + 1}`).join(' AND ');
      where.forEach(w => params.push(w.val));
    }
    if (order) sql += ` ORDER BY ${this.escapeId(order)} ${dir === 'DESC' ? 'DESC' : 'ASC'}`;
    sql += ` LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
    return this.query(sql, params);
  }

  async insert(table, data) {
    const keys = Object.keys(data);
    const vals = Object.values(data);
    const sql = `INSERT INTO ${this.escapeId(table)} (${keys.map(k => this.escapeId(k)).join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
    return this.query(sql, vals);
  }

  async update(table, data, where) {
    const keys = Object.keys(data);
    const vals = Object.values(data);
    const sets = keys.map((k, i) => `${this.escapeId(k)} = $${i + 1}`).join(', ');
    const whereVals = where.map(w => w.val);
    const whereSql = where.map((w, i) => `${this.escapeId(w.col)} ${w.op || '='} $${keys.length + i + 1}`).join(' AND ');
    return this.query(`UPDATE ${this.escapeId(table)} SET ${sets} WHERE ${whereSql}`, [...vals, ...whereVals]);
  }

  async delete(table, where) {
    const whereSql = where.map((w, i) => `${this.escapeId(w.col)} ${w.op || '='} $${i + 1}`).join(' AND ');
    return this.query(`DELETE FROM ${this.escapeId(table)} WHERE ${whereSql}`, where.map(w => w.val));
  }

  async insertUpdate(table, rows, primaryKeys) {
    if (!rows.length) return { rows: [], rowsAffected: 0, error: null };
    const keys = Object.keys(rows[0]);
    const pks = primaryKeys.join(', ');
    const updateCols = keys.filter(k => !primaryKeys.includes(k)).map(k => `${this.escapeId(k)} = EXCLUDED.${this.escapeId(k)}`);
    const results = [];
    for (const row of rows) {
      const vals = keys.map(k => row[k]);
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${this.escapeId(table)} (${keys.map(k => this.escapeId(k)).join(', ')}) VALUES (${placeholders}) ON CONFLICT (${pks}) DO UPDATE SET ${updateCols.join(', ')}`;
      results.push(await this.query(sql, vals));
    }
    return results[results.length - 1];
  }

  async begin() { await this._client.query('BEGIN'); }
  async commit() { await this._client.query('COMMIT'); }
  async rollback() { await this._client.query('ROLLBACK'); }

  async createDatabase(name) {
    return this.query(`CREATE DATABASE ${this.escapeId(name)}`);
  }
  async dropDatabase(name) { return this.query(`DROP DATABASE ${this.escapeId(name)}`); }
  async dropTable(table) { return this.query(`DROP TABLE ${this.escapeId(table)}`); }
  async truncateTable(table) { return this.query(`TRUNCATE TABLE ${this.escapeId(table)}`); }

  async createSql(table) {
    // Build approximate DDL from information_schema
    const flds = await this.fields(table);
    const idxs = await this.indexes(table);
    const cols = flds.map(f => `  ${this.escapeId(f.name)} ${f.fullType}${!f.nullable ? ' NOT NULL' : ''}${f.default !== null ? ` DEFAULT ${f.default}` : ''}`).join(',\n');
    const pk = idxs.find(i => i.type === 'PRIMARY');
    const pkSql = pk ? `,\n  PRIMARY KEY (${pk.columns.map(c => this.escapeId(c)).join(', ')})` : '';
    return `CREATE TABLE ${this.escapeId(table)} (\n${cols}${pkSql}\n);`;
  }

  async serverInfo() {
    const rows = await this._q('SELECT version() AS v, current_user AS u, current_database() AS db');
    return { version: rows[0].v, user: rows[0].u, db: rows[0].db };
  }

  async variables() {
    const rows = await this._q("SELECT name, setting AS value FROM pg_settings ORDER BY name");
    return rows.map(r => ({ name: r.name, value: r.value }));
  }

  async processList() {
    const rows = await this._q("SELECT pid, usename, application_name, state, query FROM pg_stat_activity WHERE pid <> pg_backend_pid()");
    return rows;
  }

  async killProcess(id) { return this.query(`SELECT pg_terminate_backend($1)`, [id]); }

  async users() {
    const rows = await this._q("SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin FROM pg_roles ORDER BY rolname");
    return rows.map(r => ({ user: r.rolname, ...r }));
  }

  async collations() {
    const rows = await this._q("SELECT collname FROM pg_collation ORDER BY collname LIMIT 200");
    return rows.map(r => r.collname);
  }

  support(feature) { return SUPPORTED.has(feature); }
  escapeId(id) { return `"${String(id).replace(/"/g, '""')}"`; }

  config() {
    return {
      jush: 'pgsql',
      types: {
        'Numbers': ['smallint','integer','bigint','decimal','numeric','real','double precision','smallserial','serial','bigserial'],
        'Date and time': ['date','time','timetz','timestamp','timestamptz','interval'],
        'Strings': ['char','varchar','text'],
        'Binary': ['bytea'],
        'Other': ['boolean','json','jsonb','uuid','xml','point','line','polygon','inet','cidr','macaddr'],
      },
      operators: ['=','<','>','<=','>=','!=','LIKE','ILIKE','~','IS NULL','IS NOT NULL','IN','NOT IN','sql'],
      functions: ['COUNT','SUM','AVG','MIN','MAX','ARRAY_AGG','STRING_AGG'],
      grouping: ['COUNT','SUM','AVG','MIN','MAX','ARRAY_AGG'],
      editFunctions: [['NOW()','CURRENT_TIMESTAMP','gen_random_uuid()'], ['NOW()','CURRENT_TIMESTAMP','gen_random_uuid()','original']],
    };
  }
}

registerDriver('pgsql', 'PostgreSQL', PgSQLDriver);
