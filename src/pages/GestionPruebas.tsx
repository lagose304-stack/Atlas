import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import Footer from '../components/Footer';
import Header from '../components/Header';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import { useAuth } from '../contexts/AuthContext';
import { deleteFromCloudinary } from '../services/cloudinary';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { getRenderableBlocks } from '../services/contentPublication';
import { hasHtmlMarkup, toSafeHtml } from '../services/richText';
import { supabase } from '../services/supabase';
import { deleteOwnedTestReferenceImages } from '../services/testReferenceImages';
import { logAuditEvent } from '../services/unifiedAuditService';
import { collectWeeklyThemeIds, groupHistoricalTestsByPartial, orderTestsByWeeklyPriority } from './evaluacionesUtils';
import {
  BookOpenCheck,
  CalendarDays,
  Check,
  ClipboardCheck,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Pencil,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';

export type TestScope = 'parcial' | 'tema' | 'subtema';
export type ParcialKey = 'primer' | 'segundo' | 'tercer';

export interface TemaOption {
  id: number;
  nombre: string;
  parcial: string;
  sort_order: number | null;
}

export interface SubtemaOption {
  id: number;
  nombre: string;
  tema_id: number;
  sort_order: number | null;
}

export interface AdminPrueba {
  id: string;
  nombre: string;
  instrucciones: string;
  scope: TestScope;
  parcial_key: ParcialKey;
  estado: string;
  created_at: string;
  updated_at?: string | null;
  created_by_id?: number | null;
  created_by_name?: string | null;
  updated_by_id?: number | null;
  updated_by_name?: string | null;
  image_url?: string | null;
  tema_id?: number | null;
  subtema_id?: number | null;
  tema?: { id: number; nombre: string; logo_url?: string | null } | null;
  subtema?: { id: number; nombre: string; logo_url?: string | null } | null;
}

interface ParcialSection {
  key: ParcialKey;
  title: string;
  parcialTests: AdminPrueba[];
  temaTests: AdminPrueba[];
  subtemaTests: AdminPrueba[];
}

const PARCIALES: Array<{ key: ParcialKey; title: string }> = [
  { key: 'primer', title: 'Primer parcial' },
  { key: 'segundo', title: 'Segundo parcial' },
  { key: 'tercer', title: 'Tercer parcial' },
];

const HISTORICAL_SCOPE_ORDER: Record<TestScope, number> = {
  parcial: 0,
  tema: 1,
  subtema: 2,
};

const toPlainText = (value: string): string => (value || '').replace(/<[^>]+>/g, '').trim();

const InlineRichText: React.FC<{ value: string; fallback?: string }> = ({ value, fallback = '' }) => {
  const content = (value || '').trim();
  if (!content) return <span>{fallback}</span>;
  if (hasHtmlMarkup(content)) {
    return <span dangerouslySetInnerHTML={{ __html: toSafeHtml(content) }} />;
  }
  return <span>{content}</span>;
};

interface TestCardAdminProps {
  prueba: AdminPrueba;
  badge: string;
  badges?: string[];
  isUpdating: boolean;
  onTogglePublication: (prueba: AdminPrueba) => void;
  onReclassify: (prueba: AdminPrueba) => void;
  onRunTest: (prueba: AdminPrueba) => void;
  onEditTest: (prueba: AdminPrueba) => void;
  onDeleteTest: (prueba: AdminPrueba) => void;
}

const AdminTestCard: React.FC<TestCardAdminProps> = ({
  prueba,
  badge,
  badges = [],
  isUpdating,
  onTogglePublication,
  onReclassify,
  onRunTest,
  onEditTest,
  onDeleteTest,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const plainName = toPlainText(prueba.nombre) || 'Prueba';
  const rawImage = prueba.image_url || prueba.subtema?.logo_url || prueba.tema?.logo_url || '';
  const logoSrc = rawImage ? getCloudinaryImageUrl(rawImage, 'cardWide') : '';
  const logoSrcSet = rawImage
    ? `${getCloudinaryImageUrl(rawImage, 'cardWideSmall')} 640w, ${getCloudinaryImageUrl(rawImage, 'cardWide')} 960w`
    : undefined;

  const isPublished = prueba.estado === 'publicada';
  const badgeStyle = badge === 'Tema' ? s.badgeTema : badge === 'Subtema' ? s.badgeSubtema : s.badge;

  return (
    <article className="evaluacion-test-card" style={s.testCard}>
      <div
        className="evaluacion-test-image"
        style={{
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          background: isPublished
            ? 'linear-gradient(145deg, #e1f2fc, #cfe5f5)'
            : 'linear-gradient(145deg, #fef3c7, #fef08a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {logoSrc && !logoFailed ? (
          <img
            src={logoSrc}
            srcSet={logoSrcSet}
            sizes="(max-width: 760px) 50vw, (max-width: 1100px) 33vw, 420px"
            alt={plainName}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }}
            loading="lazy"
            decoding="async"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span style={s.imageFallback}>
            <BookOpenCheck size={28} aria-hidden="true" />
            <strong style={{ fontSize: '0.8rem', lineHeight: 1.25 }}>{plainName}</strong>
          </span>
        )}
      </div>

      <div
        className="evaluacion-test-body"
        style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={badgeStyle}>{badge}</span>
            <span style={isPublished ? s.statePillPublished : s.statePillDraft}>
              {isPublished ? '● Publicada' : '○ Borrador'}
            </span>
          </div>
          <span style={s.meta}>
            <CalendarDays size={13} aria-hidden="true" />
            {new Date(prueba.created_at).toLocaleDateString('es-MX')}
          </span>
        </div>

        <h4 style={s.cardTitle}>
          <InlineRichText value={prueba.nombre} fallback="Prueba sin nombre" />
        </h4>
        <p style={s.cardText}>
          <InlineRichText value={prueba.instrucciones} fallback="Sin instrucciones registradas." />
        </p>

        {badges.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '4px' }}>
            {badges.map((b) => (
              <span key={b} style={s.scopeTag}>{b}</span>
            ))}
          </div>
        )}

        {/* Acciones de administración completas */}
        <div className="evaluacion-admin-actions" style={s.cardActions}>
          <button
            type="button"
            className="eval-admin-btn"
            onClick={() => onTogglePublication(prueba)}
            style={isPublished ? s.unpublishButton : s.publishButton}
            disabled={isUpdating}
            title={isPublished ? 'Ocultar al público y pasar a borrador' : 'Publicar prueba'}
          >
            {isPublished ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
            <span>{isPublished ? 'Borrador' : 'Publicar'}</span>
          </button>

          <button
            type="button"
            className="eval-admin-btn"
            onClick={() => onReclassify(prueba)}
            style={s.reclassifyButton}
            title="Cambiar categoría, parcial, tema o subtema de la prueba"
          >
            <SlidersHorizontal size={13} aria-hidden="true" />
            <span>Reclasificar</span>
          </button>

          <button
            type="button"
            className="eval-admin-btn"
            onClick={() => onRunTest(prueba)}
            style={s.runButton}
            title="Ejecutar y probar la evaluación"
          >
            <Play size={13} aria-hidden="true" />
            <span>Ejecutar</span>
          </button>

          <button
            type="button"
            className="eval-admin-btn"
            onClick={() => onEditTest(prueba)}
            style={s.editButton}
            title="Editar preguntas y contenido de la prueba"
          >
            <Pencil size={13} aria-hidden="true" />
            <span>Editar</span>
          </button>

          <button
            type="button"
            className="eval-admin-btn"
            onClick={() => onDeleteTest(prueba)}
            style={s.deleteButton}
            disabled={isUpdating}
            title="Eliminar permanentemente esta prueba"
          >
            <Trash2 size={13} aria-hidden="true" />
            <span>Borrar</span>
          </button>
        </div>

        {/* Metadatos de auditoría: Creada por y Editada por */}
        <div style={s.auditBox}>
          <div style={s.auditRow}>
            <span style={s.auditUserText} title={`Creada por: ${prueba.created_by_name || 'No registrado'}`}>
              <UserCheck size={13} aria-hidden="true" style={{ color: '#0284c7', flexShrink: 0 }} />
              <span><strong>Creada por:</strong> {prueba.created_by_name || 'No registrado'}</span>
            </span>
            <span style={s.auditDateText}>
              <CalendarDays size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
              {new Date(prueba.created_at).toLocaleDateString('es-MX')}
            </span>
          </div>

          <div style={s.auditRow}>
            <span style={s.auditUserText} title={`Editada por: ${prueba.updated_by_name || prueba.created_by_name || 'No registrado'}`}>
              <Pencil size={12} aria-hidden="true" style={{ color: '#7c3aed', flexShrink: 0 }} />
              <span><strong>Editada por:</strong> {prueba.updated_by_name || prueba.created_by_name || 'No registrado'}</span>
            </span>
            <span style={s.auditDateText}>
              <CalendarDays size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
              {new Date(prueba.updated_at || prueba.created_at).toLocaleDateString('es-MX')}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};

