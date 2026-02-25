// Driver registry
const registry = new Map(); // id → { name, Driver }

export function registerDriver(id, name, Driver) {
  registry.set(id, { name, Driver });
}

export function getDriver(id) {
  return registry.get(id);
}

export function listDrivers() {
  return [...registry.entries()].map(([id, { name }]) => ({ id, name }));
}

/**
 * Abstract base class for all DB drivers.
 * query() returns a result object and does NOT throw on SQL errors — returns error in result.
 */
export class BaseDriver {
  // ── Connection ────────────────────────────────────────────────────────────
  /** Returns null on success, or an error string on failure. */
  async connect(server, username, password) { throw new Error('not implemented'); }
  async disconnect() {}
  async selectDb(db) {}

  // ── Introspection ─────────────────────────────────────────────────────────
  async databases() { throw new Error('not implemented'); }
  async tablesList(db) { throw new Error('not implemented'); }
  async tableStatus(table, db) { return {}; }
  async fields(table) { throw new Error('not implemented'); }
  async indexes(table) { return []; }
  async foreignKeys(table) { return []; }
  async triggers(table) { return []; }
  async collations() { return []; }

  // ── Query execution ───────────────────────────────────────────────────────
  /** Returns: { rows, fields, rowsAffected, insertId, error, time } */
  async query(sql, params = []) { throw new Error('not implemented'); }
  /** Returns: Array of query() result objects. */
  async multiQuery(sql) { throw new Error('not implemented'); }
  async explain(sql) { return null; }

  // ── Higher-level data operations ──────────────────────────────────────────
  async select(table, opts = {}) { throw new Error('not implemented'); }
  async insert(table, data) { throw new Error('not implemented'); }
  async update(table, data, where) { throw new Error('not implemented'); }
  async delete(table, where) { throw new Error('not implemented'); }
  async insertUpdate(table, rows, primaryKeys) { throw new Error('not implemented'); }

  // ── Transactions ──────────────────────────────────────────────────────────
  async begin() {}
  async commit() {}
  async rollback() {}

  // ── Schema operations ─────────────────────────────────────────────────────
  async createDatabase(name, collation) { throw new Error('not implemented'); }
  async dropDatabase(name) { throw new Error('not implemented'); }
  async createTable(table, fields, indexes) { throw new Error('not implemented'); }
  async alterTable(table, changes) { throw new Error('not implemented'); }
  async dropTable(table) { throw new Error('not implemented'); }
  async truncateTable(table) { throw new Error('not implemented'); }
  async alterIndexes(table, add, drop) { throw new Error('not implemented'); }
  async addForeignKey(table, fk) { throw new Error('not implemented'); }
  async dropForeignKey(table, name) { throw new Error('not implemented'); }

  // ── Dump/export ───────────────────────────────────────────────────────────
  async createSql(table) { throw new Error('not implemented'); }

  // ── Server info ───────────────────────────────────────────────────────────
  async serverInfo() { throw new Error('not implemented'); }
  async variables() { return []; }
  async processList() { return []; }
  async killProcess(id) {}
  async users() { return []; }

  // ── Capabilities ──────────────────────────────────────────────────────────
  support(feature) { return false; }

  // ── Driver metadata ───────────────────────────────────────────────────────
  config() {
    return {
      jush: 'sql',
      types: {},
      operators: ['=', '<', '>', '<=', '>=', '!=', 'LIKE', 'IS NULL', 'IS NOT NULL'],
      functions: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
      grouping: ['GROUP_CONCAT'],
      editFunctions: [['NOW()', 'UUID()'], ['NOW()', 'UUID()', 'original']],
    };
  }

  // ── Identifier / value escaping ───────────────────────────────────────────
  escapeId(id) { return `\`${String(id).replace(/`/g, '``')}\``; }
}

// ── Shared field descriptor helpers ──────────────────────────────────────────

/** Normalize a raw field row into the canonical field descriptor shape. */
export function normalizeField(raw) {
  return {
    name: raw.name ?? raw.Field ?? '',
    type: (raw.type ?? raw.Type ?? '').toLowerCase().split('(')[0].trim(),
    fullType: raw.fullType ?? raw.Type ?? '',
    length: raw.length ?? extractLength(raw.Type ?? raw.fullType ?? ''),
    nullable: raw.nullable ?? (raw.Null === 'YES'),
    default: raw.default ?? raw.Default ?? null,
    autoIncrement: raw.autoIncrement ?? /auto_increment/i.test(raw.Extra ?? ''),
    collation: raw.collation ?? raw.Collation ?? null,
    unsigned: raw.unsigned ?? /unsigned/i.test(raw.Type ?? ''),
    comment: raw.comment ?? raw.Comment ?? '',
    primary: raw.primary ?? (raw.Key === 'PRI'),
    generated: raw.generated ?? /GENERATED|VIRTUAL|STORED/i.test(raw.Extra ?? ''),
    privileges: raw.privileges ?? { select: true, insert: true, update: true, references: true },
  };
}

function extractLength(fullType) {
  const m = fullType.match(/\(([^)]+)\)/);
  return m ? m[1] : '';
}
