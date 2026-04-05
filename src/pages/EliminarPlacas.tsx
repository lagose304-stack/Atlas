import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MousePointerClick } from 'lucide-react';
import { supabase } from '../services/supabase';
import { deleteFromCloudinary, getCloudinaryPublicId } from '../services/cloudinary';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LoadingToast from '../components/LoadingToast';
import { useAuth } from '../contexts/AuthContext';
import { logPlateActivity } from '../services/plateActivityAudit';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';

interface Tema {
  id: number;
  nombre: string;
  parcial: string;
  sort_order: number;
}

interface Subtema {
  id: number;
  nombre: string;
  tema_id: number;
}

interface Placa {
  id: number;
  photo_url: string;
  aumento?: string | null;
  sort_order: number;
  tema_id?: number;
  subtema_id?: number;
}

interface InteractiveMapPlacaRow {
  placa_id: number;
  sections: unknown[] | null;
}

interface PlacaGroupByAumento {
  key: string;
  title: string;
  sortValue: number;
  items: Placa[];
}

type ParcialKey = 'primer' | 'segundo' | 'tercer';

const PARCIALES: { key: ParcialKey; label: string }[] = [
  { key: 'primer',  label: 'Primer parcial'  },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer',  label: 'Tercer parcial'  },
];

const parseAumentoSortValue = (aumento: string): number => {
  const normalized = aumento.trim().replace(',', '.');
  const match = normalized.match(/\d+(?:\.\d+)?/);
  if (!match) return Number.POSITIVE_INFINITY;

  const numeric = Number.parseFloat(match[0]);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
};

const normalizeAumentoLabel = (aumento: string): string => aumento.trim().replace(/\s+/g, '').toUpperCase();

// Extrae todas las URLs de imagen de un bloque (todos los tipos)
function extractAllBlockImageUrls(b: { block_type: string; content: Record<string, string> }): string[] {
  const c = b.content;
  const urls: string[] = [];
  switch (b.block_type) {
    case 'image':         if (c.url) urls.push(c.url); break;
    case 'text_image':    if (c.image_url) urls.push(c.image_url); break;
    case 'two_images':
      if (c.image_url_left)  urls.push(c.image_url_left);
      if (c.image_url_right) urls.push(c.image_url_right);
      break;
    case 'three_images':
      if (c.image_url_1) urls.push(c.image_url_1);
      if (c.image_url_2) urls.push(c.image_url_2);
      if (c.image_url_3) urls.push(c.image_url_3);
      break;
    case 'carousel':
    case 'text_carousel':
      for (let i = 1; i <= 8; i++) { const u = c[`image_url_${i}`]; if (u) urls.push(u); else break; }
      break;
    case 'double_carousel':
      for (let i = 1; i <= 5; i++) { const l = c[`left_image_url_${i}`];  if (l) urls.push(l); else break; }
      for (let i = 1; i <= 5; i++) { const r = c[`right_image_url_${i}`]; if (r) urls.push(r); else break; }
      break;
  }
  return urls.filter(Boolean);
}

