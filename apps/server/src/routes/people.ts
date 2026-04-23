import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createDb, schema } from '@mew/database';
import type { AppContext } from '../env';
import { requireAuth } from '../auth/middleware';

const Body = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(16).nullable().optional(),
});

const people = new Hono<AppContext>();
people.use('*', requireAuth);

people.get('/', async (c) => {
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(schema.people)
    .where(eq(schema.people.userId, user.id))
    .orderBy(asc(schema.people.name));
  return c.json({ people: rows });
});

people.post('/', async (c) => {
  const parsed = Body.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const row = {
    id: crypto.randomUUID(),
    userId: user.id,
    name: parsed.data.name.trim(),
    color: parsed.data.color ?? null,
  };
  try {
    await db.insert(schema.people).values(row);
  } catch {
    return c.json({ error: 'conflict' }, 409);
  }
  return c.json({ person: row }, 201);
});

people.patch('/:id', async (c) => {
  const parsed = Body.partial().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const [row] = await db
    .update(schema.people)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
    })
    .where(and(eq(schema.people.id, c.req.param('id')), eq(schema.people.userId, user.id)))
    .returning();
  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json({ person: row });
});

people.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const res = await db
    .delete(schema.people)
    .where(and(eq(schema.people.id, c.req.param('id')), eq(schema.people.userId, user.id)))
    .returning({ id: schema.people.id });
  if (!res.length) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});

export default people;
