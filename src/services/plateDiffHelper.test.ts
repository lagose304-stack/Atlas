import { describe, expect, it } from 'vitest';
import {
  computePlateChangesDiff,
  describeLogChanges,
  formatCleanActorName,
  hasPlateStateChanges,
} from './plateDiffHelper';

describe('plateDiffHelper', () => {
  describe('formatCleanActorName', () => {
    it('convierte correos electrónicos en nombres legibles si no hay coincidencia en directorio', () => {
      expect(formatCleanActorName('carlos.lagos@gmail.com')).toBe('Carlos Lagos');
      expect(formatCleanActorName('ana_maria_garcia@atlas.org')).toBe('Ana Maria Garcia');
      expect(formatCleanActorName('rodrigo@unam.mx')).toBe('Rodrigo');
    });

    it('utiliza el nombre del directorio de usuarios si coincide por ID o username', () => {
      const userDir = new Map<string | number, string>();
      userDir.set(10, 'Dr. Roberto Gómez');
      userDir.set('roberto@correo.com', 'Dr. Roberto Gómez');

      expect(formatCleanActorName('roberto@correo.com', 'roberto@correo.com', 10, userDir)).toBe('Dr. Roberto Gómez');
      expect(formatCleanActorName(null, 'roberto@correo.com', null, userDir)).toBe('Dr. Roberto Gómez');
    });

    it('devuelve Usuario del sistema si no hay datos', () => {
      expect(formatCleanActorName(null, null, null)).toBe('Usuario del sistema');
      expect(formatCleanActorName('', '', null)).toBe('Usuario del sistema');
    });
  });

  describe('computePlateChangesDiff', () => {
    it('detecta adición y eliminación de señalados', () => {
      const before = {
        senalados: ['Núcleo', 'Citoplasma'],
        senalados_meta: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
      };
      const after = {
        senalados: ['Citoplasma', 'Membrana basal'],
        senalados_meta: [{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }],
      };

      const diff = computePlateChangesDiff(before, after);
      expect(diff).toContain('Agregó el señalado "Membrana basal"');
      expect(diff).toContain('Borró el señalado "Núcleo"');
    });

    it('detecta reubicación y modificación de contornos', () => {
      const before = {
        senalados: ['Glomérulo', 'Túbulo'],
        senalados_meta: [
          { x: 0.2, y: 0.2, regionPoints: [0.1, 0.1, 0.3, 0.1, 0.3, 0.3, 0.1, 0.3] },
          { x: 0.5, y: 0.5 },
        ],
      };
      const after = {
        senalados: ['Glomérulo', 'Túbulo'],
        senalados_meta: [
          { x: 0.2, y: 0.2, regionPoints: [0.1, 0.1, 0.4, 0.1, 0.4, 0.4, 0.1, 0.4] }, // contorno modificado
          { x: 0.8, y: 0.8 }, // reubicado
        ],
      };

      const diff = computePlateChangesDiff(before, after);
      expect(diff).toContain('Modificó el contorno / borde del señalado "Glomérulo"');
      expect(diff).toContain('Reubicó la posición del señalado "Túbulo"');
    });

    it('detecta cambios de aumento y tinción', () => {
      const before = { aumento: 'x10', tincion: 'H&E' };
      const after = { aumento: 'x40', tincion: 'PAS' };

      const diff = computePlateChangesDiff(before, after);
      expect(diff).toContain('Cambió el aumento de "x10" a "x40"');
      expect(diff).toContain('Cambió la tinción de "H&E" a "PAS"');
    });

    it('detecta ajustes finos de posición, estilo visual, huecos y mayúsculas', () => {
      const before = {
        senalados: ['epitelio', 'lumen'],
        senalados_meta: [
          {
            x: 0.25,
            y: 0.25,
            regionPoints: [0.1, 0.1, 0.3, 0.1, 0.3, 0.3],
            regionHoles: [[0.15, 0.15, 0.2, 0.15, 0.2, 0.2]],
            regionColor: '#22c55e',
            regionOpacity: 0.28,
          },
          { x: 0.5, y: 0.5, startX: null, startY: null },
        ],
      };
      const after = {
        senalados: ['Epitelio', 'lumen'],
        senalados_meta: [
          {
            x: 0.25,
            y: 0.25,
            regionPoints: [0.1, 0.1, 0.3, 0.1, 0.3, 0.3],
            regionHoles: [[0.151, 0.15, 0.2, 0.15, 0.2, 0.2]],
            regionColor: '#ef4444',
            regionOpacity: 0.28,
          },
          { x: 0.501, y: 0.5, startX: 0.45, startY: 0.45 },
        ],
      };

      const diff = computePlateChangesDiff(before, after);
      expect(diff).toContain('Renombró el señalado "epitelio" a "Epitelio"');
      expect(diff).toContain('Ajustó las zonas de exclusión (huecos) del señalado "Epitelio"');
      expect(diff).toContain('Actualizó el estilo visual del señalado "Epitelio"');
      expect(diff).toContain('Reubicó la posición del señalado "lumen"');
    });
  });

  describe('hasPlateStateChanges', () => {
    it('no reporta cambios cuando el estado es equivalente aunque difiera null/undefined/[]', () => {
      const before = {
        aumento: 'x10',
        tincion: null,
        comentario: '',
        senalados: null,
        senalados_meta: null,
      };
      const after = {
        aumento: 'x10',
        tincion: '',
        comentario: '   ',
        senalados: [],
        senalados_meta: [],
      };

      expect(hasPlateStateChanges(before, after)).toBe(false);
    });

    it('detecta movimientos mínimos de posición y de origen de flecha sin cambiar el nombre', () => {
      const base = {
        senalados: ['Núcleo'],
        senalados_meta: [{ label: 'Núcleo', x: 0.5, y: 0.5, startX: null, startY: null }],
      };

      expect(
        hasPlateStateChanges(base, {
          senalados: ['Núcleo'],
          senalados_meta: [{ x: 0.5005, y: 0.5, startX: null, startY: null }],
        })
      ).toBe(true);

      expect(
        hasPlateStateChanges(base, {
          senalados: ['Núcleo'],
          senalados_meta: [{ x: 0.5, y: 0.5, startX: 0.42, startY: 0.42 }],
        })
      ).toBe(true);
    });

    it('detecta ajustes finos en vértices de contorno, huecos y propiedades visuales de borde', () => {
      const base = {
        senalados: ['Glomérulo'],
        senalados_meta: [
          {
            label: 'Glomérulo',
            x: 0.3,
            y: 0.3,
            regionPoints: [0.1, 0.1, 0.4, 0.1, 0.4, 0.4],
            regionHoles: [[0.2, 0.2, 0.25, 0.2, 0.25, 0.25]],
            regionColor: '#22c55e',
            regionOpacity: 0.28,
            regionStrokeWidth: 2,
            regionDashLength: 0,
            regionDashGap: 0,
            regionSmooth: false,
          },
        ],
      };

      // Vértice de contorno
      expect(
        hasPlateStateChanges(base, {
          senalados: ['Glomérulo'],
          senalados_meta: [{ ...base.senalados_meta[0], regionPoints: [0.1002, 0.1, 0.4, 0.1, 0.4, 0.4] }],
        })
      ).toBe(true);

      // Vértice de hueco
      expect(
        hasPlateStateChanges(base, {
          senalados: ['Glomérulo'],
          senalados_meta: [{ ...base.senalados_meta[0], regionHoles: [[0.2005, 0.2, 0.25, 0.2, 0.25, 0.25]] }],
        })
      ).toBe(true);

      // Color, opacidad, grosor, guiones y suavizado
      expect(
        hasPlateStateChanges(base, {
          senalados: ['Glomérulo'],
          senalados_meta: [{ ...base.senalados_meta[0], regionColor: '#3b82f6' }],
        })
      ).toBe(true);
      expect(
        hasPlateStateChanges(base, {
          senalados: ['Glomérulo'],
          senalados_meta: [{ ...base.senalados_meta[0], regionOpacity: 0.3 }],
        })
      ).toBe(true);
      expect(
        hasPlateStateChanges(base, {
          senalados: ['Glomérulo'],
          senalados_meta: [{ ...base.senalados_meta[0], regionStrokeWidth: 3 }],
        })
      ).toBe(true);
      expect(
        hasPlateStateChanges(base, {
          senalados: ['Glomérulo'],
          senalados_meta: [{ ...base.senalados_meta[0], regionDashLength: 6 }],
        })
      ).toBe(true);
      expect(
        hasPlateStateChanges(base, {
          senalados: ['Glomérulo'],
          senalados_meta: [{ ...base.senalados_meta[0], regionDashGap: 4 }],
        })
      ).toBe(true);
      expect(
        hasPlateStateChanges(base, {
          senalados: ['Glomérulo'],
          senalados_meta: [{ ...base.senalados_meta[0], regionSmooth: true }],
        })
      ).toBe(true);
    });

    it('detecta cambios de mayúsculas, reordenamiento, metadatos e imagen nueva', () => {
      const base = {
        tema_id: 1,
        subtema_id: 2,
        aumento: 'x10',
        tincion: 'H&E',
        comentario: 'Corte transversal',
        senalados: ['A', 'B'],
        senalados_meta: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
      };

      expect(hasPlateStateChanges(base, { ...base, senalados: ['a', 'B'] })).toBe(true);
      expect(
        hasPlateStateChanges(base, {
          ...base,
          senalados: ['B', 'A'],
          senalados_meta: [{ x: 0.2, y: 0.2 }, { x: 0.1, y: 0.1 }],
        })
      ).toBe(true);
      expect(hasPlateStateChanges(base, { ...base, comentario: 'Corte transversal.' })).toBe(true);
      expect(hasPlateStateChanges(base, { ...base, subtema_id: 3 })).toBe(true);
      expect(hasPlateStateChanges(base, base, { isNewImageReplaced: true })).toBe(true);
      expect(hasPlateStateChanges({ ...base, is_published: false }, { ...base, is_published: true })).toBe(true);
      expect(hasPlateStateChanges({ ...base, is_published: true }, { ...base, is_published: false })).toBe(true);
      expect(hasPlateStateChanges({ ...base, is_published: undefined }, { ...base, is_published: true })).toBe(false);
    });

    it('registra en computePlateChangesDiff cuando se publica o pasa a borrador', () => {
      expect(computePlateChangesDiff({ is_published: false }, { is_published: true })).toContain(
        'Publicó la placa para la vista pública'
      );
      expect(computePlateChangesDiff({ is_published: true }, { is_published: false })).toContain(
        'Pasó la placa a borrador (oculta en la vista pública)'
      );
    });
  });

  describe('describeLogChanges', () => {
    it('usa cambios_resumen si está presente en details', () => {
      const log = {
        entity_type: 'placa',
        action_type: 'update',
        entity_name: 'Placa #1',
        details: {
          cambios_resumen: ['Agregó el señalado "Mitocondria"', 'Cambió aumento a x100'],
        },
      };

      expect(describeLogChanges(log)).toEqual([
        'Agregó el señalado "Mitocondria"',
        'Cambió aumento a x100',
      ]);
    });

    it('desglosa acciones de creación o subida de placas', () => {
      const log = {
        entity_type: 'placa',
        action_type: 'create',
        entity_name: 'Placa #2',
        details: {
          original_action: 'upload_classified',
          subtema_nombre: 'Riñón',
          aumento: 'x40',
        },
      };

      const res = describeLogChanges(log);
      expect(res).toContain('Subió una nueva placa al catálogo');
      expect(res).toContain('Asignada al subtema: "Riñón"');
      expect(res).toContain('Aumento inicial: x40');
    });
  });
});
