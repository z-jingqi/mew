import type { ParsedExpense, Currency } from '@mew/shared';
import { api } from './client';
import type {
  Category,
  DashboardSummary,
  Expense,
  ExpenseItem,
  Me,
  ParseResult,
  Person,
} from './types';

/** ---- Auth ---- */
export const authApi = {
  me: () => api<{ user: Me | null }>('/api/auth/me'),
  login: (username: string, password: string) =>
    api<{ user: Me }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string, inviteCode: string) =>
    api<{ user: Me }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, inviteCode }),
    }),
  logout: () => api<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  updateProfile: (patch: { defaultCurrency?: Currency }) =>
    api<{ user: Me }>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(patch) }),
};

/** ---- People ---- */
export const peopleApi = {
  list: () => api<{ people: Person[] }>('/api/people').then((r) => r.people),
  create: (name: string, color?: string | null) =>
    api<{ person: Person }>('/api/people', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),
  update: (id: string, patch: { name?: string; color?: string | null }) =>
    api<{ person: Person }>(`/api/people/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  remove: (id: string) => api(`/api/people/${id}`, { method: 'DELETE' }),
};

/** ---- Categories ---- */
export const categoriesApi = {
  list: () => api<{ categories: Category[] }>('/api/categories').then((r) => r.categories),
  create: (input: Partial<Category> & { name: string }) =>
    api<{ category: Category }>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: Partial<Category>) =>
    api<{ category: Category }>(`/api/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  remove: (id: string) => api(`/api/categories/${id}`, { method: 'DELETE' }),
};

/** ---- Expenses ---- */
export interface CreateExpenseBody {
  amount_cents: number;
  currency: Currency;
  category_id?: string | null;
  category_name?: string | null;
  person_id?: string | null;
  person_name?: string | null;
  merchant?: string | null;
  note?: string | null;
  spent_at: string;
  source?: 'ai' | 'manual';
  items?: Array<{ name: string; amount_cents: number }>;
}

export const expensesApi = {
  parse: (text: string, localDate: string) =>
    api<ParseResult>('/api/expenses/parse', {
      method: 'POST',
      body: JSON.stringify({ text, localDate }),
    }),
  list: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    return api<{ expenses: Expense[] }>(`/api/expenses?${qs.toString()}`).then((r) => r.expenses);
  },
  get: (id: string) => api<{ expense: Expense; items: ExpenseItem[] }>(`/api/expenses/${id}`),
  create: (body: CreateExpenseBody) =>
    api<{ id: string }>('/api/expenses', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, patch: Partial<CreateExpenseBody>) =>
    api<{ ok: true }>(`/api/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id: string) => api(`/api/expenses/${id}`, { method: 'DELETE' }),
};

/** ---- Dashboard ---- */
export const dashboardApi = {
  summary: (from: string, to: string) =>
    api<DashboardSummary>(`/api/dashboard/summary?from=${from}&to=${to}`),
};

export type { ParsedExpense };
