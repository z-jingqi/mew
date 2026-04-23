import type { AIEnvironment } from '@mew/ai-core';
import type { User } from '@mew/database';

/**
 * Worker bindings + env vars.
 *
 * Extends AIEnvironment so `c.env` can be passed directly to ai-core.
 */
export interface Env extends AIEnvironment {
  AI: Ai;
  DB: D1Database;
  // ASSETS: R2Bucket; // wired when uploads land

  DEFAULT_PROVIDER?: string;
  OPENROUTER_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;

  /** Pre-shared key for admin routes (bootstrap, invite-mint). Set via wrangler secret. */
  ADMIN_API_KEY?: string;
}

/**
 * Per-request context. Routes behind the auth middleware get a non-null `user`.
 */
export interface Variables {
  user?: User;
}

export type AppContext = { Bindings: Env; Variables: Variables };
