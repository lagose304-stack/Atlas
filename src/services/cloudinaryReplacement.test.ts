import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceCloudinaryImage, uploadToCloudinary, convertAndOptimizeToWebP, generateWebPThumbnail } from './cloudinary';

vi.mock('axios', () => ({ default: { post: vi.fn(), delete: vi.fn() } }));
vi.mock('./supabase', () => ({ getAtlasSessionToken: () => 'isolated-test-session' }));

describe('Reemplazo seguro de imágenes en R2', () => {
  beforeEach(() => {
    vi.stubGlobal('FileReader', class {
      result = 'data:image/webp;base64,dGVzdA==';
      onload?: () => void;
      readAsDataURL() { this.onload?.(); }
    });
    vi.stubGlobal('Image', class {
      naturalWidth = 200;
      naturalHeight = 100;
      onload?: () => void;
      set src(_value: string) { this.onload?.(); }
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['webp'], { type: 'image/webp' })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.mocked(axios.post).mockReset();
  });

  it('sube original y miniatura con una clave nueva y conserva el archivo previo', async () => {
    vi.mocked(axios.post).mockImplementation(async (_url, body) => {
      const form = body as FormData;
      const key = String(form.get('targetKey'));
      expect(form.get('file')).toBeInstanceOf(File);
      expect(form.get('thumb')).toBeInstanceOf(File);
      return { data: { secure_url: `https://r2.atlas-tests.invalid/${key}`, public_id: key } };
    });
    const result = await replaceCloudinaryImage(new File(['imagen'], 'corte.png', { type: 'image/png' }), 'placas/origen/anterior.webp');
    expect(result.public_id).toMatch(/^placas\/origen\/\d+_[0-9a-f-]{36}_.+\.webp$/);
    expect(result.public_id).not.toBe('placas/origen/anterior.webp');
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it('no borra archivos cuando falla la subida', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(new Error('Fallo simulado'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(replaceCloudinaryImage(new File(['imagen'], 'corte.png', { type: 'image/png' }), 'placas/anterior.webp')).rejects.toThrow('Fallo simulado');
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it('genera claves distintas para reemplazos simultáneos del mismo archivo', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    vi.mocked(axios.post).mockImplementation(async (_url, body) => {
      const key = String((body as FormData).get('targetKey'));
      return { data: { secure_url: `https://r2.atlas-tests.invalid/${key}`, public_id: key } };
    });
    const file = new File(['imagen'], 'corte.png', { type: 'image/png' });
    const [first, second] = await Promise.all([
      replaceCloudinaryImage(file, 'placas/anterior.webp'),
      replaceCloudinaryImage(file, 'placas/anterior.webp'),
    ]);
    expect(first.public_id).not.toBe(second.public_id);
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it.each(['upload', 'replace'])('detiene %s si el navegador no puede convertir la imagen', async operation => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValueOnce(null);
    const file = new File(['imagen'], 'corte.png', { type: 'image/png' });
    const promise = operation === 'upload' ? uploadToCloudinary(file) : replaceCloudinaryImage(file, 'placas/anterior.webp');
    await expect(promise).rejects.toThrow('No se pudo convertir');
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it('rechaza un canvas que devuelve PNG cuando se solicitó WebP', async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementationOnce(callback => callback(new Blob(['png'], { type: 'image/png' })));
    await expect(uploadToCloudinary(new File(['imagen'], 'corte.png', { type: 'image/png' }))).rejects.toThrow('No se pudo convertir');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('no sube la imagen si falla la generación de la miniatura', async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob)
      .mockImplementationOnce(callback => callback(new Blob(['webp'], { type: 'image/webp' })))
      .mockImplementationOnce(callback => callback(null));
    await expect(uploadToCloudinary(new File(['imagen'], 'corte.png', { type: 'image/png' }))).rejects.toThrow('miniatura WebP');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('rechaza archivos que no son imágenes', async () => {
    await expect(convertAndOptimizeToWebP(new File(['texto'], 'not-image.txt', { type: 'text/plain' }))).rejects.toThrow('imagen válido');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('devuelve archivos WebP diferenciados para original y miniatura', async () => {
    const file = new File(['imagen'], 'corte.png', { type: 'image/png' });
    const converted = await convertAndOptimizeToWebP(file);
    const thumbnail = await generateWebPThumbnail(converted);
    expect(converted.name).toBe('corte.webp');
    expect(thumbnail.name).toBe('corte_thumb.webp');
    expect(converted.type).toBe('image/webp');
    expect(thumbnail.type).toBe('image/webp');
  });
});
