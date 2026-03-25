export type CloudinaryImageProfile = 'thumbSmall' | 'thumb' | 'cardWideSmall' | 'cardWide' | 'view' | 'zoom';

const UPLOAD_SEGMENT = '/image/upload/';

const profileTransform: Record<CloudinaryImageProfile, string> = {
  // Estandar unico de miniaturas: alta nitidez para evitar diferencias visuales.
  thumbSmall: 'c_fill,g_auto,w_420,h_420,f_auto,q_auto:best,dpr_auto',
  // Thumb se usa en miniaturas pequenas (subtemas y listados).
  thumb: 'c_fill,g_auto,w_720,h_720,f_auto,q_auto:best,dpr_auto',
  cardWideSmall: 'c_fill,g_auto,w_800,h_450,f_auto,q_auto:best,dpr_auto',
  // cardWide para temas: mayor resolucion para tarjetas anchas en desktop.
  cardWide: 'c_fill,g_auto,w_1280,h_720,f_auto,q_auto:best,dpr_auto',
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
