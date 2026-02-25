import { register } from '../router.js';

export function registerDatabaseRoutes() {
  register('GET', '/api/databases', async (req, res) => {
    try {
      const dbs = await req.conn.databases();
      res.json({ databases: dbs });
    } catch (e) {
      res.error(e.message, 503, { code: 'DB_ERROR' });
    }
  });

  register('POST', '/api/databases', async (req, res) => {
    const { name, collation } = req.body || {};
    if (!name) return res.error('name is required', 400);
    const result = await req.conn.createDatabase(name, collation || '');
    if (result.error) return res.error(result.error, 400, { code: 'SQL_ERROR' });
    res.json({ ok: true, name });
  });

  register('DELETE', '/api/databases/:db', async (req, res) => {
    const result = await req.conn.dropDatabase(req.params.db);
    if (result.error) return res.error(result.error, 400, { code: 'SQL_ERROR' });
    res.json({ ok: true });
  });
}
