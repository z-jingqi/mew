import { ApiError } from '../api/client';

/**
 * Map API error codes (returned as `{ error: 'code' }` from the server) to
 * short human text. Server codes are deliberately stable and terse — the UI
 * translates them here so messages can change freely without breaking clients.
 */
const MESSAGES: Record<string, string> = {
  // Auth
  invalid_credentials: 'That username and password combination didn’t match.',
  invalid_invite: 'This invite code is invalid, used, or expired.',
  username_taken: 'That username is already taken.',
  unauthenticated: 'Your session expired. Please sign in again.',
  forbidden: 'You don’t have permission to do that.',
  admin_already_exists: 'An admin user already exists — skip setup and log in.',
  admin_key_not_configured: 'Admin access isn’t configured on the server.',

  // Generic CRUD
  invalid_request: 'Something in the form isn’t quite right — please check and retry.',
  not_found: 'We couldn’t find that item. It may have been deleted.',
  conflict: 'That name is already in use.',

  // Server
  internal_error: 'Something went wrong on our end. Please try again.',
};

/** Turn any thrown value (ApiError, TypeError from fetch, etc.) into UI text. */
export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err instanceof ApiError) {
    const body = err.body;
    if (body && typeof body === 'object' && 'error' in body) {
      const code = String((body as { error: unknown }).error);
      if (MESSAGES[code]) return MESSAGES[code];
      // Zod validation — surface the first issue if present so the user can
      // see which field is wrong.
      if (code === 'invalid_request' && 'issues' in body && Array.isArray(body.issues)) {
        const first = body.issues[0] as { path?: unknown[]; message?: string } | undefined;
        if (first?.message) {
          const field = Array.isArray(first.path) && first.path.length ? String(first.path[0]) : null;
          return field ? `${field}: ${first.message}` : first.message;
        }
      }
    }
    if (err.status === 0) return 'Could not reach the server. Check your connection.';
    return fallback;
  }
  if (err instanceof TypeError) {
    // fetch() network failure surfaces as TypeError.
    return 'Could not reach the server. Check your connection.';
  }
  if (err instanceof Error && err.message) {
    return MESSAGES[err.message] ?? err.message;
  }
  return fallback;
}
