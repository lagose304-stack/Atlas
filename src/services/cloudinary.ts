import axios from 'axios';
import { getAtlasSessionToken } from './supabase';

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

    if (isLocal && configuredIsLocalhost) {
      // En local, Vite dev server atiende directamente las rutas relativas /api/*
      return '';
    }

    if (!isLocal && configuredIsLocalhost) {
      return '';
    }

    return normalized;
  }

  return '';
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
  quality?: number;
  maxDimension?: number;
};

// Calibración de máxima calidad WebP para microscopía y UI
const PLAQUE_WEBP_QUALITY = 0.94; // Fidelidad diagnóstica superior sin distorsión
const GENERAL_WEBP_QUALITY = 0.92;
const MAX_PLAQUE_DIMENSION = 3400; // Resolución ultra-alta para zoom microscópico
const MAX_GENERAL_DIMENSION = 2400;

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
          reject(new Error('No se pudo exportar la imagen optimizada a WebP.'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });

/**
 * Conversión universal a WebP de máxima calidad diagnóstica en el navegador
 */
export const convertAndOptimizeToWebP = async (
  file: File,
  options?: { isPlaque?: boolean; customQuality?: number; customMaxDimension?: number }
): Promise<File> => {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const isPlaque = options?.isPlaque ?? true;
  const targetQuality = options?.customQuality ?? (isPlaque ? PLAQUE_WEBP_QUALITY : GENERAL_WEBP_QUALITY);
  const maxDim = options?.customMaxDimension ?? (isPlaque ? MAX_PLAQUE_DIMENSION : MAX_GENERAL_DIMENSION);

  try {
    const dataUrl = await fileToDataUrl(file);
    const image = await dataUrlToImage(dataUrl);

    let width = image.naturalWidth || image.width;
    let height = image.naturalHeight || image.height;

    // Solo reescalamos si excede la dimensión máxima ultra-alta permitida
    if (width > maxDim || height > maxDim) {
      if (width >= height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return file;

    // Renderizar con máxima suavidad
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);

    const webpBlob = await canvasToBlobWithType(canvas, 'image/webp', targetQuality);

    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    return new File([webpBlob], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn('Conversión a WebP en cliente falló, subiendo archivo original:', err);
    return file;
  }
};

/**
 * Subida universal a Cloudflare R2: Convierte SIEMPRE y obligatoriamente a WebP
 */
export const uploadToCloudinary = async (file: File, options?: UploadOptions) => {
  const isPlaque = options?.optimizeForPlaque || (!options?.optimizeImage && file.size > 1.2 * 1024 * 1024);
  
  // 1. Conversión universal y obligatoria a WebP de máxima calidad
  const webpFile = await convertAndOptimizeToWebP(file, {
    isPlaque,
    customQuality: options?.quality,
    customMaxDimension: options?.maxDimension,
  });

  const formData = new FormData();
  formData.append('file', webpFile);
  if (options?.folder) {
    formData.append('folder', options.folder);
  }

  const uploadUrl = isUsingEdgeFunctions
    ? '/api/images-upload'
    : backendUrl('/api/images/upload');

  try {
    const { data } = await axios.post(uploadUrl, formData, {
      headers: {
        ...authHeaders(),
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });

    if (data?.secure_url) {
      return data;
    }

    throw new Error('No se pudo obtener la URL de la imagen subida.');
  } catch (error: any) {
    const detail = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Error al conectar con el servidor de subida';
    console.error('Error al subir imagen a Cloudflare R2:', detail, error);
    throw new Error(detail);
  }
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

  try {
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
  } catch (error: any) {
    const detail = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Error al eliminar imagen';
    console.warn('Error al eliminar imagen:', detail);
    throw new Error(detail);
  }
};

export const moveCloudinaryImage = async (fromPublicId: string, toPublicId: string): Promise<{ secure_url: string; public_id: string }> => {
  const payload = {
    from_public_id: fromPublicId,
    to_public_id: toPublicId,
  };

  try {
    const response = isUsingEdgeFunctions
      ? await axios.post('/api/images-move', payload, { headers: authHeaders() })
      : await axios.post(backendUrl('/api/images/move'), payload, { headers: authHeaders() });
    return response.data;
  } catch (error: any) {
    const detail = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Error al mover imagen';
    console.error('Error al mover imagen:', detail);
    throw new Error(detail);
  }
};

/**
 * Extrae el Key / Identificador de la imagen en Cloudflare R2
 */
export const getCloudinaryPublicId = (url: string): string => {
  if (!url || typeof url !== 'string') return '';

  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');

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

    return pathname;
  } catch {
    return url.replace(/^\/+/, '');
  }
};
