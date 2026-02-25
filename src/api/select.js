import { register } from '../router.js';

async function setupDb(req) {
  const db = req.query?.db || req.connInfo?.db || '';
  if (db && req.conn.support('databases')) await req.conn.selectDb(db);
  return db;
}

export function registerSelectRoutes() {
  // GET /api/select/:table — browse rows with pagination, filtering, sorting
  register('GET', '/api/select/:table', async (req, res) => {
    try {
      await setupDb(req);
      const table = req.params.table;
      const q = req.query || {};
      const limit = Math.min(parseInt(q.limit, 10) || 50, 1000);
      const offset = parseInt(q.offset, 10) || 0;
      const order = q.order || null;
      const dir = q.dir === 'DESC' ? 'DESC' : 'ASC';

      // Build where from query params: where[col][op]=val or where[col]=val
      const where = [];
      if (q.where && typeof q.where === 'object') {
        for (const [col, opOrVal] of Object.entries(q.where)) {
          if (typeof opOrVal === 'object') {
            for (const [op, val] of Object.entries(opOrVal)) {
              if (val !== '' && val !== undefined) where.push({ col, op, val });
            }
          } else if (opOrVal !== '' && opOrVal !== undefined) {
            where.push({ col, op: '=', val: opOrVal });
          }
        }
      }

      const columns = q.columns ? q.columns.split(',').map(c => c.trim()) : ['*'];
      const result = await req.conn.select(table, { columns, where, order, dir, limit, offset });

      if (result.error) return res.error(result.error, 400, { code: 'SQL_ERROR' });

      // Get total count for pagination
      let total = null;
      try {
        const countSql = `SELECT COUNT(*) as cnt FROM ${req.conn.escapeId(table)}`;
        const countRes = await req.conn.query(countSql);
        total = parseInt(countRes.rows?.[0]?.cnt ?? countRes.rows?.[0]?.CNT ?? 0, 10);
      } catch {}

      res.json({ rows: result.rows, fields: result.fields, total, limit, offset });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });

  // POST /api/select/:table — bulk delete
  register('POST', '/api/select/:table', async (req, res) => {
    try {
      await setupDb(req);
      const table = req.params.table;
      const { action, rows: rowKeys = [], primaryKey } = req.body || {};

      if (action === 'delete') {
        if (!rowKeys.length) return res.error('No rows selected', 400);
        if (!primaryKey) return res.error('primaryKey required for delete', 400);
        let deleted = 0;
        for (const keyVal of rowKeys) {
          const result = await req.conn.delete(table, [{ col: primaryKey, op: '=', val: keyVal }]);
          deleted += result.rowsAffected || 0;
        }
        return res.json({ ok: true, deleted });
      }

      res.error('Unknown action', 400);
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });
}
