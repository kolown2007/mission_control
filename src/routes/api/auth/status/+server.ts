// Returns whether the server saw the `kolown_sso` cookie on this request.
export const GET = async ({ cookies }: any) => {
  const sso = cookies.get('kolown_sso');
  const present = !!sso;
  return new Response(JSON.stringify({ present }), {
    headers: { 'content-type': 'application/json' }
  });
};
