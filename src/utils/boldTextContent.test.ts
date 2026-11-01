import { describe, expect, it } from 'vitest';
import { boldTextContent } from './boldTextContent';

describe('títulos de mapa sin marcas en canvas y anuncios', () => {
  it('mantiene texto previo, acentos y signos sin formato', () => {
    expect(boldTextContent('Epitelio á ñ *')).toBe('Epitelio á ñ *');
  });
  it('elimina solo pares de marcas de negrita, conservando su contenido', () => {
    expect(boldTextContent('**Núcleo** de **célula**')).toBe('Núcleo de célula');
  });
});
