import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const KOLOWN_BASE = env.KOLOWN_BASE_URL ?? 'https://kolown.net';

export const handle: Handle = async ({ event, resolve }) => {
  // Read HttpOnly cookie (client JS cannot access this)
  const token = event.cookies.get('kolown_sso');
  // mark whether the request had the SSO cookie at all
  event.locals.ssoPresent = Boolean(token);

  if (token) {
    try {
      // use the request-scoped fetch so adapters and cookies behave consistently
      const res = await event.fetch(`${KOLOWN_BASE}/api/sso/validate`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });

      if (res.ok) {
        // expected: { id, name, email, ... }
        event.locals.user = (await res.json()) as App.User;
      } else {
        event.locals.user = null;
      }
    } catch (err) {
      // network/other error -> treat as unauthenticated
      event.locals.user = null;
    }
  } else {
    event.locals.user = null;
  }

  return await resolve(event);
};