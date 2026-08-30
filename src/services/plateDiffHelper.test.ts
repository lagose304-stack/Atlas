import { describe, expect, it } from 'vitest';
import {
  computePlateChangesDiff,
  describeLogChanges,
  formatCleanActorName,
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
