import React, { useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Box,
  ChevronDownSquare,
  Columns2,
  Copy,
  Film,
  FolderKanban,
  GalleryHorizontal,
  GripVertical,
  Heading,
  Image as ImageIcon,
  LayoutGrid,
  MessageSquareText,
  Microscope,
  Minus,
  MousePointerClick,
  Sparkles,
  Table2,
  Tag,
  Trash2,
  Type,
} from 'lucide-react';
import { Puck, usePuck, type Data } from '@puckeditor/core';
import { fromPuckData, toPuckCompatibleData, type Editor2PuckData } from '../adapters/puck';
import { EDITOR2_SCHEMA_VERSION, type CanvasDoc } from '../domain/schema';
import { workspacePath } from '../services/pageIndex';
import { useEditor2Store } from '../store/editor2Store';
import BlockComponentTools from './BlockComponentTools';
import DesignInspector from './DesignInspector';
import { editor2PuckConfig } from './Editor2Blocks';
import GridDrag from './GridDrag';
import PageFrame from './PageFrame';
import TextToolbar from './TextToolbar';

const COMPONENT_ICONS: Record<string, React.ReactNode> = {
  canvas: <LayoutGrid size={14} aria-hidden="true" />,
  box: <Box size={14} aria-hidden="true" />,
  tabs: <FolderKanban size={14} aria-hidden="true" />,
  accordion: <ChevronDownSquare size={14} aria-hidden="true" />,
  heading: <Heading size={14} aria-hidden="true" />,
  text: <Type size={14} aria-hidden="true" />,
  image: <ImageIcon size={14} aria-hidden="true" />,
  gif: <Sparkles size={14} aria-hidden="true" />,
  video: <Film size={14} aria-hidden="true" />,
  compare: <Columns2 size={14} aria-hidden="true" />,
  callout: <MessageSquareText size={14} aria-hidden="true" />,
  divider: <Minus size={14} aria-hidden="true" />,
  button: <MousePointerClick size={14} aria-hidden="true" />,
  table: <Table2 size={14} aria-hidden="true" />,
  carousel: <GalleryHorizontal size={14} aria-hidden="true" />,
  badge: <Tag size={14} aria-hidden="true" />,
  icon: <Microscope size={14} aria-hidden="true" />,
  examCarousel: <Columns2 size={14} aria-hidden="true" />,
};

const fieldOverrides = {
  actionBar: ({
    label,
    children,
    parentAction,
  }: {
    label?: string;
    children: React.ReactNode;
    parentAction?: React.ReactNode;
  }) => (
    <div className="e2-puck-actionbar">
      <div className="e2-puck-actionbar__group">
        {parentAction}
        <button
          type="button"
          className="e2-puck-actionbar__move"
          data-e2-move-handle=""
          title="Arrastra desde aquí para mover el bloque"
        >
          <GripVertical size={13} aria-hidden="true" />
          <span>{label || 'Mover'}</span>
        </button>
      </div>
      <div className="e2-puck-actionbar__group">{children}</div>
    </div>
  ),
  drawerItem: ({ name }: { name: string }) => (
    <div className="e2-drawer-chip">
      <span className="e2-drawer-chip__icon" aria-hidden="true">
        {COMPONENT_ICONS[name] ?? <LayoutGrid size={14} />}
      </span>
      <span className="e2-drawer-chip__label">
        {editor2PuckConfig.components[name]?.label ?? name}
      </span>
      <GripVertical size={13} className="e2-drawer-chip__grip" aria-hidden="true" />
    </div>
  ),
  fields: ({ fields }: { fields: Partial<Record<string, React.ReactNode>> }) => (
    <div className="e2-field-strip">
      {Object.entries(fields)
        .filter(([name]) => name !== 'items')
        .map(([name, field]) => (
          <div key={name} className="e2-field-strip__item" data-field={name}>
            {field}
          </div>
        ))}
    </div>
  ),
  fieldLabel: ({
    children,
    label,
    el = 'label',
    className,
  }: {
    children?: React.ReactNode;
    label: string;
    el?: 'label' | 'div';
    className?: string;
  }) => {
    // El campo de distribución ya contiene sus propios <label>; usar <div> evita etiquetas anidadas.
    if (label === 'Distribución') {
      return <div className="e2-field-inline e2-field-inline--layout">{children}</div>;
    }
    const El = el;
    return (
      <El className={`e2-field-inline${className ? ` ${className}` : ''}`}>
        {label && <span className="e2-field-inline__label">{label}</span>}
        {children}
      </El>
    );
  },
};

