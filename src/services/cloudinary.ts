import axios from 'axios';

const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

type UploadOptions = {
  folder?: string;
};

export const uploadToCloudinary = async (file: File, options?: UploadOptions) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryUploadPreset);
  if (options?.folder) {
    // Cloudinary crea carpetas si no existen al usar el parámetro folder
    formData.append('folder', options.folder);
  }

  const { data } = await axios.post(
    `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`,
    formData
  );
  return data;
};

export const deleteFromCloudinary = async (publicId: string) => {
  const response = await axios.delete(
    `http://localhost:3001/api/images/${publicId}`
  );
  return response.data;
};
