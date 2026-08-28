import { describe, expect, it } from 'vitest';
import { getCloudinaryImageUrl, getImageCandidateUrls } from './cloudinaryImages';

describe('getCloudinaryImageUrl', () => {
  it('devuelve directamente la URL de Cloudflare R2 con formato webp', () => {
    const source = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/epitelio/placa.webp';
    const result = getCloudinaryImageUrl(source, 'thumb');

    expect(result).toBe(source);
  });

  it('conserva URLs externas y valores vacíos', () => {
    expect(getCloudinaryImageUrl('https://example.com/image.jpg', 'view'))
      .toBe('https://example.com/image.jpg');
    expect(getCloudinaryImageUrl('', 'zoom')).toBe('');
  });
});

describe('getImageCandidateUrls', () => {
  it('genera lista de candidatos con URL webp y fallbacks', () => {
    const source = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/epitelio/placa.jpg';
    const candidates = getImageCandidateUrls(source, 'zoom');

    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates[0]).toContain('.webp');
    expect(candidates).toContain(source);
  });

  it('devuelve array vacío si no se proporciona URL', () => {
    expect(getImageCandidateUrls('')).toEqual([]);
  });
});
