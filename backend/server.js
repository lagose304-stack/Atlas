require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;

// --- Verificación de Variables de Entorno ---
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.error('Error: Faltan variables de entorno de Cloudinary. Asegúrate de que CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, y CLOUDINARY_API_SECRET están definidas en el archivo backend/.env');
  process.exit(1); // Detiene la aplicación si faltan claves
}

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

console.log('Cloudinary configurado correctamente.');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Ruta para eliminar imagen de Cloudinary
app.delete('/api/images/:public_id', async (req, res) => {
  const { public_id } = req.params;
  console.log(`Intentando eliminar imagen con public_id: ${public_id}`);
  try {
    const result = await cloudinary.uploader.destroy(public_id);
    console.log('Respuesta de Cloudinary:', result);
    if (result.result === 'ok' || result.result === 'not found') {
      res.status(200).send({ message: 'Operación de eliminación procesada por Cloudinary.' });
    } else {
      throw new Error(result.result);
    }
  } catch (error) {
    console.error('Error detallado al eliminar la imagen de Cloudinary:', error);
    res.status(500).send({ message: 'Error al eliminar la imagen', error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en el puerto ${PORT}`);
});
