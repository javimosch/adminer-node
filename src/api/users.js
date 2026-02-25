import { register } from '../router.js';

export function registerUserRoutes() {
  register('GET', '/api/users', async (req, res) => {
    try {
      if (!req.conn.support('users')) return res.json({ users: [] });
      const users = await req.conn.users();
      res.json({ users });
    } catch (e) { res.error(e.message, 503, { code: 'DB_ERROR' }); }
  });
}
