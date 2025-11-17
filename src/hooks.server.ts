import type { Handle } from '@sveltejs/kit';

// Hardcoded validate URL (use the main auth host)
const VALIDATE_URL = 'https://kolown.net/api/sso/validate';

export const handle: Handle = async ({ event, resolve }) => {
  // Read the HttpOnly domain cookie
  const token = event.cookies.get('kolown_sso');
  let user = null;
  let ssoPresent = false;

  if (token) {
    ssoPresent = true;
    try {
      // Forward the request cookies so Laravel can read kolown_sso
      const cookieHeader = event.request.headers.get('cookie') ?? `kolown_sso=${token}`;

      // Use event.fetch so the adapter/context is preserved
      const res = await event.fetch(VALIDATE_URL, {
        method: 'GET',
        headers: {
          // ensure server-to-server call includes cookie header
          cookie: cookieHeader,
          accept: 'application/json'
        },
        // include credentials if validate is cross-origin and requires them
        credentials: 'include'
      });

      if (res.ok) {
        const payload = await res.json().catch(() => null);
        // Laravel may return { user: { ... } } or the user directly — handle both
        const resolved = payload?.user ?? payload ?? null;

        // minimal shape guard
        if (resolved && (typeof resolved.id === 'string' || typeof resolved.id === 'number')) {
          user = { id: resolved.id, name: resolved.name ?? null, email: resolved.email ?? null };
        } else {
          // unexpected shape — keep user null
          user = null;
        }
      } else {
        user = null;
      }
    } catch (err) {
      console.error('[hooks] SSO validate failed', err);
      user = null;
    }
  }

  // Expose to server-side loads
  event.locals.user = user;
  event.locals.ssoPresent = ssoPresent;

  return await resolve(event);
};