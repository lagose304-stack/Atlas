import { describe, expect, it } from 'vitest';
import { getCloudinaryImageUrl, getImageCandidateUrls } from './cloudinaryImages';

describe('getCloudinaryImageUrl', () => {
  it('devuelve la URL con sufijo _thumb.webp cuando el perfil es thumb o thumbSmall', () => {
    const source = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/epitelio/placa.webp';
    const result = getCloudinaryImageUrl(source, 'thumb');

    expect(result).toBe('https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/epitelio/placa_thumb.webp');
  });

  it('devuelve la URL original completa para perfiles de alta resolución (view, zoom)', () => {
    const source = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/epitelio/placa.webp';
    const result = getCloudinaryImageUrl(source, 'view');

    expect(result).toBe('https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/epitelio/placa.webp');
  });

  it('conserva URLs externas y valores vacíos', () => {
    expect(getCloudinaryImageUrl('https://example.com/image.jpg', 'view'))
      .toBe('https://example.com/image.jpg');
    expect(getCloudinaryImageUrl('', 'zoom')).toBe('');
  });

  it('procesa correctamente URLs que ya contienen query string ?v=... generando miniatura limpia', () => {
    const sourceWithQuery = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/Ojo/Cornea/1788064584813_d2d9d68e25e663b3c8161ed5ef8aa3ca.webp?v=1788123096603';
    const thumbResult = getCloudinaryImageUrl(sourceWithQuery, 'thumb');

    expect(thumbResult).toBe('https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/Ojo/Cornea/1788064584813_d2d9d68e25e663b3c8161ed5ef8aa3ca_thumb.webp?v=1788123096603');
    expect(thumbResult.indexOf('?')).toBe(thumbResult.lastIndexOf('?')); // Un solo '?'

    const viewResult = getCloudinaryImageUrl(sourceWithQuery, 'view');
    expect(viewResult).toBe('https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/Ojo/Cornea/1788064584813_d2d9d68e25e663b3c8161ed5ef8aa3ca.webp?v=1788123096603');
  });

  it('remueve el sufijo _thumb.webp cuando se solicita perfil view o zoom desde una URL de miniatura', () => {
    const thumbUrl = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/Ojo/Cornea/1788064584813_thumb.webp';
    const viewResult = getCloudinaryImageUrl(thumbUrl, 'view');

    expect(viewResult).toBe('https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/Ojo/Cornea/1788064584813.webp');
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

  it('incluye fallback a la versión completa cuando se solicita miniatura', () => {
    const source = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/epitelio/placa.webp';
    const candidates = getImageCandidateUrls(source, 'thumb');

    expect(candidates[0]).toContain('_thumb.webp');
    expect(candidates).toContain(source);
  });

  it('devuelve array vacío si no se proporciona URL', () => {
    expect(getImageCandidateUrls('')).toEqual([]);
  });
});
