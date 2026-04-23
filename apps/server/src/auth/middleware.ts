import type { MiddlewareHandler } from 'hono';
import { createDb } from '@mew/database';
import type { AppContext } from '../env';
import {
  buildSessionCookie,
  lookupSession,
  readSessionCookie,
} from './session';

export const requireAuth: MiddlewareHandler<AppContext> = async (c, next) => {
  const token = readSessionCookie(c.req.header('cookie'));
  if (!token) return c.json({ error: 'unauthenticated' }, 401);

  const db = createDb(c.env.DB);
  const hit = await lookupSession(db, token);
  if (!hit) return c.json({ error: 'unauthenticated' }, 401);

  c.set('user', hit.user);

  if (hit.renewed) {
    const url = new URL(c.req.url);
    const isHttps = url.protocol === 'https:';
    c.header('set-cookie', buildSessionCookie(hit.session.id, hit.session.expiresAt, isHttps));
  }

  await next();
};

export const requireAdmin: MiddlewareHandler<AppContext> = async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'forbidden' }, 403);
  }
  await next();
};

/**
 * Pre-shared-key guard for endpoints used before any admin exists
 * (bootstrap, invite minting from CLI/scripts).
 */
export const requireAdminKey: MiddlewareHandler<AppContext> = async (c, next) => {
  const expected = c.env.ADMIN_API_KEY;
  if (!expected) return c.json({ error: 'admin_key_not_configured' }, 503);
  const got = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (got !== expected) return c.json({ error: 'forbidden' }, 403);
  await next();
};
