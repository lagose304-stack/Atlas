import axios from 'axios';
import { getAtlasSessionToken } from './supabase';

const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const resolveBackendBaseUrl = () => {
  const configured = (import.meta.env.VITE_BACKEND_BASE_URL || '').trim();
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

  const configuredIsDisabledMarker = /^(none|null|empty|__empty__|no_aplica|n\/a)$/i.test(configured);
  if (configuredIsDisabledMarker) {
    return '';
  }

  if (configured) {
    const normalized = configured.replace(/\/+$/, '');
    const configuredIsLocalhost = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized);

    // En producción ignoramos localhost para evitar dependencia de una PC encendida.
    if (!isLocal && configuredIsLocalhost) {
      return '';
    }

    return normalized;
  }

  // En desarrollo local usamos backend local; en producción usamos rutas relativas
  // para ejecutar Cloudflare Functions en el mismo dominio del frontend.
  return isLocal ? 'http://localhost:3001' : '';
};

const backendBaseUrl = resolveBackendBaseUrl();
const backendUrl = (path: string) => (backendBaseUrl ? `${backendBaseUrl}${path}` : path);
const isUsingEdgeFunctions = !backendBaseUrl;
const authHeaders = () => {
  const token = getAtlasSessionToken();
  return token ? { 'X-Atlas-Session': token } : {};
};

export type UploadOptions = {
  folder?: string;
  optimizeForPlaque?: boolean;
  optimizeImage?: boolean;
};

const PLAQUE_MIN_BYTES_TO_OPTIMIZE = 1.5 * 1024 * 1024;
const PLAQUE_JPEG_QUALITY = 0.94;
const IMAGE_MIN_BYTES_TO_OPTIMIZE = 0.8 * 1024 * 1024;
const IMAGE_MAX_DIMENSION = 2400;
const IMAGE_WEBP_QUALITY = 0.88;

const shouldOptimizePlaque = (file: File) => {
  if (file.size < PLAQUE_MIN_BYTES_TO_OPTIMIZE) return false;
  return file.type.startsWith('image/');
};

const shouldOptimizeImage = (file: File) => {
  if (file.size < IMAGE_MIN_BYTES_TO_OPTIMIZE) return false;
  return file.type.startsWith('image/');
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

const dataUrlToImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen para optimizar.'));
    img.src = dataUrl;
  });

const canvasToBlobWithType = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo exportar la imagen optimizada.'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });

const hasAlphaPixels = (ctx: CanvasRenderingContext2D, width: number, height: number): boolean => {
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 16) {
    if (data[i] < 255) {
      return true;
    }
  }
  return false;
};

const extensionForMimeType = (mimeType: string): string => {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
};

const optimizeImageFile = async (file: File): Promise<File> => {
  const dataUrl = await fileToDataUrl(file);
  const image = await dataUrlToImage(dataUrl);

  const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const keepsAlpha = file.type === 'image/png' && hasAlphaPixels(ctx, targetWidth, targetHeight);
  const targetMimeType: 'image/png' | 'image/webp' = keepsAlpha ? 'image/png' : 'image/webp';
  const quality = targetMimeType === 'image/webp' ? IMAGE_WEBP_QUALITY : undefined;

  const optimizedBlob = await canvasToBlobWithType(canvas, targetMimeType, quality);

  if (optimizedBlob.size >= file.size * 0.98) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, '');
  const extension = extensionForMimeType(targetMimeType);
  return new File([optimizedBlob], `${baseName}.${extension}`, {
    type: targetMimeType,
    lastModified: Date.now(),
  });
};

const optimizePlaqueFile = async (file: File): Promise<File> => {
  const dataUrl = await fileToDataUrl(file);
  const image = await dataUrlToImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  // Convertimos a WebP manteniendo resolución original para alta fidelidad y peso mínimo
  ctx.drawImage(image, 0, 0);

  const optimizedBlob = await canvasToBlobWithType(canvas, 'image/webp', PLAQUE_JPEG_QUALITY);

  if (optimizedBlob.size >= file.size * 0.98) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([optimizedBlob], `${baseName}.webp`, {
    type: 'image/webp',
    lastModified: Date.now(),
  });
};

/**
 * Subida universal compatible con Cloudflare R2 (vía Backend/Edge) y Cloudinary (fallback)
 */
