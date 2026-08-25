import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.error('❌ Faltan credenciales de Cloudinary en backend/.env');
  process.exit(1);
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

async function cleanup() {
  console.log('====================================================');
  console.log(`🗑️ LIMPIEZA TOTAL DE ASSETS EN CLOUDINARY (${cloudName})`);
  console.log('====================================================');

  try {
    for (const rType of ['image', 'raw', 'video']) {
      let hasMore = true;
      let nextCursor = undefined;
      while (hasMore) {
        console.log(`Eliminando lote de recursos tipo '${rType}'...`);
        const result = await cloudinary.api.delete_all_resources({
          resource_type: rType,
          all: true,
          next_cursor: nextCursor,
        });
        if (result.next_cursor) {
          nextCursor = result.next_cursor;
        } else {
          hasMore = false;
        }
      }
    }

    console.log('\nEliminando todas las subcarpetas...');
    async function deleteSubfoldersRecursive(folderPath = '') {
      try {
        const res = folderPath
          ? await cloudinary.api.sub_folders(folderPath)
          : await cloudinary.api.root_folders();

        for (const f of res.folders || []) {
          await deleteSubfoldersRecursive(f.path);
          try {
            await cloudinary.api.delete_folder(f.path);
            console.log(`   - Carpeta eliminada: ${f.path}`);
          } catch (e) {
            // continuar
          }
        }
      } catch (err) {
        // continuar
      }
    }

    await deleteSubfoldersRecursive();

    console.log('\n🎉 ¡Todos los recursos y carpetas de Cloudinary han sido eliminados por completo!');
  } catch (error) {
    console.error('Error al limpiar Cloudinary:', error.message);
  }
}

cleanup();
