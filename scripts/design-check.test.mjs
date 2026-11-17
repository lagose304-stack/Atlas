import { describe, expect, it } from 'vitest';

import { auditAddedLines, isDesignFile } from './design-check.mjs';

describe('design:check', () => {
  it('reconoce solo archivos de interfaz y excluye pruebas', () => {
    expect(isDesignFile('src/components/Home.tsx')).toBe(true);
    expect(isDesignFile('src/styles/home.css')).toBe(true);
    expect(isDesignFile('src/components/Home.test.tsx')).toBe(false);
    expect(isDesignFile('src/services/supabase.ts')).toBe(false);
    expect(isDesignFile('docs/diseno-web.md')).toBe(false);
  });

  it('falla ante fuentes remotas, Cloudinary y movimiento sin preferencia reducida', () => {
    const result = auditAddedLines([
      { file: 'src/styles/a.css', text: "@import url('https://fonts.googleapis.com/css2?family=Inter');" },
      { file: 'src/components/A.tsx', text: 'const url = "https://res.cloudinary.com/demo/image.jpg";' },
      { file: 'src/styles/a.css', text: 'animation: spin 2s infinite;' },
    ]);

    expect(result.issues).toHaveLength(3);
  });

  it('acepta movimiento infinito cuando existe prefers-reduced-motion', () => {
    const result = auditAddedLines(
      [{ file: 'src/styles/a.css', text: 'animation: spin 2s infinite;' }],
      '@media (prefers-reduced-motion: reduce) { animation: none; }',
    );

    expect(result.issues).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });

  it('avisa de patrones genéricos sin bloquear el cierre', () => {
    const result = auditAddedLines([
      { file: 'src/styles/a.css', text: 'background: linear-gradient(135deg, #7c3aed, #3b82f6);' },
      { file: 'src/components/A.tsx', text: '<img src={url} />' },
    ]);

    expect(result.issues).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });
});