export const uploadToCloudinary = async (file: File, options?: UploadOptions) => {
  let fileToUpload = file;

  if (options?.optimizeForPlaque && shouldOptimizePlaque(file)) {
    try {
      fileToUpload = await optimizePlaqueFile(file);
    } catch {
      fileToUpload = file;
    }
  } else if (options?.optimizeImage && shouldOptimizeImage(file)) {
    try {
      fileToUpload = await optimizeImageFile(file);
    } catch {
      fileToUpload = file;
    }
  }

  const formData = new FormData();
  formData.append('file', fileToUpload);
  if (options?.folder) {
    formData.append('folder', options.folder);
  }

  // 1. Intento principal: Subir a Cloudflare R2 a través del endpoint de backend / edge function
  try {
    const uploadUrl = isUsingEdgeFunctions
      ? '/api/images-upload'
      : backendUrl('/api/images/upload');

    const { data } = await axios.post(uploadUrl, formData, {
      headers: {
        ...authHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    });

    if (data?.secure_url) {
      return data;
    }
  } catch (r2UploadError) {
    console.warn('Subida a R2 no disponible o fallida, intentando fallback...', r2UploadError);
  }

  // 2. Fallback: Cloudinary directo si está configurado
  if (cloudinaryCloudName && cloudinaryUploadPreset) {
    const cldFormData = new FormData();
    cldFormData.append('file', fileToUpload);
    cldFormData.append('upload_preset', cloudinaryUploadPreset);
    if (options?.folder) {
      cldFormData.append('folder', options.folder);
    }

    try {
      const { data } = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`,
        cldFormData
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const cloudinaryMessage =
          (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message ||
          error.response?.data?.message ||
          error.message;
        throw new Error(`Error en subida: ${cloudinaryMessage}`);
      }
    }
  }

  throw new Error('No se pudo subir la imagen al almacenamiento.');
};

type DeleteFromCloudinaryInput =
  | string
  | {
      publicId?: string;
      imageUrl?: string;
    };

export const deleteFromCloudinary = async (input: DeleteFromCloudinaryInput) => {
  const parsed = typeof input === 'string'
    ? (/^https?:\/\//i.test(input) ? { imageUrl: input } : { publicId: input })
    : input;

  const publicId = (parsed.publicId || '').trim();
  const imageUrl = (parsed.imageUrl || '').trim();

  if (!publicId && !imageUrl) {
    throw new Error('Se requiere publicId o imageUrl para borrar la imagen.');
  }

  const resolvedPublicId = publicId || getCloudinaryPublicId(imageUrl);
  if (!resolvedPublicId) {
    throw new Error('No se pudo resolver el identificador para eliminar la imagen.');
  }

  if (isUsingEdgeFunctions) {
    const response = await axios.delete('/api/images-delete', {
      headers: authHeaders(),
      params: {
        publicId: resolvedPublicId,
        ...(imageUrl ? { imageUrl } : {}),
      },
    });
    return response.data;
  }

  const response = await axios.delete(backendUrl(`/api/images/${encodeURIComponent(resolvedPublicId)}`), {
    headers: authHeaders(),
    params: { publicId: resolvedPublicId },
  });
  return response.data;
};

export const moveCloudinaryImage = async (fromPublicId: string, toPublicId: string): Promise<{ secure_url: string; public_id: string }> => {
  const payload = {
    from_public_id: fromPublicId,
    to_public_id: toPublicId,
  };
  const response = isUsingEdgeFunctions
    ? await axios.post('/api/images-move', payload, { headers: authHeaders() })
    : await axios.post(backendUrl('/api/images/move'), payload, { headers: authHeaders() });
  return response.data;
};

/**
 * Extrae el ID / Key tanto de URLs de Cloudinary como de Cloudflare R2
 */
export const getCloudinaryPublicId = (url: string): string => {
  if (!url || typeof url !== 'string') return '';

  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');

    // Caso 1: URL de Cloudinary (/upload/...)
    const uploadToken = 'upload/';
    const uploadIndex = pathname.indexOf(uploadToken);
    if (uploadIndex !== -1) {
      const afterUpload = pathname.slice(uploadIndex + uploadToken.length);
      let segments = afterUpload.split('/').filter(Boolean);
      if (segments.length === 0) return '';

      const versionIndex = segments.findIndex((s) => /^v\d+$/.test(s));
      if (versionIndex >= 0) {
        segments = segments.slice(versionIndex + 1);
      } else {
        const isTransformationSegment = (segment: string) =>
          /^([a-z]{1,3}_[^/]+)(,[a-z]{1,3}_[^/]+)*$/.test(segment);
        while (segments.length > 1 && isTransformationSegment(segments[0])) {
          segments.shift();
        }
      }

      if (segments.length === 0) return '';
      const last = segments[segments.length - 1];
      segments[segments.length - 1] = last.replace(/\.[^.]+$/, '');
      return segments.join('/');
    }

    // Caso 2: URL de Cloudflare R2 o subdominio directo (ej. pub-xxxx.r2.dev/placas/...)
    return pathname;
  } catch {
    return url.replace(/^\/+/, '');
  }
};
