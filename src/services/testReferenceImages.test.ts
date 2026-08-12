import { describe, expect, it } from 'vitest';
import { getTestReferenceFolder, isOwnedTestReferenceUrl } from './testReferenceImages';

describe('testReferenceImages', () => {
  it('construye una carpeta exclusiva para cada prueba', () => {
    expect(getTestReferenceFolder('prueba-123')).toBe('pruebas/referencias/prueba-123');
  });

  it('reconoce únicamente referencias que pertenecen a la prueba indicada', () => {
    const ownUrl = 'https://res.cloudinary.com/demo/image/upload/v123/pruebas/referencias/prueba-123/referencia.jpg';
    const anotherTestUrl = 'https://res.cloudinary.com/demo/image/upload/v123/pruebas/referencias/prueba-999/referencia.jpg';
    const atlasPlateUrl = 'https://res.cloudinary.com/demo/image/upload/v123/placas/epitelio/placa.jpg';

    expect(isOwnedTestReferenceUrl(ownUrl, 'prueba-123')).toBe(true);
    expect(isOwnedTestReferenceUrl(anotherTestUrl, 'prueba-123')).toBe(false);
    expect(isOwnedTestReferenceUrl(atlasPlateUrl, 'prueba-123')).toBe(false);
  });
});
