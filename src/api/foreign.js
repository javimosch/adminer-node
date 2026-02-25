import { register } from '../router.js';

async function setupDb(req) {
  const db = req.query?.db || req.connInfo?.db || '';
  if (db && req.conn.support('databases')) await req.conn.selectDb(db);
}

export function registerForeignRoutes() {
  register('GET', '/api/foreign/:table', async (req, res) => {
    try {
      await setupDb(req);
      const fks = await req.conn.foreignKeys(req.params.table);
      res.json({ foreignKeys: fks });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });

  register('POST', '/api/foreign/:table', async (req, res) => {
    try {
      await setupDb(req);
      const table = req.params.table;
      const { action, fk, name } = req.body || {};
      if (!req.conn.support('foreign_keys')) return res.error('Foreign keys not supported', 400);

      if (action === 'drop') {
        if (!name) return res.error('name required', 400);
        const result = await req.conn.dropForeignKey(table, name);
        if (result?.error) return res.error(result.error, 400, { code: 'SQL_ERROR' });
        return res.json({ ok: true });
      }

      if (!fk) return res.error('fk object required', 400);
      const result = await req.conn.addForeignKey(table, fk);
      if (result?.error) return res.error(result.error, 400, { code: 'SQL_ERROR' });
      res.json({ ok: true });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });
}
