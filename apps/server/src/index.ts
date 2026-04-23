import { Hono } from 'hono';

import type { AppContext, Env } from './env';
import auth from './routes/auth';
import admin from './routes/admin';
import expenses from './routes/expenses';
import people from './routes/people';
import categories from './routes/categories';
import dashboard from './routes/dashboard';
import { runWeeklyInsightForAllUsers } from './jobs/weekly-insight';

const app = new Hono<AppContext>();

app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'mew-server', ts: new Date().toISOString() }),
);

app.route('/api/auth', auth);
app.route('/api/admin', admin);
app.route('/api/expenses', expenses);
app.route('/api/people', people);
app.route('/api/categories', categories);
app.route('/api/dashboard', dashboard);

app.onError((err, c) => {
  console.error('unhandled', err);
  return c.json({ error: 'internal_error', message: err.message }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runWeeklyInsightForAllUsers(env));
  },
};
