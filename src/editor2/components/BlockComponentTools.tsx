import { useEffect, useMemo, useState } from 'react';
import { usePuck } from '@puckeditor/core';
import { Images, LayoutGrid, Microscope, Minus, Plus, SlidersHorizontal, Trash2, Upload } from 'lucide-react';
import { uploadToCloudinary } from '../../services/cloudinary';
import { supabase } from '../../services/supabase';
import type { PuckAccordionItem, PuckCanvasData, PuckTabItem } from '../adapters/puck';
import { EDITOR2_DEFAULT_IMAGE_SRC, createLayoutIntent } from '../domain/defaults';
import type { CarouselItem, MediaAppearance } from '../domain/schema';
import { loadCatalog, type Editor2CatalogSnapshot } from '../services/catalogIndex';
import { loadPageIndex, type Editor2PageSummary } from '../services/pageIndex';
import {
  getActiveAccordionIndex,
  getActiveTabIndex,
  setActiveAccordionIndex,
  setActiveTabIndex,
} from './Editor2Blocks';
import IconPickerModal, { renderAtlasIcon } from './IconPickerModal';
import InspectorDialog from './InspectorDialog';

type AtlasTestSummary = {
  id: string;
  titulo: string;
};

function MediaStyleDialog({
  media,
  onChange,
}: {
  media?: MediaAppearance;
  onChange: (next: MediaAppearance | undefined) => void;
}) {
  const current: MediaAppearance = media ?? {};
  const patch = (partial: Partial<MediaAppearance>) => {
    const merged: MediaAppearance = { ...current, ...partial };
    for (const key of Object.keys(merged) as Array<keyof MediaAppearance>) {
      if (merged[key] === undefined || merged[key] === '') delete merged[key];
    }
    onChange(Object.keys(merged).length > 0 ? merged : undefined);
  };

  return (
    <InspectorDialog label="Aspecto y filtros" icon={<SlidersHorizontal size={13} aria-hidden="true" />}>
      <div className="e2-design-panel">
        <div className="e2-quad-grid">
          <label className="e2-design-field">
            <span className="e2-design-label">Relación de aspecto</span>
            <select
              aria-label="Relación de aspecto"
              value={current.aspect ?? 'auto'}
              onChange={(e) =>
                patch({ aspect: e.target.value === 'auto' ? undefined : (e.target.value as MediaAppearance['aspect']) })
              }
            >
              <option value="auto">Automática</option>
              <option value="16/9">16:9 (Panorámica)</option>
              <option value="4/3">4:3 (Micrografía)</option>
              <option value="1/1">1:1 (Cuadrada)</option>
              <option value="3/4">3:4 (Vertical)</option>
            </select>
          </label>
          <label className="e2-design-field">
            <span className="e2-design-label">Punto focal</span>
            <select
              aria-label="Punto focal de la imagen"
              value={current.objectPosition ?? 'center'}
              onChange={(e) =>
                patch({
                  objectPosition:
                    e.target.value === 'center' ? undefined : (e.target.value as MediaAppearance['objectPosition']),
                })
              }
            >
              <option value="center">Centro</option>
              <option value="top">Arriba</option>
              <option value="bottom">Abajo</option>
              <option value="left">Izquierda</option>
              <option value="right">Derecha</option>
            </select>
          </label>
        </div>

        <div className="e2-quad-grid">
          <label className="e2-design-field">
            <span className="e2-design-label">Filtro visual</span>
            <select
              aria-label="Filtro visual de la imagen"
              value={current.filter ?? 'none'}
              onChange={(e) =>
                patch({ filter: e.target.value === 'none' ? undefined : (e.target.value as MediaAppearance['filter']) })
              }
            >
              <option value="none">Original</option>
              <option value="vivid">Vívido</option>
              <option value="contrast">Alto contraste</option>
              <option value="warm">Cálido</option>
              <option value="grayscale">Escala de grises</option>
            </select>
          </label>
          <label className="e2-design-slider">
            <span>Redondeado: {current.radius ?? 0} px</span>
            <input
              type="range"
              aria-label="Redondeado de la imagen"
              min={0}
              max={40}
              step={2}
              value={current.radius ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                patch({ radius: v > 0 ? v : undefined });
              }}
            />
          </label>
        </div>

        <div className="e2-quad-grid">
          <label className="e2-design-field">
            <span className="e2-design-label">Etiqueta sobre la foto</span>
            <input
              type="text"
              maxLength={60}
              placeholder="Ej. H&E · 40×"
              value={current.overlayBadge ?? ''}
              onChange={(e) => patch({ overlayBadge: e.target.value.trim() ? e.target.value : undefined })}
            />
          </label>
          <label className="e2-design-field">
            <span className="e2-design-label">Esquina de etiqueta</span>
            <select
              aria-label="Esquina de la etiqueta"
              value={current.overlayPosition ?? 'tl'}
              onChange={(e) => patch({ overlayPosition: e.target.value as MediaAppearance['overlayPosition'] })}
            >
              <option value="tl">Superior izquierda</option>
              <option value="tr">Superior derecha</option>
              <option value="bl">Inferior izquierda</option>
              <option value="br">Inferior derecha</option>
            </select>
          </label>
        </div>
      </div>
    </InspectorDialog>
  );
}

