import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createDb, schema } from '@mew/database';
import type { AppContext } from '../env';
import { requireAuth } from '../auth/middleware';

const Body = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(8).nullable().optional(),
  color: z.string().max(16).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const categories = new Hono<AppContext>();
categories.use('*', requireAuth);

categories.get('/', async (c) => {
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.userId, user.id))
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name));
  return c.json({ categories: rows });
});

categories.post('/', async (c) => {
  const parsed = Body.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const row = {
    id: crypto.randomUUID(),
    userId: user.id,
    name: parsed.data.name.trim(),
    icon: parsed.data.icon ?? null,
    color: parsed.data.color ?? null,
    sortOrder: parsed.data.sortOrder ?? 0,
  };
  try {
    await db.insert(schema.categories).values(row);
  } catch {
    return c.json({ error: 'conflict' }, 409);
  }
  return c.json({ category: row }, 201);
});

categories.patch('/:id', async (c) => {
  const parsed = Body.partial().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const [row] = await db
    .update(schema.categories)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon } : {}),
      ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
      ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
    })
    .where(and(eq(schema.categories.id, c.req.param('id')), eq(schema.categories.userId, user.id)))
    .returning();
  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json({ category: row });
});

categories.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const res = await db
    .delete(schema.categories)
    .where(and(eq(schema.categories.id, c.req.param('id')), eq(schema.categories.userId, user.id)))
    .returning({ id: schema.categories.id });
  if (!res.length) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});

export default categories;
