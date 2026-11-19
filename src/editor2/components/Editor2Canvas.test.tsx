import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toPuckData } from '../adapters/puck';
import {
  createEmptyCanvasDoc,
  createPlacedBlock,
  createNestedCanvasNode,
} from '../domain/defaults';
import { useEditor2Store } from '../store/editor2Store';
import { editor2PuckConfig } from './Editor2Blocks';
import Editor2Canvas from './Editor2Canvas';

const ROOT_ID = '11111111-1111-4111-8111-111111111111';
const TEXT_ID = '22222222-2222-4222-8222-222222222222';

const puckState = vi.hoisted(() => ({ props: null as Record<string, any> | null }));

vi.mock('@puckeditor/core', () => ({
  Puck: (props: Record<string, any>) => {
    puckState.props = props;
    return <div data-testid="puck" />;
  },
}));

describe('Editor2Canvas', () => {
  beforeEach(() => {
    useEditor2Store.getState().reset();
    puckState.props = null;
  });

  it('monta Puck con el documento convertible y sin botón de publicar', () => {
    const doc = createEmptyCanvasDoc('home', { id: ROOT_ID });
    useEditor2Store.getState().setDoc(doc);

    render(<Editor2Canvas doc={doc} />);

    expect(screen.getByTestId('puck')).toBeInTheDocument();
    expect(puckState.props?.config).toBe(editor2PuckConfig);
    expect(puckState.props?.data.root.props).toMatchObject({ pageKey: 'home', rootId: ROOT_ID });
    expect(puckState.props?.iframe).toEqual({ enabled: false });
    expect(puckState.props?.headerTitle).toBe('Editor 2.0');
    expect(puckState.props?.headerPath).toBe('/editor-paginas-v2/p/home');
    expect(puckState.props?.children).toBeTruthy();
  });

  it('aplica los cambios de Puck al store sin remontar el lienzo', () => {
    const doc = createEmptyCanvasDoc('home', { id: ROOT_ID });
    useEditor2Store.getState().setDoc(doc);
    const revision = useEditor2Store.getState().puckRevision;
    render(<Editor2Canvas doc={doc} />);

    const next = createEmptyCanvasDoc('home', {
      id: ROOT_ID,
      children: [createPlacedBlock(createNestedCanvasNode({ id: TEXT_ID }))],
    });

    act(() => {
      puckState.props?.onChange(toPuckData(next));
    });

    expect(useEditor2Store.getState().doc?.root.slots.children).toHaveLength(1);
    expect(useEditor2Store.getState().dirty).toBe(true);
    expect(useEditor2Store.getState().puckRevision).toBe(revision);
    expect(useEditor2Store.getState().lastError).toBeNull();
  });

  it('muestra un error recuperable si Puck devuelve datos inválidos', () => {
    const doc = createEmptyCanvasDoc('home', { id: ROOT_ID });
    useEditor2Store.getState().setDoc(doc);
    render(<Editor2Canvas doc={doc} />);

    act(() => {
      puckState.props?.onChange({ root: {}, content: [] });
    });

    expect(useEditor2Store.getState().doc).toEqual(doc);
    expect(useEditor2Store.getState().lastError).toContain('contrato');
  });

  it('renderiza campos en línea y evita etiquetas anidadas en distribución', () => {
    const doc = createEmptyCanvasDoc('home', { id: ROOT_ID });
    useEditor2Store.getState().setDoc(doc);
    render(<Editor2Canvas doc={doc} />);

    const FieldLabel = puckState.props?.overrides?.fieldLabel;
    expect(typeof FieldLabel).toBe('function');

    const { container } = render(
      <>
        <FieldLabel label="Texto">
          <input type="text" aria-label="Texto" />
        </FieldLabel>
        <FieldLabel label="Distribución">
          <label>
            <span>Ancho</span>
            <select aria-label="Ancho" />
          </label>
        </FieldLabel>
      </>,
    );

    const textWrapper = container.querySelector('label.e2-field-inline');
    expect(textWrapper).toBeInTheDocument();
    expect(textWrapper).toHaveTextContent('Texto');

    const layoutWrapper = container.querySelector('div.e2-field-inline--layout');
    expect(layoutWrapper).toBeInTheDocument();
    expect(layoutWrapper?.querySelector('label label')).toBeNull();

    const DrawerItem = puckState.props?.overrides?.drawerItem;
    expect(typeof DrawerItem).toBe('function');
    const drawerRender = render(<DrawerItem name="heading" />);
    expect(drawerRender.container.querySelector('.e2-drawer-chip')).toHaveTextContent('Título');
  });
});
