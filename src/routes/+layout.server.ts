// Minimal server load that exposes the server-detected `locals.user` to the
// client. We intentionally avoid importing `$types` here to sidestep
// mismatched generated types across SvelteKit versions.
export const load = async ({ locals }: any) => {
  return {
    user: (locals as any).user ?? null
  };
};
