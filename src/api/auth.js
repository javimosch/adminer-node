import { register } from '../router.js';
import { loginHandler, logoutHandler } from '../auth.js';
import { listDrivers } from '../drivers/base.js';

export function registerAuthRoutes(config) {
  register('POST', '/api/auth/login',  (req, res) => loginHandler(req, res, config));
  register('POST', '/api/auth/logout', (req, res) => logoutHandler(req, res));
  register('GET',  '/api/drivers',     (_req, res) => res.json(listDrivers()));
}
