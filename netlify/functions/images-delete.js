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
        'Access-Control-Allow-Methods': 'DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Método no permitido' }),
    };
  }

  try {
    configureCloudinary();

    const publicId = event.queryStringParameters?.publicId;
    if (!publicId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Falta el parámetro publicId' }),
      };
    }

    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result === 'ok' || result.result === 'not found') {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Operación de eliminación procesada por Cloudinary.' }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Cloudinary no pudo eliminar la imagen', result }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error al eliminar la imagen', error: error.message }),
    };
  }
};