const EliminarPlacas: React.FC = () => {
  const { user } = useAuth();

  const [temas,    setTemas]    = useState<Tema[]>([]);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [placas,   setPlacas]   = useState<Placa[]>([]);
  const [placasConMapa, setPlacasConMapa] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [selectedTemaId,    setSelectedTemaId]    = useState<number | null>(null);
  const [selectedSubtemaId, setSelectedSubtemaId] = useState<number | null>(null);

  const [loadingTemas,    setLoadingTemas]    = useState(true);
  const [loadingSubtemas, setLoadingSubtemas] = useState(false);
  const [loadingPlacas,   setLoadingPlacas]   = useState(false);
  const [temasLoadError, setTemasLoadError] = useState<string | null>(null);
  const [subtemasLoadError, setSubtemasLoadError] = useState<string | null>(null);
  const [placasLoadError, setPlacasLoadError] = useState<string | null>(null);
  const [temasReloadTick, setTemasReloadTick] = useState(0);
  const [subtemasReloadTick, setSubtemasReloadTick] = useState(0);
  const [placasReloadTick, setPlacasReloadTick] = useState(0);

  const [isDeleting,    setIsDeleting]    = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const [hoveredCard,   setHoveredCard]   = useState<number | null>(null);

  const fetchTemas = useCallback(async (): Promise<boolean> => {
    setLoadingTemas(true);
    setTemasLoadError(null);
    try {
      const { data, error } = await supabase
        .from('temas')
        .select('id, nombre, parcial, sort_order')
        .order('parcial')
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      setTemas(data ?? []);
      return true;
    } catch (err) {
      console.error('Error al cargar temas en eliminar placas:', err);
      setTemas([]);
      setTemasLoadError('No se pudieron cargar los temas. Revisa tu conexión e inténtalo de nuevo.');
      return false;
    } finally {
      setLoadingTemas(false);
    }
  }, []);

  const fetchSubtemas = useCallback(async (temaId: number): Promise<boolean> => {
    setLoadingSubtemas(true);
    setSubtemasLoadError(null);
    try {
      const { data, error } = await supabase
        .from('subtemas')
        .select('id, nombre, tema_id')
        .eq('tema_id', temaId)
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      setSubtemas(data ?? []);
      return true;
    } catch (err) {
      console.error('Error al cargar subtemas en eliminar placas:', err);
      setSubtemas([]);
      setSubtemasLoadError('No se pudieron cargar los subtemas. Revisa tu conexión e inténtalo de nuevo.');
      return false;
    } finally {
      setLoadingSubtemas(false);
    }
  }, []);

  const fetchPlacas = useCallback(async (subtemaId: number): Promise<boolean> => {
    setLoadingPlacas(true);
    setPlacasLoadError(null);
    try {
      const { data, error } = await supabase
        .from('placas')
        .select('id, photo_url, aumento, sort_order, tema_id, subtema_id')
        .eq('subtema_id', subtemaId)
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      const nextPlacas = data ?? [];
      setPlacas(nextPlacas);

      const placaIds = nextPlacas
        .map((placa) => placa.id)
        .filter((id): id is number => typeof id === 'number');

      if (placaIds.length > 0) {
        const { data: interactiveMapsData, error: interactiveMapsError } = await supabase
          .from('interactive_maps')
          .select('placa_id, sections')
          .in('placa_id', placaIds);

        if (interactiveMapsError) {
          console.error('Error al consultar mapas interactivos por placa en eliminar placas:', interactiveMapsError);
          setPlacasConMapa(new Set());
        } else {
          const placaIdsConMapa = (interactiveMapsData ?? [])
            .filter((row: InteractiveMapPlacaRow) => Array.isArray(row.sections) && row.sections.length > 0)
            .map((row: InteractiveMapPlacaRow) => row.placa_id)
            .filter((id): id is number => typeof id === 'number');
          setPlacasConMapa(new Set(placaIdsConMapa));
        }
      } else {
        setPlacasConMapa(new Set());
      }

      return true;
    } catch (err) {
      console.error('Error al cargar placas en eliminar placas:', err);
      setPlacas([]);
      setPlacasConMapa(new Set());
      setPlacasLoadError('No se pudieron cargar las placas. Revisa tu conexión e inténtalo de nuevo.');
      return false;
    } finally {
      setLoadingPlacas(false);
    }
  }, []);

  // Cargar temas al montar
  useEffect(() => {
    void fetchTemas();
  }, [fetchTemas, temasReloadTick]);

  // Cargar subtemas cuando cambia el tema
  useEffect(() => {
    setSubtemas([]);
    setPlacas([]);
    setPlacasConMapa(new Set());
    setSelectedSubtemaId(null);
    setSelectedIds(new Set());
    setSubtemasLoadError(null);
    setPlacasLoadError(null);
    setPlacasReloadTick(0);
    if (!selectedTemaId) return;
    void fetchSubtemas(selectedTemaId);
  }, [selectedTemaId, subtemasReloadTick, fetchSubtemas]);

  // Cargar placas cuando cambia el subtema
  useEffect(() => {
    setPlacas([]);
    setPlacasConMapa(new Set());
    setSelectedIds(new Set());
    setPlacasLoadError(null);
    if (!selectedSubtemaId) return;
    void fetchPlacas(selectedSubtemaId);
  }, [selectedSubtemaId, placasReloadTick, fetchPlacas]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === placas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(placas.map(p => p.id)));
    }
  };

  const handleDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    setShowConfirm(false);
    setDeleteSuccessMessage(null);
    try {
      const toDelete = placas.filter(p => selectedIds.has(p.id));
      const toDeleteUrlSet = new Set(toDelete.map(p => p.photo_url));
      const placaIdsToDelete = toDelete.map((placa) => placa.id);
      let deletedMapsCount = 0;

      // 1. Borrar content_blocks que referencian estas fotos en cualquier página del sitio
      const { data: allBlocks } = await supabase
        .from('content_blocks').select('id, block_type, content');
      const blockIdsToDelete: string[] = [];
      for (const b of (allBlocks ?? [])) {
        const urls = extractAllBlockImageUrls(b as any);
        if (urls.some(u => toDeleteUrlSet.has(u))) {
          blockIdsToDelete.push(b.id as string);
        }
      }
      if (blockIdsToDelete.length > 0) {
        await supabase.from('content_blocks').delete().in('id', blockIdsToDelete);
      }

      // 2. Borrar mapas interactivos asociados a las placas seleccionadas
      if (placaIdsToDelete.length > 0) {
        const { data: deletedInteractiveMaps, error: deleteInteractiveMapsError } = await supabase
          .from('interactive_maps')
          .delete()
          .in('placa_id', placaIdsToDelete)
          .select('id');

        if (deleteInteractiveMapsError) {
          throw deleteInteractiveMapsError;
        }

        deletedMapsCount = deletedInteractiveMaps?.length ?? 0;
      }

      // 3. Borrar fotos de Cloudinary y registros de placas
      await Promise.all(
        toDelete.map(async placa => {
          const publicId = getCloudinaryPublicId(placa.photo_url);
          if (publicId) {
            try { await deleteFromCloudinary({ publicId, imageUrl: placa.photo_url }); } catch {/* ignorar si falla Cloudinary */}
          }

          const { error: deletePlacaError } = await supabase
            .from('placas')
            .delete()
            .eq('id', placa.id);

          if (deletePlacaError) {
            throw deletePlacaError;
          }

          await logPlateActivity({
            actionType: 'delete_classified',
            targetTable: 'placas',
            placaId: placa.id,
            actor: {
              id: user?.id ?? null,
              username: user?.username ?? null,
            },
            details: {
              source: 'eliminar_placas',
              selected_tema_id: selectedTemaId,
              selected_subtema_id: selectedSubtemaId,
              tema_id: placa.tema_id ?? selectedTemaId,
              subtema_id: placa.subtema_id ?? selectedSubtemaId,
            },
          });
        })
      );
      setPlacas(prev => prev.filter(p => !selectedIds.has(p.id)));
      setPlacasConMapa((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        placaIdsToDelete.forEach((id) => next.delete(id));
        return next;
      });
      setSelectedIds(new Set());
      const deletedPlacasCount = placaIdsToDelete.length;
      const placasLabel = deletedPlacasCount === 1 ? 'placa' : 'placas';
      const mapasLabel = deletedMapsCount === 1 ? 'mapa interactivo asociado' : 'mapas interactivos asociados';
      setDeleteSuccessMessage(
        `✅ Eliminacion completada: ${deletedPlacasCount} ${placasLabel} y ${deletedMapsCount} ${mapasLabel}.`
      );
      setTimeout(() => setDeleteSuccessMessage(null), 4500);
    } catch (err) {
      console.error('Error al eliminar placas:', err);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, placas, user, selectedTemaId, selectedSubtemaId]);

  const temasByParcial: Record<ParcialKey, Tema[]> = { primer: [], segundo: [], tercer: [] };
  temas.forEach(t => {
    if (temasByParcial[t.parcial as ParcialKey]) {
      temasByParcial[t.parcial as ParcialKey].push(t);
    }
  });

  const selectedTema    = temas.find(t => t.id === selectedTemaId)       ?? null;
  const selectedSubtema = subtemas.find(s => s.id === selectedSubtemaId) ?? null;
  const allSelected     = placas.length > 0 && selectedIds.size === placas.length;
  const someSelected    = selectedIds.size > 0;
  const handleGoBack = useSmartBackNavigation('/edicion');

  const interactivePlacas = useMemo(() => {
    return placas.filter((placa) => placasConMapa.has(placa.id));
  }, [placas, placasConMapa]);

  const nonInteractivePlacas = useMemo(() => {
    return placas.filter((placa) => !placasConMapa.has(placa.id));
  }, [placas, placasConMapa]);

  const placasByAumento = useMemo<PlacaGroupByAumento[]>(() => {
    const groups = new Map<string, PlacaGroupByAumento>();

    nonInteractivePlacas.forEach((placa) => {
      const aumentoRaw = (placa.aumento ?? '').trim();
      const hasAumento = aumentoRaw.length > 0;
      const aumentoLabel = hasAumento ? normalizeAumentoLabel(aumentoRaw) : 'SIN_AUMENTO';
      const key = hasAumento ? `AUMENTO_${aumentoLabel}` : 'AUMENTO_SIN_AUMENTO';
      const title = hasAumento ? `Aumento ${aumentoLabel}` : 'Sin aumento';
      const sortValue = hasAumento ? parseAumentoSortValue(aumentoRaw) : Number.POSITIVE_INFINITY;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title,
          sortValue,
          items: [],
        });
      }

      const target = groups.get(key);
      if (target) {
        target.items.push(placa);
      }
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.sortValue !== b.sortValue) return a.sortValue - b.sortValue;
      return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
    });
  }, [nonInteractivePlacas]);

  const renderPlacaCard = (placa: Placa, index: number, keySuffix: string) => {
    const isSelected = selectedIds.has(placa.id);
    const isHovered = hoveredCard === placa.id;
    const hasInteractiveMap = placasConMapa.has(placa.id);

    return (
      <div
        key={`${placa.id}-${keySuffix}`}
        className="placa-thumb-wrap"
        style={{
          ...s.placaCard,
          border: isSelected
            ? '2.5px solid #ef4444'
            : isHovered
            ? '2px solid #38bdf8'
            : '1.5px solid #e0f2fe',
          boxShadow: isSelected
            ? '0 0 0 4px rgba(239,68,68,0.18)'
            : isHovered
            ? '0 12px 28px rgba(14,165,233,0.22)'
            : '0 2px 10px rgba(15,23,42,0.10)',
          transform: isHovered && !isSelected ? 'translateY(-4px)' : 'none',
          cursor: 'pointer',
        }}
        onClick={() => toggleSelect(placa.id)}
        onMouseEnter={() => setHoveredCard(placa.id)}
        onMouseLeave={() => setHoveredCard(null)}
      >
        <div style={{
          ...s.cardAccent,
          background: isSelected
            ? 'linear-gradient(90deg, #ef4444, #f97316)'
            : 'linear-gradient(90deg, #38bdf8, #818cf8)',
        }} />

        <span style={s.positionBadge}>{index + 1}</span>

        {hasInteractiveMap && (
          <span style={s.interactiveMapBadge} title="Mapa interactivo disponible" aria-label="Mapa interactivo disponible">
            <MousePointerClick size={14} strokeWidth={2.3} />
          </span>
        )}

        {isSelected && (
          <div style={{ ...s.selectedMark, right: hasInteractiveMap ? '42px' : '10px' }}>✓</div>
        )}

        <div style={s.imgWrap}>
          <img
            src={getCloudinaryImageUrl(placa.photo_url, 'thumb')}
            alt={`Placa ${index + 1}`}
            style={{
              ...s.img,
              ...(isSelected ? { filter: 'brightness(0.55) saturate(0.5)' } : {}),
            }}
            loading="lazy"
            draggable={false}
          />
        </div>

        <div style={{
          ...s.cardFooter,
          background: isSelected
            ? '#fee2e2'
            : isHovered
            ? 'linear-gradient(135deg, #e0f2fe, #ede9fe)'
            : '#f8fafc',
          borderColor: isSelected ? '#fca5a5' : isHovered ? '#7dd3fc' : '#e2e8f0',
        }}>
          <span style={{
            ...s.cardFooterText,
            color: isSelected ? '#991b1b' : '#94a3b8',
            fontWeight: isSelected ? 700 : 600,
          }}>
            {isSelected ? '🗑️ Seleccionada' : 'Clic para seleccionar'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>

                <BackButton onClick={handleGoBack} />

        {/* Encabezado */}
        <div style={s.pageHeader}>
          <h1 style={s.pageTitle}>Eliminar placas</h1>
          <p style={s.pageSubtitle}>Selecciona un tema y subtema, luego marca las placas que deseas eliminar. Esta acción es permanente e irreversible.</p>
          <div style={s.accentLine} />
        </div>

        {/* Selección de tema y subtema */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <h2 style={s.cardTitle}>Selecciona tema y subtema</h2>
            <p style={s.cardSubtitle}>Elige el subtema cuyas placas deseas gestionar</p>
            <div style={s.divider} />
          </div>

          <div style={s.selectsRow}>
            {/* Selector de Tema */}
            <div style={s.selectGroup}>
              <label style={s.selectLabel}>Tema</label>
              {loadingTemas ? (
                <div style={s.inlineLoading}><div style={s.spinnerSm} /> Cargando...</div>
              ) : (
                <select
                  style={s.select}
                  value={selectedTemaId ?? ''}
                  onChange={e => setSelectedTemaId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— Elige un tema —</option>
                  {PARCIALES.map(({ key, label }) =>
                    temasByParcial[key].length > 0 ? (
                      <optgroup key={key} label={label}>
                        {temasByParcial[key].map(t => (
                          <option key={t.id} value={t.id}>{t.nombre}</option>
                        ))}
                      </optgroup>
                    ) : null
                  )}
                </select>
              )}
            </div>

            {/* Selector de Subtema */}
            <div style={s.selectGroup}>
              <label style={s.selectLabel}>Subtema</label>
              {loadingSubtemas ? (
                <div style={s.inlineLoading}><div style={s.spinnerSm} /> Cargando...</div>
              ) : (
                <select
                  style={{ ...s.select, ...(!selectedTemaId ? s.selectDisabled : {}) }}
                  value={selectedSubtemaId ?? ''}
                  disabled={!selectedTemaId || subtemas.length === 0}
                  onChange={e => setSelectedSubtemaId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">
                    {!selectedTemaId
                      ? '— Primero elige un tema —'
                      : subtemas.length === 0
                      ? '— Sin subtemas —'
                      : '— Elige un subtema —'}
                  </option>
                  {subtemas.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {(temasLoadError || subtemasLoadError) && (
            <div style={s.loadErrorBox}>
              {temasLoadError && (
                <div style={s.loadErrorRow}>
                  <span style={s.loadErrorText}>{temasLoadError}</span>
                  <button
                    type="button"
                    style={s.retryButton}
                    onClick={() => setTemasReloadTick(tick => tick + 1)}
                    disabled={loadingTemas}
                  >
                    {loadingTemas ? 'Reintentando...' : 'Reintentar temas'}
                  </button>
                </div>
              )}

              {subtemasLoadError && selectedTemaId && (
                <div style={s.loadErrorRow}>
                  <span style={s.loadErrorText}>{subtemasLoadError}</span>
                  <button
                    type="button"
                    style={s.retryButton}
                    onClick={() => setSubtemasReloadTick(tick => tick + 1)}
                    disabled={loadingSubtemas}
                  >
                    {loadingSubtemas ? 'Reintentando...' : 'Reintentar subtemas'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grid de placas */}
        {selectedSubtema && (
          <div style={s.card}>
            <div style={s.cardHeader}>
              <h2 style={s.cardTitle}>
                {selectedTema?.nombre} › {selectedSubtema.nombre}
              </h2>
              <p style={s.cardSubtitle}>
                {placas.length} {placas.length === 1 ? 'placa' : 'placas'} — haz clic para seleccionar
              </p>
              <div style={s.divider} />
            </div>

            {/* Barra seleccionar todo */}
            {placas.length > 0 && !loadingPlacas && (
              <div style={s.selectAllBar}>
                <label style={s.selectAllLabel}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    style={{ marginRight: '8px', cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </label>
                {someSelected && (
                  <span style={s.selectedCount}>
                    {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            {placasLoadError ? (
              <div style={s.loadErrorBox}>
                <div style={s.loadErrorRow}>
                  <span style={s.loadErrorText}>{placasLoadError}</span>
                  <button
                    type="button"
                    style={s.retryButton}
                    onClick={() => setPlacasReloadTick(tick => tick + 1)}
                    disabled={loadingPlacas}
                  >
                    {loadingPlacas ? 'Reintentando...' : 'Reintentar placas'}
                  </button>
                </div>
              </div>
            ) : loadingPlacas ? (
              <div style={s.loadingWrap}>
                <div style={s.spinner} />
                <p style={s.loadingText}>Cargando placas...</p>
              </div>
            ) : placas.length === 0 ? (
              <div style={s.emptyState}>Este subtema no tiene placas aún.</div>
            ) : (
              <div style={s.gallerySectionsWrap}>
                {interactivePlacas.length > 0 && (
                  <section style={s.gallerySection}>
                    <div style={s.gallerySectionHeader}>
                      <h3 style={s.gallerySectionTitle}>Placas con mapa interactivo</h3>
                      <span style={s.gallerySectionCount}>{interactivePlacas.length}</span>
                    </div>
                    <div className="placas-gallery-grid">
                      {interactivePlacas.map((placa, idx) => renderPlacaCard(placa, idx, 'interactive'))}
                    </div>
                  </section>
                )}

                {placasByAumento.map((group) => (
                  <section key={group.key} style={s.gallerySection}>
                    <div style={s.gallerySectionHeader}>
                      <h3 style={s.gallerySectionTitle}>{group.title}</h3>
                      <span style={s.gallerySectionCount}>{group.items.length}</span>
                    </div>
                    <div className="placas-gallery-grid">
                      {group.items.map((placa, idx) => renderPlacaCard(placa, idx, group.key))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Botón de eliminar inline — sin barra fija */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end', marginTop: '24px', paddingBottom: '40px' }}>
          {deleteSuccessMessage && (
            <span style={s.successMsg}>{deleteSuccessMessage}</span>
          )}
          <button
            style={someSelected && !isDeleting ? s.deleteBtn : s.deleteBtnDisabled}
            disabled={!someSelected || isDeleting}
            onClick={() => setShowConfirm(true)}
          >
            {isDeleting
              ? 'Eliminando...'
              : someSelected
              ? `🗑️ Eliminar ${selectedIds.size} placa${selectedIds.size !== 1 ? 's' : ''}`
              : '— Ninguna seleccionada —'}
          </button>
        </div>
      </main>

      {/* Modal de confirmación */}
      {showConfirm && (
        <div style={s.modalOverlay} onClick={() => setShowConfirm(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={s.modalTitle}>⚠️ Confirmar eliminación</h3>
            <p style={s.modalBody}>
              ¿Estás seguro de que deseas eliminar{' '}
              <strong>{selectedIds.size} placa{selectedIds.size !== 1 ? 's' : ''}</strong>?
              Esta acción es <strong>permanente e irreversible</strong>.
            </p>
            <div style={s.modalActions}>
              <button
                style={s.cancelBtn}
                onClick={() => setShowConfirm(false)}
                onMouseEnter={e => (e.currentTarget.style.background = '#e2e8f0')}
                onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
              >
                Cancelar
              </button>
              <button style={s.deleteBtn} onClick={handleDelete}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
      <LoadingToast visible={isDeleting} type="deleting" message="Eliminando placas" />
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    background: 'transparent',
    color: '#0f172a',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1300px',
    margin: '0 auto',
    padding: 'clamp(16px, 3vw, 40px) clamp(12px, 3vw, 40px) 120px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  breadcrumb: {
    display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' as const,
    background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)',
    border: '1px solid rgba(186,230,253,0.6)', borderRadius: '12px',
    padding: '8px 16px', boxShadow: '0 2px 8px rgba(14,165,233,0.07)',
    alignSelf: 'flex-start',
  },
  breadcrumbLink: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#0ea5e9',
    fontWeight: 600, fontSize: '0.88em', padding: '4px 8px', borderRadius: '8px',
    transition: 'background 0.15s', fontFamily: 'inherit', letterSpacing: '0.01em',
  },
  breadcrumbSep: { color: '#94a3b8', fontWeight: 700, fontSize: '0.75em', userSelect: 'none' as const },
  breadcrumbCurrent: {
    color: '#0f172a', fontWeight: 800, fontSize: '0.88em', padding: '4px 8px',
    background: 'linear-gradient(135deg, #e0f2fe, #ede9fe)', borderRadius: '8px',
    border: '1px solid #bae6fd', letterSpacing: '0.01em',
  },
  pageHeader: { display: 'flex', flexDirection: 'column', gap: '6px' },
  pageTitle: {
    fontSize: 'clamp(1.6em, 4vw, 2.4em)', fontWeight: 900, color: '#0f172a',
    letterSpacing: '-0.03em', margin: 0,
  },
  pageSubtitle: { fontSize: 'clamp(0.88em, 2vw, 1em)', color: '#64748b', margin: 0, lineHeight: 1.6 },
  accentLine: {
    width: '56px', height: '4px',
    background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: '4px',
    marginTop: '8px',
  },
  card: {
    background: 'transparent',
    borderRadius: '20px',
    padding: 'clamp(16px, 3vw, 36px)',
    boxShadow: 'none',
    border: 'none',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '24px',
  },
  cardTitle: {
    fontSize: 'clamp(1.2em, 3vw, 2em)',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.03em',
    margin: '0 0 6px',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: '0.9em',
    color: '#64748b',
    margin: '0 0 14px',
    textAlign: 'center',
  },
  divider: {
    width: '56px',
    height: '4px',
    background: 'linear-gradient(90deg, #ef4444, #f97316)',
    borderRadius: '4px',
  },
  selectsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
  },
  selectGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  selectLabel: {
    fontSize: '0.875em',
    fontWeight: 700,
    color: '#475569',
    letterSpacing: '0.03em',
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '1em',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#f8fafc',
    color: '#0f172a',
    cursor: 'pointer',
    outline: 'none',
    boxSizing: 'border-box',
  },
  selectDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  inlineLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    fontSize: '0.9em',
    color: '#64748b',
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1.5px solid #e2e8f0',
  },
  spinnerSm: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '3px solid #e0f2fe',
    borderTop: '3px solid #38bdf8',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  },
  loadErrorBox: {
    marginTop: '14px',
    borderRadius: '12px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  loadErrorRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap',
  },
  loadErrorText: {
    color: '#9f1239',
    fontSize: '0.9em',
    fontWeight: 600,
  },
  retryButton: {
    border: '1px solid #fb7185',
    background: '#ffffff',
    color: '#9f1239',
    borderRadius: '999px',
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: '0.8em',
    fontWeight: 700,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  selectAllBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#f1f5f9',
    borderRadius: '10px',
    marginBottom: '20px',
    border: '1px solid #e2e8f0',
  },
  selectAllLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9em',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
    userSelect: 'none',
  },
  selectedCount: {
    fontSize: '0.85em',
    fontWeight: 700,
    color: '#ef4444',
    background: '#fee2e2',
    padding: '3px 10px',
    borderRadius: '50px',
  },
  emptyState: {
    textAlign: 'center',
    color: '#94a3b8',
    fontStyle: 'italic',
    padding: '36px',
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1px dashed #e2e8f0',
    fontSize: '0.95em',
  },
  gallerySectionsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  gallerySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  gallerySectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    paddingBottom: '7px',
    borderBottom: '1px solid rgba(148,163,184,0.24)',
  },
  gallerySectionTitle: {
    margin: 0,
    color: '#334155',
    fontSize: '0.92em',
    fontWeight: 700,
    letterSpacing: '0.01em',
  },
  gallerySectionCount: {
    color: '#64748b',
    fontSize: '0.76em',
    fontWeight: 700,
    border: '1px solid rgba(148,163,184,0.32)',
    borderRadius: '999px',
    padding: '2px 9px',
    background: 'rgba(255,255,255,0.58)',
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '40px 0',
  },
  spinner: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '4px solid #e0f2fe',
    borderTop: '4px solid #38bdf8',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { color: '#64748b', fontSize: '1em', fontWeight: 500 },
  placaCard: {
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    border: '1.5px solid #e0f2fe',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    transition: 'opacity 0.2s, transform 0.2s, box-shadow 0.2s, border-color 0.2s',
    userSelect: 'none',
  },
  cardAccent: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '3px',
    borderRadius: '12px 12px 0 0',
    zIndex: 1,
  },
  positionBadge: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    background: 'rgba(15,23,42,0.55)',
    color: '#ffffff',
    fontSize: '0.72em',
    fontWeight: 800,
    borderRadius: '6px',
    padding: '2px 7px',
    lineHeight: 1.5,
    zIndex: 2,
    backdropFilter: 'blur(4px)',
  },
  selectedMark: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '26px',
    height: '26px',
    background: '#ef4444',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85em',
    fontWeight: 800,
    zIndex: 3,
    boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
  },
  interactiveMapBadge: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '26px',
    height: '26px',
    borderRadius: '8px',
    background: '#1d345f',
    color: '#f8fbff',
    border: '1px solid rgba(120,143,186,0.78)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 3px 10px rgba(29,52,95,0.38)',
    zIndex: 3,
  },
  imgWrap: {
    width: '100%',
    aspectRatio: '1 / 1',
    overflow: 'hidden',
    background: '#e2e8f0',
    flexShrink: 0,
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    display: 'block',
    pointerEvents: 'none',
    transition: 'filter 0.2s',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '7px 0',
    borderTop: '1px solid #e2e8f0',
    transition: 'background 0.15s, border-color 0.15s',
    flexShrink: 0,
  },
  cardFooterText: {
    fontSize: '0.7em',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  actionBar: {
    position: 'fixed',
    bottom: 0, left: 0, right: 0,
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(12px)',
    borderTop: '1px solid #e2e8f0',
    padding: '14px clamp(16px, 4vw, 48px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
    boxShadow: '0 -4px 24px rgba(15,23,42,0.08)',
  },
  actionRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  successMsg: { fontSize: '0.92em', color: '#15803d', fontWeight: 600 },
  cancelBtn: {
    padding: '10px 22px',
    border: '1.5px solid #cbd5e1',
    borderRadius: '8px',
    cursor: 'pointer',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.95em',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  deleteBtn: {
    padding: '11px 28px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    color: 'white',
    fontWeight: 700,
    fontSize: '1em',
    fontFamily: 'inherit',
    boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
  },
  deleteBtnDisabled: {
    padding: '11px 28px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'not-allowed',
    background: '#e2e8f0',
    color: '#94a3b8',
    fontWeight: 700,
    fontSize: '1em',
    fontFamily: 'inherit',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.55)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: '16px',
  },
  modal: {
    background: '#ffffff',
    borderRadius: '20px',
    padding: 'clamp(24px, 4vw, 40px)',
    maxWidth: '440px',
    width: '100%',
    boxShadow: '0 24px 64px rgba(15,23,42,0.22)',
    border: '1px solid rgba(15,23,42,0.06)',
  },
  modalTitle: {
    margin: '0 0 14px',
    fontSize: '1.3em',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  modalBody: {
    fontSize: '0.95em',
    color: '#475569',
    lineHeight: 1.65,
    margin: '0 0 24px',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
};

export default EliminarPlacas;






