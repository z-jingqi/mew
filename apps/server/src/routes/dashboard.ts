import { Hono } from 'hono';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createDb, schema } from '@mew/database';
import type { AppContext } from '../env';
import { requireAuth } from '../auth/middleware';

const dashboard = new Hono<AppContext>();
dashboard.use('*', requireAuth);

const Query = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Returns everything the dashboard renders in one round-trip.
 * - totals grouped by currency
 * - by-category (within each currency)
 * - by-person (within each currency)
 * - recent entries
 */
dashboard.get('/summary', async (c) => {
  const parsed = Query.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);

  const user = c.get('user')!;
  const db = createDb(c.env.DB);

  const base = and(
    eq(schema.expenses.userId, user.id),
    gte(schema.expenses.spentAt, parsed.data.from),
    lte(schema.expenses.spentAt, parsed.data.to),
  );

  const [byCurrency, byCategory, byPerson, recent, latestInsight] = await Promise.all([
    db
      .select({
        currency: schema.expenses.currency,
        total: sql<number>`sum(${schema.expenses.amountCents})`.as('total'),
        count: sql<number>`count(*)`.as('count'),
      })
      .from(schema.expenses)
      .where(base)
      .groupBy(schema.expenses.currency),

    db
      .select({
        currency: schema.expenses.currency,
        categoryId: schema.expenses.categoryId,
        categoryName: schema.categories.name,
        categoryIcon: schema.categories.icon,
        total: sql<number>`sum(${schema.expenses.amountCents})`.as('total'),
        count: sql<number>`count(*)`.as('count'),
      })
      .from(schema.expenses)
      .leftJoin(schema.categories, eq(schema.categories.id, schema.expenses.categoryId))
      .where(base)
      .groupBy(schema.expenses.currency, schema.expenses.categoryId),

    db
      .select({
        currency: schema.expenses.currency,
        personId: schema.expenses.personId,
        personName: schema.people.name,
        total: sql<number>`sum(${schema.expenses.amountCents})`.as('total'),
        count: sql<number>`count(*)`.as('count'),
      })
      .from(schema.expenses)
      .leftJoin(schema.people, eq(schema.people.id, schema.expenses.personId))
      .where(base)
      .groupBy(schema.expenses.currency, schema.expenses.personId),

    db
      .select({
        id: schema.expenses.id,
        amountCents: schema.expenses.amountCents,
        currency: schema.expenses.currency,
        merchant: schema.expenses.merchant,
        note: schema.expenses.note,
        spentAt: schema.expenses.spentAt,
        categoryName: schema.categories.name,
        categoryIcon: schema.categories.icon,
        personName: schema.people.name,
      })
      .from(schema.expenses)
      .leftJoin(schema.categories, eq(schema.categories.id, schema.expenses.categoryId))
      .leftJoin(schema.people, eq(schema.people.id, schema.expenses.personId))
      .where(eq(schema.expenses.userId, user.id))
      .orderBy(desc(schema.expenses.spentAt), desc(schema.expenses.createdAt))
      .limit(10),

    db
      .select()
      .from(schema.insights)
      .where(eq(schema.insights.userId, user.id))
      .orderBy(desc(schema.insights.weekStart))
      .limit(1),
  ]);

  const insight = latestInsight[0]
    ? {
        weekStart: latestInsight[0].weekStart,
        weekEnd: latestInsight[0].weekEnd,
        createdAt: latestInsight[0].createdAt,
        ...JSON.parse(latestInsight[0].payload),
      }
    : null;

  return c.json({
    range: { from: parsed.data.from, to: parsed.data.to },
    byCurrency,
    byCategory,
    byPerson,
    recent,
    insight,
  });
});

export default dashboard;
