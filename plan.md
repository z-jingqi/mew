# Mew — Plan

Personal finance / expense tracker with AI-first UX. Subdomain of `aleph-cat.com`.

## Vision

No forms. The user tells the AI what they spent (typed or spoken), the AI parses it into structured data, a one-tap chip confirms. Dashboards review history and habits. AI also generates weekly insights.

## MVP scope

In:
- Account + login (username/password, invite-code-gated registration)
- Natural-language expense entry → AI parse → confirm chip
- Manual edit of any field after parse
- Expense list, edit, delete
- Optional line items per expense (descriptive breakdown)
- User-scoped people tags (optional per expense, "like a tag")
- User-scoped categories (seeded defaults, user can add/edit)
- Multi-currency (per-expense `currency` field, user `default_currency`)
- Dashboard: month total, by-category, by-person, recent entries, per-currency subtotals
- Weekly AI insight (cron → Claude summary, stored and shown)
- Responsive web (desktop + mobile browser) deployed as PWA

Out (post-MVP):
- Native iOS app (shares backend when built)
- Budgets, recurring-expense detection, subscription tracking
- Receipts / OCR
- Sharing between accounts (households, splits)
- Per-line-item person/category tagging
- Many-to-many person tags on one expense

## Tech stack

| Layer | Choice |
|---|---|
| Package manager | pnpm |
| Monorepo | Turborepo |
| Frontend | React 19 + Vite + TypeScript |
| Routing | TanStack Router |
| Data fetching | TanStack Query |
| UI | Tailwind v4 + shadcn/Radix |
| AI client | `ai` + `@ai-sdk/react` |
| Backend | Hono on Cloudflare Workers |
| DB | Cloudflare D1 + Drizzle ORM |
| Object storage | Cloudflare R2 (avatars, future receipts) |
| Auth | Custom — PBKDF2 password hashing + session cookie + invite codes |
| AI providers | Vercel AI SDK with OpenRouter, Anthropic (Claude), Cloudflare Workers AI |
| Frontend deploy | Cloudflare Pages |
| Backend deploy | Cloudflare Workers |

### AI model routing

Runtime `ModelResolver` with fallback chain `user override → tier config → DB default → env var → hardcoded`, configured via the D1 `app_config` table. Lets us switch providers or models at runtime without a redeploy.

Default lineup for MVP:
- **Entry parsing (fast, cheap)** — OpenRouter `google/gemini-2.5-flash` (~$0.30/M in)
- **Weekly insights (higher quality)** — Anthropic `claude-sonnet-4-6`
- **Free tier fallback** — Cloudflare Workers AI `llama-3.3-70b-instruct-fp8-fast` or OpenRouter `:free` models

## Repo layout

```
Mew/
  apps/
    server/          Hono + Cloudflare Workers (API)
    web/             React + Vite (Cloudflare Pages)
  packages/
    ai-core/         Vercel AI SDK + provider registry + model resolver
    database/        Drizzle schema, migrations, D1 client
    shared/          Zod schemas + TS types shared across apps
  docs/
    model-configuration.md
  plan.md
  turbo.json
  pnpm-workspace.yaml
  package.json
```

## Data model (D1 + Drizzle)

All tables scoped by `user_id` unless noted. Amounts in integer cents.

```
users                id, username, password_hash, salt, role (admin|user),
                     default_currency, created_at, updated_at
sessions             id (= token), user_id, expires_at, last_active_at, created_at
invite_codes         id, code, created_by, used_by (nullable), used_at,
                     expires_at (nullable), created_at

people               id, user_id, name, color, created_at
categories           id, user_id, name, icon, color, sort_order, created_at

expenses
  id, user_id,
  amount_cents, currency,
  category_id (nullable, FK),
  person_id   (nullable, FK),
  merchant, note,
  spent_at, source (ai | manual),
  created_at, updated_at

expense_items                  line items — descriptive breakdown only for MVP
  id, expense_id,
  name, amount_cents,
  sort_order
  -- no category_id / person_id yet; inherit from parent at display time

ai_messages          id, user_id, role, content, created_at  (optional chat history)

app_config           key, value (JSON), updated_at    -- global, for ModelResolver
```

Semantics:
- Parent `expenses.amount_cents` is authoritative. Items don't have to sum to parent (tax/tip/unitemized).
- All queries filter by `user_id` via Hono middleware that resolves it from the session cookie.
- Currency is per-expense. Reports show per-currency subtotals, no FX conversion in MVP.

