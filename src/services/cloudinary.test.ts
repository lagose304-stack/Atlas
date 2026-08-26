import { describe, expect, it } from 'vitest';
import { slugify, buildPlacaStorageKey, getCloudinaryPublicId } from './cloudinary';

describe('cloudinary / R2 helpers', () => {
  describe('slugify', () => {
    it('normaliza acentos, espacios y caracteres especiales en guiones bajos', () => {
      expect(slugify('Tejido Epitelial')).toBe('Tejido_Epitelial');
      expect(slugify('Epitelio Cilíndrico Pseudoestratificado Ciliado')).toBe('Epitelio_Cilindrico_Pseudoestratificado_Ciliado');
      expect(slugify('  ¡Órganos & Tejidos!  ')).toBe('Organos_Tejidos');
      expect(slugify('placa-01 (100x)')).toBe('placa_01_100x');
    });

    it('maneja strings vacíos o nulos limpiamente', () => {
      expect(slugify('')).toBe('');
      expect(slugify('   ')).toBe('');
    });
  });

  describe('getCloudinaryPublicId', () => {
    it('extrae el public_id o key de una URL de R2', () => {
      const url = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/sin_clasificar/1724630000000_muestra.webp';
      expect(getCloudinaryPublicId(url)).toBe('placas/sin_clasificar/1724630000000_muestra.webp');
    });

    it('extrae el path relativo si ya es una clave de almacenamiento', () => {
      expect(getCloudinaryPublicId('placas/sin_clasificar/muestra.webp')).toBe('placas/sin_clasificar/muestra.webp');
    });
  });

  describe('buildPlacaStorageKey', () => {
    it('construye la ruta estándar de tema y subtema en placas', () => {
      const tema = 'Tejido Muscular';
      const subtema = 'Músculo Esquelético';
      const url = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/sin_clasificar/1740000000_corte.webp';

      const key = buildPlacaStorageKey(tema, subtema, url);
      expect(key).toBe('placas/Tejido_Muscular/Musculo_Esqueletico/1740000000_corte.webp');
    });

    it('asigna extensión .webp si el archivo de origen no tiene extensión', () => {
      const key = buildPlacaStorageKey('Epitelio', 'Simple', 'corte_histologico');
      expect(key).toBe('placas/Epitelio/Simple/corte_histologico.webp');
    });

    it('mantiene nombres seguros de archivo con timestamp y su extensión original', () => {
      const keyJpg = buildPlacaStorageKey('Cartílago', 'Hialino', 'placas/sin_clasificar/1725000000000_matriz.jpg');
      expect(keyJpg).toBe('placas/Cartilago/Hialino/1725000000000_matriz.jpg');

      const keyWebp = buildPlacaStorageKey('Cartílago', 'Hialino', 'placas/sin_clasificar/1725000000000_matriz.webp');
      expect(keyWebp).toBe('placas/Cartilago/Hialino/1725000000000_matriz.webp');
    });
  });
});
