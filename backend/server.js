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
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.FRONTEND_ORIGINS ? process.env.FRONTEND_ORIGINS.split(',').map(o => o.trim()).filter(Boolean) : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Permite clientes sin origin (scripts/health checks) y orígenes aprobados.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS bloqueado para origen: ${origin}`));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Ruta para eliminar imagen de Cloudinary (soporta public_ids con sub-carpetas)
app.delete(/^\/api\/images\/(.+)$/, async (req, res) => {
  // En Express 5 los grupos de regex no se exponen en req.params; extraemos de req.path
  const public_id = req.path.replace(/^\/api\/images\//, '').replace(/^\//, '')
    || (req.url || '').split('/api/images/')[1] || '';
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

// Ruta para mover/renombrar imagen en Cloudinary (cambiar de carpeta)
app.post('/api/images/move', async (req, res) => {
  const { from_public_id, to_public_id } = req.body;
  if (!from_public_id || !to_public_id) {
    return res.status(400).json({ message: 'Faltan parámetros from_public_id o to_public_id' });
  }
  try {
    const result = await cloudinary.uploader.rename(from_public_id, to_public_id, { overwrite: true });
    res.status(200).json({ secure_url: result.secure_url, public_id: result.public_id });
  } catch (error) {
    console.error('Error al mover imagen en Cloudinary:', error);
    res.status(500).json({ message: 'Error al mover la imagen', error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en el puerto ${PORT}`);
});
