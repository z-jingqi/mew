/**
 * @mew/database — Drizzle + Cloudflare D1.
 */

import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Db = DrizzleD1Database<typeof schema>;

export function createDb(d1: D1Database): Db {
  return drizzle(d1, { schema });
}

export * as schema from './schema';
export type {
  User,
  NewUser,
  Session,
  InviteCode,
  Person,
  Category,
  Expense,
  NewExpense,
  ExpenseItem,
  Insight,
} from './schema';
