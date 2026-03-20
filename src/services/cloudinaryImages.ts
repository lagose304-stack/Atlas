export type CloudinaryImageProfile = 'thumb' | 'view' | 'zoom';

const UPLOAD_SEGMENT = '/image/upload/';

const profileTransform: Record<CloudinaryImageProfile, string> = {
  thumb: 'c_fill,g_auto,w_380,h_380,f_auto,q_auto:good,dpr_auto',
  view: 'c_limit,w_1800,f_auto,q_auto:good,dpr_auto',
  zoom: 'c_limit,w_3200,f_auto,q_auto:best,dpr_auto',
};

const isCloudinaryImageUrl = (url: string) =>
  typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes(UPLOAD_SEGMENT);

export const getCloudinaryImageUrl = (
  originalUrl: string,
  profile: CloudinaryImageProfile
): string => {
  if (!isCloudinaryImageUrl(originalUrl)) return originalUrl;

  const [prefix, suffix] = originalUrl.split(UPLOAD_SEGMENT);
  if (!prefix || !suffix) return originalUrl;

  const cleanSuffix = suffix.replace(/^\/+/, '');
  return `${prefix}${UPLOAD_SEGMENT}${profileTransform[profile]}/${cleanSuffix}`;
};
