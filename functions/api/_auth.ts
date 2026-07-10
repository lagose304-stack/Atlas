type AuthEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export const authorizeEditor = async (request: Request, env: AuthEnv): Promise<boolean> => {
  const token = request.headers.get('X-Atlas-Session') || '';
  const url = env.SUPABASE_URL || '';
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!token || !url || !serviceKey) return false;

  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/atlas_authorize_token`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_token: token,
      p_roles: ['Administrador', 'Microscopía'],
    }),
  });
  if (!response.ok) return false;
  return (await response.json()) === true;
};
