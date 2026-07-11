import { describe, expect, it } from 'vitest';
import { getCloudinaryImageUrl } from './cloudinaryImages';

describe('getCloudinaryImageUrl', () => {
  it('inserta la transformación correspondiente sin alterar el public id', () => {
    const source = 'https://res.cloudinary.com/demo/image/upload/v123/atlas/placa.jpg';
    const result = getCloudinaryImageUrl(source, 'thumb');

    expect(result).toContain('/image/upload/c_fill,g_auto,w_720,h_720,f_auto,q_auto:best,dpr_auto/');
    expect(result.endsWith('v123/atlas/placa.jpg')).toBe(true);
  });

  it('conserva URLs externas y valores vacíos', () => {
    expect(getCloudinaryImageUrl('https://example.com/image.jpg', 'view'))
      .toBe('https://example.com/image.jpg');
    expect(getCloudinaryImageUrl('', 'zoom')).toBe('');
  });
});
