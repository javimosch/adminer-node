import { register } from '../router.js';

export function registerVariableRoutes() {
  register('GET', '/api/variables', async (req, res) => {
    try {
      if (!req.conn.support('variables')) return res.json({ variables: [] });
      const variables = await req.conn.variables();
      res.json({ variables });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });

  register('GET', '/api/processlist', async (req, res) => {
    try {
      if (!req.conn.support('processlist')) return res.json({ processes: [] });
      const processes = await req.conn.processList();
      res.json({ processes });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });

  register('DELETE', '/api/processlist/:id', async (req, res) => {
    try {
      if (!req.conn.support('kill')) return res.error('Kill not supported', 400);
      await req.conn.killProcess(req.params.id);
      res.json({ ok: true });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });
}
