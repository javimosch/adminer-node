import { register } from '../router.js';

async function setupDb(req) {
  const db = req.query?.db || req.connInfo?.db || '';
  if (db && req.conn.support('databases')) await req.conn.selectDb(db);
  return db;
}

export function registerSqlRoutes() {
  // POST /api/sql — execute SQL statement(s)
  register('POST', '/api/sql', async (req, res) => {
    try {
      await setupDb(req);
      const { sql, limit = 1000 } = req.body || {};
      if (!sql || typeof sql !== 'string') return res.error('sql is required', 400);

      // Use multiQuery for multi-statement support
      const results = await req.conn.multiQuery(sql.trim());

      // Cap row counts per result set
      const capped = results.map(r => ({
        ...r,
        rows: r.rows?.slice(0, parseInt(limit, 10) || 1000),
      }));

      res.json({ results: capped });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });

  // POST /api/sql/explain — EXPLAIN a query
  register('POST', '/api/sql/explain', async (req, res) => {
    try {
      await setupDb(req);
      const { sql } = req.body || {};
      if (!sql) return res.error('sql is required', 400);
      if (!req.conn.support('explain')) return res.error('EXPLAIN not supported', 400);
      const rows = await req.conn.explain(sql.trim());
      res.json({ rows });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });
}
