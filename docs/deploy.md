# Deploying Mew

Step 9 of `plan.md`. Stops just short of pushing — run these yourself.

## One-time setup

1. **Create the D1 database**
   ```sh
   cd apps/server
   npx wrangler d1 create mew
   ```
   Copy the returned `database_id` into `apps/server/wrangler.toml` (replace
   `REPLACE_ME_VIA_WRANGLER_D1_CREATE`).

2. **Apply migrations**
   ```sh
   pnpm --filter @mew/server db:migrate:remote
   ```
   For local dev (miniflare):
   ```sh
   pnpm --filter @mew/server db:migrate:local
   ```

   When you change `packages/database/src/schema.ts`, regenerate the SQL first:
   ```sh
   pnpm --filter @mew/database db:generate
   ```

3. **Set secrets** (only for fallback providers; Cloudflare AI is free via the binding)
   ```sh
   npx wrangler secret put ADMIN_API_KEY         # required to bootstrap admin + mint invites
   npx wrangler secret put OPENROUTER_API_KEY    # optional fallback
   npx wrangler secret put ANTHROPIC_API_KEY     # optional fallback
   ```

4. **Bootstrap the first admin** (one-shot — errors if an admin already exists):
   ```sh
   curl -X POST https://mew.aleph-cat.com/api/admin/setup \
     -H "Authorization: Bearer $ADMIN_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"username":"you","password":"at-least-6-chars"}'
   ```

5. **Mint invite codes**:
   ```sh
   curl -X POST https://mew.aleph-cat.com/api/admin/invite-codes \
     -H "Authorization: Bearer $ADMIN_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"count":5, "expiresInDays":30}'
   ```

   Other admin endpoints (all gated by the same bearer token):
   - `GET  /api/admin/invite-codes` — list codes (audit)
   - `POST /api/admin/cleanup-sessions` — prune expired session rows

## Deploy

```sh
# Worker → https://mew.aleph-cat.com/api/*
pnpm --filter @mew/server deploy

# Frontend (Cloudflare Pages) → https://mew.aleph-cat.com/*
pnpm --filter @mew/web deploy
```

## Domain setup — single origin at mew.aleph-cat.com

API and web share one domain so cookies work natively and no CORS config is needed.

- `apps/server/wrangler.toml` declares `routes = [{ pattern = "mew.aleph-cat.com/api/*", zone_name = "aleph-cat.com" }]` with `workers_dev = false`. The Worker catches every request whose path starts with `/api/`.
- Pages project `mew-web` is assigned the custom domain `mew.aleph-cat.com` via the Cloudflare dashboard (*Pages → mew-web → Custom domains*). Pages serves everything except `/api/*` — Worker routes take precedence on shared domains.

One-time Pages domain attach (dashboard or CLI):

```sh
npx wrangler pages project create mew-web --production-branch main
# then in dashboard: Pages → mew-web → Custom domains → add mew.aleph-cat.com
```

`aleph-cat.com` must be on your Cloudflare account for the route pattern to resolve.

## GitHub Actions

Workflows live in `.github/workflows/`:

- **`ci.yml`** — runs on PRs and pushes to `main`: `pnpm -r typecheck` + web build + wrangler dry-run deploy. No secrets required.
- **`deploy.yml`** — runs on push to `main` (or manual dispatch). Uses `dorny/paths-filter` to only deploy what changed:
  - `apps/web/**` or shared packages → `deploy-web` (Cloudflare Pages)
  - `apps/server/**` or shared packages → `deploy-server` (Cloudflare Workers)
  - `packages/database/drizzle/**` → `migrate-db` runs first; server deploy waits for it.

### Required repo secrets

Set these under **Settings → Secrets and variables → Actions**:

| Secret | Notes |
|---|---|
| `CLOUDFLARE_GIT_ACTION` | API token. Create at dash.cloudflare.com/profile/api-tokens. Needs permissions: *Account → D1:Edit*, *Account → Workers Scripts:Edit*, *Account → Cloudflare Pages:Edit*, *User → User Details:Read*. The workflow maps this secret into the `CLOUDFLARE_API_TOKEN` env var wrangler reads. |

If the token grants access to more than one Cloudflare account (rare — only if you're a member of multiple orgs), also add a `CLOUDFLARE_ACCOUNT_ID` secret and pipe it into `env.CLOUDFLARE_ACCOUNT_ID` in `deploy.yml`. Single-account tokens don't need it — wrangler infers the account from the token.

Once set, pushing to `main` deploys the affected app(s) automatically, and a change to any file in `packages/database/drizzle/` triggers `db:migrate:remote` before the server deploy.

## Local dev

```sh
pnpm dev                          # turbo: web + server together
# or
pnpm --filter @mew/server dev     # wrangler dev :8787
pnpm --filter @mew/web dev        # vite :5173 (proxies /api)
```

`.dev.vars` at `apps/server/.dev.vars` holds local secrets.
