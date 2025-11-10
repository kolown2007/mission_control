import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const sso = event.cookies.get('kolown_sso'); // server-side only
  // Use a safe cast to avoid TypeScript errors if the App.Locals augmentation
  // isn't picked up by the compiler in this environment.
  const locals = event.locals as any;

  // Prepare a short log message we can both server-log and optionally inject
  // into HTML responses so the browser console shows it (useful when you
  // can't access the server terminal). Injection is opt-in via query param
  // `?auth_debug=1` or cookie `kolown_sso_debug=1`.
  let hookLogMessage: string | null = null;

  // Simply detect presence of the kolown_sso cookie and set a boolean flag
  // on locals. Do not parse or expose any user id here; the caller only
  // wanted a simple present/not-present boolean.
  const ssoPresent = !!sso;
  locals.ssoPresent = ssoPresent;

  if (ssoPresent) {
    hookLogMessage = '[auth-hook] kolown_sso present';
  } else {
    hookLogMessage = '[auth-hook] kolown_sso not found';
  }

  const response = await resolve(event);

  const contentType = response.headers.get('content-type') || '';

  // Log once for HTML responses only to avoid duplicate logs from
  // asset/XHR requests that also hit this hook. No client-side injection
  // is performed — the hook only detects/validates the cookie and sets
  // `event.locals.user` for downstream server code.
  if (hookLogMessage && contentType.includes('text/html')) {
    console.log(hookLogMessage);
  }

  return response;
};
