import { useEffect, useState } from 'react';
import { usePuck } from '@puckeditor/core';
import { Microscope, Minus, Plus, SlidersHorizontal, Trash2, Upload } from 'lucide-react';
import { uploadToCloudinary } from '../../services/cloudinary';
import { supabase } from '../../services/supabase';
import type { PuckAccordionItem, PuckTabItem } from '../adapters/puck';
import { EDITOR2_DEFAULT_IMAGE_SRC } from '../domain/defaults';
import type { CarouselItem, MediaAppearance } from '../domain/schema';
import { loadPageIndex, type PageIndexLoadResult } from '../services/pageIndex';
import AtlasPhotoPicker from './AtlasPhotoPicker';
import {
  getActiveAccordionIndex,
  getActiveTabIndex,
  setActiveAccordionIndex,
  setActiveTabIndex,
} from './Editor2Blocks';
import IconPickerModal, { renderAtlasIcon } from './IconPickerModal';
import InspectorDialog from './InspectorDialog';
import MediaStyleFields from './MediaStyleFields';
import TextColorPicker from './TextColorPicker';
import ButtonDestinationPicker from './ButtonDestinationPicker';
import { WEEKLY_BUTTON_TEMPLATE } from '../domain/componentTemplates';

type AtlasTestSummary = {
  id: string;
  titulo: string;
};

function MediaStyleDialog({ media, onChange }: {
  media?: MediaAppearance;
  onChange: (next: MediaAppearance | undefined) => void;
}) {
  return (
    <InspectorDialog label="Aspecto y filtros" icon={<SlidersHorizontal size={13} aria-hidden="true" />}>
      <div className="e2-design-panel">
        <MediaStyleFields media={media} onChange={onChange} />
      </div>
    </InspectorDialog>
  );
}

