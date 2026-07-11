import React from 'react';
import { LockKeyhole, Monitor, Tablet, Smartphone } from 'lucide-react';
import ContentBlockRenderer from '../ContentBlockRenderer';
import type { ContentBlock } from '../../types/contentBlocks';
import type { PageSelection } from './PageNavigator';

export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

interface PageDraftPreviewProps {
  selection: PageSelection;
  blocks: ContentBlock[];
  device: PreviewDevice;
  onDeviceChange: (device: PreviewDevice) => void;
  selectedBlockId?: string | null;
  onBlockSelect?: (blockId: string) => void;
  propertiesPanel?: React.ReactNode;
}

const SystemContentPreview: React.FC<{ selection: PageSelection }> = ({ selection }) => {
  if (selection.kind === 'home') return null;
  const title = selection.kind === 'temario'
    ? 'Catálogo de temas'
    : selection.kind === 'tema'
      ? 'Catálogo de subtemas'
      : 'Galería de placas';
  return (
    <section className="page-editor-system-block">
      <div className="page-editor-system-block-title">
        <LockKeyhole size={16} />
        <strong>{title}</strong>
        <span>Contenido automático</span>
      </div>
      <div className="page-editor-system-grid">
        {[1, 2, 3].map(item => <div key={item}><span /><strong>Elemento {item}</strong></div>)}
      </div>
    </section>
  );
};

const PageDraftPreview: React.FC<PageDraftPreviewProps> = ({
  selection,
  blocks,
  device,
  onDeviceChange,
  selectedBlockId,
  onBlockSelect,
  propertiesPanel,
}) => (
  <div className="page-editor-preview-shell">
    <div className="page-editor-preview-toolbar">
      <div>
        <strong>Vista previa del borrador</strong>
        <span>Así se verá el contenido antes de publicarlo.</span>
      </div>
      <div className="page-editor-device-switcher" aria-label="Tamaño de vista previa">
        <button className={device === 'desktop' ? 'is-active' : ''} onClick={() => onDeviceChange('desktop')} title="Escritorio"><Monitor size={18} /></button>
        <button className={device === 'tablet' ? 'is-active' : ''} onClick={() => onDeviceChange('tablet')} title="Tableta"><Tablet size={18} /></button>
        <button className={device === 'mobile' ? 'is-active' : ''} onClick={() => onDeviceChange('mobile')} title="Móvil"><Smartphone size={18} /></button>
      </div>
    </div>

    <div className={`page-editor-preview-body ${propertiesPanel ? 'has-properties' : ''}`}>
      <div className="page-editor-preview-stage" onClick={() => onBlockSelect?.('')}>
       <div className={`page-editor-preview-document device-${device}`}>
        <div className="page-editor-locked-region"><LockKeyhole size={15} /> Header del sitio <span>No editable</span></div>
        <main>
          {selection.kind === 'tema' && (
            <div className="page-editor-page-identity"><small>Tema</small><h1>{selection.label}</h1></div>
          )}
          {selection.kind === 'subtema' && (
            <div className="page-editor-page-identity"><small>{selection.parentLabel}</small><h1>{selection.label}</h1></div>
          )}
          {blocks.length > 0 ? (
            <ContentBlockRenderer
              blocks={blocks}
              editorMode
              selectedBlockId={selectedBlockId}
              onBlockSelect={onBlockSelect}
            />
          ) : (
            <div className="page-editor-empty-canvas"><strong>Esta página todavía no tiene bloques.</strong><span>Vuelve a “Editar contenido” para comenzar.</span></div>
          )}
          <SystemContentPreview selection={selection} />
        </main>
        <div className="page-editor-locked-region footer"><LockKeyhole size={15} /> Footer del sitio <span>No editable</span></div>
       </div>
      </div>
      {propertiesPanel}
    </div>
  </div>
);

export default PageDraftPreview;
