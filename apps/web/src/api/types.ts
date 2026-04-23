import type { ParsedExpense, WeeklyInsight, Currency } from '@mew/shared';

export interface Me {
  id: string;
  username: string;
  role: 'admin' | 'user';
  defaultCurrency: Currency;
  createdAt: number;
}

export interface Person {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  createdAt: number;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  createdAt: number;
}

export interface Expense {
  id: string;
  userId: string;
  amountCents: number;
  currency: string;
  categoryId: string | null;
  personId: string | null;
  merchant: string | null;
  note: string | null;
  spentAt: string;
  source: 'ai' | 'manual';
  createdAt: number;
  updatedAt: number;
  itemCount?: number;
}

export interface ExpenseItem {
  id: string;
  expenseId: string;
  name: string;
  amountCents: number;
  sortOrder: number;
}

export interface ParseResult {
  expense: ParsedExpense;
  model: { provider: string; modelId: string };
}

export interface DashboardSummary {
  range: { from: string; to: string };
  byCurrency: Array<{ currency: string; total: number; count: number }>;
  byCategory: Array<{
    currency: string;
    categoryId: string | null;
    categoryName: string | null;
    categoryIcon: string | null;
    total: number;
    count: number;
  }>;
  byPerson: Array<{
    currency: string;
    personId: string | null;
    personName: string | null;
    total: number;
    count: number;
  }>;
  recent: Array<{
    id: string;
    amountCents: number;
    currency: string;
    merchant: string | null;
    note: string | null;
    spentAt: string;
    categoryName: string | null;
    categoryIcon: string | null;
    personName: string | null;
  }>;
  insight:
    | (WeeklyInsight & { weekStart: string; weekEnd: string; createdAt: number })
    | null;
}
