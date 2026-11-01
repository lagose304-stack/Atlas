import { describe, expect, it } from 'vitest';
import { getCloudinaryImageUrl, getImageCandidateUrls, invalidateImageCache } from './cloudinaryImages';

describe('getCloudinaryImageUrl', () => {
  it('devuelve la URL con sufijo _thumb.webp cuando el perfil es thumb o thumbSmall', () => {
    const source = 'https://r2.atlas-tests.invalid/placas/epitelio/placa.webp';
    const result = getCloudinaryImageUrl(source, 'thumb');

    expect(result).toBe('https://r2.atlas-tests.invalid/placas/epitelio/placa_thumb.webp');
  });

  it('devuelve la URL original completa para perfiles de alta resolución (view, zoom)', () => {
    const source = 'https://r2.atlas-tests.invalid/placas/epitelio/placa.webp';
    const result = getCloudinaryImageUrl(source, 'view');

    expect(result).toBe('https://r2.atlas-tests.invalid/placas/epitelio/placa.webp');
  });

  it('conserva URLs externas y valores vacíos', () => {
    expect(getCloudinaryImageUrl('https://example.com/image.jpg', 'view'))
      .toBe('https://example.com/image.jpg');
    expect(getCloudinaryImageUrl('', 'zoom')).toBe('');
  });

  it('procesa correctamente URLs que ya contienen query string ?v=... generando miniatura limpia', () => {
    const sourceWithQuery = 'https://r2.atlas-tests.invalid/placas/Ojo/Cornea/1788064584813_d2d9d68e25e663b3c8161ed5ef8aa3ca.webp?v=1788123096603';
    const thumbResult = getCloudinaryImageUrl(sourceWithQuery, 'thumb');

    expect(thumbResult).toBe('https://r2.atlas-tests.invalid/placas/Ojo/Cornea/1788064584813_d2d9d68e25e663b3c8161ed5ef8aa3ca_thumb.webp?v=1788123096603');
    expect(thumbResult.indexOf('?')).toBe(thumbResult.lastIndexOf('?')); // Un solo '?'

    const viewResult = getCloudinaryImageUrl(sourceWithQuery, 'view');
    expect(viewResult).toBe('https://r2.atlas-tests.invalid/placas/Ojo/Cornea/1788064584813_d2d9d68e25e663b3c8161ed5ef8aa3ca.webp?v=1788123096603');
  });

  it('remueve el sufijo _thumb.webp cuando se solicita perfil view o zoom desde una URL de miniatura', () => {
    const thumbUrl = 'https://r2.atlas-tests.invalid/placas/Ojo/Cornea/1788064584813_thumb.webp';
    const viewResult = getCloudinaryImageUrl(thumbUrl, 'view');

    expect(viewResult).toBe('https://r2.atlas-tests.invalid/placas/Ojo/Cornea/1788064584813.webp');
  });

  it('respeta la carpeta atlas-content sin anteponer placas/sin_clasificar', () => {
    const r2Url = 'https://r2.atlas-tests.invalid/atlas-content/1788929744560_sample.webp';
    const viewResult = getCloudinaryImageUrl(r2Url, 'view');
    expect(viewResult).toBe('https://r2.atlas-tests.invalid/atlas-content/1788929744560_sample.webp');

    const thumbResult = getCloudinaryImageUrl(r2Url, 'thumb');
    expect(thumbResult).toBe('https://r2.atlas-tests.invalid/atlas-content/1788929744560_sample_thumb.webp');
  });

  it('corrige prefijos anidados accidentales como placas/sin_clasificar/atlas-content/', () => {
    const corruptUrl = 'https://r2.atlas-tests.invalid/placas/sin_clasificar/atlas-content/1788929744560_sample.webp';
    const viewResult = getCloudinaryImageUrl(corruptUrl, 'view');
    expect(viewResult).toBe('https://r2.atlas-tests.invalid/atlas-content/1788929744560_sample.webp');
  });
});

describe('getImageCandidateUrls', () => {
  it('mantiene las alternativas del proveedor histórico exclusivamente en R2', () => {
    const candidates = getImageCandidateUrls('https://res.cloudinary.com/legacy/image/upload/w_200/v123/atlas-content/corte.jpg?token=sample', 'thumb');
    expect(candidates).toEqual([
      'https://r2.atlas-tests.invalid/atlas-content/corte_thumb.webp?token=sample',
      'https://r2.atlas-tests.invalid/atlas-content/corte.webp?token=sample',
      'https://r2.atlas-tests.invalid/atlas-content/corte.jpg?token=sample',
    ]);
  });

  it('preserva parámetros externos firmados sin convertirlos en una versión de caché', () => {
    const url = 'https://example.com/image.png?width=100&signature=test#preview';
    expect(getCloudinaryImageUrl(url, 'thumb')).toBe(url);
    expect(getImageCandidateUrls(url)).toEqual([url]);
  });

  it('resuelve URLs de otro dominio R2 sin introducir un segundo protocolo en la ruta', () => {
    expect(getCloudinaryImageUrl('https://old-bucket.r2.dev/atlas-content/a.webp', 'view'))
      .toBe('https://r2.atlas-tests.invalid/atlas-content/a.webp');
  });

  it('conserva parámetros al invalidar una imagen sin duplicar v', () => {
    const url = 'https://r2.atlas-tests.invalid/atlas-content/version-test.webp?width=100&v=old';
    invalidateImageCache(url);
    const parsed = new URL(getCloudinaryImageUrl(url));
    expect(parsed.searchParams.get('width')).toBe('100');
    expect(parsed.searchParams.getAll('v')).toHaveLength(1);
    expect(parsed.searchParams.get('v')).not.toBe('old');
  });

  it('preserva originales PNG en R2 y deriva correctamente la miniatura WebP', () => {
    const url = 'https://r2.atlas-tests.invalid/atlas-content/real.png';
    expect(getCloudinaryImageUrl(url, 'view')).toBe(url);
    expect(getCloudinaryImageUrl(url, 'thumb')).toBe('https://r2.atlas-tests.invalid/atlas-content/real_thumb.webp');
  });
  it('respeta el formato guardado en R2 y ofrece WebP como alternativa', () => {
    const source = 'https://r2.atlas-tests.invalid/placas/epitelio/placa.jpg';
    const candidates = getImageCandidateUrls(source, 'zoom');

    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates[0]).toBe(source);
    expect(candidates.some(url => url.endsWith('.webp'))).toBe(true);
    expect(candidates).toContain(source);
  });

  it('incluye fallback a la versión completa cuando se solicita miniatura', () => {
    const source = 'https://r2.atlas-tests.invalid/placas/epitelio/placa.webp';
    const candidates = getImageCandidateUrls(source, 'thumb');

    expect(candidates[0]).toContain('_thumb.webp');
    expect(candidates).toContain(source);
  });

  it('devuelve array vacío si no se proporciona URL', () => {
    expect(getImageCandidateUrls('')).toEqual([]);
  });
});
