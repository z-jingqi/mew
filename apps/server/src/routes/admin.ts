import { Hono } from 'hono';
import { eq, lt } from 'drizzle-orm';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { createDb, schema } from '@mew/database';

import type { AppContext } from '../env';
import { hashPassword, randomInviteCode, randomSalt } from '../auth/crypto';
import { seedDefaultCategories } from '../auth/seed';
import { requireAdminKey } from '../auth/middleware';

const SetupBody = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/),
  password: z.string().min(6).max(200),
});

const MintInviteCodesBody = z.object({
  count: z.number().int().min(1).max(50).default(1),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

const admin = new Hono<AppContext>();

// All admin endpoints are gated by ADMIN_API_KEY (Bearer).
admin.use('*', requireAdminKey);

/**
 * POST /api/admin/setup — one-shot. Creates the first admin user.
 * Errors if any admin already exists.
 */
admin.post('/setup', async (c) => {
  const parsed = SetupBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);

  const db = createDb(c.env.DB);
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, 'admin'))
    .limit(1);
  if (existing) return c.json({ error: 'admin_already_exists' }, 409);

  const salt = randomSalt();
  const passwordHash = await hashPassword(parsed.data.password, salt);
  const id = crypto.randomUUID();
  await db.insert(schema.users).values({
    id,
    username: parsed.data.username,
    passwordHash,
    salt,
    role: 'admin',
  });
  await seedDefaultCategories(db, id);
  return c.json({ ok: true, userId: id });
});

/**
 * POST /api/admin/invite-codes — mint one or more invite codes.
 */
admin.post('/invite-codes', async (c) => {
  const parsed = MintInviteCodesBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);

  const db = createDb(c.env.DB);
  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  const rows = Array.from({ length: parsed.data.count }, () => ({
    id: crypto.randomUUID(),
    code: randomInviteCode(),
    expiresAt,
  }));
  await db.insert(schema.inviteCodes).values(rows);
  return c.json({ codes: rows.map((r) => r.code), expiresAt });
});

/**
 * GET /api/admin/invite-codes — list codes (newest first) for audit.
 */
admin.get('/invite-codes', async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(schema.inviteCodes)
    .orderBy(desc(schema.inviteCodes.createdAt))
    .limit(200);
  return c.json({ codes: rows });
});

/**
 * POST /api/admin/cleanup-sessions — prune expired session rows.
 */
admin.post('/cleanup-sessions', async (c) => {
  const db = createDb(c.env.DB);
  const now = new Date();
  const deleted = await db
    .delete(schema.sessions)
    .where(lt(schema.sessions.expiresAt, now))
    .returning({ id: schema.sessions.id });
  return c.json({ removed: deleted.length });
});

export default admin;
