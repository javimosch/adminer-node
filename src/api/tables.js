import { register } from '../router.js';

export function registerTableRoutes() {
  // List tables
  register('GET', '/api/tables', async (req, res) => {
    try {
      const db = req.query?.db || req.connInfo?.db || '';
      if (db && req.conn.support('databases')) await req.conn.selectDb(db);
      const tables = await req.conn.tablesList(db);
      res.json({ tables });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });

  // Get table structure
  register('GET', '/api/table/:name', async (req, res) => {
    try {
      const db = req.query?.db || req.connInfo?.db || '';
      if (db && req.conn.support('databases')) await req.conn.selectDb(db);
      const table = req.params.name;
      const [fields, indexes, foreignKeys, status] = await Promise.all([
        req.conn.fields(table),
        req.conn.indexes(table),
        req.conn.foreignKeys(table),
        req.conn.tableStatus(table, db),
      ]);
      res.json({ table, fields, indexes, foreignKeys, status });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });

  // Create table
  register('POST', '/api/table', async (req, res) => {
    try {
      const db = req.query?.db || req.connInfo?.db || '';
      if (db && req.conn.support('databases')) await req.conn.selectDb(db);
      const { name, fields = [], indexes = [] } = req.body || {};
      if (!name) return res.error('name is required', 400);
      const result = await req.conn.createTable(name, fields, indexes);
      if (result.error) return res.error(result.error, 400, { code: 'SQL_ERROR' });
      res.json({ ok: true, name });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });

  // Drop table
  register('DELETE', '/api/table/:name', async (req, res) => {
    try {
      const db = req.query?.db || req.connInfo?.db || '';
      if (db && req.conn.support('databases')) await req.conn.selectDb(db);
      const result = await req.conn.dropTable(req.params.name);
      if (result.error) return res.error(result.error, 400, { code: 'SQL_ERROR' });
      res.json({ ok: true });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });

  // Truncate table
  register('POST', '/api/table/:name/truncate', async (req, res) => {
    try {
      const db = req.query?.db || req.connInfo?.db || '';
      if (db && req.conn.support('databases')) await req.conn.selectDb(db);
      const result = await req.conn.truncateTable(req.params.name);
      if (result.error) return res.error(result.error, 400, { code: 'SQL_ERROR' });
      res.json({ ok: true });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });

  // Get DDL (CREATE TABLE SQL)
  register('GET', '/api/table/:name/sql', async (req, res) => {
    try {
      const db = req.query?.db || req.connInfo?.db || '';
      if (db && req.conn.support('databases')) await req.conn.selectDb(db);
      const sql = await req.conn.createSql(req.params.name);
      res.json({ sql });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });
}
