import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

/** ---- Users & auth ---- */

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    salt: text('salt').notNull(),
    role: text('role', { enum: ['admin', 'user'] })
      .notNull()
      .default('user'),
    defaultCurrency: text('default_currency').notNull().default('USD'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    usernameIdx: uniqueIndex('users_username_unique').on(t.username),
  }),
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    lastActiveAt: integer('last_active_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
    expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
  }),
);

export const inviteCodes = sqliteTable(
  'invite_codes',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    usedBy: text('used_by').references(() => users.id, { onDelete: 'set null' }),
    usedAt: integer('used_at', { mode: 'timestamp_ms' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    codeIdx: uniqueIndex('invite_codes_code_unique').on(t.code),
  }),
);

/** ---- People & categories ---- */

export const people = sqliteTable(
  'people',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userNameIdx: uniqueIndex('people_user_name_unique').on(t.userId, t.name),
  }),
);

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon'),
    color: text('color'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userNameIdx: uniqueIndex('categories_user_name_unique').on(t.userId, t.name),
  }),
);

/** ---- Expenses ---- */

export const expenses = sqliteTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    personId: text('person_id').references(() => people.id, { onDelete: 'set null' }),
    merchant: text('merchant'),
    note: text('note'),
    spentAt: text('spent_at').notNull(), // YYYY-MM-DD in user local TZ
    source: text('source', { enum: ['ai', 'manual'] })
      .notNull()
      .default('manual'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userSpentIdx: index('expenses_user_spent_idx').on(t.userId, t.spentAt),
    userCategoryIdx: index('expenses_user_category_idx').on(t.userId, t.categoryId),
    userPersonIdx: index('expenses_user_person_idx').on(t.userId, t.personId),
  }),
);

export const expenseItems = sqliteTable(
  'expense_items',
  {
    id: text('id').primaryKey(),
    expenseId: text('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    amountCents: integer('amount_cents').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({
    expenseIdx: index('expense_items_expense_idx').on(t.expenseId),
  }),
);

/** ---- AI artefacts ---- */

export const insights = sqliteTable(
  'insights',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weekStart: text('week_start').notNull(), // YYYY-MM-DD
    weekEnd: text('week_end').notNull(), // YYYY-MM-DD
    payload: text('payload').notNull(), // JSON-encoded WeeklyInsight
    provider: text('provider'),
    modelId: text('model_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userWeekIdx: uniqueIndex('insights_user_week_unique').on(t.userId, t.weekStart),
  }),
);

export const appConfig = sqliteTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** ---- Type exports ---- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type Person = typeof people.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type ExpenseItem = typeof expenseItems.$inferSelect;
export type Insight = typeof insights.$inferSelect;
