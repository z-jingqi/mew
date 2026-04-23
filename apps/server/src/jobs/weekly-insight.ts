import { and, eq, gte, lte } from 'drizzle-orm';
import { createDb, schema, type Db } from '@mew/database';
import { generateWeeklyInsight, type InsightExpense } from '@mew/ai-core';
import type { Env } from '../env';

/**
 * Run once per user per week. Idempotent — the insights table has a unique
 * (userId, weekStart) index so reruns overwrite.
 */
export async function runWeeklyInsightForAllUsers(env: Env, now = new Date()): Promise<void> {
  const db = createDb(env.DB);
  const { weekStart, weekEnd } = previousWeekRange(now);
  const users = await db.select({ id: schema.users.id }).from(schema.users);

  for (const u of users) {
    try {
      await runForUser(env, db, u.id, weekStart, weekEnd);
    } catch (err) {
      console.error('[weekly-insight] failed for user', u.id, err);
    }
  }
}

async function runForUser(
  env: Env,
  db: Db,
  userId: string,
  weekStart: string,
  weekEnd: string,
): Promise<void> {
  const rows = await db
    .select({
      spentAt: schema.expenses.spentAt,
      amountCents: schema.expenses.amountCents,
      currency: schema.expenses.currency,
      merchant: schema.expenses.merchant,
      note: schema.expenses.note,
      categoryName: schema.categories.name,
      personName: schema.people.name,
    })
    .from(schema.expenses)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.expenses.categoryId))
    .leftJoin(schema.people, eq(schema.people.id, schema.expenses.personId))
    .where(
      and(
        eq(schema.expenses.userId, userId),
        gte(schema.expenses.spentAt, weekStart),
        lte(schema.expenses.spentAt, weekEnd),
      ),
    );

  if (!rows.length) return; // don't burn a model call on an empty week

  const [userRow] = await db
    .select({ defaultCurrency: schema.users.defaultCurrency })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  const expenses: InsightExpense[] = rows.map((r) => ({
    spent_at: r.spentAt,
    amount_cents: r.amountCents,
    currency: r.currency,
    category: r.categoryName ?? null,
    person: r.personName ?? null,
    merchant: r.merchant ?? null,
    note: r.note ?? null,
  }));

  const { insight, model } = await generateWeeklyInsight(env, {
    weekStart,
    weekEnd,
    defaultCurrency: userRow?.defaultCurrency ?? 'USD',
    expenses,
  });

  const id = crypto.randomUUID();
  // Upsert keyed on (userId, weekStart).
  await db
    .insert(schema.insights)
    .values({
      id,
      userId,
      weekStart,
      weekEnd,
      payload: JSON.stringify(insight),
      provider: model.provider,
      modelId: model.modelId,
    })
    .onConflictDoUpdate({
      target: [schema.insights.userId, schema.insights.weekStart],
      set: {
        weekEnd,
        payload: JSON.stringify(insight),
        provider: model.provider,
        modelId: model.modelId,
      },
    });
}

/**
 * Returns the Mon–Sun ISO dates (YYYY-MM-DD) for the week preceding `now` in UTC.
 * Cron fires Monday 02:00 UTC so we always summarize the just-ended week.
 */
export function previousWeekRange(now: Date): { weekStart: string; weekEnd: string } {
  // getUTCDay: 0=Sun..6=Sat. Normalize to Monday start (1..7).
  const day = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
  const thisMondayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  thisMondayUTC.setUTCDate(thisMondayUTC.getUTCDate() - (day - 1));
  const lastMonday = new Date(thisMondayUTC);
  lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setUTCDate(lastSunday.getUTCDate() + 6);
  return {
    weekStart: toDateString(lastMonday),
    weekEnd: toDateString(lastSunday),
  };
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}
