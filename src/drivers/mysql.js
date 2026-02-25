import { BaseDriver, registerDriver, normalizeField } from './base.js';

const SUPPORTED = new Set([
  'databases', 'routine', 'trigger', 'event', 'processlist', 'users',
  'variables', 'indexes', 'foreign_keys', 'drop_col', 'move_col',
  'comment', 'collation', 'unsigned', 'auto_increment', 'explain',
  'dump', 'multi_query', 'kill',
]);

function parseServer(server, defaultPort) {
  if (!server) return ['127.0.0.1', defaultPort];
  const m = server.match(/^(?:\[([^\]]+)\]|([^:]+))(?::(\d+))?$/);
  if (!m) return [server, defaultPort];
  return [m[1] || m[2], m[3] ? parseInt(m[3], 10) : defaultPort];
}

class MySQLDriver extends BaseDriver {
  constructor() { super(); this._conn = null; }

  async connect(server, username, password) {
    try {
      const mysql = (await import('mysql2/promise')).default;
      const [host, port] = parseServer(server, 3306);
      this._conn = await mysql.createConnection({
        host, port,
        user: username || '',
        password: password || '',
        multipleStatements: true,
        charset: 'UTF8MB4_GENERAL_CI',
        connectTimeout: 10000,
      });
      return null; // success
    } catch (e) {
      return e.message;
    }
  }

  async disconnect() {
    if (this._conn) { try { await this._conn.end(); } catch {} this._conn = null; }
  }

  async selectDb(db) {
    await this._conn.query(`USE ${this.escapeId(db)}`);
  }

  async databases() {
    const [rows] = await this._conn.query('SHOW DATABASES');
    return rows.map(r => r.Database);
  }

  async tablesList(db) {
    const [rows] = await this._conn.query(
      db ? `SHOW FULL TABLES FROM ${this.escapeId(db)}` : 'SHOW FULL TABLES'
    );
    return rows.map(r => {
      const keys = Object.keys(r);
      return { name: r[keys[0]], type: r[keys[1]] === 'VIEW' ? 'view' : 'table' };
    });
  }

  async tableStatus(table, db) {
    const dbPart = db ? `FROM ${this.escapeId(db)} ` : '';
    const [rows] = await this._conn.query(
      `SHOW TABLE STATUS ${dbPart}LIKE ?`, [table]
    );
    return rows[0] || {};
  }