function BlockTools() {
  const { selectedItem, dispatch, getSelectorForId } = usePuck();
  if (!selectedItem) return (
    <section className="e2-palette" aria-label="Insertar bloques"><Puck.Components /></section>
  );

  const handleDuplicate = () => {
    const position = getSelectorForId(selectedItem.props.id);
    if (!position) return;
    dispatch({
      type: 'duplicate',
      sourceIndex: position.index,
      sourceZone: position.zone ?? 'root:default-zone',
    });
  };

  const handleRemove = () => {
    const targetId = selectedItem.props.id as string;
    const position = getSelectorForId(targetId);
    if (position) {
      dispatch({
        type: 'remove',
        index: position.index,
        zone: position.zone ?? 'root:default-zone',
      });
    } else {
      window.dispatchEvent(new CustomEvent('e2:remove-block', { detail: { id: targetId } }));
    }
    dispatch({ type: 'setUi', ui: { itemSelector: null } });
  };

  return (
    <section className="e2-settings" aria-label="Configuración del bloque">
      <div className="e2-settings__heading">
        <button
          type="button"
          aria-label="Volver a componentes"
          className="e2-button e2-button--quiet e2-settings__back"
          onClick={() => dispatch({ type: 'setUi', ui: { itemSelector: null } })}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Componentes</span>
        </button>
        <strong className="e2-settings__title">
          {editor2PuckConfig.components[selectedItem.type]?.label ?? 'Configuración'}
        </strong>
      </div>
      <div className="e2-settings__fields"><Puck.Fields wrapFields={false} /></div>
      {['text', 'heading'].includes(selectedItem.type) && (
        <TextToolbar key={selectedItem.props.id} />
      )}
      {['image', 'gif', 'compare', 'button', 'table', 'carousel', 'badge', 'icon', 'tabs', 'accordion'].includes(selectedItem.type) && (
        <BlockComponentTools key={`tools-${selectedItem.props.id}`} />
      )}
      <DesignInspector key={`design-${selectedItem.props.id}`} />
      <div className="e2-settings__actions" role="group" aria-label="Acciones del bloque">
        <button
          type="button"
          className="e2-button e2-button--quiet"
          aria-label="Duplicar bloque"
          title="Duplicar bloque"
          onClick={handleDuplicate}
        >
          <Copy size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="e2-button e2-button--quiet e2-button--danger"
          aria-label="Eliminar bloque"
          title="Eliminar bloque"
          onClick={handleRemove}
        >
          <Trash2 size={13} aria-hidden="true" />
          <span>Eliminar</span>
        </button>
      </div>
    </section>
  );
}

export type Editor2CanvasProps = {
  doc: CanvasDoc;
  width?: number;
};

/**
 * Lienzo editable. Puck solo aporta interacción: el documento que se conserva
 * es siempre `CanvasDoc`, validado antes de entrar en el store.
 */
const Editor2Canvas: React.FC<Editor2CanvasProps> = ({ doc, width }) => {
  const toolbar = useRef<HTMLDivElement>(null);
  const applyDoc = useEditor2Store((state) => state.applyDoc);
  const markSaveError = useEditor2Store((state) => state.markSaveError);
  const puckRevision = useEditor2Store((state) => state.puckRevision);

  const handleChange = useCallback(
    (data: Data) => {
      try {
        applyDoc(fromPuckData(data as unknown as Editor2PuckData));
      } catch {
        markSaveError('El lienzo produjo un documento fuera del contrato y se conservó el último válido.');
      }
    },
    [applyDoc, markSaveError],
  );

  return (
    <div ref={toolbar} className="e2-puck-shell">
      <Puck
        key={`${EDITOR2_SCHEMA_VERSION}-${puckRevision}`}
        overrides={fieldOverrides}
        config={editor2PuckConfig}
        data={toPuckCompatibleData(doc)}
        onChange={handleChange}
        iframe={{ enabled: false }}
        headerTitle="Editor 2.0"
        headerPath={workspacePath(doc.pageKey)}
      >
        <BlockTools />
        <GridDrag host={toolbar} />
        <div className="e2-canvas-stage">
          <PageFrame width={width}><Puck.Preview /></PageFrame>
        </div>
        <details className="e2-outline"><summary>Árbol de la página</summary><Puck.Outline /></details>
      </Puck>
    </div>
  );
};

export default Editor2Canvas;
