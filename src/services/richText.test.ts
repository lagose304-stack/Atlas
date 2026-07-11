import { describe, expect, it } from 'vitest';
import { hasHtmlMarkup, toSafeHtml } from './richText';

describe('texto enriquecido seguro', () => {
  it('detecta contenido HTML', () => {
    expect(hasHtmlMarkup('<strong>Atlas</strong>')).toBe(true);
    expect(hasHtmlMarkup('Atlas de Histología')).toBe(false);
  });

  it('elimina scripts y atributos ejecutables', () => {
    const result = toSafeHtml('<p onclick="alert(1)">Texto</p><script>alert(1)</script>');
    expect(result).toContain('<p>Texto</p>');
    expect(result).not.toContain('script');
    expect(result).not.toContain('onclick');
  });

  it('protege enlaces que se abren en una pestaña nueva', () => {
    const result = toSafeHtml('<a href="https://example.com">Referencia</a>');
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('target="_blank"');
  });
});
