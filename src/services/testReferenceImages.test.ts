import { describe, expect, it, vi } from 'vitest';

vi.mock('./cloudinary', () => ({
  deleteFromCloudinary: vi.fn(),
  getCloudinaryPublicId: (url: string) => {
    const pathname = new URL(url).pathname.replace(/^\/+/, '');
    return pathname;
  },
}));

import { getTestReferenceFolder, isOwnedTestReferenceUrl } from './testReferenceImages';

describe('testReferenceImages', () => {
  it('construye una carpeta exclusiva para cada prueba', () => {
    expect(getTestReferenceFolder('prueba-123')).toBe('pruebas/referencias/prueba-123');
  });

  it('reconoce únicamente referencias que pertenecen a la prueba indicada', () => {
    const ownUrl = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/pruebas/referencias/prueba-123/referencia.webp';
    const anotherTestUrl = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/pruebas/referencias/prueba-999/referencia.webp';
    const atlasPlateUrl = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/epitelio/placa.jpg';

    expect(isOwnedTestReferenceUrl(ownUrl, 'prueba-123')).toBe(true);
    expect(isOwnedTestReferenceUrl(anotherTestUrl, 'prueba-123')).toBe(false);
    expect(isOwnedTestReferenceUrl(atlasPlateUrl, 'prueba-123')).toBe(false);
  });
});
