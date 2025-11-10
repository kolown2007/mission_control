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

  if (sso && !locals.user) {
    const [id, pass] = String(sso).split('|', 2);
    if (id && pass === 'cat123') {
      locals.user = { id: Number(id) };
      hookLogMessage = `[auth-hook] kolown_sso valid, user id=${locals.user.id}`;
    } else {
      hookLogMessage = `[auth-hook] kolown_sso present but invalid: ${sso}`;
    }
  } else {
    hookLogMessage = '[auth-hook] kolown_sso not found';
  }

  const response = await resolve(event);

  // Opt-in: only inject into HTML responses when the request includes the
  // debug query param or debug cookie. This avoids leaking server logs to
  // normal users in production.
  const wantsDebug = event.url.searchParams.get('auth_debug') === '1' ||
    event.cookies.get('kolown_sso_debug') === '1';

  const contentType = response.headers.get('content-type') || '';
  // Log once for HTML responses only to avoid duplicate logs from
  // asset/XHR requests that also hit this hook.
  if (hookLogMessage && contentType.includes('text/html')) {
    console.log(hookLogMessage);
  }
  if (wantsDebug && hookLogMessage && contentType.includes('text/html')) {
    try {
      const bodyText = await response.text();
      const script = `<script>console.info(${JSON.stringify(hookLogMessage)});</script>`;
      const injected = bodyText.replace(/<\/body>/i, script + '</body>');

      // Clone headers and remove content-length because the body size changed.
      const newHeaders = new Headers(response.headers);
      newHeaders.delete('content-length');

      return new Response(injected, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (err) {
      // If anything goes wrong injecting, fall back to the original response.
      console.warn('[auth-hook] failed to inject debug script into HTML response', err);
      return response;
    }
  }

  return response;
};
