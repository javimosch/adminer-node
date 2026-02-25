import { register } from '../router.js';

async function setupDb(req) {
  const db = req.query?.db || req.connInfo?.db || '';
  if (db && req.conn.support('databases')) await req.conn.selectDb(db);
  return db;
}

export function registerEditRoutes() {
  // GET /api/edit/:table — fetch single row by primary key
  register('GET', '/api/edit/:table', async (req, res) => {
    try {
      await setupDb(req);
      const table = req.params.table;
      const q = req.query || {};

      // Build where from query params: where[col]=val
      const where = [];
      if (q.where && typeof q.where === 'object') {
        for (const [col, val] of Object.entries(q.where)) {
          where.push({ col, op: '=', val });
        }
      }

      const fields = await req.conn.fields(table);

      if (where.length) {
        const result = await req.conn.select(table, { where, limit: 1 });
        if (result.error) return res.error(result.error, 400, { code: 'SQL_ERROR' });
        const row = result.rows?.[0] || null;
        return res.json({ table, fields, row });
      }

      res.json({ table, fields, row: null });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });

  // POST /api/edit/:table — insert row
  register('POST', '/api/edit/:table', async (req, res) => {
    try {
      await setupDb(req);
      const table = req.params.table;
      const { data } = req.body || {};
      if (!data || typeof data !== 'object') return res.error('data object required', 400);

      const result = await req.conn.insert(table, data);
      if (result.error) return res.error(result.error, 400, { code: 'SQL_ERROR' });
      res.json({ ok: true, insertId: result.insertId, rowsAffected: result.rowsAffected });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });

  // PUT /api/edit/:table — update row
  register('PUT', '/api/edit/:table', async (req, res) => {
    try {
      await setupDb(req);
      const table = req.params.table;
      const { data, where } = req.body || {};
      if (!data || typeof data !== 'object') return res.error('data object required', 400);
      if (!where || !Array.isArray(where) || !where.length) return res.error('where array required', 400);

      const result = await req.conn.update(table, data, where);
      if (result.error) return res.error(result.error, 400, { code: 'SQL_ERROR' });
      res.json({ ok: true, rowsAffected: result.rowsAffected });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });

  // DELETE /api/edit/:table — delete row(s)
  register('DELETE', '/api/edit/:table', async (req, res) => {
    try {
      await setupDb(req);
      const table = req.params.table;
      const { where } = req.body || {};
      if (!where || !Array.isArray(where) || !where.length) return res.error('where array required', 400);

      const result = await req.conn.delete(table, where);
      if (result.error) return res.error(result.error, 400, { code: 'SQL_ERROR' });
      res.json({ ok: true, rowsAffected: result.rowsAffected });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });
}
