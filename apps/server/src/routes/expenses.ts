import { Hono } from 'hono';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createDb, schema, type Db } from '@mew/database';
import { parseExpense } from '@mew/ai-core';
import {
  ParseExpenseRequestSchema,
  ParsedExpenseSchema,
  SUPPORTED_CURRENCIES,
} from '@mew/shared';

import type { AppContext } from '../env';
import { requireAuth } from '../auth/middleware';

const expenses = new Hono<AppContext>();
expenses.use('*', requireAuth);

/** ---- Parse (AI) ---- */

expenses.post('/parse', async (c) => {
  const parsed = ParseExpenseRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);

  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const [cats, ppl] = await Promise.all([
    db
      .select({ name: schema.categories.name })
      .from(schema.categories)
      .where(eq(schema.categories.userId, user.id)),
    db
      .select({ name: schema.people.name })
      .from(schema.people)
      .where(eq(schema.people.userId, user.id)),
  ]);

  const result = await parseExpense(c.env, {
    text: parsed.data.text,
    localDate: parsed.data.localDate,
    defaultCurrency: user.defaultCurrency,
    categories: cats.map((r) => r.name),
    people: ppl.map((r) => r.name),
  });

  return c.json(result);
});

/** ---- List ---- */

const ListQuery = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

expenses.get('/', async (c) => {
  const parsed = ListQuery.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const user = c.get('user')!;
  const db = createDb(c.env.DB);

  const filters = [eq(schema.expenses.userId, user.id)];
  if (parsed.data.from) filters.push(gte(schema.expenses.spentAt, parsed.data.from));
  if (parsed.data.to) filters.push(lte(schema.expenses.spentAt, parsed.data.to));

  const rows = await db
    .select()
    .from(schema.expenses)
    .where(and(...filters))
    .orderBy(desc(schema.expenses.spentAt), desc(schema.expenses.createdAt))
    .limit(parsed.data.limit);

  const ids = rows.map((r) => r.id);
  const counts = ids.length
    ? await db
        .select({
          expenseId: schema.expenseItems.expenseId,
          count: sql<number>`count(*)`,
        })
        .from(schema.expenseItems)
        .where(inArray(schema.expenseItems.expenseId, ids))
        .groupBy(schema.expenseItems.expenseId)
    : [];
  const countMap = new Map(counts.map((c) => [c.expenseId, Number(c.count)]));

  return c.json({
    expenses: rows.map((r) => ({ ...r, itemCount: countMap.get(r.id) ?? 0 })),
  });
});

expenses.get('/:id', async (c) => {
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const [expense] = await db
    .select()
    .from(schema.expenses)
    .where(and(eq(schema.expenses.id, c.req.param('id')), eq(schema.expenses.userId, user.id)))
    .limit(1);
  if (!expense) return c.json({ error: 'not_found' }, 404);
  const items = await db
    .select()
    .from(schema.expenseItems)
    .where(eq(schema.expenseItems.expenseId, expense.id));
  return c.json({ expense, items });
});

/** ---- Create / update / delete ---- */

const ItemInput = z.object({
  name: z.string().min(1).max(100),
  amount_cents: z.number().int().nonnegative(),
});

const ExpenseBase = z.object({
  amount_cents: z.number().int().nonnegative(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  category_id: z.string().nullable().optional(),
  person_id: z.string().nullable().optional(),
  merchant: z.string().max(100).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  spent_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['ai', 'manual']).default('manual'),
  items: z.array(ItemInput).optional(),
});

const CreateBody = ExpenseBase.extend({
  /** Accept a suggested category name if no id yet — we'll create it. */
  category_name: z.string().max(50).nullable().optional(),
  person_name: z.string().max(50).nullable().optional(),
});

async function resolveCategoryId(
  db: Db,
  userId: string,
  id: string | null | undefined,
  name: string | null | undefined,
): Promise<string | null> {
  if (id) {
    const [row] = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(and(eq(schema.categories.id, id), eq(schema.categories.userId, userId)))
      .limit(1);
    return row?.id ?? null;
  }
  if (name) {
    const trimmed = name.trim();
    const [existing] = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(and(eq(schema.categories.userId, userId), eq(schema.categories.name, trimmed)))
      .limit(1);
    if (existing) return existing.id;
    const newId = crypto.randomUUID();
    await db.insert(schema.categories).values({ id: newId, userId, name: trimmed });
    return newId;
  }
  return null;
}