type CatalogPlaca = {
  id: number;
  photo_url: string;
  aumento: string | null;
  tincion: string | null;
  tema_id: number | null;
  subtema_id: number | null;
};

function PlacaCatalogPicker({ onSelect }: { onSelect: (url: string, alt: string) => void }) {
  const [catalog, setCatalog] = useState<Editor2CatalogSnapshot>({ temas: [], subtemas: [] });
  const [selectedTemaId, setSelectedTemaId] = useState<string>('');
  const [selectedSubtemaId, setSelectedSubtemaId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [placas, setPlacas] = useState<CatalogPlaca[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    loadCatalog()
      .then((snap) => {
        if (active) setCatalog(snap);
      })
      .catch(() => {
        // Ignorar errores de catálogo
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredSubtemas = useMemo(() => {
    if (!selectedTemaId) return catalog.subtemas;
    const temaNum = Number(selectedTemaId);
    return catalog.subtemas.filter((s) => s.tema_id === temaNum);
  }, [catalog.subtemas, selectedTemaId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = async () => {
      try {
        let query = supabase
          .from('placas')
          .select('id, photo_url, aumento, tincion, tema_id, subtema_id')
          .order('id', { ascending: false })
          .limit(60);
        if (selectedSubtemaId) {
          query = query.eq('subtema_id', Number(selectedSubtemaId));
        } else if (selectedTemaId) {
          query = query.eq('tema_id', Number(selectedTemaId));
        }
        const { data } = await query;
        if (!active) return;
        const valid: CatalogPlaca[] = [];
        for (const row of data ?? []) {
          if (typeof row?.photo_url === 'string' && row.photo_url.startsWith('https://')) {
            valid.push({
              id: Number(row.id),
              photo_url: row.photo_url,
              aumento: typeof row.aumento === 'string' ? row.aumento : null,
              tincion: typeof row.tincion === 'string' ? row.tincion : null,
              tema_id: typeof row.tema_id === 'number' ? row.tema_id : null,
              subtema_id: typeof row.subtema_id === 'number' ? row.subtema_id : null,
            });
          }
        }
        setPlacas(valid);
      } catch {
        if (active) setPlacas([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [selectedTemaId, selectedSubtemaId]);

  const visiblePlacas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return placas;
    return placas.filter((p) => {
      const hay = `placa ${p.id} ${p.tincion ?? ''} ${p.aumento ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [placas, search]);

  return (
    <div className="e2-catalog-picker-wrap">
      <div className="e2-catalog-picker__filters">
        <select
          aria-label="Filtrar por tema"
          value={selectedTemaId}
          onChange={(e) => {
            setSelectedTemaId(e.target.value);
            setSelectedSubtemaId('');
          }}
        >
          <option value="">Todos los temas</option>
          {catalog.temas.map((tema) => (
            <option key={tema.id} value={tema.id}>
              {tema.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por subtema"
          value={selectedSubtemaId}
          onChange={(e) => setSelectedSubtemaId(e.target.value)}
          disabled={filteredSubtemas.length === 0}
        >
          <option value="">Todos los subtemas</option>
          {filteredSubtemas.map((sub) => (
            <option key={sub.id} value={sub.id}>
              {sub.nombre}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label="Buscar placa por tinción, aumento o número"
          placeholder="Buscar tinción, aumento o #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading ? (
        <p className="e2-catalog-picker__status">Cargando placas del Atlas...</p>
      ) : visiblePlacas.length === 0 ? (
        <p className="e2-catalog-picker__status">No se encontraron placas para este filtro.</p>
      ) : (
        <div className="e2-catalog-picker" role="list" aria-label="Placas del catálogo del Atlas">
          {visiblePlacas.map((placa) => {
            const label = [
              `Placa #${placa.id}`,
              placa.tincion ? placa.tincion : null,
              placa.aumento ? `${placa.aumento}x` : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <button
                key={placa.id}
                type="button"
                className="e2-catalog-picker__item"
                onClick={() => onSelect(placa.photo_url, label)}
                title={label}
              >
                <img src={placa.photo_url} alt={label} loading="lazy" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BlockComponentTools() {
  const { selectedItem, dispatch, getSelectorForId } = usePuck();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [atlasPages, setAtlasPages] = useState<Editor2PageSummary[]>([]);
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
    if (selectedItem?.type !== 'button' || atlasPages.length > 0) return;
    let active = true;
    loadPageIndex()
      .then((res) => {
        if (active) setAtlasPages(res.pages);
      })
      .catch(() => {
        // Ignorar errores de carga de índice
      });
    return () => {
      active = false;
    };
  }, [atlasPages.length, selectedItem?.type]);

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
        <InspectorDialog label="Elegir del Atlas" icon={<Images size={14} aria-hidden="true" />}>
          <PlacaCatalogPicker
            onSelect={(url, label) => {
              updateProps({ src: url, alt: label });
            }}
          />
        </InspectorDialog>
        <MediaStyleDialog
          media={item.props.media as MediaAppearance | undefined}
          onChange={(media) => updateProps({ media })}
        />
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
        <label className="e2-layout-field__control">
          <span>Cabecera</span>
          <input
            type="color"
            aria-label="Color de cabecera"
            value={item.props.accentColor ?? '#e0f2fe'}
            onChange={(e) => updateProps({ accentColor: e.target.value })}
          />
        </label>
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
        <InspectorDialog label="Elegir del Atlas" icon={<Images size={14} aria-hidden="true" />}>
          <PlacaCatalogPicker
            onSelect={(url, label) => {
              updateSlide({ src: url, alt: label });
            }}
          />
        </InspectorDialog>
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
        <MediaStyleDialog
          media={item.props.media as MediaAppearance | undefined}
          onChange={(media) => updateProps({ media })}
        />
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
    const createCanvasSection = (): PuckCanvasData => ({
      type: 'canvas',
      props: {
        id: `canvas-${crypto.randomUUID()}`,
        layout: createLayoutIntent(24),
        gap: 'md',
        content: [],
      },
    });

    const items: PuckTabItem[] =
      Array.isArray(item.props.items) && item.props.items.length > 0
        ? (item.props.items as PuckTabItem[])
        : [{ title: 'Sección 1', content: [createCanvasSection()] }];
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
          content: [createCanvasSection()],
        },
      ];
      const nextIdx = next.length - 1;
      setActiveTabIndex(item.props.id, nextIdx);
      setTabIndex(nextIdx);
      updateProps({ items: next });
      window.dispatchEvent(new CustomEvent('e2:tabs-select', { detail: { id: item.props.id, index: nextIdx } }));
    };

    const addCanvasToActiveTab = () => {
      const existingContent = Array.isArray(currentTab?.content) ? currentTab.content : [];
      updateTab({ content: [...existingContent, createCanvasSection()] });
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
        <button
          type="button"
          className="e2-button e2-button--quiet"
          onClick={addCanvasToActiveTab}
          title="Añadir bloque de página en la pestaña activa"
        >
          <LayoutGrid size={13} aria-hidden="true" />
          <span>+ Bloque de página</span>
        </button>
        <label className="e2-layout-field__control">
          <span>Acento</span>
          <input
            type="color"
            aria-label="Color de pestañas"
            value={item.props.accentColor ?? '#0284c7'}
            onChange={(e) => updateProps({ accentColor: e.target.value })}
          />
        </label>
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
        <InspectorDialog label="Atlas A" icon={<Images size={14} aria-hidden="true" />}>
          <PlacaCatalogPicker
            onSelect={(url, label) => {
              updateProps({ leftSrc: url, leftLabel: label });
            }}
          />
        </InspectorDialog>
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
        <InspectorDialog label="Atlas B" icon={<Images size={14} aria-hidden="true" />}>
          <PlacaCatalogPicker
            onSelect={(url, label) => {
              updateProps({ rightSrc: url, rightLabel: label });
            }}
          />
        </InspectorDialog>
        {uploadError && <span className="e2-upload-error" role="alert">{uploadError}</span>}
      </div>
    );
  }

  if (item.type === 'button') {
    const currentHref = typeof item.props.href === 'string' ? item.props.href : '';
    const matchingPage = atlasPages.some((p) => p.publicPath === currentHref) ? currentHref : '';
    const matchingTest = atlasTests.some((t) => `/evaluaciones/ejecutar/${t.id}` === currentHref) ? currentHref : '';
    return (
      <div className="e2-component-tools" role="group" aria-label="Enlace interno del Atlas">
        <label className="e2-layout-field__control">
          <span>Página Atlas</span>
          <select
            aria-label="Elegir página interna del Atlas"
            value={matchingPage}
            onChange={(e) => {
              if (e.target.value) updateProps({ href: e.target.value, newTab: false });
            }}
          >
            <option value="">URL personalizada...</option>
            {atlasPages.map((p) => (
              <option key={p.pageKey} value={p.publicPath}>
                {p.title} ({p.publicPath})
              </option>
            ))}
          </select>
        </label>
        <label className="e2-layout-field__control">
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
        </label>
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
    const createCanvasSection = (): PuckCanvasData => ({
      type: 'canvas',
      props: {
        id: `canvas-${crypto.randomUUID()}`,
        layout: createLayoutIntent(24),
        gap: 'md',
        content: [],
      },
    });

    const items: PuckAccordionItem[] =
      Array.isArray(item.props.items) && item.props.items.length > 0
        ? (item.props.items as PuckAccordionItem[])
        : [{ title: 'Sección desplegable 1', openByDefault: true, content: [createCanvasSection()] }];
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
          content: [createCanvasSection()],
        },
      ];
      const nextIdx = next.length - 1;
      setActiveAccordionIndex(item.props.id, nextIdx);
      setAccordionIndex(nextIdx);
      updateProps({ items: next });
      window.dispatchEvent(new CustomEvent('e2:accordion-select', { detail: { id: item.props.id, index: nextIdx } }));
    };

    const addCanvasToActiveSection = () => {
      const existingContent = Array.isArray(currentSection?.content) ? currentSection.content : [];
      updateSection({ content: [...existingContent, createCanvasSection()] });
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
        <button
          type="button"
          className="e2-button e2-button--quiet"
          onClick={addCanvasToActiveSection}
          title="Añadir bloque de página en la sección activa"
        >
          <LayoutGrid size={13} aria-hidden="true" />
          <span>+ Bloque de página</span>
        </button>
        <label className="e2-layout-field__control">
          <span>Acento</span>
          <input
            type="color"
            aria-label="Color de acordeón"
            value={item.props.accentColor ?? '#0284c7'}
            onChange={(e) => updateProps({ accentColor: e.target.value })}
          />
        </label>
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
