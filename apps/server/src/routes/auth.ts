import { Hono } from 'hono';
import { and, eq, isNull, or, gt } from 'drizzle-orm';
import { z } from 'zod';
import { createDb, schema } from '@mew/database';
import { SUPPORTED_CURRENCIES } from '@mew/shared';

import type { AppContext } from '../env';
import { hashPassword, randomSalt, verifyPassword } from '../auth/crypto';
import {
  buildClearSessionCookie,
  buildSessionCookie,
  createSession,
  deleteSession,
  readSessionCookie,
} from '../auth/session';
import { seedDefaultCategories } from '../auth/seed';
import { requireAuth } from '../auth/middleware';

const usernameSchema = z.string().regex(/^[a-zA-Z0-9_]{3,20}$/);
const passwordSchema = z.string().min(6).max(200);

const RegisterBody = z.object({
  username: usernameSchema,
  password: passwordSchema,
  inviteCode: z.string().min(4).max(40),
});

// Login accepts any non-empty strings. Registration-style validation
// (regex, length) runs at signup; on login we always fall through to the
// DB lookup and return 401 for misses so we don't leak credential rules.
const LoginBody = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

const DeleteAccountBody = z.object({
  password: passwordSchema,
});

const auth = new Hono<AppContext>();

function isHttps(req: Request): boolean {
  return new URL(req.url).protocol === 'https:';
}

function userDto(u: schema.User) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    defaultCurrency: u.defaultCurrency,
    createdAt: u.createdAt,
  };
}

auth.post('/register', async (c) => {
  const parsed = RegisterBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const { username, password, inviteCode } = parsed.data;

  const db = createDb(c.env.DB);

  // Validate invite.
  const now = new Date();
  const [invite] = await db
    .select()
    .from(schema.inviteCodes)
    .where(
      and(
        eq(schema.inviteCodes.code, inviteCode),
        isNull(schema.inviteCodes.usedBy),
        or(isNull(schema.inviteCodes.expiresAt), gt(schema.inviteCodes.expiresAt, now)),
      ),
    )
    .limit(1);
  if (!invite) return c.json({ error: 'invalid_invite' }, 400);

  // Username uniqueness check (also enforced at DB level).
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);
  if (existing.length) return c.json({ error: 'username_taken' }, 409);

  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const userId = crypto.randomUUID();

  await db.insert(schema.users).values({
    id: userId,
    username,
    passwordHash,
    salt,
    role: 'user',
    defaultCurrency: 'USD',
  });

  await db
    .update(schema.inviteCodes)
    .set({ usedBy: userId, usedAt: now })
    .where(eq(schema.inviteCodes.id, invite.id));

  await seedDefaultCategories(db, userId);

  const session = await createSession(db, userId);
  c.header('set-cookie', buildSessionCookie(session.id, session.expiresAt, isHttps(c.req.raw)));

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return c.json({ user: user ? userDto(user) : null });
});

auth.post('/login', async (c) => {
  const parsed = LoginBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const { username, password } = parsed.data;

  const db = createDb(c.env.DB);
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);
  if (!user) return c.json({ error: 'invalid_credentials' }, 401);

  const ok = await verifyPassword(password, user.salt, user.passwordHash);
  if (!ok) return c.json({ error: 'invalid_credentials' }, 401);

  const session = await createSession(db, user.id);
  c.header('set-cookie', buildSessionCookie(session.id, session.expiresAt, isHttps(c.req.raw)));
  return c.json({ user: userDto(user) });
});

auth.post('/logout', async (c) => {
  const token = readSessionCookie(c.req.header('cookie'));
  if (token) {
    const db = createDb(c.env.DB);
    await deleteSession(db, token);
  }
  c.header('set-cookie', buildClearSessionCookie(isHttps(c.req.raw)));
  return c.json({ ok: true });
});

auth.get('/me', requireAuth, (c) => {
  const user = c.get('user')!;
  return c.json({ user: userDto(user) });
});

auth.patch('/me', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z
    .object({ defaultCurrency: z.enum(SUPPORTED_CURRENCIES).optional() })
    .safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const now = new Date();
  const [updated] = await db
    .update(schema.users)
    .set({ ...parsed.data, updatedAt: now })
    .where(eq(schema.users.id, user.id))
    .returning();
  return c.json({ user: updated ? userDto(updated) : null });
});

auth.delete('/account', requireAuth, async (c) => {
  const parsed = DeleteAccountBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const user = c.get('user')!;
  const ok = await verifyPassword(parsed.data.password, user.salt, user.passwordHash);
  if (!ok) return c.json({ error: 'invalid_credentials' }, 401);

  const db = createDb(c.env.DB);
  // Cascades handle sessions, people, categories, expenses, etc.
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  c.header('set-cookie', buildClearSessionCookie(isHttps(c.req.raw)));
  return c.json({ ok: true });
});

export default auth;
