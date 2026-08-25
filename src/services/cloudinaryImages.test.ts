import { describe, expect, it } from 'vitest';
import { getCloudinaryImageUrl } from './cloudinaryImages';

describe('getCloudinaryImageUrl', () => {
  it('devuelve directamente la URL de Cloudflare R2 sin alteraciones', () => {
    const source = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/epitelio/placa.jpg';
    const result = getCloudinaryImageUrl(source, 'thumb');

    expect(result).toBe(source);
  });

  it('conserva URLs externas y valores vacíos', () => {
    expect(getCloudinaryImageUrl('https://example.com/image.jpg', 'view'))
      .toBe('https://example.com/image.jpg');
    expect(getCloudinaryImageUrl('', 'zoom')).toBe('');
  });
});
