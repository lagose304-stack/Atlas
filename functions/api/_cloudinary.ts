type CloudinaryEnv = {
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
};

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

export const json = (status: number, body: unknown, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...extraHeaders,
    },
  });

export const getCloudinaryConfig = (env: CloudinaryEnv): CloudinaryConfig => {
  const cloudName = env.CLOUDINARY_CLOUD_NAME || '';
  const apiKey = env.CLOUDINARY_API_KEY || '';
  const apiSecret = env.CLOUDINARY_API_SECRET || '';

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET');
  }

  return { cloudName, apiKey, apiSecret };
};

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const sha1 = async (value: string): Promise<string> => {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-1', data);
  return toHex(hash);
};

const signParams = async (
  params: Record<string, string>,
  apiSecret: string
): Promise<string> => {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return sha1(`${serialized}${apiSecret}`);
};

export const callCloudinary = async (
  endpoint: string,
  unsignedParams: Record<string, string>,
  env: CloudinaryEnv
) => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig(env);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signatureParams = {
    ...unsignedParams,
    timestamp,
  };

  const signature = await signParams(signatureParams, apiSecret);

  const body = new URLSearchParams({
    ...unsignedParams,
    timestamp,
    api_key: apiKey,
    signature,
  });

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await response.json();
  return { ok: response.ok, data };
};
