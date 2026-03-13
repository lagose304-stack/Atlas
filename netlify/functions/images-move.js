const cloudinary = require('cloudinary').v2;

const configureCloudinary = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Faltan variables CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY o CLOUDINARY_API_SECRET');
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Método no permitido' }),
    };
  }

  try {
    configureCloudinary();

    const { from_public_id, to_public_id } = JSON.parse(event.body || '{}');
    if (!from_public_id || !to_public_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Faltan parámetros from_public_id o to_public_id' }),
      };
    }

    const result = await cloudinary.uploader.rename(from_public_id, to_public_id, { overwrite: true });
    return {
      statusCode: 200,
      body: JSON.stringify({ secure_url: result.secure_url, public_id: result.public_id }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error al mover la imagen', error: error.message }),
    };
  }
};