export default function BlockComponentTools({ requestWeekly, onWeeklyRequestClose }: {
  requestWeekly?: boolean;
  onWeeklyRequestClose?: () => void;
}) {
  const { selectedItem, dispatch, getSelectorForId } = usePuck();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState<PageIndexLoadResult | null>(null);
  const selectedId = selectedItem?.props?.id as string | undefined;
  const [tabIndex, setTabIndex] = useState(() => getActiveTabIndex(selectedId));
  const [accordionIndex, setAccordionIndex] = useState(() => getActiveAccordionIndex(selectedId));
  const [atlasTests, setAtlasTests] = useState<AtlasTestSummary[]>([]);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    setTabIndex(getActiveTabIndex(selectedId));
    setAccordionIndex(getActiveAccordionIndex(selectedId));
  }, [selectedId]);

  useEffect(() => {
    if (selectedItem?.type !== 'button' || pageIndex) return;
    let active = true;
    loadPageIndex()
      .then((res) => {
        if (active) setPageIndex(res);
      })
      .catch(() => {
        if (active) setPageIndex({ pages: [], warning: 'No se pudieron cargar los destinos de Atlas.' });
      });
    return () => {
      active = false;
    };
  }, [pageIndex, selectedItem?.type]);

  useEffect(() => {
    if (selectedItem?.type !== 'button' || atlasTests.length > 0) return;
    let active = true;
    Promise.resolve(
      supabase.from('pruebas').select('id, nombre').eq('estado', 'publicada').order('nombre', { ascending: true }),
    )
      .then(({ data }) => {
        if (active && Array.isArray(data)) {
          setAtlasTests(
            data
              .filter(
                (row): row is { id: string | number; nombre: string } =>
                  (typeof row?.id === 'string' || typeof row?.id === 'number') && typeof row?.nombre === 'string',
              )
              .map((row) => ({ id: String(row.id), titulo: row.nombre })),
          );
        }
      })
      .catch(() => {
        // En entorno sin red se omite la lista de evaluaciones
      });
    return () => {
      active = false;
    };
  }, [atlasTests.length, selectedItem?.type]);

  useEffect(() => {
    const onCarouselChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; index?: number }>).detail;
      if (detail && (!detail.id || detail.id === selectedId) && typeof detail.index === 'number') {
        setSlideIndex(detail.index);
      }
    };
    const onTabsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; index?: number }>).detail;
      if (detail && (!detail.id || detail.id === selectedId) && typeof detail.index === 'number') {
        setActiveTabIndex(selectedId, detail.index);
        setTabIndex(detail.index);
      }
    };
    const onAccordionChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; index?: number }>).detail;
      if (detail && (!detail.id || detail.id === selectedId) && typeof detail.index === 'number') {
        setActiveAccordionIndex(selectedId, detail.index);
        setAccordionIndex(detail.index);
      }
    };
    window.addEventListener('e2:carousel-changed', onCarouselChanged);
    window.addEventListener('e2:tabs-changed', onTabsChanged);
    window.addEventListener('e2:accordion-changed', onAccordionChanged);
    return () => {
      window.removeEventListener('e2:carousel-changed', onCarouselChanged);
      window.removeEventListener('e2:tabs-changed', onTabsChanged);
      window.removeEventListener('e2:accordion-changed', onAccordionChanged);
    };
  }, [selectedId]);

  if (!selectedItem) return null;
  const item = selectedItem;

  function updateProps(patch: Record<string, unknown>) {
    const position = getSelectorForId(item.props.id);
    if (!position) return;
    dispatch({
      type: 'replace',
      destinationIndex: position.index,
      destinationZone: position.zone,
      data: { ...item, props: { ...item.props, ...patch } },
    });
  }

  async function handleFileUpload(
    file: File | undefined,
    onUploaded: (url: string, name: string) => void,
    options?: { preserveAnimation?: boolean; folder?: string },
  ) {
    if (!file || uploading) return;
    try {
      setUploading(true);
      setUploadError(null);
      const isGif = Boolean(options?.preserveAnimation) || file.type === 'image/gif';
      const result = await uploadToCloudinary(file, {
        folder: options?.folder ?? 'paginas',
        optimizeImage: !isGif,
        preserveAnimation: isGif,
      });
      if (result?.secure_url) {
        const cleanName = file.name.replace(/\.[^.]+$/, '');
        onUploaded(result.secure_url, cleanName);
      } else {
        setUploadError('No se recibió URL al subir la imagen.');
      }
    } catch {
      setUploadError('Error al subir el archivo a R2.');
    } finally {
      setUploading(false);
    }
  }

  if (item.type === 'image') {
    return (
      <div className="e2-component-tools" role="group" aria-label="Herramientas de imagen">
        <label className="e2-button e2-button--quiet e2-upload-btn">
          <Upload size={13} aria-hidden="true" />
          <span>{uploading ? 'Subiendo...' : 'Subir nueva'}</span>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            className="e2-visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void handleFileUpload(file, (url, name) => {
                updateProps({ src: url, alt: item.props.alt || name });
              });
            }}
          />
        </label>
        <AtlasPhotoPicker onSelect={(src, alt) => updateProps({ src, alt })} />
        {uploadError && <span className="e2-upload-error" role="alert">{uploadError}</span>}
      </div>
    );
  }

  if (item.type === 'table') {
    const headers: string[] = Array.isArray(item.props.headers)
      ? item.props.headers
      : ['Columna 1', 'Columna 2'];
    const rows: string[][] = Array.isArray(item.props.rows) ? item.props.rows : [['', '']];
    const colCount = headers.length;

    const addColumn = () => {
      if (colCount >= 12) return;
      const nextHeaders = [...headers, `Columna ${colCount + 1}`];
      const nextRows = rows.map((row) => [...row, '']);
      updateProps({ headers: nextHeaders, rows: nextRows });
    };

    const removeColumn = () => {
      if (colCount <= 1) return;
      const nextHeaders = headers.slice(0, -1);
      const nextRows = rows.map((row) => row.slice(0, -1));
      updateProps({ headers: nextHeaders, rows: nextRows });
    };

    const addRow = () => {
      if (rows.length >= 50) return;
      const nextRows = [...rows, Array.from({ length: colCount }, () => '')];
      updateProps({ rows: nextRows });
    };

    const removeRow = () => {
      if (rows.length <= 1) return;
      updateProps({ rows: rows.slice(0, -1) });
    };

    return (
      <div className="e2-component-tools" role="group" aria-label="Herramientas de tabla">
        <button type="button" className="e2-button e2-button--quiet" onClick={addColumn} title="Añadir columna">
          <Plus size={13} aria-hidden="true" />
          <span>Columna</span>
        </button>
        <button
          type="button"
          className="e2-button e2-button--quiet"
          onClick={removeColumn}
          disabled={colCount <= 1}
          title="Quitar última columna"
        >
          <Minus size={13} aria-hidden="true" />
          <span>Columna</span>
        </button>
        <button type="button" className="e2-button e2-button--quiet" onClick={addRow} title="Añadir fila">
          <Plus size={13} aria-hidden="true" />
          <span>Fila</span>
        </button>
        <button
          type="button"
          className="e2-button e2-button--quiet"
          onClick={removeRow}
          disabled={rows.length <= 1}
          title="Quitar última fila"
        >
          <Minus size={13} aria-hidden="true" />
          <span>Fila</span>
        </button>
        <div className="e2-layout-field__control">
          <span>Cabecera</span>
          <TextColorPicker label="Color de cabecera" value={item.props.accentColor} fallback="#e0f2fe"
            onChange={accentColor => updateProps({ accentColor })} />
        </div>
        <button
          type="button"
          className={`e2-button e2-button--quiet${item.props.striped ? ' is-active' : ''}`}
          aria-pressed={Boolean(item.props.striped)}
          onClick={() => updateProps({ striped: !item.props.striped })}
        >
          <span>Cebra</span>
        </button>
        <button
          type="button"
          className={`e2-button e2-button--quiet${item.props.compact ? ' is-active' : ''}`}
          aria-pressed={Boolean(item.props.compact)}
          onClick={() => updateProps({ compact: !item.props.compact })}
        >
          <span>Compacta</span>
        </button>
        <button
          type="button"
          className={`e2-button e2-button--quiet${item.props.bordered ? ' is-active' : ''}`}
          aria-pressed={Boolean(item.props.bordered)}
          onClick={() => updateProps({ bordered: !item.props.bordered })}
        >
          <span>Bordes</span>
        </button>
      </div>
    );
  }

  if (item.type === 'carousel') {
    const items: CarouselItem[] = Array.isArray(item.props.items) && item.props.items.length > 0
      ? item.props.items
      : [{ src: EDITOR2_DEFAULT_IMAGE_SRC, alt: 'Placa histológica', caption: '' }];
    const safeIdx = Math.min(slideIndex, items.length - 1);
    const currentSlide = items[safeIdx];

    const updateSlide = (patch: Partial<CarouselItem>) => {
      const next = items.map((slide, idx) => (idx === safeIdx ? { ...slide, ...patch } : slide));
      updateProps({ items: next });
    };

    const selectSlide = (nextIdx: number) => {
      setSlideIndex(nextIdx);
      window.dispatchEvent(new CustomEvent('e2:carousel-select', { detail: { id: item.props.id, index: nextIdx } }));
    };

    const addSlide = () => {
      if (items.length >= 20) return;
      const next = [
        ...items,
        {
          src: EDITOR2_DEFAULT_IMAGE_SRC,
          alt: `Placa histológica ${items.length + 1}`,
          caption: '',
        },
      ];
      updateProps({ items: next });
      selectSlide(next.length - 1);
    };

    const removeSlide = () => {
      if (items.length <= 1) return;
      const next = items.filter((_, idx) => idx !== safeIdx);
      updateProps({ items: next });
      selectSlide(Math.max(0, safeIdx - 1));
    };

    return (
      <div className="e2-component-tools" role="group" aria-label="Herramientas de carrusel">
        <label className="e2-layout-field__control">
          <span>Diapositiva</span>
          <select
            aria-label="Seleccionar diapositiva"
            value={safeIdx}
            onChange={(e) => selectSlide(Number(e.target.value))}
          >
            {items.map((_, idx) => (
              <option key={idx} value={idx}>
                {idx + 1} de {items.length}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="e2-button e2-button--quiet" onClick={addSlide} title="Añadir diapositiva">
          <Plus size={13} aria-hidden="true" />
          <span>Imagen</span>
        </button>
        <label className="e2-button e2-button--quiet e2-upload-btn">
          <Upload size={13} aria-hidden="true" />
          <span>{uploading ? 'Subiendo...' : 'Subir nueva'}</span>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            className="e2-visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void handleFileUpload(file, (url, name) => {
                updateSlide({ src: url, alt: name });
              });
            }}
          />
        </label>
        <AtlasPhotoPicker onSelect={(src, alt) => updateSlide({ src, alt })} />
        {uploadError && <span className="e2-upload-error" role="alert">{uploadError}</span>}
        <label className="e2-layout-field__control">
          <span>URL</span>
          <input
            type="text"
            aria-label="URL de diapositiva (R2)"
            value={currentSlide?.src ?? ''}
            placeholder="https://..."
            onChange={(e) => updateSlide({ src: e.target.value })}
          />
        </label>
        <label className="e2-layout-field__control">
          <span>Pie</span>
          <input
            type="text"
            aria-label="Pie de diapositiva"
            value={currentSlide?.caption ?? ''}
            placeholder="Pie de imagen"
            onChange={(e) => updateSlide({ caption: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="e2-button e2-button--quiet"
          onClick={removeSlide}
          disabled={items.length <= 1}
          title="Eliminar diapositiva actual"
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`e2-button e2-button--quiet${item.props.autoplay ? ' is-active' : ''}`}
          aria-pressed={Boolean(item.props.autoplay)}
          onClick={() => updateProps({ autoplay: !item.props.autoplay })}
        >
          <span>Autoplay</span>
        </button>
        {item.props.autoplay && (
          <label className="e2-layout-field__control">
            <span>Seg.</span>
            <select
              aria-label="Intervalo de carrusel en segundos"
              value={Number(item.props.intervalSec) || 4}
              onChange={(e) => updateProps({ intervalSec: Number(e.target.value) })}
            >
              {[2, 3, 4, 5, 6, 8, 10].map((sec) => (
                <option key={sec} value={sec}>{sec}s</option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className={`e2-button e2-button--quiet${item.props.showArrows !== false ? ' is-active' : ''}`}
          aria-pressed={item.props.showArrows !== false}
          onClick={() => updateProps({ showArrows: item.props.showArrows === false })}
        >
          <span>Flechas</span>
        </button>
        <button
          type="button"
          className={`e2-button e2-button--quiet${item.props.showDots !== false ? ' is-active' : ''}`}
          aria-pressed={item.props.showDots !== false}
          onClick={() => updateProps({ showDots: item.props.showDots === false })}
        >
          <span>Puntos</span>
        </button>
      </div>
    );
  }

  if (item.type === 'tabs') {
    const items: PuckTabItem[] =
      Array.isArray(item.props.items) && item.props.items.length > 0
        ? (item.props.items as PuckTabItem[])
        : [{ title: 'Sección 1', content: [] }];
    const safeIdx = Math.min(tabIndex, items.length - 1);
    const currentTab = items[safeIdx];

    const selectTab = (nextIdx: number) => {
      setActiveTabIndex(item.props.id, nextIdx);
      setTabIndex(nextIdx);
      window.dispatchEvent(new CustomEvent('e2:tabs-select', { detail: { id: item.props.id, index: nextIdx } }));
    };

    const updateTab = (patch: Partial<PuckTabItem>) => {
      const next = items.map((tab, idx) => (idx === safeIdx ? { ...tab, ...patch } : tab));
      updateProps({ items: next });
    };

    const addTab = () => {
      if (items.length >= 10) return;
      const next: PuckTabItem[] = [
        ...items,
        {
          title: `Sección ${items.length + 1}`,
          content: [],
        },
      ];
      const nextIdx = next.length - 1;
      setActiveTabIndex(item.props.id, nextIdx);
      setTabIndex(nextIdx);
      updateProps({ items: next });
      window.dispatchEvent(new CustomEvent('e2:tabs-select', { detail: { id: item.props.id, index: nextIdx } }));
    };



    const removeTab = () => {
      if (items.length <= 1) return;
      const next = items.filter((_, idx) => idx !== safeIdx);
      const nextIdx = Math.max(0, safeIdx - 1);
      setActiveTabIndex(item.props.id, nextIdx);
      setTabIndex(nextIdx);
      updateProps({ items: next });
      window.dispatchEvent(new CustomEvent('e2:tabs-select', { detail: { id: item.props.id, index: nextIdx } }));
    };

    return (
      <div className="e2-component-tools" role="group" aria-label="Herramientas de pestañas">
        <label className="e2-layout-field__control">
          <span>Pestaña</span>
          <select
            aria-label="Seleccionar pestaña para configurar"
            value={safeIdx}
            onChange={(e) => selectTab(Number(e.target.value))}
          >
            {items.map((tab, idx) => (
              <option key={idx} value={idx}>
                {idx + 1}. {tab.title}
              </option>
            ))}
          </select>
        </label>
        <label className="e2-layout-field__control">
          <span>Nombre</span>
          <input
            type="text"
            aria-label="Título de la pestaña activa"
            value={currentTab?.title ?? ''}
            onChange={(e) => updateTab({ title: e.target.value || `Sección ${safeIdx + 1}` })}
          />
        </label>
        <label className="e2-layout-field__control">
          <span>Subtítulo</span>
          <input
            type="text"
            aria-label="Subtítulo opcional de la pestaña"
            placeholder="Opcional"
            value={currentTab?.subtitle ?? ''}
            onChange={(e) => updateTab({ subtitle: e.target.value || undefined })}
          />
        </label>
        <label className="e2-layout-field__control">
          <span>Estilo</span>
          <select
            aria-label="Estilo visual de pestañas"
            value={item.props.tabStyle ?? 'underline'}
            onChange={(e) => updateProps({ tabStyle: e.target.value })}
          >
            <option value="underline">Línea</option>
            <option value="pills">Pastillas</option>
            <option value="cards">Tarjetas</option>
          </select>
        </label>
        <button type="button" className="e2-button e2-button--quiet" onClick={addTab} title="Añadir pestaña">
          <Plus size={13} aria-hidden="true" />
          <span>Pestaña</span>
        </button>
        <div className="e2-layout-field__control">
          <span>Acento</span>
          <TextColorPicker label="Color de pestañas" value={item.props.accentColor} fallback="#0284c7"
            onChange={accentColor => updateProps({ accentColor })} />
        </div>
        <button
          type="button"
          className="e2-button e2-button--quiet"
          onClick={removeTab}
          disabled={items.length <= 1}
          title="Eliminar pestaña actual"
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (item.type === 'gif') {
    return (
      <div className="e2-component-tools" role="group" aria-label="Herramientas de GIF">
        <label className="e2-button e2-button--quiet e2-upload-btn">
          <Upload size={13} aria-hidden="true" />
          <span>{uploading ? 'Subiendo...' : 'Subir GIF (R2)'}</span>
          <input
            type="file"
            accept="image/gif,image/webp,image/*"
            disabled={uploading}
            className="e2-visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void handleFileUpload(
                file,
                (url, name) => {
                  updateProps({ src: url, alt: item.props.alt || name });
                },
                { preserveAnimation: true, folder: 'paginas/gifs' },
              );
            }}
          />
        </label>
        <AtlasPhotoPicker onSelect={(src, alt) => updateProps({ src, alt })} />
        <MediaStyleDialog
          media={item.props.media as MediaAppearance | undefined}
          onChange={(media) => updateProps({ media })}
        />
        <button
          type="button"
          className={`e2-button e2-button--quiet${item.props.zoom ? ' is-active' : ''}`}
          aria-pressed={Boolean(item.props.zoom)}
          onClick={() => updateProps({ zoom: !item.props.zoom })}
        >
          <span>Zoom</span>
        </button>
        {uploadError && <span className="e2-upload-error" role="alert">{uploadError}</span>}
      </div>
    );
  }

  if (item.type === 'badge') {
    return (
      <div className="e2-component-tools" role="group" aria-label="Herramientas de insignia">
        <button
          type="button"
          className="e2-button e2-button--quiet"
          onClick={() => setIconPickerOpen(true)}
        >
          {item.props.icon ? renderAtlasIcon(String(item.props.icon), 14) : <Microscope size={14} aria-hidden="true" />}
          <span>{item.props.icon ? 'Cambiar icono' : 'Añadir icono'}</span>
        </button>
        <IconPickerModal
          open={iconPickerOpen}
          value={typeof item.props.icon === 'string' ? item.props.icon : undefined}
          allowClear
          onSelect={(iconId) => updateProps({ icon: iconId })}
          onClose={() => setIconPickerOpen(false)}
        />
      </div>
    );
  }

  if (item.type === 'icon') {
    return (
      <div className="e2-component-tools" role="group" aria-label="Herramientas de icono">
        <button
          type="button"
          className="e2-button e2-button--quiet"
          onClick={() => setIconPickerOpen(true)}
        >
          {renderAtlasIcon(String(item.props.name || 'microscope'), 14)}
          <span>Cambiar icono</span>
        </button>
        <IconPickerModal
          open={iconPickerOpen}
          value={typeof item.props.name === 'string' ? item.props.name : 'microscope'}
          onSelect={(iconId) => {
            if (iconId) updateProps({ name: iconId });
          }}
          onClose={() => setIconPickerOpen(false)}
        />
      </div>
    );
  }

  if (item.type === 'compare') {
    return (
      <div className="e2-component-tools" role="group" aria-label="Herramientas del comparador">
        <label className="e2-button e2-button--quiet e2-upload-btn">
          <Upload size={13} aria-hidden="true" />
          <span>{uploading ? 'Subiendo...' : 'Subir A'}</span>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            className="e2-visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void handleFileUpload(file, (url, name) => {
                updateProps({ leftSrc: url, leftLabel: item.props.leftLabel || name });
              });
            }}
          />
        </label>
        <AtlasPhotoPicker label="Atlas A" onSelect={(leftSrc, leftLabel) => updateProps({ leftSrc, leftLabel })} />
        <label className="e2-button e2-button--quiet e2-upload-btn">
          <Upload size={13} aria-hidden="true" />
          <span>{uploading ? 'Subiendo...' : 'Subir B'}</span>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            className="e2-visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void handleFileUpload(file, (url, name) => {
                updateProps({ rightSrc: url, rightLabel: item.props.rightLabel || name });
              });
            }}
          />
        </label>
        <AtlasPhotoPicker label="Atlas B" onSelect={(rightSrc, rightLabel) => updateProps({ rightSrc, rightLabel })} />
        {uploadError && <span className="e2-upload-error" role="alert">{uploadError}</span>}
      </div>
    );
  }

  if (item.type === 'button') {
    const currentHref = typeof item.props.href === 'string' ? item.props.href : '';
    const weeklyOnly = requestWeekly || item.props.variant === 'weekly';
    const matchingTest = atlasTests.some((t) => `/evaluaciones/ejecutar/${t.id}` === currentHref) ? currentHref : '';
    return (
      <div className="e2-component-tools" role="group" aria-label="Enlace interno del Atlas">
        <ButtonDestinationPicker index={pageIndex} href={currentHref} weeklyOnly={weeklyOnly}
          openRequest={requestWeekly} onClose={onWeeklyRequestClose}
          onSelect={href => updateProps({
            href, newTab: false,
            ...(requestWeekly ? WEEKLY_BUTTON_TEMPLATE : {}),
          })} />
        {!weeklyOnly && <label className="e2-layout-field__control">
          <span>Evaluación</span>
          <select
            aria-label="Elegir evaluación del Atlas"
            value={matchingTest}
            onChange={(e) => {
              if (e.target.value) updateProps({ href: e.target.value, newTab: false });
            }}
          >
            <option value="">Elegir prueba…</option>
            <option value="/evaluaciones">Catálogo de evaluaciones</option>
            {atlasTests.map((test) => (
              <option key={test.id} value={`/evaluaciones/ejecutar/${test.id}`}>
                {test.titulo}
              </option>
            ))}
          </select>
        </label>}
        <button
          type="button"
          className="e2-button e2-button--quiet"
          onClick={() => setIconPickerOpen(true)}
        >
          {item.props.icon ? renderAtlasIcon(String(item.props.icon), 13) : <Microscope size={13} aria-hidden="true" />}
          <span>{item.props.icon ? 'Icono' : '+ Icono'}</span>
        </button>
        <IconPickerModal
          open={iconPickerOpen}
          value={typeof item.props.icon === 'string' ? item.props.icon : undefined}
          allowClear
          onSelect={(iconId) => updateProps({ icon: iconId })}
          onClose={() => setIconPickerOpen(false)}
        />
      </div>
    );
  }

  if (item.type === 'accordion') {
    const items: PuckAccordionItem[] =
      Array.isArray(item.props.items) && item.props.items.length > 0
        ? (item.props.items as PuckAccordionItem[])
        : [{ title: 'Sección desplegable 1', openByDefault: true, content: [] }];
    const safeIdx = Math.min(accordionIndex, items.length - 1);
    const currentSection = items[safeIdx];

    const selectSection = (nextIdx: number) => {
      setActiveAccordionIndex(item.props.id, nextIdx);
      setAccordionIndex(nextIdx);
      window.dispatchEvent(new CustomEvent('e2:accordion-select', { detail: { id: item.props.id, index: nextIdx } }));
    };

    const updateSection = (patch: Partial<PuckAccordionItem>) => {
      const next = items.map((sec, idx) => (idx === safeIdx ? { ...sec, ...patch } : sec));
      updateProps({ items: next });
    };

    const addSection = () => {
      if (items.length >= 12) return;
      const next: PuckAccordionItem[] = [
        ...items,
        {
          title: `Sección desplegable ${items.length + 1}`,
          openByDefault: false,
          content: [],
        },
      ];
      const nextIdx = next.length - 1;
      setActiveAccordionIndex(item.props.id, nextIdx);
      setAccordionIndex(nextIdx);
      updateProps({ items: next });
      window.dispatchEvent(new CustomEvent('e2:accordion-select', { detail: { id: item.props.id, index: nextIdx } }));
    };



    const removeSection = () => {
      if (items.length <= 1) return;
      const next = items.filter((_, idx) => idx !== safeIdx);
      const nextIdx = Math.max(0, safeIdx - 1);
      setActiveAccordionIndex(item.props.id, nextIdx);
      setAccordionIndex(nextIdx);
      updateProps({ items: next });
      window.dispatchEvent(new CustomEvent('e2:accordion-select', { detail: { id: item.props.id, index: nextIdx } }));
    };

    return (
      <div className="e2-component-tools" role="group" aria-label="Herramientas de acordeón">
        <label className="e2-layout-field__control">
          <span>Sección</span>
          <select
            aria-label="Seleccionar sección desplegable"
            value={safeIdx}
            onChange={(e) => selectSection(Number(e.target.value))}
          >
            {items.map((sec, idx) => (
              <option key={idx} value={idx}>
                {idx + 1}. {sec.title}
              </option>
            ))}
          </select>
        </label>
        <label className="e2-layout-field__control">
          <span>Modo</span>
          <select
            aria-label="Modo del acordeón"
            value={item.props.mode ?? 'default'}
            onChange={(e) => updateProps({ mode: e.target.value })}
          >
            <option value="default">Clásico</option>
            <option value="reveal">Revelar pista</option>
          </select>
        </label>
        <label className="e2-layout-field__control">
          <span>Nombre</span>
          <input
            type="text"
            aria-label="Título de la sección desplegable"
            value={currentSection?.title ?? ''}
            onChange={(e) => updateSection({ title: e.target.value || `Sección ${safeIdx + 1}` })}
          />
        </label>
        <button type="button" className="e2-button e2-button--quiet" onClick={addSection} title="Añadir sección">
          <Plus size={13} aria-hidden="true" />
          <span>Sección</span>
        </button>
        <div className="e2-layout-field__control">
          <span>Acento</span>
          <TextColorPicker label="Color de acordeón" value={item.props.accentColor} fallback="#0284c7"
            onChange={accentColor => updateProps({ accentColor })} />
        </div>
        <button
          type="button"
          className="e2-button e2-button--quiet"
          onClick={removeSection}
          disabled={items.length <= 1}
          title="Eliminar sección actual"
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return null;
}
