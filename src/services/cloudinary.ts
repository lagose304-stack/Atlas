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

/**
 * Genera una miniatura WebP en el navegador a partir de un archivo de imagen
 */
export const generateWebPThumbnail = async (
  file: File,
  maxWidth = 480,
  quality = 0.8
): Promise<File> => {
  try {
    const dataUrl = await fileToDataUrl(file);
    const image = await dataUrlToImage(dataUrl);

    let width = image.naturalWidth || image.width;
    let height = image.naturalHeight || image.height;

    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return file;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlobWithType(canvas, 'image/webp', quality);
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    return new File([blob], `${baseName}_thumb.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn('No se pudo generar la miniatura WebP en cliente:', err);
    return file;
  }
};

/**
 * Reemplaza una imagen existente en Cloudflare R2 con el mismo nombre y clave exacta,
 * convirtiéndola a WebP optimizado y actualizando también su miniatura asociada.
 */
export const replaceCloudinaryImage = async (
  file: File,
  targetKeyOrUrl: string,
  options?: UploadOptions
): Promise<{ secure_url: string; public_id: string }> => {
  if (!targetKeyOrUrl) {
    throw new Error('Se requiere la ruta o URL original para reemplazar la imagen.');
  }

  // 1. Quitar cualquier query string previo (ej: ?v=...)
  const cleanTarget = targetKeyOrUrl.trim().split('?')[0];

  const rawKey = getCloudinaryPublicId(cleanTarget);
  const oldKey = rawKey
    .replace(/^\/+/, '')
    .replace(/^atlas-media\//i, '')
    .replace(/^atlas\//i, '')
    .replace(/_thumb\.webp$/i, '.webp');

  // 2. Extraer la carpeta de la placa existente (ej. 'placas/Ojo/Cornea')
  const lastSlash = oldKey.lastIndexOf('/');
  const folder = lastSlash !== -1 ? oldKey.substring(0, lastSlash) : (options?.folder || 'placas/sin_clasificar');

  // 3. Generar una clave ÚNICA con timestamp nuevo para invalidar por completo cualquier caché previo (navegador y CDN)
  const timestamp = Date.now();
  const rawFileName = slugify(file.name || 'placa').replace(/\.[^.]+$/, '');
  const cleanName = rawFileName.replace(/^\d+_/, '') || 'placa';
  const newKey = `${folder}/${timestamp}_${cleanName}.webp`;

  // 4. Optimizar imagen principal a WebP de alta fidelidad diagnóstica
  const webpFile = await convertAndOptimizeToWebP(file, {
    isPlaque: options?.optimizeForPlaque ?? true,
    customQuality: options?.quality,
    customMaxDimension: options?.maxDimension,
  });

  // 5. Generar miniatura optimizada para compatibilidad con Cloudflare Pages y backend
  const thumbFile = await generateWebPThumbnail(webpFile);

  const formData = new FormData();
  formData.append('file', webpFile);
  formData.append('thumb', thumbFile);
  formData.append('targetKey', newKey);
  formData.append('target_key', newKey);

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
      // 6. Eliminar el archivo antiguo y su miniatura en Cloudflare R2 para no acumular archivos huérfanos
      if (oldKey && oldKey !== newKey) {
        deleteFromCloudinary({ publicId: oldKey }).catch((delErr) => {
          console.warn('[replaceCloudinaryImage] No se pudo borrar el archivo antiguo en R2:', delErr);
        });
      }

      return {
        secure_url: data.secure_url.split('?')[0],
        public_id: data.public_id || newKey,
      };
    }

    throw new Error('No se pudo obtener la confirmación del reemplazo de imagen.');
  } catch (error: any) {
    const detail = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Error al reemplazar la imagen en Cloudflare R2';
    console.error('Error al reemplazar imagen en Cloudflare R2:', detail, error);
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

/**
 * Convierte un texto en slug seguro para carpetas y claves en Cloudflare R2
 */
export const slugify = (text: string): string =>
  (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/**
 * Construye la ruta / Key estandarizada de una placa en Cloudflare R2 a partir del tema, subtema y nombre de archivo o URL
 */
export const buildPlacaStorageKey = (
  temaNombre: string,
  subtemaNombre: string,
  filenameOrUrl: string
): string => {
  const cleanTema = slugify(temaNombre || 'sin_tema');
  const cleanSubtema = slugify(subtemaNombre || 'sin_subtema');

  const rawKey = getCloudinaryPublicId(filenameOrUrl);
  let filename = (rawKey.split('/').pop() || filenameOrUrl.split('/').pop() || `placa_${Date.now()}.webp`).trim();

  // Normalizar extensión a .webp si aplica
  if (!/\.(webp|jpe?g|png|gif|svg)$/i.test(filename)) {
    filename = `${filename.replace(/\.[^.]+$/, '')}.webp`;
  }

  return `placas/${cleanTema}/${cleanSubtema}/${filename}`;
};