## AI flow

### Entry parse (`POST /api/expenses/parse`)

Input: `{ text: string, localDate: string }` plus server-injected context (user's people list, categories, default currency).

Claude/OpenRouter returns structured JSON via `generateObject`:

```ts
{
  amount: number            // cents
  currency: string          // ISO 4217
  merchant: string | null
  category: string | null   // matched to existing or suggested new
  person: string | null     // matched to existing or suggested new
  spent_at: string          // ISO date
  note: string | null
  items: Array<{ name: string, amount: number }>  // optional
}
```

Frontend shows a confirm chip. Unknown person/category surfaces an "Add X?" one-tap action. User can edit any field.

### Weekly insight (Cloudflare cron trigger)

Runs weekly per user. Pulls last 7 days of expenses, sends to Claude with a summary prompt, stores result in `ai_messages` (or a dedicated `insights` table). Dashboard shows latest.

## Auth

Custom auth running entirely on D1 + Web Crypto. No third-party auth provider.

**Password hashing** — PBKDF2-SHA256, 100,000 iterations, 256-bit derived key, 128-bit random salt. Stored base64. Verification uses constant-time comparison.

**Sessions** — on login, generate a 32-byte random hex token, insert into `sessions` with 30-day expiry, set as `session` cookie (httpOnly, sameSite=Lax, secure-when-https). Each request validates the cookie against the table. Sliding renewal: if <29 days remain, extend expiry and refresh cookie.

**Invite-code gated registration** — `POST /api/auth/register` requires a valid, unused `invite_codes.code`. On success, mark the invite used. Admin mints codes via an authenticated endpoint. Prevents open signup.

**Roles** — `admin` and `user`. First admin bootstrapped via a one-time setup endpoint (errors if an admin already exists).

**Routes**
- `POST /api/auth/register` — username, password, invite code
- `POST /api/auth/login` — username, password → sets cookie
- `POST /api/auth/logout` — clears cookie and deletes session row
- `GET  /api/auth/me` — returns current user
- `DELETE /api/auth/account` — requires password re-entry

**Middleware** — runs on all `/api/*` except `/api/auth/login`, `/api/auth/register`, `/health`. Reads the cookie, validates the session, attaches `userId` and `user` to Hono context, handles sliding renewal.

**Username, not email** — usernames are 3–20 chars, `[a-zA-Z0-9_]`. Keeps the MVP minimal (no email verification flow). Email + OAuth (Google/Apple) can be added later without breaking the scheme.

## Build order

1. **Scaffold** — init pnpm + Turborepo monorepo; wire `wrangler`, `turbo.json`, shared `tsconfig`, eslint, prettier; create empty `apps/{server,web}` and `packages/{ai-core,database,shared}`. Confirm `pnpm dev` boots web + server together.
2. **DB + Auth** — Drizzle schema for `users`, `sessions`, `invite_codes`; first D1 migration; PBKDF2 + session-cookie auth service; invite-gated register, login, logout, me, delete-account routes; auth middleware; admin bootstrap + invite-code endpoints; login/register UI with invite-code field.
3. **People + Categories** — CRUD routes and UI; seed default categories on signup; basic settings page for profile + default currency.
4. **Expense CRUD** — `GET/POST/PATCH/DELETE /api/expenses` (+ items), list view with filters, edit modal.
5. **AI entry** — `ai-core` package with provider registry (OpenRouter, Anthropic, Cloudflare Workers AI) and `ModelResolver`; `POST /api/expenses/parse` using `generateObject`; chat-style entry UI with confirm chip and "Add new person/category?" actions.
6. **Dashboard** — month total, by-category bar, by-person bar, per-currency subtotals, recent list.
7. **Weekly insight** — Worker cron trigger, insight storage, dashboard card.
8. **PWA polish** — manifest, icons, install prompt, offline shell.
9. **Deploy** — Pages + Workers, custom subdomain on `aleph-cat.com`, secrets (`ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, Cloudflare AI binding, `ADMIN_API_KEY`).

## Open TODOs

- Confirm subdomain (e.g. `mew.aleph-cat.com`) before deploy step.
- Decide on seeded default categories (food, transport, shopping, entertainment, health, other?).
- Decide supported currencies in the UI picker (start with USD, CNY, EUR, JPY, GBP?).
- Voice input: Web Speech API on mobile (free, no Whisper needed) — confirm browsers cover user's devices.