  async fields(table) {
    const [rows] = await this._conn.query(`SHOW FULL COLUMNS FROM ${this.escapeId(table)}`);
    return rows.map(r => normalizeField({
      name: r.Field,
      type: r.Type.toLowerCase().split('(')[0].trim(),
      fullType: r.Type,
      length: (() => { const m = r.Type.match(/\(([^)]+)\)/); return m ? m[1] : ''; })(),
      nullable: r.Null === 'YES',
      default: r.Default,
      autoIncrement: /auto_increment/i.test(r.Extra),
      collation: r.Collation,
      unsigned: /unsigned/i.test(r.Type),
      comment: r.Comment,
      primary: r.Key === 'PRI',
      generated: /GENERATED|VIRTUAL|STORED/i.test(r.Extra),
      privileges: Object.fromEntries(
        ['select','insert','update','references'].map(p => [p, r.Privileges?.includes(p) ?? true])
      ),
    }));
  }

  async indexes(table) {
    const [rows] = await this._conn.query(`SHOW INDEX FROM ${this.escapeId(table)}`);
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.Key_name)) {
        map.set(r.Key_name, {
          name: r.Key_name,
          type: r.Key_name === 'PRIMARY' ? 'PRIMARY' : r.Non_unique === 0 ? 'UNIQUE' : r.Index_type === 'FULLTEXT' ? 'FULLTEXT' : 'INDEX',
          columns: [], lengths: [], descs: [],
        });
      }
      const idx = map.get(r.Key_name);
      idx.columns.push(r.Column_name);
      idx.lengths.push(r.Sub_part || null);
      idx.descs.push(r.Collation === 'D');
    }
    return [...map.values()];
  }

  async foreignKeys(table) {
    const [rows] = await this._conn.query(`
      SELECT kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME, kcu.REFERENCED_TABLE_SCHEMA,
             kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME,
             rc.DELETE_RULE, rc.UPDATE_RULE
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE kcu.TABLE_NAME = ? AND kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
    `, [table]);
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.CONSTRAINT_NAME)) {
        map.set(r.CONSTRAINT_NAME, {
          name: r.CONSTRAINT_NAME, sourceColumns: [],
          targetDb: r.REFERENCED_TABLE_SCHEMA,
          targetTable: r.REFERENCED_TABLE_NAME, targetColumns: [],
          onDelete: r.DELETE_RULE, onUpdate: r.UPDATE_RULE,
        });
      }
      const fk = map.get(r.CONSTRAINT_NAME);
      fk.sourceColumns.push(r.COLUMN_NAME);
      fk.targetColumns.push(r.REFERENCED_COLUMN_NAME);
    }
    return [...map.values()];
  }

  async triggers(table) {
    const [rows] = await this._conn.query('SHOW TRIGGERS LIKE ?', [table]);
    return rows.map(r => ({ name: r.Trigger, event: r.Event, timing: r.Timing, statement: r.Statement }));
  }

  async query(sql, params = []) {
    const t = Date.now();
    try {
      const [rows, fields] = await this._conn.execute(sql, params);
      return {
        rows: Array.isArray(rows) ? rows : [],
        fields: (fields || []).map(f => ({ name: f.name, type: f.type })),
        rowsAffected: rows?.affectedRows ?? 0,
        insertId: rows?.insertId ?? null,
        error: null,
        time: Date.now() - t,
      };
    } catch (e) {
      return { rows: [], fields: [], rowsAffected: 0, insertId: null, error: e.message, time: Date.now() - t };
    }
  }

  async multiQuery(sql) {
    const results = [];
    const t = Date.now();
    try {
      const [rows] = await this._conn.query(sql);
      const sets = Array.isArray(rows[0]) ? rows : [rows];
      for (const set of sets) {
        results.push({ rows: Array.isArray(set) ? set : [], fields: [], rowsAffected: set?.affectedRows ?? 0, insertId: set?.insertId ?? null, error: null, time: Date.now() - t });
      }
    } catch (e) {
      results.push({ rows: [], fields: [], rowsAffected: 0, insertId: null, error: e.message, time: Date.now() - t });
    }
    return results;
  }

  async explain(sql) {
    try {
      const [rows] = await this._conn.query(`EXPLAIN ${sql}`);
      return rows;
    } catch { return null; }
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
    const params = [...Object.values(data), ...where.map(w => w.val)];
    return this.query(`UPDATE ${this.escapeId(table)} SET ${sets} WHERE ${whereSql}`, params);
  }

  async delete(table, where) {
    const whereSql = where.map(w => `${this.escapeId(w.col)} ${w.op || '='} ?`).join(' AND ');
    return this.query(`DELETE FROM ${this.escapeId(table)} WHERE ${whereSql}`, where.map(w => w.val));
  }

  async insertUpdate(table, rows, primaryKeys) {
    if (!rows.length) return { rows: [], rowsAffected: 0, error: null };
    const keys = Object.keys(rows[0]);
    const vals = rows.map(r => keys.map(k => r[k]));
    const updateCols = keys.filter(k => !primaryKeys.includes(k)).map(k => `${this.escapeId(k)}=VALUES(${this.escapeId(k)})`);
    const placeholders = vals.map(v => `(${v.map(() => '?').join(',')})`).join(',');
    const sql = `INSERT INTO ${this.escapeId(table)} (${keys.map(k => this.escapeId(k)).join(',')}) VALUES ${placeholders} ON DUPLICATE KEY UPDATE ${updateCols.join(',')}`;
    return this.query(sql, vals.flat());
  }

  async begin() { await this._conn.beginTransaction(); }
  async commit() { await this._conn.commit(); }
  async rollback() { await this._conn.rollback(); }

  async createDatabase(name, collation) {
    const col = collation ? ` COLLATE ${collation}` : '';
    return this.query(`CREATE DATABASE ${this.escapeId(name)} CHARACTER SET utf8mb4${col}`);
  }

  async dropDatabase(name) {
    return this.query(`DROP DATABASE ${this.escapeId(name)}`);
  }

  async createTable(table, fieldDefs, indexDefs = []) {
    const cols = fieldDefs.map(f => buildColumnDef(f, this)).join(',\n  ');
    const idxs = indexDefs.map(i => buildIndexDef(i, this)).join(',\n  ');
    const defs = [cols, idxs].filter(Boolean).join(',\n  ');
    return this.query(`CREATE TABLE ${this.escapeId(table)} (\n  ${defs}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }

  async dropTable(table) { return this.query(`DROP TABLE ${this.escapeId(table)}`); }
  async truncateTable(table) { return this.query(`TRUNCATE TABLE ${this.escapeId(table)}`); }

  async createSql(table) {
    const [rows] = await this._conn.query(`SHOW CREATE TABLE ${this.escapeId(table)}`);
    return rows[0]?.['Create Table'] || rows[0]?.['Create View'] || '';
  }

  async serverInfo() {
    const [rows] = await this._conn.query('SELECT VERSION() as v, USER() as u, @@character_set_server as cs, @@collation_server as co');
    const r = rows[0];
    return { version: r.v, user: r.u, charset: r.cs, collation: r.co };
  }

  async variables() {
    const [vars] = await this._conn.query('SHOW VARIABLES');
    return vars.map(r => ({ name: r.Variable_name, value: r.Value }));
  }

  async processList() {
    const [rows] = await this._conn.query('SHOW FULL PROCESSLIST');
    return rows;
  }

  async killProcess(id) { return this.query(`KILL ${parseInt(id, 10)}`); }

  async users() {
    try {
      const [rows] = await this._conn.query("SELECT User, Host FROM mysql.user ORDER BY User, Host");
      return rows.map(r => ({ user: r.User, host: r.Host }));
    } catch { return []; }
  }

  async collations() {
    const [rows] = await this._conn.query('SHOW COLLATION');
    return rows.map(r => r.Collation);
  }

  support(feature) { return SUPPORTED.has(feature); }
  escapeId(id) { return `\`${String(id).replace(/`/g, '``')}\``; }

  config() {
    return {
      jush: 'sql',
      types: {
        'Numbers': ['tinyint','smallint','mediumint','int','bigint','decimal','float','double'],
        'Date and time': ['date','time','datetime','timestamp','year'],
        'Strings': ['char','varchar','tinytext','text','mediumtext','longtext'],
        'Binary': ['binary','varbinary','tinyblob','blob','mediumblob','longblob'],
        'Lists': ['enum','set'],
        'Other': ['json','geometry','point','linestring','polygon'],
      },
      operators: ['=','<','>','<=','>=','!=','LIKE','LIKE %%','REGEXP','IS NULL','IS NOT NULL','IN','NOT IN','BETWEEN','sql'],
      functions: ['COUNT','SUM','AVG','MIN','MAX','GROUP_CONCAT','DISTINCT'],
      grouping: ['GROUP_CONCAT','COUNT','SUM','AVG','MIN','MAX'],
      editFunctions: [
        ['MD5','SHA1','PASSWORD','NOW','CURDATE','CURTIME','UNIX_TIMESTAMP','UUID'],
        ['MD5','SHA1','PASSWORD','NOW','CURDATE','CURTIME','UNIX_TIMESTAMP','UUID','original'],
      ],
    };
  }
}

