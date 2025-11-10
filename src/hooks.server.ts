import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const sso = event.cookies.get('kolown_sso'); // server-side only

  // Use a safe cast to avoid TypeScript errors if the App.Locals augmentation
  // isn't picked up by the compiler in this environment.
  const locals = event.locals as any;

  if (sso && !locals.user) {
    const [id, pass] = String(sso).split('|', 2);
    if (id && pass === 'cat123') {
      locals.user = { id: Number(id) };
      // server console log for quick test
      console.log('[auth-hook] kolown_sso valid, user id=', locals.user.id);
    } else {
      console.log('[auth-hook] kolown_sso present but invalid:', sso);
    }
  } else {
    // useful to see when no cookie is sent
    console.log('[auth-hook] kolown_sso not found');
  }

  return await resolve(event);
};
