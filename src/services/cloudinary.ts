import axios from 'axios';

const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const uploadToCloudinary = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryUploadPreset);

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
