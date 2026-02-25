import { register } from '../router.js';

async function setupDb(req) {
  const db = req.query?.db || req.connInfo?.db || '';
  if (db && req.conn.support('databases')) await req.conn.selectDb(db);
  return db;
}

export function registerIndexRoutes() {
  register('GET', '/api/indexes/:table', async (req, res) => {
    try {
      await setupDb(req);
      const indexes = await req.conn.indexes(req.params.table);
      res.json({ indexes });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });

  register('POST', '/api/indexes/:table', async (req, res) => {
    try {
      await setupDb(req);
      const table = req.params.table;
      const { add = [], drop = [] } = req.body || {};
      if (!req.conn.support('indexes')) return res.error('Indexes not supported', 400);
      const result = await req.conn.alterIndexes(table, add, drop);
      if (result?.error) return res.error(result.error, 400, { code: 'SQL_ERROR' });
      res.json({ ok: true });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });
}
