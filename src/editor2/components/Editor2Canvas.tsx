import '@puckeditor/core/puck.css';
import React, { useCallback, useRef, useState } from 'react';
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
  PenLine,
  Sparkles,
  Table2,
  Tag,
  Trash2,
  Type,
} from 'lucide-react';
import { Puck, usePuck, type Data } from '@puckeditor/core';
import { fromPuckData, toAtlasId, toPuckId, toPuckCompatibleData, type Editor2PuckData, type Editor2PuckType } from '../adapters/puck';
import { EDITOR2_SCHEMA_VERSION, type CanvasDoc } from '../domain/schema';
import { workspacePath } from '../services/pageIndex';
import { useEditor2Store } from '../store/editor2Store';
import BlockBreadcrumb from './BlockBreadcrumb';
import BlockComponentTools from './BlockComponentTools';
import CanvasRowControls from './CanvasRowControls';
import DesignInspector from './DesignInspector';
import { editor2PuckConfig } from './Editor2Blocks';
import GridDrag from './GridDrag';
import { CanvasScreen, ReportCanvasScreen } from './ResponsiveCanvas';
import type { ScreenSize } from '../domain/responsive';
import MoveBlockDialog from './MoveBlockDialog';
import TextToolbar from './TextToolbar';
import { EDIT_TEXT_REQUEST, hasInlineText } from './inlineEditMode';

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

function BlockTools({
  doc, onSaveSection, editScreen, onEditScreenChange,
}: Editor2CanvasProps) {
  const { selectedItem, dispatch, getSelectorForId } = usePuck();
  if (!selectedItem) return (
    <section className="e2-palette" aria-label="Insertar bloques"><Puck.Components /></section>
  );

  const section = onSaveSection && doc.root.slots.children.find(({ block }) => toPuckId(block.type, block.id) === selectedItem.props.id);
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
        <BlockBreadcrumb />
        <div className="e2-settings__actions" role="group" aria-label="Acciones del bloque">
          {hasInlineText(selectedItem.type) && (
            <button
              type="button"
              className="e2-button e2-button--quiet"
              title="También puedes hacer doble clic sobre el texto"
              onClick={(event) => event.currentTarget.dispatchEvent(new CustomEvent(EDIT_TEXT_REQUEST, { bubbles: true }))}
            >
              <PenLine size={14} aria-hidden="true" />
              Editar texto
            </button>
          )}
          <MoveBlockDialog key={selectedItem.props.id} doc={doc}
            sourceId={toAtlasId(selectedItem.type as Editor2PuckType, selectedItem.props.id)}
            puckId={selectedItem.props.id}
            labelFor={type => editor2PuckConfig.components[type]?.label ?? type} />
          {onSaveSection && section && (
            <button type="button" className="e2-button e2-button--quiet" onClick={() => onSaveSection(section.block.id)}>
              Guardar como plantilla
            </button>
          )}
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
      </div>
      <div className="e2-settings__fields"><Puck.Fields wrapFields={false} /></div>
      {['text', 'heading'].includes(selectedItem.type) && (
        <TextToolbar key={selectedItem.props.id} />
      )}
      {['image', 'gif', 'compare', 'button', 'table', 'carousel', 'badge', 'icon', 'tabs', 'accordion'].includes(selectedItem.type) && (
        <BlockComponentTools key={`tools-${selectedItem.props.id}`} />
      )}
      <DesignInspector key={`design-${selectedItem.props.id}`} editScreen={editScreen} onEditScreenChange={onEditScreenChange} />
    </section>
  );
}

export type Editor2CanvasProps = {
  doc: CanvasDoc;
  editScreen?: ScreenSize;
  onEditScreenChange?: (screen?: ScreenSize) => void;
  onSaveSection?: (id: string) => void;
};

/**
 * Lienzo editable. Puck solo aporta interacción: el documento que se conserva
 * es siempre `CanvasDoc`, validado antes de entrar en el store.
 */
const Editor2Canvas: React.FC<Editor2CanvasProps> = ({ doc, onSaveSection, editScreen, onEditScreenChange }) => {
  const [screen, setScreen] = useState<ScreenSize>('desktop');
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
        <CanvasScreen.Provider value={screen}>
          <BlockTools doc={doc} onSaveSection={onSaveSection} editScreen={editScreen} onEditScreenChange={onEditScreenChange} />
        </CanvasScreen.Provider>
        <GridDrag host={toolbar} />
        <div className="e2-canvas-stage e2-canvas-stage--editing">
          <ReportCanvasScreen.Provider value={setScreen}>
            <Puck.Preview />
          </ReportCanvasScreen.Provider>
        </div>
        <CanvasRowControls host={toolbar} minRows={doc.root.props.minRows} />
        <details className="e2-outline"><summary>Árbol de la página</summary><Puck.Outline /></details>
      </Puck>
    </div>
  );
};

export default Editor2Canvas;
