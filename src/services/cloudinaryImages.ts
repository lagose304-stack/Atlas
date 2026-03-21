export type CloudinaryImageProfile = 'thumbSmall' | 'thumb' | 'cardWideSmall' | 'cardWide' | 'view' | 'zoom';

const UPLOAD_SEGMENT = '/image/upload/';

const profileTransform: Record<CloudinaryImageProfile, string> = {
  thumbSmall: 'c_fill,g_auto,w_320,h_320,f_auto,q_auto:good,dpr_auto',
  // Thumb se usa en miniaturas pequenas (subtemas y listados).
  thumb: 'c_fill,g_auto,w_560,h_560,f_auto,q_auto:best,dpr_auto',
  cardWideSmall: 'c_fill,g_auto,w_640,h_360,f_auto,q_auto:good,dpr_auto',
  // cardWide evita pixelacion en tarjetas de temas que ocupan mas ancho en desktop.
  cardWide: 'c_fill,g_auto,w_960,h_540,f_auto,q_auto:best,dpr_auto',
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