async function resolvePersonId(
  db: Db,
  userId: string,
  id: string | null | undefined,
  name: string | null | undefined,
): Promise<string | null> {
  if (id) {
    const [row] = await db
      .select({ id: schema.people.id })
      .from(schema.people)
      .where(and(eq(schema.people.id, id), eq(schema.people.userId, userId)))
      .limit(1);
    return row?.id ?? null;
  }
  if (name) {
    const trimmed = name.trim();
    const [existing] = await db
      .select({ id: schema.people.id })
      .from(schema.people)
      .where(and(eq(schema.people.userId, userId), eq(schema.people.name, trimmed)))
      .limit(1);
    if (existing) return existing.id;
    const newId = crypto.randomUUID();
    await db.insert(schema.people).values({ id: newId, userId, name: trimmed });
    return newId;
  }
  return null;
}

expenses.post('/', async (c) => {
  const parsed = CreateBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const user = c.get('user')!;
  const db = createDb(c.env.DB);

  const categoryId = await resolveCategoryId(
    db,
    user.id,
    parsed.data.category_id,
    parsed.data.category_name,
  );
  const personId = await resolvePersonId(
    db,
    user.id,
    parsed.data.person_id,
    parsed.data.person_name,
  );

  const id = crypto.randomUUID();
  await db.insert(schema.expenses).values({
    id,
    userId: user.id,
    amountCents: parsed.data.amount_cents,
    currency: parsed.data.currency,
    categoryId,
    personId,
    merchant: parsed.data.merchant ?? null,
    note: parsed.data.note ?? null,
    spentAt: parsed.data.spent_at,
    source: parsed.data.source,
  });

  if (parsed.data.items?.length) {
    await db.insert(schema.expenseItems).values(
      parsed.data.items.map((it, i) => ({
        id: crypto.randomUUID(),
        expenseId: id,
        name: it.name,
        amountCents: it.amount_cents,
        sortOrder: i,
      })),
    );
  }

  return c.json({ id }, 201);
});

const UpdateBody = CreateBody.partial();

expenses.patch('/:id', async (c) => {
  const parsed = UpdateBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
  const user = c.get('user')!;
  const db = createDb(c.env.DB);

  const [existing] = await db
    .select()
    .from(schema.expenses)
    .where(and(eq(schema.expenses.id, c.req.param('id')), eq(schema.expenses.userId, user.id)))
    .limit(1);
  if (!existing) return c.json({ error: 'not_found' }, 404);

  const updates: Partial<typeof schema.expenses.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.amount_cents !== undefined) updates.amountCents = parsed.data.amount_cents;
  if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency;
  if (parsed.data.merchant !== undefined) updates.merchant = parsed.data.merchant;
  if (parsed.data.note !== undefined) updates.note = parsed.data.note;
  if (parsed.data.spent_at !== undefined) updates.spentAt = parsed.data.spent_at;

  if (parsed.data.category_id !== undefined || parsed.data.category_name !== undefined) {
    updates.categoryId = await resolveCategoryId(
      db,
      user.id,
      parsed.data.category_id,
      parsed.data.category_name,
    );
  }
  if (parsed.data.person_id !== undefined || parsed.data.person_name !== undefined) {
    updates.personId = await resolvePersonId(
      db,
      user.id,
      parsed.data.person_id,
      parsed.data.person_name,
    );
  }

  await db.update(schema.expenses).set(updates).where(eq(schema.expenses.id, existing.id));

  if (parsed.data.items !== undefined) {
    await db.delete(schema.expenseItems).where(eq(schema.expenseItems.expenseId, existing.id));
    if (parsed.data.items.length) {
      await db.insert(schema.expenseItems).values(
        parsed.data.items.map((it, i) => ({
          id: crypto.randomUUID(),
          expenseId: existing.id,
          name: it.name,
          amountCents: it.amount_cents,
          sortOrder: i,
        })),
      );
    }
  }

  return c.json({ ok: true });
});

expenses.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const res = await db
    .delete(schema.expenses)
    .where(and(eq(schema.expenses.id, c.req.param('id')), eq(schema.expenses.userId, user.id)))
    .returning({ id: schema.expenses.id });
  if (!res.length) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});

/** ---- Schema re-export for clients ---- */
export { ParsedExpenseSchema };

export default expenses;
