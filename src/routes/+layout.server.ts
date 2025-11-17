// Minimal server load that exposes the server-detected `locals.user` to the
// client. We intentionally avoid importing `$types` here to sidestep
// mismatched generated types across SvelteKit versions.
export const load = async ({ locals }: any) => {
  // Expose a simple boolean indicating whether the kolown_sso cookie was
  // present on the request and a minimal safe user object (if available).
  const ssoPresent = Boolean((locals as any).ssoPresent);
  const rawUser = (locals as any).user;

  // Only expose a minimal subset to the client
  const user = rawUser
    ? {
        id: rawUser.id,
        name: rawUser.name ?? null,
        email: rawUser.email ?? null
      }
    : null;

  return {
    ssoPresent,
    user,
    // TEMP: expose keys returned by the validate endpoint for debugging
    userInfoKeys: (locals as any).userInfoKeys ?? null
  };
};
