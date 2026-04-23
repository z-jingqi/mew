/**
 * Session service — create/validate/destroy session rows keyed by token.
 * Sliding renewal: if <29 days remain the expiry extends and the cookie is refreshed.
 */

import { and, eq, gt } from 'drizzle-orm';
import type { Db } from '@mew/database';
import { schema, type Session, type User } from '@mew/database';
import { randomToken } from './crypto';

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RENEWAL_THRESHOLD_MS = 29 * 24 * 60 * 60 * 1000; // extend when <29d left

export interface SessionLookup {
  session: Session;
  user: User;
  renewed: boolean;
}

export async function createSession(db: Db, userId: string): Promise<Session> {
  const id = randomToken(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const [row] = await db
    .insert(schema.sessions)
    .values({
      id,
      userId,
      expiresAt,
      lastActiveAt: now,
    })
    .returning();
  if (!row) throw new Error('Failed to create session');
  return row;
}

export async function lookupSession(db: Db, token: string): Promise<SessionLookup | null> {
  const now = new Date();
  const rows = await db
    .select({
      session: schema.sessions,
      user: schema.users,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, token), gt(schema.sessions.expiresAt, now)))
    .limit(1);
  const hit = rows[0];
  if (!hit) return null;

  const remaining = hit.session.expiresAt.getTime() - now.getTime();
  let session = hit.session;
  let renewed = false;
  if (remaining < RENEWAL_THRESHOLD_MS) {
    const newExpiry = new Date(now.getTime() + SESSION_TTL_MS);
    await db
      .update(schema.sessions)
      .set({ expiresAt: newExpiry, lastActiveAt: now })
      .where(eq(schema.sessions.id, session.id));
    session = { ...session, expiresAt: newExpiry, lastActiveAt: now };
    renewed = true;
  } else {
    await db
      .update(schema.sessions)
      .set({ lastActiveAt: now })
      .where(eq(schema.sessions.id, session.id));
  }

  return { session, user: hit.user, renewed };
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, token));
}

/** Cookie serialization — built manually so we don't need a cookie lib. */
export function buildSessionCookie(token: string, expiresAt: Date, isHttps: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    `Expires=${expiresAt.toUTCString()}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isHttps) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearSessionCookie(isHttps: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isHttps) parts.push('Secure');
  return parts.join('; ');
}

export function readSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const piece of cookieHeader.split(';')) {
    const [k, v] = piece.trim().split('=');
    if (k === SESSION_COOKIE) return v ?? null;
  }
  return null;
}
