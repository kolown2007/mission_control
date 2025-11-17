import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// validate URL from env or fallback to production host
const VALIDATE_URL = env.SSO_VALIDATE_URL ?? 'https://kolown.net/api/sso/validate';

// Simple in-memory cache to reduce validate calls. NOTE: ephemeral on serverless.
const CACHE_TTL = 60 * 1000; // 60s
type CacheEntry = { user: any | null; expires: number };
const tokenCache = new Map<string, CacheEntry>();

function getCached(token: string) {
  const e = tokenCache.get(token);
  if (!e) return null;
  if (Date.now() > e.expires) {
    tokenCache.delete(token);
    return null;
  }
  return e.user;
}

function setCached(token: string, user: any | null) {
  tokenCache.set(token, { user, expires: Date.now() + CACHE_TTL });
}

export const handle: Handle = async ({ event, resolve }) => {
  // Read the HttpOnly domain cookie
  const token = event.cookies.get('kolown_sso');
  let user = null;
  let ssoPresent = false;

  if (token) {
    ssoPresent = true;

    // check cache first
    const cached = getCached(token);
    if (cached !== null) {
      user = cached;
    } else {
      try {
        // Forward the request cookies so Laravel can read kolown_sso
        const cookieHeader = event.request.headers.get('cookie') ?? `kolown_sso=${token}`;

        // Use event.fetch so the adapter/context is preserved
        const res = await event.fetch(VALIDATE_URL, {
          method: 'GET',
          headers: {
            // forward incoming cookies so Laravel can read the HttpOnly kolown_sso cookie
            cookie: cookieHeader,
            accept: 'application/json',
            // fallback Authorization header (harmless if ignored)
            Authorization: `Bearer ${token}`
          }
        });

        // concise server-side log (no sensitive data)
        console.log('[hooks] SSO validate', { url: VALIDATE_URL, status: res.status, ok: res.ok });

        if (res.ok) {
          const payload = await res.json().catch(() => null);
          // Laravel may return { user: {...} } or the user directly — handle both
          const resolved = payload?.user ?? payload ?? null;

          // minimal shape guard
          if (resolved && (typeof resolved.id === 'string' || typeof resolved.id === 'number')) {
            user = { id: resolved.id, name: resolved.name ?? null, email: resolved.email ?? null };
          } else {
            user = null;
          }
        } else {
          user = null;
        }
      } catch (err) {
        console.error('[hooks] SSO validate failed', err);
        user = null;
      }

      // cache result (including null) to avoid repeated validate calls
      setCached(token, user);
    }
  }

  // Expose to server-side loads (minimal)
  event.locals.user = user;
  event.locals.ssoPresent = ssoPresent;

  return await resolve(event);
};