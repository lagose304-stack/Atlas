type AuthEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export const authorizeEditor = async (request: Request, env: AuthEnv): Promise<number> => {
  const token = (request.headers.get('X-Atlas-Session') || '').trim();
  if (!token) return 401;
  const url = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) return 503;

  try {
    const response = await fetch(`${url}/rest/v1/rpc/atlas_authorize_token`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_token: token, p_roles: ['Administrador', 'Microscopía'] }),
    });
    if (!response.ok) return 503;
    const allowed = await response.json();
    return allowed === true ? 200 : allowed === false ? 403 : 503;
  } catch {
    return 503;
  }
};
