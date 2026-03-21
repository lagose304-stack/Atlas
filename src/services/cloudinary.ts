import axios from 'axios';

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

type UploadOptions = {
  folder?: string;
  optimizeForPlaque?: boolean;
  optimizeImage?: boolean;
};

const PLAQUE_MIN_BYTES_TO_OPTIMIZE = 2 * 1024 * 1024;
const PLAQUE_JPEG_QUALITY = 0.96;
const IMAGE_MIN_BYTES_TO_OPTIMIZE = 1 * 1024 * 1024;
const IMAGE_MAX_DIMENSION = 2200;
const IMAGE_JPEG_QUALITY = 0.9;
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

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo exportar la imagen optimizada.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
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
  const targetMimeType = keepsAlpha
    ? 'image/png'
    : file.type === 'image/webp'
      ? 'image/webp'
      : 'image/jpeg';
  const quality = targetMimeType === 'image/jpeg'
    ? IMAGE_JPEG_QUALITY
    : targetMimeType === 'image/webp'
      ? IMAGE_WEBP_QUALITY
      : undefined;

  const optimizedBlob = await canvasToBlobWithType(canvas, targetMimeType, quality);

  // Conserva original si la mejora no compensa el reprocesado.
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

  // Mantiene resolución original; solo optimiza codificación para reducir peso.
  ctx.drawImage(image, 0, 0);

  const optimizedBlob = await canvasToBlob(canvas, PLAQUE_JPEG_QUALITY);

  // Si no hay mejora de tamaño, conserva original para evitar pérdida innecesaria.
  if (optimizedBlob.size >= file.size * 0.98) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([optimizedBlob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
};

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
  formData.append('upload_preset', cloudinaryUploadPreset);
  if (options?.folder) {
    // Cloudinary crea carpetas si no existen al usar el parámetro folder
    formData.append('folder', options.folder);
  }

  try {
    const { data } = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`,
      formData
    );
    return data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const cloudinaryMessage =
        (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message ||
        error.response?.data?.message ||
        error.message;
      throw new Error(`No se pudo subir la imagen a Cloudinary. ${cloudinaryMessage}`);
    }
    throw new Error('No se pudo subir la imagen a Cloudinary.');
  }
};

export const deleteFromCloudinary = async (publicId: string) => {
  const response = isUsingEdgeFunctions
    ? await axios.delete('/api/images-delete', { params: { publicId } })
    : await axios.delete(backendUrl(`/api/images/${publicId}`));
  return response.data;
};

export const moveCloudinaryImage = async (fromPublicId: string, toPublicId: string): Promise<{ secure_url: string; public_id: string }> => {
  const payload = {
    from_public_id: fromPublicId,
    to_public_id: toPublicId,
  };
  const response = isUsingEdgeFunctions
    ? await axios.post('/api/images-move', payload)
    : await axios.post(backendUrl('/api/images/move'), payload);
  return response.data;
};

export const getCloudinaryPublicId = (url: string): string => {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname);
    const uploadToken = '/upload/';
    const uploadIndex = pathname.indexOf(uploadToken);
    if (uploadIndex === -1) return '';

    // Toma la parte posterior a /upload/ para normalizar transformaciones/versiones.
    const afterUpload = pathname.slice(uploadIndex + uploadToken.length);
    let segments = afterUpload.split('/').filter(Boolean);
    if (segments.length === 0) return '';

    // Si existe segmento de versión (v123...), todo lo anterior no es parte del public_id.
    const versionIndex = segments.findIndex((s) => /^v\d+$/.test(s));
    if (versionIndex >= 0) {
      segments = segments.slice(versionIndex + 1);
    } else {
      // Sin versión, elimina prefijos de transformación comunes (c_..., f_auto, q_auto, etc.).
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
  } catch {
    return '';
  }
};
