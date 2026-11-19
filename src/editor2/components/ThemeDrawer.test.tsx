import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromPuckData, toPuckData } from '../adapters/puck';
import {
  createAccordionBlock,
  createEmptyCanvasDoc,
  createNestedCanvasNode,
  createPlacedBlock,
  createTabsBlock,
} from '../domain/defaults';
import { ATLAS_PAGE_THEMES } from '../domain/styleSchema';
import { pageThemeToCssVars } from '../domain/styleToCss';
import { useEditor2Store } from '../store/editor2Store';
import ThemeDrawer from './ThemeDrawer';

describe('ThemeDrawer y PageTheme (Fase 2 — Parte 3)', () => {
  beforeEach(() => {
    useEditor2Store.getState().reset();
    useEditor2Store.getState().setDoc(
      createEmptyCanvasDoc('tema-prueba', {
        children: [createPlacedBlock(createNestedCanvasNode())],
      }),
    );
  });

  it('aplica cualquiera de los 6 temas curados en 1 clic y permite deshacer', () => {
    render(<ThemeDrawer open onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Editorial H&E/i }));
    expect(useEditor2Store.getState().doc?.pageTheme?.presetId).toBe('editorial-violeta');
    expect(useEditor2Store.getState().dirty).toBe(true);

    useEditor2Store.getState().undo();
    expect(useEditor2Store.getState().doc?.pageTheme).toBeUndefined();
  });

  it('quita el tema personalizado al pulsar Restablecer/Quitar', () => {
    useEditor2Store.getState().setPageTheme(ATLAS_PAGE_THEMES[3].theme);
    render(<ThemeDrawer open onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Quitar tema personalizado/i }));
    expect(useEditor2Store.getState().doc?.pageTheme).toBeUndefined();
  });

  it('traduce PageTheme a variables CSS acotadas --e2-page-*', () => {
    const vars = pageThemeToCssVars(ATLAS_PAGE_THEMES[1].theme) as Record<string, string>;
    expect(vars['--e2-page-primary']).toBe('#6d28d9');
    expect(vars['--e2-page-heading-font']).toContain('Fraunces');
    expect(vars.backgroundColor).toBe('#faf8ff');
  });

  it('conserva pageTheme, tabStyle/subtitle y accordion.mode en ida y vuelta con Puck', () => {
    const tabs = createTabsBlock({
      items: [
        {
          title: 'Parcial 1',
          subtitle: 'Tejidos básicos',
          children: [],
        },
      ],
    });
    tabs.props.tabStyle = 'cards';

    const acc = createAccordionBlock({
      items: [{ title: 'Ver pista clínica', openByDefault: false, children: [] }],
    });
    acc.props.mode = 'reveal';

    const doc = createEmptyCanvasDoc('tema-estructuras', {
      children: [createPlacedBlock(tabs), createPlacedBlock(acc)],
    });
    doc.pageTheme = ATLAS_PAGE_THEMES[2].theme;

    const roundtrip = fromPuckData(toPuckData(doc));
    expect(roundtrip.pageTheme?.presetId).toBe('lamina-laboratorio');

    const rtTabs = roundtrip.root.slots.children[0].block;
    expect(rtTabs.type).toBe('tabs');
    if (rtTabs.type === 'tabs') {
      expect(rtTabs.props.tabStyle).toBe('cards');
      expect(rtTabs.props.items[0].subtitle).toBe('Tejidos básicos');
    }

    const rtAcc = roundtrip.root.slots.children[1].block;
    expect(rtAcc.type).toBe('accordion');
    if (rtAcc.type === 'accordion') {
      expect(rtAcc.props.mode).toBe('reveal');
    }
  });
});
