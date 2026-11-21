import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fromPuckData, toPuckData } from '../adapters/puck';
import { createEmptyCanvasDoc, createNestedCanvasNode, createPlacedBlock } from '../domain/defaults';
import { canvasDocSchema } from '../domain/schema';
import { blockMotionClasses } from '../domain/styleToCss';
import { ATLAS_SECTION_TEMPLATES } from '../domain/templates';
import { useEditor2Store } from '../store/editor2Store';
import TemplateDrawer from './TemplateDrawer';
import { editor2Api } from '../services/editor2Api';

vi.mock('../services/editor2Api', () => ({
  editor2Api: {
    listTemplates: vi.fn().mockResolvedValue([]),
    listPresets: vi.fn().mockResolvedValue([]),
    saveTemplate: vi.fn(),
    savePreset: vi.fn(),
    deleteTemplate: vi.fn(),
    deletePreset: vi.fn(),
  },
}));

describe('Plantillas de sección, Presets y Animaciones (Fase 2 — Parte 6)', () => {
  beforeEach(() => {
    useEditor2Store.getState().reset();
    useEditor2Store.getState().setDoc(
      createEmptyCanvasDoc('plantillas-test', {
        children: [createPlacedBlock(createNestedCanvasNode())],
      }),
    );
  });

  it('todas las 8 plantillas integradas cumplen canvasDocSchema y sobreviven ida y vuelta con Puck', () => {
    expect(ATLAS_SECTION_TEMPLATES).toHaveLength(8);
    for (const tpl of ATLAS_SECTION_TEMPLATES) {
      const section = tpl.build();
      const doc = createEmptyCanvasDoc(`tpl-${tpl.id}`, { children: [section] });
      const parsed = canvasDocSchema.parse(doc);
      const roundtrip = fromPuckData(toPuckData(parsed));
      expect(roundtrip.root.slots.children).toHaveLength(1);
    }
  });

  it('inserta una plantilla en 1 clic desde TemplateDrawer y permite deshacer', () => {
    render(<TemplateDrawer open onClose={() => {}} />);

    const insertButtons = screen.getAllByRole('button', { name: /Insertar/i });
    expect(insertButtons.length).toBeGreaterThanOrEqual(8);

    fireEvent.click(insertButtons[0]);
    expect(useEditor2Store.getState().doc?.root.slots.children).toHaveLength(2);
    expect(useEditor2Store.getState().dirty).toBe(true);

    useEditor2Store.getState().undo();
    expect(useEditor2Store.getState().doc?.root.slots.children).toHaveLength(1);
  });

  it('guarda la sección seleccionada del lienzo aunque no sea la última', async () => {
    const first = ATLAS_SECTION_TEMPLATES[0].build();
    const second = ATLAS_SECTION_TEMPLATES[1].build();
    vi.mocked(editor2Api.saveTemplate).mockResolvedValueOnce({
      id: crypto.randomUUID(), name: 'Mi ficha', category: 'Personalizada',
      description: '', section: first, created_at: new Date().toISOString(),
    });
    useEditor2Store.getState().setDoc(createEmptyCanvasDoc('plantillas-test', { children: [first, second] }));
    render(<TemplateDrawer open initialSectionId={first.block.id} onClose={() => {}} />);
    expect(screen.getByLabelText('Sección para guardar')).toHaveValue(first.block.id);
    fireEvent.change(screen.getByLabelText('Nombre de la nueva plantilla'), { target: { value: 'Mi ficha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(editor2Api.saveTemplate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mi ficha', section: first }));
    expect(await screen.findByText('Plantilla «Mi ficha» guardada en Supabase.')).toBeInTheDocument();
  });

  it('genera clases de animación de entrada solo fuera del modo edición y mantiene hover', () => {
    expect(
      blockMotionClasses({ motion: { entrance: 'slide-up', hover: 'lift' } }, false),
    ).toBe('e2-anim-in e2-anim-in--slide-up e2-hover--lift');

    expect(
      blockMotionClasses({ motion: { entrance: 'slide-up', hover: 'lift' } }, true),
    ).toBe('e2-hover--lift');
  });
});