function buildColumnDef(f, driver) {
  let sql = `${driver.escapeId(f.name)} ${f.fullType || f.type}`;
  if (f.unsigned) sql += ' UNSIGNED';
  if (!f.nullable) sql += ' NOT NULL';
  if (f.autoIncrement) sql += ' AUTO_INCREMENT';
  else if (f.default !== null && f.default !== undefined) sql += ` DEFAULT ${quoteDefault(f.default, f.type)}`;
  if (f.comment) sql += ` COMMENT '${f.comment.replace(/'/g, "\\'")}'`;
  return sql;
}

function buildIndexDef(idx, driver) {
  const type = idx.type === 'PRIMARY' ? 'PRIMARY KEY' : `${idx.type === 'UNIQUE' ? 'UNIQUE ' : ''}KEY ${driver.escapeId(idx.name)}`;
  const cols = idx.columns.map((c, i) => `${driver.escapeId(c)}${idx.lengths?.[i] ? `(${idx.lengths[i]})` : ''}`).join(', ');
  return `${type} (${cols})`;
}

function quoteDefault(val, type) {
  if (val === 'NULL') return 'NULL';
  if (/^(int|tinyint|smallint|mediumint|bigint|float|double|decimal)/i.test(type)) return val;
  return `'${val.replace(/'/g, "\\'")}'`;
}

registerDriver('mysql', 'MySQL / MariaDB', MySQLDriver);
