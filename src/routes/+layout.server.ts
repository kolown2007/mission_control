// Minimal server load that exposes the server-detected `locals.user` to the
// client. We intentionally avoid importing `$types` here to sidestep
// mismatched generated types across SvelteKit versions.
export const load = async ({ locals }: any) => {
  // Expose a simple boolean indicating whether the kolown_sso cookie was
  // present on the request. We avoid exposing any user id here per the new
  // request.
  return {
    ssoPresent: Boolean((locals as any).ssoPresent)
  };
};