const GestionPruebas: React.FC = () => {
  const handleGoBack = useSmartBackNavigation('/edicion');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pruebas, setPruebas] = useState<AdminPrueba[]>([]);
  const [weeklyThemeIds, setWeeklyThemeIds] = useState<number[]>([]);
  const [allTemas, setAllTemas] = useState<TemaOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingTestId, setUpdatingTestId] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'publicada' | 'borrador'>('todos');
  const [scopeFilter, setScopeFilter] = useState<'todos' | TestScope>('todos');

  // Modal de confirmación de borrado
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminPrueba | null>(null);

  // Modal de reclasificación
  const [showReclassifyModal, setShowReclassifyModal] = useState(false);
  const [reclassifyTarget, setReclassifyTarget] = useState<AdminPrueba | null>(null);
  const [reclassifyScope, setReclassifyScope] = useState<TestScope>('parcial');
  const [reclassifyParcial, setReclassifyParcial] = useState<ParcialKey>('primer');
  const [reclassifyTemaId, setReclassifyTemaId] = useState<number | null>(null);
  const [reclassifySubtemaId, setReclassifySubtemaId] = useState<number | null>(null);
  const [modalSubtemas, setModalSubtemas] = useState<SubtemaOption[]>([]);
  const [isLoadingSubtemas, setIsLoadingSubtemas] = useState(false);
  const [reclassifyError, setReclassifyError] = useState('');
  const [isSavingReclassification, setIsSavingReclassification] = useState(false);

  // Cargar temas globales para selector de reclasificación
  useEffect(() => {
    const fetchAllTemas = async () => {
      const { data } = await supabase
        .from('temas')
        .select('id, nombre, parcial, sort_order')
        .order('parcial', { ascending: true })
        .order('sort_order', { ascending: true });

      if (data) {
        setAllTemas(data as TemaOption[]);
      }
    };

    void fetchAllTemas();
  }, []);

  // Cargar temas semanales
  useEffect(() => {
    const loadWeeklyThemes = async () => {
      try {
        const blocks = await getRenderableBlocks('home_page', 0);
        setWeeklyThemeIds(collectWeeklyThemeIds(blocks));
      } catch (loadError) {
        console.warn('No se pudieron cargar los temas activos de la semana.', loadError);
        setWeeklyThemeIds([]);
      }
    };

    void loadWeeklyThemes();
  }, []);

  // Cargar todas las pruebas
  const fetchPruebas = useCallback(async () => {
    setIsLoading(true);
    setError('');

    let data: unknown[] | null = null;
    let queryError: unknown = null;

    const fullResult = await supabase
      .from('pruebas')
      .select('id, nombre, instrucciones, scope, parcial_key, estado, created_at, updated_at, created_by_id, created_by_name, updated_by_id, updated_by_name, image_url, tema_id, subtema_id, tema:temas(id, nombre, logo_url), subtema:subtemas(id, nombre, logo_url)')
      .order('created_at', { ascending: false });

    if (fullResult.error) {
      // Fallback: si las nuevas columnas aún no existen en la BD de Supabase, reintentar con la consulta base
      const fallbackResult = await supabase
        .from('pruebas')
        .select('id, nombre, instrucciones, scope, parcial_key, estado, created_at, image_url, tema_id, subtema_id, tema:temas(id, nombre, logo_url), subtema:subtemas(id, nombre, logo_url)')
        .order('created_at', { ascending: false });

      data = (fallbackResult.data as unknown[]) ?? null;
      queryError = fallbackResult.error;
    } else {
      data = (fullResult.data as unknown[]) ?? null;
      queryError = fullResult.error;
    }

    if (queryError || !data) {
      setPruebas([]);
      setError('No se pudieron cargar las evaluaciones.');
    } else {
      setPruebas(data as unknown as AdminPrueba[]);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchPruebas();
  }, [fetchPruebas]);

  // Contadores generales
  const publishedCount = useMemo(() => pruebas.filter((p) => p.estado === 'publicada').length, [pruebas]);
  const draftCount = useMemo(() => pruebas.filter((p) => p.estado !== 'publicada').length, [pruebas]);

  // Filtrado de pruebas en memoria
  const filteredPruebas = useMemo(() => {
    return pruebas.filter((item) => {
      if (statusFilter === 'publicada' && item.estado !== 'publicada') return false;
      if (statusFilter === 'borrador' && item.estado === 'publicada') return false;

      if (scopeFilter !== 'todos' && item.scope !== scopeFilter) return false;

      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchName = (item.nombre || '').toLowerCase().includes(query);
        const matchInstructions = (item.instrucciones || '').toLowerCase().includes(query);
        const matchTema = (item.tema?.nombre || '').toLowerCase().includes(query);
        const matchSubtema = (item.subtema?.nombre || '').toLowerCase().includes(query);
        if (!matchName && !matchInstructions && !matchTema && !matchSubtema) return false;
      }

      return true;
    });
  }, [pruebas, statusFilter, scopeFilter, search]);

  const orderedPruebas = useMemo(
    () => orderTestsByWeeklyPriority(filteredPruebas, weeklyThemeIds),
    [filteredPruebas, weeklyThemeIds]
  );

  const parcialSections = useMemo<ParcialSection[]>(() => {
    return PARCIALES.map((parcial) => {
      const testsForParcial = orderedPruebas.filter((item) => item.parcial_key === parcial.key);
      const weeklyTests = testsForParcial.filter((item) => item.tema_id != null && weeklyThemeIds.includes(item.tema_id));
      const historicalTests = testsForParcial.filter((item) => !(item.tema_id != null && weeklyThemeIds.includes(item.tema_id)));

      return {
        key: parcial.key,
        title: parcial.title,
        parcialTests: weeklyTests.filter((item) => item.scope === 'parcial').concat(historicalTests.filter((item) => item.scope === 'parcial')),
        temaTests: weeklyTests.filter((item) => item.scope === 'tema').concat(historicalTests.filter((item) => item.scope === 'tema')),
        subtemaTests: weeklyTests.filter((item) => item.scope === 'subtema').concat(historicalTests.filter((item) => item.scope === 'subtema')),
      };
    });
  }, [orderedPruebas, weeklyThemeIds]);

  const getHistoricalParcialGroups = useCallback((section: ParcialSection) => {
    const historicalItems = [
      ...section.parcialTests.filter((prueba) => !(prueba.tema_id != null && weeklyThemeIds.includes(prueba.tema_id))),
      ...section.temaTests.filter((prueba) => !(prueba.tema_id != null && weeklyThemeIds.includes(prueba.tema_id))),
      ...section.subtemaTests.filter((prueba) => !(prueba.tema_id != null && weeklyThemeIds.includes(prueba.tema_id))),
    ];

    return groupHistoricalTestsByPartial(historicalItems).map((group) => ({
      key: group.key,
      title: PARCIALES.find((parcial) => parcial.key === group.key)?.title ?? 'Parcial',
      items: group.items,
    })).sort((a, b) => {
      const aIndex = PARCIALES.findIndex((parcial) => parcial.key === a.key);
      const bIndex = PARCIALES.findIndex((parcial) => parcial.key === b.key);
      return aIndex - bIndex;
    });
  }, [weeklyThemeIds]);

  const getWeeklyThemeGroups = useCallback((section: ParcialSection) => {
    const weeklyItems = [
      ...section.parcialTests.filter((prueba) => prueba.tema_id != null && weeklyThemeIds.includes(prueba.tema_id)),
      ...section.temaTests.filter((prueba) => prueba.tema_id != null && weeklyThemeIds.includes(prueba.tema_id)),
      ...section.subtemaTests.filter((prueba) => prueba.tema_id != null && weeklyThemeIds.includes(prueba.tema_id)),
    ];

    const grouped = new Map<string, AdminPrueba[]>();

    weeklyItems.forEach((prueba) => {
      const themeKey = String(prueba.tema_id ?? prueba.tema?.id ?? 'sin-tema');
      const current = grouped.get(themeKey) ?? [];
      current.push(prueba);
      grouped.set(themeKey, current);
    });

    return Array.from(grouped.entries())
      .map(([key, items]) => ({
        key,
        temaNombre: items[0]?.tema?.nombre || (items[0]?.tema_id ? `Tema ${items[0].tema_id}` : 'Tema sin identificar'),
        items: [...items].sort((a, b) => {
          const scopeDelta = HISTORICAL_SCOPE_ORDER[a.scope] - HISTORICAL_SCOPE_ORDER[b.scope];
          if (scopeDelta !== 0) return scopeDelta;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }),
      }))
      .sort((a, b) => a.temaNombre.localeCompare(b.temaNombre, 'es'));
  }, [weeklyThemeIds]);

  // Acciones administrativas
  const handleTogglePublication = async (prueba: AdminPrueba) => {
    if (updatingTestId) return;

    const nextEstado = prueba.estado === 'publicada' ? 'borrador' : 'publicada';
    const editorName = user?.nombre?.trim() || user?.username?.trim() || 'Administrador';
    const nowIso = new Date().toISOString();
    setUpdatingTestId(prueba.id);

    let { error: updateError } = await supabase
      .from('pruebas')
      .update({
        estado: nextEstado,
        updated_by_id: user?.id ?? null,
        updated_by_name: editorName,
        updated_at: nowIso,
      })
      .eq('id', prueba.id);

    // Fallback si aún no existen las columnas de auditoría en la BD
    if (updateError) {
      const fallbackResult = await supabase
        .from('pruebas')
        .update({ estado: nextEstado })
        .eq('id', prueba.id);
      updateError = fallbackResult.error;
    }

    if (updateError) {
      setError('No se pudo cambiar el estado de la prueba.');
      setUpdatingTestId(null);
      return;
    }

    void logAuditEvent({
      entityType: 'prueba',
      actionType: nextEstado === 'publicada' ? 'publish' : 'unpublish',
      entityId: prueba.id,
      entityName: `Prueba: ${prueba.nombre}`,
      actor: user ? { id: user.id, username: user.username, name: user.nombre, role: user.rol } : null,
      details: {
        estado_anterior: prueba.estado,
        nuevo_estado: nextEstado,
        scope: prueba.scope,
        parcial_key: prueba.parcial_key,
      },
    });

    setPruebas((prev) =>
      prev.map((item) => (item.id === prueba.id ? {
        ...item,
        estado: nextEstado,
        updated_by_id: user?.id ?? null,
        updated_by_name: editorName,
        updated_at: nowIso,
      } : item))
    );
    setUpdatingTestId(null);
  };

  const handleRunTest = (prueba: AdminPrueba) => {
    navigate(`/pruebas/ejecutar/${prueba.id}`, { state: { from: '/pruebas' } });
  };

  const handleEditTest = (prueba: AdminPrueba) => {
    navigate(`/pruebas/editor/${prueba.id}`, { state: { from: '/pruebas' } });
  };

  // Apertura del modal de reclasificación
  const handleOpenReclassify = (prueba: AdminPrueba) => {
    setReclassifyTarget(prueba);
    setReclassifyScope(prueba.scope);
    setReclassifyParcial(prueba.parcial_key || 'primer');
    setReclassifyTemaId(prueba.tema_id ?? prueba.tema?.id ?? null);
    setReclassifySubtemaId(prueba.subtema_id ?? prueba.subtema?.id ?? null);
    setReclassifyError('');
    setShowReclassifyModal(true);
  };

  // Cargar subtemas en el modal cuando cambia el tema seleccionado
  useEffect(() => {
    if (!showReclassifyModal || !reclassifyTemaId || reclassifyScope !== 'subtema') {
      setModalSubtemas([]);
      return;
    }

    const fetchSubtemas = async () => {
      setIsLoadingSubtemas(true);
      const { data } = await supabase
        .from('subtemas')
        .select('id, nombre, tema_id, sort_order')
        .eq('tema_id', reclassifyTemaId)
        .order('sort_order', { ascending: true });

      if (data) {
        setModalSubtemas(data as SubtemaOption[]);
      } else {
        setModalSubtemas([]);
      }
      setIsLoadingSubtemas(false);
    };

    void fetchSubtemas();
  }, [showReclassifyModal, reclassifyTemaId, reclassifyScope]);

  // Guardar reclasificación
  const handleSaveReclassification = async () => {
    if (!reclassifyTarget) return;

    if (reclassifyScope === 'tema' && !reclassifyTemaId) {
      setReclassifyError('Debes seleccionar un tema.');
      return;
    }

    if (reclassifyScope === 'subtema') {
      if (!reclassifyTemaId) {
        setReclassifyError('Debes seleccionar un tema primero.');
        return;
      }
      if (!reclassifySubtemaId) {
        setReclassifyError('Debes seleccionar un subtema.');
        return;
      }
    }

    setIsSavingReclassification(true);
    setReclassifyError('');

    const targetTema = reclassifyScope !== 'parcial' && reclassifyTemaId
      ? allTemas.find((t) => t.id === reclassifyTemaId)
      : null;

    // Si el tema tiene un parcial asignado, asegurarse de sincronizar el parcial_key
    const finalParcial: ParcialKey = targetTema ? (targetTema.parcial as ParcialKey) : reclassifyParcial;

    const editorName = user?.nombre?.trim() || user?.username?.trim() || 'Administrador';
    const nowIso = new Date().toISOString();

    const payload = {
      scope: reclassifyScope,
      parcial_key: finalParcial,
      tema_id: reclassifyScope === 'parcial' ? null : reclassifyTemaId,
      subtema_id: reclassifyScope === 'subtema' ? reclassifySubtemaId : null,
      updated_by_id: user?.id ?? null,
      updated_by_name: editorName,
      updated_at: nowIso,
    };

    let { error: updateError } = await supabase
      .from('pruebas')
      .update(payload)
      .eq('id', reclassifyTarget.id);

    // Fallback si aún no existen las columnas de auditoría en la BD
    if (updateError) {
      const basePayload = {
        scope: reclassifyScope,
        parcial_key: finalParcial,
        tema_id: reclassifyScope === 'parcial' ? null : reclassifyTemaId,
        subtema_id: reclassifyScope === 'subtema' ? reclassifySubtemaId : null,
      };
      const fallbackResult = await supabase
        .from('pruebas')
        .update(basePayload)
        .eq('id', reclassifyTarget.id);
      updateError = fallbackResult.error;
    }

    if (updateError) {
      setReclassifyError('No se pudo guardar la reclasificación.');
      setIsSavingReclassification(false);
      return;
    }

    void logAuditEvent({
      entityType: 'prueba',
      actionType: 'update',
      entityId: reclassifyTarget.id,
      entityName: `Prueba: ${reclassifyTarget.nombre}`,
      actor: user ? { id: user.id, username: user.username, name: user.nombre, role: user.rol } : null,
      details: {
        action_detail: 'Reclasificación de prueba',
        nuevo_scope: reclassifyScope,
        nuevo_parcial: finalParcial,
        tema_id: reclassifyScope === 'parcial' ? null : reclassifyTemaId,
        subtema_id: reclassifyScope === 'subtema' ? reclassifySubtemaId : null,
      },
    });

    // Actualizar estado local
    const selectedSubtema = modalSubtemas.find((s) => s.id === reclassifySubtemaId);

    setPruebas((prev) =>
      prev.map((item) =>
        item.id === reclassifyTarget.id
          ? {
              ...item,
              scope: reclassifyScope,
              parcial_key: finalParcial,
              tema_id: payload.tema_id,
              subtema_id: payload.subtema_id,
              tema: targetTema ? { id: targetTema.id, nombre: targetTema.nombre } : null,
              subtema: selectedSubtema ? { id: selectedSubtema.id, nombre: selectedSubtema.nombre } : null,
              updated_by_id: user?.id ?? null,
              updated_by_name: editorName,
              updated_at: nowIso,
            }
          : item
      )
    );

    setIsSavingReclassification(false);
    setShowReclassifyModal(false);
    setReclassifyTarget(null);
  };

  const requestDeletePrueba = (prueba: AdminPrueba) => {
    if (updatingTestId) return;
    setDeleteTarget(prueba);
    setShowDeleteModal(true);
  };

  const confirmDeletePrueba = async () => {
    if (!deleteTarget || updatingTestId) return;

    const prueba = deleteTarget;
    setUpdatingTestId(prueba.id);
    setError('');
    setShowDeleteModal(false);

    const { data: referenceRows, error: referenceQueryError } = await supabase
      .from('prueba_preguntas')
      .select('reference_photo_url')
      .eq('prueba_id', prueba.id);

    if (referenceQueryError) {
      setError('No se pudieron comprobar las imágenes exclusivas de la prueba. No se borró nada.');
      setUpdatingTestId(null);
      return;
    }

    const ownedReferenceUrls = (referenceRows ?? [])
      .map((row) => (row as { reference_photo_url: string | null }).reference_photo_url);

    const { error: deleteError } = await supabase
      .from('pruebas')
      .delete()
      .eq('id', prueba.id);

    if (deleteError) {
      setError('No se pudo borrar la prueba.');
      setUpdatingTestId(null);
      return;
    }

    if (prueba.image_url) {
      try {
        await deleteFromCloudinary({ imageUrl: prueba.image_url });
      } catch (cloudinaryError) {
        console.warn('No se pudo borrar la imagen asociada a la prueba:', cloudinaryError);
      }
    }

    const referenceCleanup = await deleteOwnedTestReferenceImages(ownedReferenceUrls, prueba.id);
    if (referenceCleanup.failed.length > 0) {
      setError(`La prueba se borró, pero no se pudieron eliminar ${referenceCleanup.failed.length} referencia(s) exclusiva(s).`);
    }

    void logAuditEvent({
      entityType: 'prueba',
      actionType: 'delete',
      entityId: prueba.id,
      entityName: `Prueba: ${prueba.nombre}`,
      actor: user ? { id: user.id, username: user.username, name: user.nombre, role: user.rol } : null,
      details: {
        scope: prueba.scope,
        parcial_key: prueba.parcial_key,
        tuvo_imagen_portada: Boolean(prueba.image_url),
      },
    });

    setPruebas((prev) => prev.filter((item) => item.id !== prueba.id));
    setDeleteTarget(null);
    setUpdatingTestId(null);
  };

  const hasAnyMatchingTest = parcialSections.some(
    (section) => section.parcialTests.length || section.temaTests.length || section.subtemaTests.length
  );

  // Temas filtrados por el parcial elegido en el modal
  const temasForSelectedParcial = useMemo(() => {
    return allTemas.filter((t) => t.parcial === reclassifyParcial);
  }, [allTemas, reclassifyParcial]);

  return (
    <div style={s.page}>
      <style>{`
        .eval-admin-btn {
          box-sizing: border-box !important;
          min-width: 0 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          transition: transform 150ms ease, box-shadow 150ms ease, filter 150ms ease !important;
        }
        .eval-admin-btn:hover:not(:disabled) {
          transform: translateY(-2px) !important;
          filter: brightness(1.05) !important;
        }
        .eval-admin-btn:active:not(:disabled) {
          transform: translateY(0) !important;
        }
        .eval-admin-btn span {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        @media (max-width: 680px) {
          .evaluaciones-hero {
            grid-template-columns: 1fr !important;
            justify-items: center;
            text-align: center;
          }
          .evaluaciones-hero-stat {
            width: fit-content;
            min-width: 0;
          }
          .evaluaciones-title {
            white-space: normal !important;
            word-break: break-word !important;
          }
          .evaluacion-admin-actions {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>

      <Header />

      <main style={s.main}>
        <BackButton onClick={handleGoBack} />

        {/* Hero Banner Principal */}
        <section className="evaluaciones-hero" style={s.hero}>
          <div style={s.heroGlow} aria-hidden="true" />
          <div style={s.heroIcon}>
            <ClipboardCheck size={30} strokeWidth={2} aria-hidden="true" />
          </div>

          <div style={s.heroCopy}>
            <p style={s.kicker}>
              <Sparkles size={14} aria-hidden="true" /> Panel de administración
            </p>
            <h1 className="evaluaciones-title" style={s.title}>
              Administración de pruebas
            </h1>
            <p style={s.text}>
              Supervisa, publica, ejecuta, edita, reclasifica y organiza las evaluaciones con la misma estructura visual de la vista pública.
            </p>
          </div>

          <div style={s.heroRightContainer}>
            <div className="evaluaciones-hero-stat" style={s.heroStat}>
              <strong>{pruebas.length}</strong>
              <span>{pruebas.length === 1 ? 'prueba registrada' : 'pruebas registradas'}</span>
              <div style={s.statBadgesRow}>
                <span style={s.statBadgeGreen}>● {publishedCount} publicadas</span>
                <span style={s.statBadgeAmber}>○ {draftCount} borradores</span>
              </div>
            </div>

            <Link to="/pruebas/crear" style={s.heroCreateButton}>
              <Plus size={18} aria-hidden="true" />
              <span>Crear nueva prueba</span>
            </Link>
          </div>
        </section>

        {/* Toolbar de búsqueda y filtros rápidos */}
        <section style={s.toolbar}>
          <div style={s.searchWrap}>
            <Search size={18} style={s.searchIcon} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, instrucciones, tema o subtema..."
              style={s.searchInput}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} style={s.clearSearchButton} title="Limpiar búsqueda">
                <X size={15} />
              </button>
            )}
          </div>

          <div style={s.filterRow}>
            {/* Filtros de estado */}
            <div style={s.filterGroup}>
              <span style={s.filterLabel}>Estado:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('todos')}
                style={statusFilter === 'todos' ? s.filterPillActive : s.filterPill}
              >
                Todas ({pruebas.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('publicada')}
                style={statusFilter === 'publicada' ? s.filterPillActive : s.filterPill}
              >
                Publicadas ({publishedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('borrador')}
                style={statusFilter === 'borrador' ? s.filterPillActive : s.filterPill}
              >
                Borradores ({draftCount})
              </button>
            </div>

            {/* Filtros de scope */}
            <div style={s.filterGroup}>
              <span style={s.filterLabel}>Alcance:</span>
              <button
                type="button"
                onClick={() => setScopeFilter('todos')}
                style={scopeFilter === 'todos' ? s.filterPillActive : s.filterPill}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('parcial')}
                style={scopeFilter === 'parcial' ? s.filterPillActive : s.filterPill}
              >
                Parcial
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('tema')}
                style={scopeFilter === 'tema' ? s.filterPillActive : s.filterPill}
              >
                Tema
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('subtema')}
                style={scopeFilter === 'subtema' ? s.filterPillActive : s.filterPill}
              >
                Subtema
              </button>
            </div>
          </div>
        </section>

        {/* Contenido Principal de Parciales / Tarjetas */}
        <section style={s.card}>
          {isLoading ? (
            <div style={s.statusBox}>
              <span className="route-loading-spinner" />
              <div style={s.statusCopy}>
                <strong>Cargando evaluaciones...</strong>
                <span>Estamos organizando el catálogo de pruebas para administración.</span>
              </div>
            </div>
          ) : error ? (
            <div style={{ ...s.statusBox, ...s.errorBox }}>
              <div style={s.statusCopy}>
                <strong>No pudimos cargar las evaluaciones</strong>
                <span>{error}</span>
              </div>
            </div>
          ) : pruebas.length === 0 ? (
            <div style={s.emptyState}>
              <BookOpenCheck size={36} color="#2563eb" aria-hidden="true" />
              <p style={s.emptyTitle}>Aún no hay pruebas creadas</p>
              <p style={s.emptyText}>Crea tu primera evaluación académica para comenzar.</p>
              <Link to="/pruebas/crear" style={s.heroCreateButton}>
                <Plus size={16} aria-hidden="true" /> Crear primera prueba
              </Link>
            </div>
          ) : !hasAnyMatchingTest ? (
            <div style={s.emptyState}>
              <Filter size={32} color="#64748b" aria-hidden="true" />
              <p style={s.emptyTitle}>No hay pruebas que coincidan con los filtros</p>
              <p style={s.emptyText}>Prueba a cambiar el término de búsqueda o limpia los filtros.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('todos');
                  setScopeFilter('todos');
                }}
                style={s.resetFilterBtn}
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div style={s.parcialSections}>
              {parcialSections
                .filter((section) => section.parcialTests.length || section.temaTests.length || section.subtemaTests.length)
                .map((section) => {
                  const hasTests = section.parcialTests.length || section.temaTests.length || section.subtemaTests.length;

                  return (
                    <section
                      className="evaluaciones-parcial"
                      key={section.key}
                      id={`evaluaciones-${section.key}`}
                      style={s.parcialBlock}
                    >
                      <header style={s.parcialHeader}>
                        <h2 style={s.parcialTitle}>{section.title}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={s.parcialCount}>
                            {section.parcialTests.length + section.temaTests.length + section.subtemaTests.length} pruebas
                          </span>
                        </div>
                      </header>

                      {!hasTests ? (
                        <div style={s.innerEmpty}>Sin pruebas coincidentes en este parcial.</div>
                      ) : (
                        <>
                          {/* Contenido actual de la semana */}
                          {(() => {
                            const weeklyThemeGroups = getWeeklyThemeGroups(section);
                            const hasWeeklyTests = weeklyThemeGroups.length > 0;

                            if (!hasWeeklyTests) {
                              return null;
                            }

                            return (
                              <div className="evaluaciones-scope" style={s.scopeBlock}>
                                <h3 style={s.scopeTitle}>
                                  {weeklyThemeIds.length > 0 ? 'Contenido actual de la semana' : 'Pruebas por parcial'}
                                </h3>
                                <div style={{ display: 'grid', gap: '12px' }}>
                                  {weeklyThemeGroups.map((themeGroup) => {
                                    const parcialItems = themeGroup.items.filter((prueba) => prueba.scope === 'parcial');
                                    const temaItems = themeGroup.items.filter((prueba) => prueba.scope === 'tema');
                                    const subtemaItems = themeGroup.items.filter((prueba) => prueba.scope === 'subtema');

                                    return (
                                      <details key={`${section.key}-${themeGroup.key}`} style={s.historyAccordion} open>
                                        <summary
                                          style={{
                                            ...s.historySummary,
                                            background: 'linear-gradient(135deg, rgba(248,250,252,0.96), rgba(239,246,255,0.9))',
                                          }}
                                        >
                                          <span style={s.weekThemeSummary}>
                                            <span style={s.weekThemeLabelWrap}>
                                              {themeGroup.items[0]?.image_url ? (
                                                <img
                                                  src={getCloudinaryImageUrl(themeGroup.items[0].image_url, 'thumb')}
                                                  alt={themeGroup.temaNombre}
                                                  style={s.weekThemeThumb}
                                                />
                                              ) : (
                                                <span style={s.weekThemeThumbFallback}>
                                                  {(themeGroup.temaNombre || 'T').slice(0, 1).toUpperCase()}
                                                </span>
                                              )}
                                              <span style={s.weekThemeTitle}>{themeGroup.temaNombre}</span>
                                            </span>
                                            <span style={s.historySummaryMeta}>
                                              <span style={s.historySummaryCount}>
                                                {themeGroup.items.length} {themeGroup.items.length === 1 ? 'prueba' : 'pruebas'}
                                              </span>
                                              <span aria-hidden="true" style={s.historySummaryArrow}>
                                                ▾
                                              </span>
                                            </span>
                                          </span>
                                        </summary>

                                        <div style={s.historyAccordionBody}>
                                          {parcialItems.length > 0 && (
                                            <div style={s.historyGroupBlock}>
                                              <h4 style={s.historyGroupTitle}>Parcial</h4>
                                              <div className="evaluaciones-grid" style={s.grid}>
                                                {parcialItems.map((prueba) => (
                                                  <AdminTestCard
                                                    key={`week-${section.key}-${themeGroup.key}-parcial-${prueba.id}`}
                                                    prueba={prueba}
                                                    badge="Parcial"
                                                    isUpdating={updatingTestId === prueba.id}
                                                    onTogglePublication={handleTogglePublication}
                                                    onReclassify={handleOpenReclassify}
                                                    onRunTest={handleRunTest}
                                                    onEditTest={handleEditTest}
                                                    onDeleteTest={requestDeletePrueba}
                                                  />
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {temaItems.length > 0 && (
                                            <div style={s.historyGroupBlock}>
                                              <h4 style={s.historyGroupTitle}>Tema</h4>
                                              <div className="evaluaciones-grid" style={s.grid}>
                                                {temaItems.map((prueba) => (
                                                  <AdminTestCard
                                                    key={`week-${section.key}-${themeGroup.key}-tema-${prueba.id}`}
                                                    prueba={prueba}
                                                    badge="Tema"
                                                    badges={[prueba.tema?.nombre ?? 'Tema sin identificar']}
                                                    isUpdating={updatingTestId === prueba.id}
                                                    onTogglePublication={handleTogglePublication}
                                                    onReclassify={handleOpenReclassify}
                                                    onRunTest={handleRunTest}
                                                    onEditTest={handleEditTest}
                                                    onDeleteTest={requestDeletePrueba}
                                                  />
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {subtemaItems.length > 0 && (
                                            <div style={s.historyGroupBlock}>
                                              <h4 style={s.historyGroupTitle}>Subtema</h4>
                                              <div className="evaluaciones-grid" style={s.grid}>
                                                {subtemaItems.map((prueba) => (
                                                  <AdminTestCard
                                                    key={`week-${section.key}-${themeGroup.key}-subtema-${prueba.id}`}
                                                    prueba={prueba}
                                                    badge="Subtema"
                                                    badges={[
                                                      prueba.tema?.nombre ?? 'Tema sin identificar',
                                                      prueba.subtema?.nombre ?? 'Subtema sin identificar',
                                                    ]}
                                                    isUpdating={updatingTestId === prueba.id}
                                                    onTogglePublication={handleTogglePublication}
                                                    onReclassify={handleOpenReclassify}
                                                    onRunTest={handleRunTest}
                                                    onEditTest={handleEditTest}
                                                    onDeleteTest={requestDeletePrueba}
                                                  />
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </details>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Historial / Pruebas anteriores */}
                          {(() => {
                            const historicalGroups = getHistoricalParcialGroups(section);
                            const hasHistoricalTests = historicalGroups.some((group) => group.items.length > 0);
                            if (!hasHistoricalTests) return null;

                            return (
                              <div className="evaluaciones-scope" style={{ ...s.scopeBlock, marginTop: '10px' }}>
                                <div style={s.historyDivider}>
                                  <span style={s.historyDividerLabel}>Pruebas anteriores / historial</span>
                                </div>

                                <div style={{ display: 'grid', gap: '12px' }}>
                                  {historicalGroups.map((partialGroup) => {
                                    const groupedByTema = new Map<string, AdminPrueba[]>();
                                    partialGroup.items.forEach((prueba) => {
                                      const themeKey = prueba.tema_id ?? prueba.tema?.id;
                                      if (themeKey == null) return;

                                      const key = String(themeKey);
                                      const current = groupedByTema.get(key) ?? [];
                                      current.push(prueba);
                                      groupedByTema.set(key, current);
                                    });

                                    const themeGroups = Array.from(groupedByTema.entries())
                                      .map(([key, items]) => ({
                                        key,
                                        temaNombre: items[0]?.tema?.nombre || `Tema ${items[0]?.tema_id ?? key}`,
                                        items: [...items].sort((a, b) => {
                                          const scopeDelta = HISTORICAL_SCOPE_ORDER[a.scope] - HISTORICAL_SCOPE_ORDER[b.scope];
                                          if (scopeDelta !== 0) return scopeDelta;
                                          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                                        }),
                                      }))
                                      .sort((a, b) => a.temaNombre.localeCompare(b.temaNombre, 'es'));

                                    return (
                                      <details key={`${section.key}-${partialGroup.key}`} style={s.historyAccordion} open={Boolean(search)}>
                                        <summary
                                          style={{
                                            ...s.historySummary,
                                            background: 'linear-gradient(135deg, rgba(248,250,252,0.96), rgba(239,246,255,0.9))',
                                          }}
                                        >
                                          <span style={s.historySummaryLabel}>{partialGroup.title}</span>
                                          <span style={s.historySummaryMeta}>
                                            <span style={s.historySummaryCount}>
                                              {partialGroup.items.length} {partialGroup.items.length === 1 ? 'prueba' : 'pruebas'}
                                            </span>
                                            <span aria-hidden="true" style={s.historySummaryArrow}>
                                              ▾
                                            </span>
                                          </span>
                                        </summary>

                                        <div style={s.historyAccordionBody}>
                                          {partialGroup.items.filter((prueba) => prueba.scope === 'parcial').length > 0 && (
                                            <div style={s.historyGroupBlock}>
                                              <h4 style={s.historyGroupTitle}>Parcial</h4>
                                              <div className="evaluaciones-grid" style={s.grid}>
                                                {partialGroup.items
                                                  .filter((prueba) => prueba.scope === 'parcial')
                                                  .map((prueba) => (
                                                    <AdminTestCard
                                                      key={`history-${section.key}-${partialGroup.key}-${prueba.id}`}
                                                      prueba={prueba}
                                                      badge="Parcial"
                                                      isUpdating={updatingTestId === prueba.id}
                                                      onTogglePublication={handleTogglePublication}
                                                      onReclassify={handleOpenReclassify}
                                                      onRunTest={handleRunTest}
                                                      onEditTest={handleEditTest}
                                                      onDeleteTest={requestDeletePrueba}
                                                    />
                                                  ))}
                                              </div>
                                            </div>
                                          )}

                                          {themeGroups.length > 0 && (
                                            <div style={s.historyGroupBlock}>
                                              <h4 style={s.historyGroupTitle}>Temas</h4>
                                              <div style={{ display: 'grid', gap: '12px' }}>
                                                {themeGroups.map((themeGroup) => {
                                                  const partialThemeItems = themeGroup.items.filter((prueba) => prueba.scope === 'parcial');
                                                  const temaItems = themeGroup.items.filter((prueba) => prueba.scope === 'tema');
                                                  const subtemaItems = themeGroup.items.filter((prueba) => prueba.scope === 'subtema');

                                                  return (
                                                    <details
                                                      key={`${section.key}-${partialGroup.key}-${themeGroup.key}`}
                                                      style={{ ...s.historyAccordion, borderRadius: '14px' }}
                                                      open={Boolean(search)}
                                                    >
                                                      <summary
                                                        style={{
                                                          ...s.historySummary,
                                                          padding: '12px 14px',
                                                          fontSize: '0.92rem',
                                                          background:
                                                            'linear-gradient(135deg, rgba(248,250,252,0.9), rgba(224,242,254,0.8))',
                                                        }}
                                                      >
                                                        <span style={s.historySummaryLabel}>{themeGroup.temaNombre}</span>
                                                        <span style={s.historySummaryMeta}>
                                                          <span style={s.historySummaryCount}>
                                                            {themeGroup.items.length} {themeGroup.items.length === 1 ? 'prueba' : 'pruebas'}
                                                          </span>
                                                          <span aria-hidden="true" style={s.historySummaryArrow}>
                                                            ▾
                                                          </span>
                                                        </span>
                                                      </summary>

                                                      <div style={{ ...s.historyAccordionBody, padding: '0 14px 14px' }}>
                                                        {partialThemeItems.length > 0 && (
                                                          <div style={s.historyGroupBlock}>
                                                            <h5 style={{ ...s.historyGroupTitle, fontSize: '0.68rem' }}>Parcial</h5>
                                                            <div className="evaluaciones-grid" style={s.grid}>
                                                              {partialThemeItems.map((prueba) => (
                                                                <AdminTestCard
                                                                  key={`history-theme-partial-${section.key}-${prueba.id}`}
                                                                  prueba={prueba}
                                                                  badge="Parcial"
                                                                  isUpdating={updatingTestId === prueba.id}
                                                                  onTogglePublication={handleTogglePublication}
                                                                  onReclassify={handleOpenReclassify}
                                                                  onRunTest={handleRunTest}
                                                                  onEditTest={handleEditTest}
                                                                  onDeleteTest={requestDeletePrueba}
                                                                />
                                                              ))}
                                                            </div>
                                                          </div>
                                                        )}

                                                        {temaItems.length > 0 && (
                                                          <div style={s.historyGroupBlock}>
                                                            <h5 style={{ ...s.historyGroupTitle, fontSize: '0.68rem' }}>Tema</h5>
                                                            <div className="evaluaciones-grid" style={s.grid}>
                                                              {temaItems.map((prueba) => (
                                                                <AdminTestCard
                                                                  key={`history-theme-tema-${section.key}-${prueba.id}`}
                                                                  prueba={prueba}
                                                                  badge="Tema"
                                                                  badges={[prueba.tema?.nombre ?? 'Tema sin identificar']}
                                                                  isUpdating={updatingTestId === prueba.id}
                                                                  onTogglePublication={handleTogglePublication}
                                                                  onReclassify={handleOpenReclassify}
                                                                  onRunTest={handleRunTest}
                                                                  onEditTest={handleEditTest}
                                                                  onDeleteTest={requestDeletePrueba}
                                                                />
                                                              ))}
                                                            </div>
                                                          </div>
                                                        )}

                                                        {subtemaItems.length > 0 && (
                                                          <div style={s.historyGroupBlock}>
                                                            <h5 style={{ ...s.historyGroupTitle, fontSize: '0.68rem' }}>Subtema</h5>
                                                            <div className="evaluaciones-grid" style={s.grid}>
                                                              {subtemaItems.map((prueba) => (
                                                                <AdminTestCard
                                                                  key={`history-theme-subtema-${section.key}-${prueba.id}`}
                                                                  prueba={prueba}
                                                                  badge="Subtema"
                                                                  badges={[
                                                                    prueba.tema?.nombre ?? 'Tema sin identificar',
                                                                    prueba.subtema?.nombre ?? 'Subtema sin identificar',
                                                                  ]}
                                                                  isUpdating={updatingTestId === prueba.id}
                                                                  onTogglePublication={handleTogglePublication}
                                                                  onReclassify={handleOpenReclassify}
                                                                  onRunTest={handleRunTest}
                                                                  onEditTest={handleEditTest}
                                                                  onDeleteTest={requestDeletePrueba}
                                                                />
                                                              ))}
                                                            </div>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </details>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </details>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </section>
                  );
                })}
            </div>
          )}

          {/* Botón inferior para crear nueva prueba */}
          <div style={s.footerActions}>
            <Link to="/pruebas/crear" style={s.secondaryCreateButton}>
              <Plus size={16} aria-hidden="true" />
              <span>Crear nueva prueba</span>
            </Link>
          </div>
        </section>
      </main>

      {/* Modal de Reclasificación de Prueba */}
      {showReclassifyModal && reclassifyTarget && (
        <div
          style={s.modalOverlay}
          onClick={() => {
            if (isSavingReclassification) return;
            setShowReclassifyModal(false);
            setReclassifyTarget(null);
          }}
        >
          <div style={s.reclassifyModal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div>
                  <p style={s.reclassifyKicker}>Reclasificación de evaluación</p>
                  <h3 style={s.modalTitle}>Cambiar categoría o ubicación</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReclassifyModal(false)}
                  style={s.modalCloseBtn}
                  disabled={isSavingReclassification}
                >
                  <X size={18} />
                </button>
              </div>
              <div style={s.modalTargetBadge}>
                <BookOpenCheck size={14} color="#1d4ed8" />
                <span style={s.modalTargetName}>{toPlainText(reclassifyTarget.nombre) || 'Prueba seleccionada'}</span>
              </div>
            </div>

            <div style={s.reclassifyBody}>
              {/* 1. Selector de Alcance (Scope) */}
              <div style={s.fieldBlock}>
                <label style={s.fieldLabel}>
                  <Layers size={14} color="#2563eb" /> Tipo de alcance:
                </label>
                <div style={s.scopeCardsRow}>
                  <button
                    type="button"
                    onClick={() => {
                      setReclassifyScope('parcial');
                      setReclassifyTemaId(null);
                      setReclassifySubtemaId(null);
                    }}
                    style={reclassifyScope === 'parcial' ? s.scopeOptionActive : s.scopeOption}
                  >
                    <span style={s.scopeOptionTitle}>🎓 Por Parcial</span>
                    <span style={s.scopeOptionDesc}>Abarca todo el parcial</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReclassifyScope('tema');
                      setReclassifySubtemaId(null);
                    }}
                    style={reclassifyScope === 'tema' ? s.scopeOptionActive : s.scopeOption}
                  >
                    <span style={s.scopeOptionTitle}>📖 Por Tema</span>
                    <span style={s.scopeOptionDesc}>Específica de un tema</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReclassifyScope('subtema')}
                    style={reclassifyScope === 'subtema' ? s.scopeOptionActive : s.scopeOption}
                  >
                    <span style={s.scopeOptionTitle}>🔬 Por Subtema</span>
                    <span style={s.scopeOptionDesc}>Específica de un subtema</span>
                  </button>
                </div>
              </div>

              {/* 2. Selector de Parcial */}
              <div style={s.fieldBlock}>
                <label style={s.fieldLabel}>Parcial correspondiente:</label>
                <div style={s.parcialSelectionRow}>
                  {PARCIALES.map((p) => {
                    const isSelected = reclassifyParcial === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => {
                          setReclassifyParcial(p.key);
                          setReclassifyTemaId(null);
                          setReclassifySubtemaId(null);
                        }}
                        style={isSelected ? s.parcialPillActive : s.parcialPill}
                      >
                        {isSelected && <Check size={13} style={{ marginRight: '4px' }} />}
                        {p.title}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Selector de Tema (si scope es tema o subtema) */}
              {(reclassifyScope === 'tema' || reclassifyScope === 'subtema') && (
                <div style={s.fieldBlock}>
                  <label style={s.fieldLabel}>Tema del {reclassifyParcial} parcial:</label>
                  {temasForSelectedParcial.length === 0 ? (
                    <div style={s.warningBox}>
                      No hay temas registrados en el {reclassifyParcial} parcial.
                    </div>
                  ) : (
                    <select
                      value={reclassifyTemaId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        setReclassifyTemaId(val);
                        setReclassifySubtemaId(null);
                      }}
                      style={s.selectInput}
                    >
                      <option value="">-- Selecciona un tema --</option>
                      {temasForSelectedParcial.map((tema) => (
                        <option key={tema.id} value={tema.id}>
                          {tema.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* 4. Selector de Subtema (si scope es subtema) */}
              {reclassifyScope === 'subtema' && (
                <div style={s.fieldBlock}>
                  <label style={s.fieldLabel}>Subtema correspondiente:</label>
                  {!reclassifyTemaId ? (
                    <div style={s.hintBox}>
                      Selecciona un tema arriba para ver sus subtemas disponibles.
                    </div>
                  ) : isLoadingSubtemas ? (
                    <div style={s.hintBox}>Cargando subtemas...</div>
                  ) : modalSubtemas.length === 0 ? (
                    <div style={s.warningBox}>
                      El tema seleccionado no tiene subtemas creados.
                    </div>
                  ) : (
                    <select
                      value={reclassifySubtemaId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        setReclassifySubtemaId(val);
                      }}
                      style={s.selectInput}
                    >
                      <option value="">-- Selecciona un subtema --</option>
                      {modalSubtemas.map((subtema) => (
                        <option key={subtema.id} value={subtema.id}>
                          {subtema.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {reclassifyError && <p style={s.modalErrorText}>{reclassifyError}</p>}
            </div>

            <div style={s.deleteModalActions}>
              <button
                type="button"
                onClick={() => setShowReclassifyModal(false)}
                style={s.deleteModalCancelButton}
                disabled={isSavingReclassification}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveReclassification()}
                style={s.saveReclassifyButton}
                disabled={isSavingReclassification}
              >
                {isSavingReclassification ? 'Guardando...' : 'Guardar reclasificación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar prueba */}
      {showDeleteModal && deleteTarget && (
        <div
          style={s.modalOverlay}
          onClick={() => {
            if (updatingTestId) return;
            setShowDeleteModal(false);
            setDeleteTarget(null);
          }}
        >
          <div style={s.deleteModal} onClick={(event) => event.stopPropagation()}>
            <div style={s.deleteModalHeader}>
              <p style={s.deleteModalKicker}>Confirmar eliminación</p>
              <h3 style={s.deleteModalTitle}>Borrar prueba</h3>
            </div>

            <p style={s.deleteModalText}>
              Esta acción eliminará permanentemente <strong>{toPlainText(deleteTarget.nombre) || 'esta prueba'}</strong>,
              sus preguntas, la imagen asociada y todas las referencias exclusivas que se hayan subido.
              <br />
              <span style={{ color: '#dc2626', fontWeight: 700, marginTop: '6px', display: 'inline-block' }}>
                Esta acción no se puede deshacer.
              </span>
            </p>

            <div style={s.deleteModalActions}>
              <button
                type="button"
                onClick={() => {
                  if (updatingTestId) return;
                  setShowDeleteModal(false);
                  setDeleteTarget(null);
                }}
                style={s.deleteModalCancelButton}
                disabled={Boolean(updatingTestId)}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void confirmDeletePrueba();
                }}
                style={s.deleteModalDangerButton}
                disabled={Boolean(updatingTestId)}
              >
                {updatingTestId ? 'Borrando...' : 'Sí, borrar prueba'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background:
      'radial-gradient(circle at 8% 8%, rgba(186,230,253,.55), transparent 28%), radial-gradient(circle at 92% 18%, rgba(219,234,254,.72), transparent 25%), linear-gradient(180deg, #f7fbff 0%, #edf5fc 52%, #f8fbff 100%)',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    color: '#0f172a',
  },
  main: {
    width: '100%',
    maxWidth: '1240px',
    margin: '0 auto',
    padding: 'clamp(20px, 4vw, 42px) 16px 58px',
    boxSizing: 'border-box',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  hero: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '30px',
    border: '1px solid rgba(157,210,245,.75)',
    background: 'linear-gradient(125deg, rgba(255,255,255,.98), rgba(231,246,255,.96) 52%, rgba(218,238,255,.94))',
    boxShadow: '0 24px 58px rgba(20,72,118,.13)',
    padding: 'clamp(24px, 4vw, 36px)',
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 'clamp(18px, 3vw, 26px)',
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: '230px',
    height: '230px',
    borderRadius: '50%',
    right: '-90px',
    top: '-125px',
    background: 'radial-gradient(circle, rgba(56,189,248,.22), transparent 68%)',
    pointerEvents: 'none',
  },
  heroIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '20px',
    display: 'grid',
    placeItems: 'center',
    color: '#fff',
    background: 'linear-gradient(145deg, #1677b8, #2563a9)',
    boxShadow: '0 14px 30px rgba(22,119,184,.25)',
  },
  heroCopy: { minWidth: 0 },
  heroRightContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'stretch',
    minWidth: '190px',
  },
  heroStat: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 16px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,.78)',
    border: '1px solid rgba(147,197,253,.65)',
    color: '#315b82',
    fontSize: '.78rem',
    fontWeight: 700,
    textAlign: 'center',
    boxShadow: '0 4px 14px rgba(20,72,118,.06)',
  },
  statBadgesRow: {
    display: 'flex',
    gap: '6px',
    marginTop: '6px',
    fontSize: '0.72rem',
    fontWeight: 800,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statBadgeGreen: {
    color: '#15803d',
    background: '#dcfce7',
    padding: '2px 8px',
    borderRadius: '999px',
  },
  statBadgeAmber: {
    color: '#b45309',
    background: '#fef3c7',
    padding: '2px 8px',
    borderRadius: '999px',
  },
  heroCreateButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 18px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: '0.88rem',
    textDecoration: 'none',
    boxShadow: '0 10px 24px rgba(16,185,129,0.28)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    textAlign: 'center',
  },
  toolbar: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '22px',
    border: '1px solid rgba(191,219,238,.92)',
    background: 'rgba(255,255,255,.88)',
    boxShadow: '0 10px 28px rgba(20,67,112,.06)',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  searchWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    color: '#64748b',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '14px',
    border: '1.5px solid #cbd5e1',
    padding: '12px 42px 12px 46px',
    fontFamily: 'inherit',
    fontSize: '0.92rem',
    color: '#0f172a',
    outline: 'none',
    background: '#ffffff',
    boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.03)',
  },
  clearSearchButton: {
    position: 'absolute',
    right: '14px',
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '999px',
    padding: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: '0.82rem',
    fontWeight: 800,
    color: '#475569',
    marginRight: '2px',
  },
  filterPill: {
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    padding: '6px 12px',
    background: '#ffffff',
    color: '#475569',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  },
  filterPillActive: {
    border: '1px solid #2563eb',
    borderRadius: '999px',
    padding: '6px 12px',
    background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
    color: '#1d4ed8',
    fontSize: '0.78rem',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 4px 10px rgba(37,99,235,0.12)',
  },
  kicker: {
    margin: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '5px 11px',
    borderRadius: '999px',
    background: 'rgba(219,234,254,.8)',
    color: '#176aa5',
    fontSize: '0.74rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '8px 0 6px',
    color: '#0f172a',
    fontSize: 'clamp(1.4rem, 2.3vw, 1.95rem)',
    lineHeight: 1.15,
    fontWeight: 900,
    maxWidth: '38ch',
  },
  text: {
    margin: 0,
    maxWidth: '68ch',
    color: '#475569',
    fontSize: '0.94rem',
    lineHeight: 1.6,
  },
  card: {
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  statusBox: {
    width: '100%',
    borderRadius: '18px',
    border: '1px solid #cfe3f4',
    background: 'rgba(255,255,255,.82)',
    color: '#475569',
    padding: '18px 20px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    boxShadow: '0 10px 26px rgba(20,67,112,.07)',
  },
  statusCopy: {
    display: 'grid',
    gap: '3px',
  },
  errorBox: { borderColor: '#fecaca', background: '#fff7f7', color: '#991b1b' },
  parcialSections: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  parcialBlock: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '25px',
    border: '1px solid rgba(191,219,238,.92)',
    background: 'rgba(255,255,255,.88)',
    padding: 'clamp(16px, 2.5vw, 24px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    textAlign: 'left',
    boxShadow: '0 14px 36px rgba(20,67,112,.08)',
    scrollMarginTop: '24px',
  },
  parcialHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    paddingBottom: '8px',
    borderBottom: '1px solid #e2e8f0',
  },
  parcialTitle: {
    margin: 0,
    fontSize: '1.3rem',
    color: '#123b66',
    fontWeight: 900,
  },
  parcialCount: {
    borderRadius: '999px',
    padding: '5px 12px',
    background: '#e7f4fd',
    color: '#176aa5',
    fontSize: '0.76rem',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  scopeBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  scopeTitle: {
    margin: 0,
    color: '#315b82',
    fontSize: '0.82rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 900,
  },
  historyAccordion: {
    borderRadius: '16px',
    border: '1px solid rgba(191,219,254,.6)',
    background: 'linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,250,252,.94))',
    boxShadow: '0 8px 18px rgba(59,130,246,.03)',
    overflow: 'hidden',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
  },
  historySummary: {
    listStyle: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    cursor: 'pointer',
    padding: '12px 14px',
    color: '#1e293b',
    fontWeight: 700,
    fontSize: '0.98rem',
    userSelect: 'none',
    WebkitAppearance: 'none',
  },
  historySummaryLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
    fontWeight: 900,
  },
  weekThemeSummary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    width: '100%',
  },
  weekThemeLabelWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
    gap: '10px',
    textAlign: 'center',
  },
  weekThemeThumb: {
    width: '50px',
    height: '50px',
    borderRadius: '14px',
    objectFit: 'cover',
    border: '2px solid rgba(147,197,253,0.9)',
    boxShadow: '0 8px 20px rgba(59,130,246,0.18)',
    background: 'linear-gradient(135deg, #e0f2fe, #dbeafe)',
    flexShrink: 0,
  },
  weekThemeThumbFallback: {
    width: '50px',
    height: '50px',
    borderRadius: '14px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.05rem',
    fontWeight: 900,
    color: '#1d4ed8',
    background: 'linear-gradient(135deg, #dbeafe, #e0f2fe)',
    border: '2px solid rgba(147,197,253,0.9)',
    boxShadow: '0 8px 20px rgba(59,130,246,0.12)',
    flexShrink: 0,
  },
  weekThemeTitle: {
    margin: 0,
    fontSize: '1.05rem',
    lineHeight: 1.2,
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: '0.01em',
    fontWeight: 800,
  },
  historySummaryMeta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
  },
  historySummaryCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    background: 'rgba(59,130,246,0.08)',
    color: '#1d4ed8',
    padding: '4px 10px',
    fontSize: '0.75rem',
    fontWeight: 800,
    minWidth: '80px',
  },
  historySummaryArrow: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '26px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, rgba(191,219,254,0.7), rgba(224,242,254,0.9))',
    color: '#1d4ed8',
    fontSize: '0.95rem',
    fontWeight: 900,
    lineHeight: 1,
  },
  historyAccordionBody: {
    display: 'grid',
    gap: '14px',
    padding: '12px 14px 14px',
    borderTop: '1px solid rgba(191,219,254,.45)',
    background: 'rgba(255,255,255,.18)',
  },
  historyGroupBlock: {
    display: 'grid',
    gap: '10px',
    paddingTop: '10px',
  },
  historyGroupTitle: {
    margin: 0,
    color: '#2563eb',
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  historyDivider: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '14px',
    paddingTop: '14px',
    borderTop: '1px solid rgba(191,219,254,0.35)',
  },
  historyDividerLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: '#475569',
    fontSize: '0.74rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.09em',
    padding: '7px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.6)',
    border: '1px solid rgba(191,219,254,0.5)',
    boxShadow: '0 4px 12px rgba(96,165,250,0.05)',
    textAlign: 'center',
  },
  innerEmpty: {
    borderRadius: '14px',
    border: '1px dashed #cbd5e1',
    background: '#f8fafc',
    color: '#64748b',
    padding: '12px 14px',
    fontWeight: 700,
    fontSize: '0.88rem',
  },
  grid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '14px',
    justifyContent: 'start',
  },
  testCard: {
    borderRadius: '20px',
    background: '#ffffff',
    boxShadow: '0 7px 22px rgba(23,61,94,0.07)',
    border: '1px solid rgba(196,215,230,0.85)',
    display: 'grid',
    gridTemplateColumns: '140px minmax(0, 1fr)',
    padding: '0',
    minHeight: '210px',
    overflow: 'hidden',
  },
  badge: {
    borderRadius: '999px',
    padding: '4px 9px',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '0.72rem',
    fontWeight: 800,
  },
  badgeTema: {
    borderRadius: '999px',
    padding: '4px 9px',
    background: '#dbeafe',
    color: '#1d4ed8',
    fontSize: '0.72rem',
    fontWeight: 800,
  },
  badgeSubtema: {
    borderRadius: '999px',
    padding: '4px 9px',
    background: '#ede9fe',
    color: '#6d28d9',
    fontSize: '0.72rem',
    fontWeight: 800,
  },
  statePillPublished: {
    borderRadius: '999px',
    padding: '4px 8px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#15803d',
    fontSize: '0.7rem',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  statePillDraft: {
    borderRadius: '999px',
    padding: '4px 8px',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#b45309',
    fontSize: '0.7rem',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  meta: {
    color: '#64748b',
    fontSize: '0.78rem',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  cardTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '1.05rem',
    lineHeight: 1.35,
    fontWeight: 800,
  },
  cardText: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.55,
    fontSize: '0.88rem',
  },
  scopeTag: {
    borderRadius: '999px',
    padding: '4px 8px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '0.7rem',
    fontWeight: 800,
  },
  cardActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
    gap: '6px',
    marginTop: 'auto',
    paddingTop: '10px',
    borderTop: '1px solid rgba(226, 232, 240, 0.8)',
  },
  auditBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    paddingTop: '8px',
    marginTop: '4px',
    borderTop: '1px dashed #e2e8f0',
    fontSize: '0.75rem',
  },
  auditRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  auditUserText: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    color: '#334155',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    maxWidth: 'calc(100% - 95px)',
  },
  auditDateText: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: '#64748b',
    fontWeight: 600,
    fontSize: '0.72rem',
    flexShrink: 0,
    marginLeft: 'auto',
  },
  publishButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '8px 10px',
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.78rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    boxShadow: '0 4px 10px rgba(22,163,74,0.18)',
    lineHeight: 1.2,
    minHeight: '34px',
  },
  unpublishButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '8px 10px',
    background: 'linear-gradient(135deg, #d97706, #b45309)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.78rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    boxShadow: '0 4px 10px rgba(217,119,6,0.18)',
    lineHeight: 1.2,
    minHeight: '34px',
  },
  reclassifyButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '8px 10px',
    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.78rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    boxShadow: '0 4px 10px rgba(2,132,199,0.18)',
    lineHeight: 1.2,
    minHeight: '34px',
  },
  runButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '8px 10px',
    background: 'linear-gradient(135deg, #1677b8, #2563a9)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.78rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    boxShadow: '0 4px 10px rgba(22,119,184,0.18)',
    lineHeight: 1.2,
    minHeight: '34px',
  },
  editButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '8px 10px',
    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.78rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    boxShadow: '0 4px 10px rgba(124,58,237,0.18)',
    lineHeight: 1.2,
    minHeight: '34px',
  },
  deleteButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '8px 10px',
    background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.78rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    boxShadow: '0 4px 10px rgba(220,38,38,0.18)',
    lineHeight: 1.2,
    minHeight: '34px',
  },
  imageFallback: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    color: '#315b82',
    padding: '12px',
    textAlign: 'center',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    borderRadius: '24px',
    padding: '48px 24px',
    border: '1px dashed #93c5fd',
    background: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  emptyTitle: {
    margin: 0,
    fontWeight: 900,
    color: '#0f172a',
    fontSize: '1.2rem',
  },
  emptyText: {
    margin: 0,
    color: '#475569',
    fontSize: '0.94rem',
    maxWidth: '44ch',
  },
  resetFilterBtn: {
    border: '1px solid #93c5fd',
    borderRadius: '12px',
    padding: '9px 18px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  footerActions: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '12px',
  },
  secondaryCreateButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: '0.92rem',
    textDecoration: 'none',
    boxShadow: '0 8px 20px rgba(16,185,129,0.24)',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2500,
    background: 'rgba(15, 23, 42, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    backdropFilter: 'blur(4px)',
  },
  reclassifyModal: {
    width: 'min(560px, 100%)',
    maxHeight: '90vh',
    overflowY: 'auto',
    borderRadius: '24px',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    border: '1px solid rgba(191, 219, 254, 0.9)',
    boxShadow: '0 28px 80px rgba(15, 23, 42, 0.38)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    boxSizing: 'border-box',
  },
  modalHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e2e8f0',
  },
  reclassifyKicker: {
    margin: 0,
    color: '#0284c7',
    fontWeight: 900,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontSize: '0.72rem',
  },
  modalTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '1.35rem',
    fontWeight: 900,
  },
  modalCloseBtn: {
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '999px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#64748b',
  },
  modalTargetBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    borderRadius: '12px',
    background: '#eff6ff',
    border: '1px solid #dbeafe',
    width: 'fit-content',
    maxWidth: '100%',
  },
  modalTargetName: {
    color: '#1e40af',
    fontWeight: 700,
    fontSize: '0.82rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  reclassifyBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fieldBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fieldLabel: {
    fontSize: '0.86rem',
    fontWeight: 800,
    color: '#334155',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  scopeCardsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
  },
  scopeOption: {
    border: '1.5px solid #cbd5e1',
    borderRadius: '14px',
    padding: '10px 8px',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    textAlign: 'center',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  },
  scopeOptionActive: {
    border: '1.5px solid #2563eb',
    borderRadius: '14px',
    padding: '10px 8px',
    background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    textAlign: 'center',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(37,99,235,0.15)',
  },
  scopeOptionTitle: {
    fontSize: '0.82rem',
    fontWeight: 800,
    color: '#0f172a',
  },
  scopeOptionDesc: {
    fontSize: '0.68rem',
    color: '#64748b',
    lineHeight: 1.2,
  },
  parcialSelectionRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
  },
  parcialPill: {
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '8px 10px',
    background: '#fff',
    color: '#475569',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'center',
  },
  parcialPillActive: {
    border: '1px solid #2563eb',
    borderRadius: '12px',
    padding: '8px 10px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '0.8rem',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(37,99,235,0.12)',
  },
  selectInput: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '12px',
    border: '1.5px solid #cbd5e1',
    padding: '10px 14px',
    fontFamily: 'inherit',
    fontSize: '0.88rem',
    color: '#0f172a',
    outline: 'none',
    background: '#ffffff',
  },
  warningBox: {
    padding: '10px 14px',
    borderRadius: '12px',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e',
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  hintBox: {
    padding: '10px 14px',
    borderRadius: '12px',
    background: '#f8fafc',
    border: '1px dashed #cbd5e1',
    color: '#64748b',
    fontSize: '0.82rem',
    fontStyle: 'italic',
  },
  modalErrorText: {
    margin: 0,
    color: '#dc2626',
    fontSize: '0.82rem',
    fontWeight: 700,
  },
  saveReclassifyButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
    color: '#fff',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(2,132,199,0.25)',
  },
  deleteModal: {
    width: 'min(500px, 100%)',
    borderRadius: '24px',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    border: '1px solid rgba(191, 219, 254, 0.9)',
    boxShadow: '0 28px 80px rgba(15, 23, 42, 0.38)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  deleteModalHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  deleteModalKicker: {
    margin: 0,
    color: '#b91c1c',
    fontWeight: 900,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontSize: '0.72rem',
  },
  deleteModalTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '1.35rem',
    fontWeight: 900,
  },
  deleteModalText: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.65,
    fontSize: '0.94rem',
  },
  deleteModalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '6px',
  },
  deleteModalCancelButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '10px 16px',
    background: '#fff',
    color: '#334155',
    fontWeight: 800,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  deleteModalDangerButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '10px 18px',
    background: 'linear-gradient(135deg, #b91c1c, #ef4444)',
    color: '#fff',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(239,68,68,0.22)',
  },
};

export default GestionPruebas;
