import axios from 'axios';

const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const resolveBackendBaseUrl = () => {
  const configured = (import.meta.env.VITE_BACKEND_BASE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');

  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

  // En desarrollo local usamos backend local; en producción usamos ruta relativa.
  // Esto permite usar proxy/rewrite en Netlify sin hardcodear localhost.
  return isLocal ? 'http://localhost:3001' : '';
};

const backendBaseUrl = resolveBackendBaseUrl();
const backendUrl = (path: string) => (backendBaseUrl ? `${backendBaseUrl}${path}` : path);
const isUsingNetlifyFunctions = !backendBaseUrl;

type UploadOptions = {
  folder?: string;
  optimizeForPlaque?: boolean;
};

const PLAQUE_MIN_BYTES_TO_OPTIMIZE = 2 * 1024 * 1024;
const PLAQUE_JPEG_QUALITY = 0.96;

const shouldOptimizePlaque = (file: File) => {
  if (file.size < PLAQUE_MIN_BYTES_TO_OPTIMIZE) return false;
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
  const response = isUsingNetlifyFunctions
    ? await axios.delete('/.netlify/functions/images-delete', { params: { publicId } })
    : await axios.delete(backendUrl(`/api/images/${publicId}`));
  return response.data;
};

export const moveCloudinaryImage = async (fromPublicId: string, toPublicId: string): Promise<{ secure_url: string; public_id: string }> => {
  const payload = {
    from_public_id: fromPublicId,
    to_public_id: toPublicId,
  };
  const response = isUsingNetlifyFunctions
    ? await axios.post('/.netlify/functions/images-move', payload)
    : await axios.post(backendUrl('/api/images/move'), payload);
  return response.data;
};

export const getCloudinaryPublicId = (url: string): string => {
  try {
    // URL: https://res.cloudinary.com/CLOUD/image/upload/v123456/folder/file.jpg
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
};
