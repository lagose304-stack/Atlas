export type CloudinaryImageProfile = 'thumbSmall' | 'thumb' | 'cardWideSmall' | 'cardWide' | 'view' | 'zoom';

export const getCloudinaryImageUrl = (
  originalUrl: string,
  _profile?: CloudinaryImageProfile
): string => {
  return originalUrl || '';
};
