import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  Clock,
  Compass,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Layers,
  LogIn,
  MapPin,
  Maximize2,
  Microscope,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  TestTube,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BackButton from '../components/BackButton';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import {
  calculateAuditMetrics,
  countAuditLogsForPurge,
  deleteAuditLogsByIds,
  exportAuditLogsToCsv,
  exportAuditLogsToJson,
  fetchAuditLogs,
  fetchPlacaAuditLogs,
  fetchPruebaAuditLogs,
  fetchSubtemaAuditLogs,
  fetchTemaAuditLogs,
  purgeAuditLogs,
  type AuditActionType,
  type AuditEntityType,
  type AuditFilters,
  type AuditLogEntry,
  type AuditMetrics,
  type PurgeAuditLogsParams,
} from '../services/unifiedAuditService';

interface SubtemaItem {
  id: number;
  nombre: string;
  tema_id: number;
}

interface TemaItem {
  id: number;
  nombre: string;
  parcial: string;
}

const ENTITY_CONFIG: Record<
  AuditEntityType,
  { label: string; icon: LucideIcon; color: string; bg: string }
> = {
  placa: { label: 'Placa', icon: Microscope, color: '#0284c7', bg: '#e0f2fe' },
  prueba: { label: 'Prueba', icon: TestTube, color: '#7c3aed', bg: '#ede9fe' },
  pagina: { label: 'Página', icon: FileText, color: '#0d9488', bg: '#ccfbf1' },
  tema: { label: 'Tema', icon: BookOpen, color: '#2563eb', bg: '#dbeafe' },
  subtema: { label: 'Subtema', icon: Layers, color: '#4f46e5', bg: '#e0e7ff' },
  mapa: { label: 'Mapa', icon: MapPin, color: '#059669', bg: '#d1fae5' },
  usuario: { label: 'Usuario', icon: Users, color: '#d97706', bg: '#fef3c7' },
  sesion: { label: 'Sesión', icon: LogIn, color: '#6366f1', bg: '#e0e7ff' },
  sistema: { label: 'Sistema', icon: Shield, color: '#dc2626', bg: '#fee2e2' },
};

const ACTION_CONFIG: Record<
  AuditActionType,
  { label: string; verb: string; color: string; bg: string; border: string }
> = {
  create: { label: 'Creación', verb: 'creó', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  update: { label: 'Edición', verb: 'editó', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  delete: { label: 'Eliminación', verb: 'eliminó', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  classify: { label: 'Clasificación', verb: 'clasificó', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  publish: { label: 'Publicación', verb: 'publicó', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff' },
  unpublish: { label: 'Despublicación', verb: 'despublicó', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  restore: { label: 'Restauración', verb: 'restauró', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  reorder: { label: 'Reordenamiento', verb: 'reordenó', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  login: { label: 'Inicio de sesión', verb: 'inició sesión en el sistema', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  logout: { label: 'Cierre de sesión', verb: 'cerró sesión', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  role_change: { label: 'Cambio de rol', verb: 'cambió el rol de', color: '#c026d3', bg: '#fdf4ff', border: '#f5d0fe' },
  maintenance_toggle: { label: 'Mantenimiento', verb: 'cambió el modo de mantenimiento', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
};

const formatRelativeTime = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;

    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return isoString;
  }
};

const formatFullDateTime = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('es-CO', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
};

const getPlateThumbnailUrl = (log: AuditLogEntry): string | null => {
  if (log.details?.photo_url) return String(log.details.photo_url);
  if (log.details?.image_url) return String(log.details.image_url);
  if (log.details?.url) return String(log.details.url);
  if (log.details?.imagen) return String(log.details.imagen);
  const origDetails = (log.details as any)?.original_details;
  if (origDetails?.photo_url) return String(origDetails.photo_url);
  return null;
};

const downloadBlob = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const HistorialAuditoria: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const goBack = useSmartBackNavigation('/edicion');
  const { user } = useAuth();

  if (user?.is_protected !== true) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  // Inicializadores perezosos para leer parámetros de URL inmediatamente en el primer render
  const [contextualScope, setContextualScope] = useState<'tema' | 'subtema' | 'placa' | 'prueba' | 'all'>(() => {
    const scope = searchParams.get('scope') as 'tema' | 'subtema' | 'placa' | 'prueba' | null;
    if (scope) return scope;
    const ent = searchParams.get('entity') as 'tema' | 'subtema' | 'placa' | 'prueba' | null;
    if (ent) return ent;
    if (searchParams.get('subtemaId')) return 'subtema';
    return 'all';
  });

  const [contextualEntityId, setContextualEntityId] = useState<string | null>(
    () => searchParams.get('entityId') || searchParams.get('placaId') || searchParams.get('pruebaId') || null
  );

  const [contextualTemaId, setContextualTemaId] = useState<number | null>(
    () => searchParams.get('temaId') ? Number(searchParams.get('temaId')) : null
  );

  const [contextualTemaNombre, setContextualTemaNombre] = useState<string>(
    () => searchParams.get('temaNombre') || ''
  );

  const [contextualSubtemaNombre, setContextualSubtemaNombre] = useState<string>(
    () => searchParams.get('subtemaNombre') || ''
  );

  const [contextualPruebaNombre, setContextualPruebaNombre] = useState<string>(
    () => searchParams.get('pruebaNombre') || ''
  );

  const [selectedEntity, setSelectedEntity] = useState<AuditEntityType | 'all'>(
    () => (searchParams.get('entity') as AuditEntityType) || 'all'
  );

  const [selectedSubtemaId, setSelectedSubtemaId] = useState<number | 'all'>(
    () => searchParams.get('subtemaId') ? Number(searchParams.get('subtemaId')) : 'all'
  );

  const [selectedAction, setSelectedAction] = useState<AuditActionType | 'all'>(
    () => (searchParams.get('action') as AuditActionType) || 'all'
  );

  const [selectedActorId, setSelectedActorId] = useState<number | 'all'>(
    () => searchParams.get('actorUserId') ? Number(searchParams.get('actorUserId')) : 'all'
  );

  const [searchQuery, setSearchQuery] = useState<string>(
    () => searchParams.get('searchQuery') || searchParams.get('q') || ''
  );

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Listas para dropdowns de filtros
  const [temasList, setTemasList] = useState<TemaItem[]>([]);
  const [subtemasList, setSubtemasList] = useState<SubtemaItem[]>([]);

  const [datePreset, setDatePreset] = useState<'today' | 'week' | 'month' | '90days' | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Paginación y modales
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [copiedFicha, setCopiedFicha] = useState(false);

  // Estados para el Modal de Depuración / Limpieza de Registros
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeMode, setPurgeMode] = useState<'range' | 'single_day' | 'older_than'>('range');
  const [purgeDateFrom, setPurgeDateFrom] = useState('');
  const [purgeDateTo, setPurgeDateTo] = useState('');
  const [purgeSingleDate, setPurgeSingleDate] = useState('');
  const [purgeOlderThanDays, setPurgeOlderThanDays] = useState<number>(30);
  const [purgeEntityType, setPurgeEntityType] = useState<AuditEntityType | 'all'>('all');
  const [purgeActionType, setPurgeActionType] = useState<AuditActionType | 'all'>('all');
  const [purgeEstimatedCount, setPurgeEstimatedCount] = useState<number | null>(null);
  const [isCalculatingPurge, setIsCalculatingPurge] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeConfirmed, setPurgeConfirmed] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Lista de autores únicos para el filtro
  const [uniqueActors, setUniqueActors] = useState<Array<{ id: number | null; name: string; username: string }>>([]);

  // Cargar lista de temas y subtemas para los filtros
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const [temasRes, subtemasRes] = await Promise.all([
          supabase.from('temas').select('id, nombre, parcial').order('nombre'),
          supabase.from('subtemas').select('id, nombre, tema_id').order('nombre'),
        ]);
        if (temasRes.data) setTemasList(temasRes.data as TemaItem[]);
        if (subtemasRes.data) setSubtemasList(subtemasRes.data as SubtemaItem[]);
      } catch (err) {
        console.warn('Error al cargar catálogo para filtros de auditoría:', err);
      }
    };
    void fetchCatalog();
  }, []);

  // Función principal de carga con bifurcación a búsquedas específicas dedicadas
  const loadData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    else setLoading(true);

    try {
      // 1. ÁMBITO ESPECÍFICO: TEMA (Contenido de página y edición del tema - SIN placas)
      if (contextualScope === 'tema') {
        const targetTemaId = contextualTemaId || (contextualEntityId ? Number(contextualEntityId) : undefined);
        const result = await fetchTemaAuditLogs(targetTemaId, contextualTemaNombre);
        setLogs(result.logs);
        setTotalCount(result.total);
      }
      // 2. ÁMBITO ESPECÍFICO: SUBTEMA (Contenido de página y configuración del subtema)
      else if (contextualScope === 'subtema') {
        const targetSubtemaId = selectedSubtemaId !== 'all' ? selectedSubtemaId : (contextualEntityId ? Number(contextualEntityId) : undefined);
        const result = await fetchSubtemaAuditLogs(targetSubtemaId, contextualSubtemaNombre);
        setLogs(result.logs);
        setTotalCount(result.total);
      }
      // 3. ÁMBITO ESPECÍFICO: PLACA (Historial exclusivo de esa placa)
      else if (contextualScope === 'placa' || (selectedEntity === 'placa' && contextualEntityId)) {
        const targetPlacaId = contextualEntityId || searchParams.get('placaId') || searchParams.get('entityId') || searchQuery;
        const result = await fetchPlacaAuditLogs(targetPlacaId);
        setLogs(result.logs);
        setTotalCount(result.total);
      }
      // 4. ÁMBITO ESPECÍFICO: PRUEBA (Historial exclusivo de esa prueba)
      else if (contextualScope === 'prueba' || (selectedEntity === 'prueba' && contextualEntityId)) {
        const targetPruebaId = contextualEntityId || searchParams.get('pruebaId') || searchParams.get('entityId') || searchQuery;
        const result = await fetchPruebaAuditLogs(targetPruebaId, contextualPruebaNombre);
        setLogs(result.logs);
        setTotalCount(result.total);
      }
      // 5. VISTA GENERAL (Filtros estándar combinados)
      else {
        let calculatedDateFrom = dateFrom;
        const today = new Date();

        if (datePreset === 'today') {
          calculatedDateFrom = today.toISOString().slice(0, 10);
        } else if (datePreset === 'week') {
          const lastWeek = new Date(today);
          lastWeek.setDate(today.getDate() - 7);
          calculatedDateFrom = lastWeek.toISOString().slice(0, 10);
        } else if (datePreset === 'month') {
          const lastMonth = new Date(today);
          lastMonth.setDate(today.getDate() - 30);
          calculatedDateFrom = lastMonth.toISOString().slice(0, 10);
        } else if (datePreset === '90days') {
          const last90 = new Date(today);
          last90.setDate(today.getDate() - 90);
          calculatedDateFrom = last90.toISOString().slice(0, 10);
        }

        const filters: AuditFilters = {
          entityType: selectedEntity !== 'all' ? selectedEntity : undefined,
          actionType: selectedAction !== 'all' ? selectedAction : undefined,
          actorUserId: selectedActorId !== 'all' ? selectedActorId : undefined,
          subtemaId: selectedSubtemaId !== 'all' ? selectedSubtemaId : undefined,
          dateFrom: calculatedDateFrom || undefined,
          dateTo: dateTo || undefined,
          searchQuery: searchQuery || undefined,
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        };

        const result = await fetchAuditLogs(filters);
        setLogs(result.logs);
        setTotalCount(result.total);
      }
    } catch (err) {
      console.error('Error al cargar datos de auditoría:', err);
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [
    contextualScope,
    contextualEntityId,
    contextualTemaId,
    selectedEntity,
    selectedAction,
    selectedActorId,
    selectedSubtemaId,
    datePreset,
    dateFrom,
    dateTo,
    currentPage,
  ]);

  // Búsqueda con retardo en modo general
  useEffect(() => {
    if (contextualScope !== 'all') return;
    const timer = setTimeout(() => {
      setCurrentPage(1);
      void loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-refresco
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void loadData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, contextualScope, contextualEntityId, contextualTemaId, selectedEntity, selectedAction, selectedActorId, selectedSubtemaId, datePreset, dateFrom, dateTo, currentPage, searchQuery]);

  // Recalcular conteo estimado de purga cuando cambian los parámetros
  useEffect(() => {
    if (!showPurgeModal) return;

    const calculatePurgeEstimate = async () => {
      setIsCalculatingPurge(true);
      const params = buildCurrentPurgeParams();
      try {
        const count = await countAuditLogsForPurge(params);
        setPurgeEstimatedCount(count);
      } catch {
        setPurgeEstimatedCount(0);
      } finally {
        setIsCalculatingPurge(false);
      }
    };

    const debounce = setTimeout(() => {
      void calculatePurgeEstimate();
    }, 200);

    return () => clearTimeout(debounce);
  }, [showPurgeModal, purgeMode, purgeDateFrom, purgeDateTo, purgeSingleDate, purgeOlderThanDays, purgeEntityType, purgeActionType]);

  const metrics: AuditMetrics = useMemo(() => {
    if (uniqueActors.length === 0 && logs.length > 0) {
      const actorsMap = new Map<string, { id: number | null; name: string; username: string }>();
      logs.forEach((log) => {
        const key = log.actor_name || log.actor_username || 'Usuario';
        if (!actorsMap.has(key)) {
          actorsMap.set(key, {
            id: log.actor_user_id,
            name: log.actor_name || log.actor_username || 'Usuario',
            username: log.actor_username || '',
          });
        }
      });
      setUniqueActors(Array.from(actorsMap.values()));
    }
    return calculateAuditMetrics(logs);
  }, [logs, uniqueActors.length]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const handleExportCsv = () => {
    const csvContent = exportAuditLogsToCsv(logs);
    downloadBlob(csvContent, `auditoria_atlas_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
  };

  const handleExportJson = () => {
    const jsonContent = exportAuditLogsToJson(logs);
    downloadBlob(jsonContent, `auditoria_atlas_${new Date().toISOString().slice(0, 10)}.json`, 'application/json;charset=utf-8;');
  };

  const buildCurrentPurgeParams = (): PurgeAuditLogsParams => {
    let from: string | undefined;
    let to: string | undefined;

    if (purgeMode === 'range') {
      from = purgeDateFrom || undefined;
      to = purgeDateTo || undefined;
    } else if (purgeMode === 'single_day') {
      from = purgeSingleDate || undefined;
      to = purgeSingleDate || undefined;
    } else if (purgeMode === 'older_than') {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - purgeOlderThanDays);
      to = targetDate.toISOString().slice(0, 10);
    }

    return {
      dateFrom: from,
      dateTo: to,
      entityType: purgeEntityType,
      actionType: purgeActionType,
    };
  };

  const handleExecutePurge = async () => {
    if (!purgeConfirmed) return;
    setIsPurging(true);

    try {
      const params = buildCurrentPurgeParams();
      const result = await purgeAuditLogs(params);

      setNotification({
        type: 'success',
        message: `Se eliminaron ${result.count} registro(s) de auditoría correctamente.`,
      });

      setShowPurgeModal(false);
      setPurgeConfirmed(false);
      await loadData(true);
    } catch (err) {
      console.error('Error al depurar auditoría:', err);
      setNotification({
        type: 'error',
        message: 'No fue posible completar la eliminación. Intenta nuevamente.',
      });
    } finally {
      setIsPurging(false);
    }
  };

  const handleDeleteSingleLog = async (logId: number) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este registro de auditoría de forma permanente?')) {
      return;
    }

    try {
      await deleteAuditLogsByIds([logId]);
      setSelectedLog(null);
      setNotification({
        type: 'success',
        message: 'Registro de auditoría eliminado exitosamente.',
      });
      await loadData(true);
    } catch (err) {
      console.error('Error al eliminar registro:', err);
      setNotification({
        type: 'error',
        message: 'Error al eliminar el registro.',
      });
    }
  };

  const clearFiltersToGeneral = () => {
    setSearchParams({});
    setContextualScope('all');
    setContextualEntityId(null);
    setContextualTemaId(null);
    setContextualTemaNombre('');
    setContextualSubtemaNombre('');
    setContextualPruebaNombre('');
    setSelectedEntity('all');
    setSelectedAction('all');
    setSelectedActorId('all');
    setSelectedSubtemaId('all');
    setSearchQuery('');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const isSpecificScope = contextualScope !== 'all';

  return (
    <div style={styles.page}>
      <Header />

      <main style={styles.main}>
        {/* Notificación Flotante */}
        {notification && (
          <div
            style={{
              ...styles.toastNotification,
              background: notification.type === 'success' ? '#065f46' : '#991b1b',
            }}
          >
            <span>{notification.message}</span>
            <button
              type="button"
              onClick={() => setNotification(null)}
              style={styles.closeToastBtn}
              aria-label="Cerrar notificación"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div style={styles.topNavRow}>
          <BackButton onClick={goBack} />

          <div style={styles.topActionsRight}>
            <button
              type="button"
              onClick={() => void loadData(true)}
              style={styles.actionIconButton}
              title="Refrescar datos ahora"
              disabled={isRefreshing}
            >
              <RefreshCw size={16} className={isRefreshing ? 'spin-animation' : ''} />
              <span>{isRefreshing ? 'Actualizando...' : 'Refrescar'}</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoRefresh((prev) => !prev)}
              style={{
                ...styles.actionIconButton,
                background: autoRefresh ? '#ecfdf5' : '#ffffff',
                borderColor: autoRefresh ? '#10b981' : '#e2e8f0',
                color: autoRefresh ? '#059669' : '#475569',
              }}
              title="Activar/desactivar auto-actualización cada 15 segundos"
            >
              <Activity size={16} />
              <span>{autoRefresh ? 'En vivo (15s)' : 'Pausado'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              style={styles.exportBtnCsv}
              title="Descargar informe en formato Excel / CSV"
            >
              <FileSpreadsheet size={16} />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              style={styles.exportBtnJson}
              title="Descargar datos en formato JSON"
            >
              <Download size={16} />
              <span>JSON</span>
            </button>

            {/* Botón de Limpieza y Purga */}
            <button
              type="button"
              onClick={() => {
                setPurgeConfirmed(false);
                setShowPurgeModal(true);
              }}
              style={styles.purgeOpenBtn}
              title="Limpiar o eliminar registros por fechas y rangos"
            >
              <Trash2 size={16} />
              <span>Limpiar Registros</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ENCABEZADO ESPECÍFICO SEGÚN EL ÁMBITO (Tema, Subtema, Placa, Prueba) */}
        {/* ========================================================================= */}
        {isSpecificScope ? (
          <div style={styles.specificHeaderCard}>
            <div style={styles.specificHeaderLeft}>
              <div style={styles.specificBadge}>
                <Sparkles size={16} color="#ffffff" />
                <span>Vista Específica de Auditoría</span>
              </div>

              {contextualScope === 'tema' && (
                <>
                  <h1 style={styles.specificTitle}>
                    Historial de Contenido y Edición del Tema: {contextualTemaNombre || (contextualTemaId ? `Tema #${contextualTemaId}` : 'General')}
                  </h1>
                  <p style={styles.specificSubtitle}>
                    Monitoreo exclusivo de cambios en el <strong>contenido de la página</strong> (bloques de texto, imágenes de lectura, versiones guardadas) y edición de este tema. <strong>No incluye placas</strong>.
                  </p>
                </>
              )}

              {contextualScope === 'subtema' && (
                <>
                  <h1 style={styles.specificTitle}>
                    Historial de Contenido y Edición del Subtema: {contextualSubtemaNombre || (selectedSubtemaId !== 'all' ? `Subtema #${selectedSubtemaId}` : 'General')}
                  </h1>
                  <p style={styles.specificSubtitle}>
                    Monitoreo exclusivo de cambios en el <strong>contenido editorial de la página</strong> de este subtema y configuración del subtema. <strong>No incluye placas de otros temas</strong>.
                  </p>
                </>
              )}

              {contextualScope === 'placa' && (
                <>
                  <h1 style={styles.specificTitle}>
                    Historial Exclusivo de la Placa #{contextualEntityId || 'Muestra'}
                  </h1>
                  <p style={styles.specificSubtitle}>
                    Monitoreo exclusivo de cambios, subidas, clasificaciones, traslados y ediciones para <strong>esta placa exacta</strong>.
                  </p>
                </>
              )}

              {contextualScope === 'prueba' && (
                <>
                  <h1 style={styles.specificTitle}>
                    Historial Exclusivo de la Evaluación: {contextualPruebaNombre || (contextualEntityId ? `Prueba #${contextualEntityId}` : '')}
                  </h1>
                  <p style={styles.specificSubtitle}>
                    Monitoreo exclusivo de creación, cambios de preguntas, opciones y estados de publicación para <strong>esta prueba exacta</strong>.
                  </p>
                </>
              )}
            </div>

            <div style={styles.specificHeaderRight}>
              <button
                type="button"
                onClick={clearFiltersToGeneral}
                style={styles.backToGeneralBtn}
                title="Quitar este filtro y ver el registro general de todo el Atlas"
              >
                <ArrowLeft size={16} />
                <span>Ver historial general completo</span>
              </button>
            </div>
          </div>
        ) : (
          /* Encabezado General */
          <>
            <div style={styles.headerHero}>
              <div style={styles.badgeTopHero}>
                <Shield size={16} color="#0284c7" />
                <span>Monitoreo Privado de Administración</span>
              </div>
              <h1 style={styles.heroTitle}>Historial, Control y Auditoría</h1>
              <p style={styles.heroSubtitle}>
                Supervisa en tiempo real quién clasifica, edita o elimina placas, pruebas, páginas y temas con miniaturas de muestras, enlaces directos a los recursos y depuración segura por fechas.
              </p>
            </div>

            {/* Tarjetas de Métricas Resumen */}
            <div style={styles.metricsGrid}>
              <div style={styles.metricCard}>
                <div style={styles.metricIconWrap(ENTITY_CONFIG.placa.bg)}>
                  <Microscope size={22} color={ENTITY_CONFIG.placa.color} />
                </div>
                <div>
                  <span style={styles.metricLabel}>Total Registros</span>
                  <h3 style={styles.metricNumber}>{totalCount}</h3>
                  <span style={styles.metricSub}>Operaciones auditadas</span>
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricIconWrap('#f0fdf4')}>
                  <Clock size={22} color="#16a34a" />
                </div>
                <div>
                  <span style={styles.metricLabel}>Acciones de Hoy</span>
                  <h3 style={styles.metricNumber}>{metrics.todayCount}</h3>
                  <span style={styles.metricSub}>Actividad reciente</span>
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricIconWrap('#faf5ff')}>
                  <Users size={22} color="#7c3aed" />
                </div>
                <div>
                  <span style={styles.metricLabel}>Editores Activos</span>
                  <h3 style={styles.metricNumber}>{metrics.activeEditorsCount}</h3>
                  <span style={styles.metricSub}>Docentes / Administradores</span>
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricIconWrap('#fef2f2')}>
                  <Trash2 size={22} color="#dc2626" />
                </div>
                <div>
                  <span style={styles.metricLabel}>Acciones Críticas</span>
                  <h3 style={styles.metricNumber}>{metrics.criticalCount}</h3>
                  <span style={styles.metricSub}>Borrados / Despublicaciones</span>
                </div>
              </div>
            </div>

            {/* Panel de Filtros en Vista General */}
            <div style={styles.filtersSection}>
              <div style={styles.filtersTopRow}>
                <div style={styles.searchWrap}>
                  <Search size={18} color="#64748b" style={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Buscar placa (# o nombre), subtema, tema, aumento (40x), tinción, autor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={styles.searchInput}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={styles.clearSearchBtn}
                      aria-label="Limpiar búsqueda"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                <div style={styles.datePresetRow}>
                  {(['all', 'today', 'week', 'month', '90days'] as const).map((preset) => {
                    const labels: Record<string, string> = {
                      all: 'Todo',
                      today: 'Hoy',
                      week: '7 días',
                      month: '30 días',
                      '90days': '90 días',
                    };
                    const isActive = datePreset === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setDatePreset(preset);
                          setCurrentPage(1);
                        }}
                        style={{
                          ...styles.presetBtn,
                          background: isActive ? '#0284c7' : '#f1f5f9',
                          color: isActive ? '#ffffff' : '#475569',
                          borderColor: isActive ? '#0284c7' : '#e2e8f0',
                          fontWeight: isActive ? 700 : 550,
                        }}
                      >
                        {labels[preset]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filtros por Categoría */}
              <div style={styles.categoriesRow}>
                <span style={styles.filterGroupLabel}>Categoría:</span>
                <div style={styles.categoryPillsWrap}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEntity('all');
                      setCurrentPage(1);
                    }}
                    style={{
                      ...styles.catPill,
                      background: selectedEntity === 'all' ? '#0f172a' : '#ffffff',
                      color: selectedEntity === 'all' ? '#ffffff' : '#475569',
                      borderColor: selectedEntity === 'all' ? '#0f172a' : '#e2e8f0',
                    }}
                  >
                    Todas las categorías
                  </button>
                  {(Object.keys(ENTITY_CONFIG) as AuditEntityType[]).map((entKey) => {
                    const conf = ENTITY_CONFIG[entKey];
                    const Icon = conf.icon;
                    const isSelected = selectedEntity === entKey;
                    return (
                      <button
                        key={entKey}
                        type="button"
                        onClick={() => {
                          setSelectedEntity(entKey);
                          setCurrentPage(1);
                        }}
                        style={{
                          ...styles.catPill,
                          background: isSelected ? conf.color : '#ffffff',
                          color: isSelected ? '#ffffff' : '#334155',
                          borderColor: isSelected ? conf.color : '#e2e8f0',
                        }}
                      >
                        <Icon size={14} color={isSelected ? '#ffffff' : conf.color} />
                        <span>{conf.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fila de Dropdowns */}
              <div style={styles.dropdownsGridRow}>
                <div style={styles.dropdownFieldWrap}>
                  <label style={styles.dropdownLabel}>🏷️ Filtrar por Subtema:</label>
                  <select
                    value={selectedSubtemaId}
                    onChange={(e) => {
                      setSelectedSubtemaId(e.target.value === 'all' ? 'all' : Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={styles.selectDropdown}
                  >
                    <option value="all">Todos los subtemas</option>
                    {temasList.map((tema) => {
                      const subtemasDelTema = subtemasList.filter((s) => s.tema_id === tema.id);
                      if (subtemasDelTema.length === 0) return null;
                      return (
                        <optgroup key={tema.id} label={`${tema.nombre} (${tema.parcial || 'General'})`}>
                          {subtemasDelTema.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nombre}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>

                <div style={styles.dropdownFieldWrap}>
                  <label style={styles.dropdownLabel}>⚡ Tipo de Acción:</label>
                  <select
                    value={selectedAction}
                    onChange={(e) => {
                      setSelectedAction(e.target.value as AuditActionType | 'all');
                      setCurrentPage(1);
                    }}
                    style={styles.selectDropdown}
                  >
                    <option value="all">Todas las acciones</option>
                    {(Object.keys(ACTION_CONFIG) as AuditActionType[]).map((actKey) => (
                      <option key={actKey} value={actKey}>
                        {ACTION_CONFIG[actKey].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.dropdownFieldWrap}>
                  <label style={styles.dropdownLabel}>👤 Responsable / Autor:</label>
                  <select
                    value={selectedActorId}
                    onChange={(e) => {
                      setSelectedActorId(e.target.value === 'all' ? 'all' : Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={styles.selectDropdown}
                  >
                    <option value="all">Todos los usuarios</option>
                    {uniqueActors.map((actor) => (
                      <option key={actor.name + String(actor.id)} value={actor.id ?? 'all'}>
                        {actor.name} {actor.username ? `(@${actor.username})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Lista de Registros / Timeline */}
        <div style={styles.timelineContainer}>
          <div style={styles.timelineHeader}>
            <h2 style={styles.timelineTitle}>
              Registro de Operaciones
              <span style={styles.timelineBadgeCount}>{totalCount}</span>
            </h2>
            <span style={styles.pageSubtitleSmall}>
              {isSpecificScope ? `${totalCount} registro(s) específicos encontrados` : `Página ${currentPage} de ${totalPages}`}
            </span>
          </div>

          {loading ? (
            <div style={styles.loadingBox}>
              <div style={styles.spinner} />
              <p style={styles.loadingText}>Cargando historial específico...</p>
            </div>
          ) : logs.length === 0 ? (
            <div style={styles.emptyStateBox}>
              <Shield size={44} color="#94a3b8" />
              <h3 style={styles.emptyTitle}>No se encontraron modificaciones para este elemento</h3>
              <p style={styles.emptySubtitle}>
                Aún no se han registrado eventos o cambios específicos para este elemento.
              </p>
              {isSpecificScope && (
                <button type="button" onClick={clearFiltersToGeneral} style={styles.emptyResetBtn}>
                  Ver todo el historial general
                </button>
              )}
            </div>
          ) : (
            <div style={styles.logsList}>
              {logs.map((log) => {
                const entityConf = ENTITY_CONFIG[log.entity_type] || ENTITY_CONFIG.sistema;
                const actionConf = ACTION_CONFIG[log.action_type] || ACTION_CONFIG.update;
                const EntityIcon = entityConf.icon;
                const photoUrl = getPlateThumbnailUrl(log);
                const subtemaName = (log.details?.subtema_nombre as string) || '';
                const temaName = (log.details?.tema_nombre as string) || '';
                const aumentoVal = (log.details?.aumento as string) || '';
                const tincionVal = (log.details?.tincion as string) || '';
                const comentarioVal = (log.details?.comentario as string) || '';

                return (
                  <article key={log.id} style={styles.auditCard}>
                    {/* Miniatura visual */}
                    {photoUrl ? (
                      <div
                        style={styles.cardThumbnailWrap}
                        onClick={() => setLightboxImageUrl(photoUrl)}
                        title="Ver imagen en tamaño completo"
                      >
                        <img src={photoUrl} alt="Placa" style={styles.cardThumbnailImg} />
                        <div style={styles.thumbnailOverlayBadge}>
                          <Maximize2 size={12} color="#ffffff" />
                        </div>
                      </div>
                    ) : log.entity_type === 'placa' ? (
                      <div
                        style={{ ...styles.cardLeftBadge, background: '#e0f2fe', borderColor: '#0284c7' }}
                        title="Placa histológica"
                      >
                        <Microscope size={22} color="#0284c7" />
                      </div>
                    ) : (
                      <div style={{ ...styles.cardLeftBadge, background: entityConf.bg, borderColor: entityConf.color }}>
                        <EntityIcon size={20} color={entityConf.color} />
                      </div>
                    )}

                    <div style={styles.cardMainContent}>
                      <div style={styles.cardHeaderRow}>
                        {/* Autor con Nombre Real */}
                        <div style={styles.actorRow}>
                          <div style={styles.actorAvatar}>
                            {log.actor_name ? log.actor_name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <span style={styles.actorRealName}>{log.actor_name}</span>
                            {log.actor_username && log.actor_username !== log.actor_name && (
                              <span style={styles.actorUsername}>@{log.actor_username}</span>
                            )}
                            {log.actor_role && <span style={styles.roleTag}>{log.actor_role}</span>}
                          </div>
                        </div>

                        {/* Fecha y Hora */}
                        <div style={styles.timeBadge} title={formatFullDateTime(log.created_at)}>
                          <Clock size={13} color="#64748b" />
                          <span>{formatRelativeTime(log.created_at)}</span>
                        </div>
                      </div>

                      {/* Descripción de la acción */}
                      <div style={styles.actionRow}>
                        <span
                          style={{
                            ...styles.actionBadge,
                            color: actionConf.color,
                            background: actionConf.bg,
                            borderColor: actionConf.border,
                          }}
                        >
                          {actionConf.label}
                        </span>
                        <p style={styles.actionSentence}>
                          <span style={styles.actionVerb}>{actionConf.verb}</span>{' '}
                          <strong style={styles.resourceName}>{log.entity_name}</strong>
                          {log.entity_id && <span style={styles.resourceId}> (ID: {log.entity_id})</span>}
                        </p>
                      </div>

                      {/* Detalles visuales estructurados */}
                      <div style={styles.quickDetailsPreview}>
                        {subtemaName && (
                          <span style={styles.detailPillSubtema}>
                            🏷️ Subtema: <strong>{subtemaName}</strong>
                          </span>
                        )}
                        {temaName && (
                          <span style={styles.detailPillTema}>
                            📚 Tema: <strong>{temaName}</strong>
                          </span>
                        )}
                        {aumentoVal && (
                          <span style={styles.detailPillAumento}>
                            🔬 Aumento: <strong>{aumentoVal}</strong>
                          </span>
                        )}
                        {tincionVal && (
                          <span style={styles.detailPillTincion}>
                            🧪 Tinción: <strong>{tincionVal}</strong>
                          </span>
                        )}
                        {log.details.blocks_count != null && (
                          <span style={styles.detailPill}>
                            🧱 {String(log.details.blocks_count)} bloques de contenido
                          </span>
                        )}
                        {log.details.version_name != null && (
                          <span style={styles.detailPill}>
                            📄 Versión: {String(log.details.version_name)}
                          </span>
                        )}
                        {log.details.preguntas_count != null && (
                          <span style={styles.detailPill}>
                            ❓ {String(log.details.preguntas_count)} preguntas
                          </span>
                        )}
                      </div>

                      {comentarioVal && (
                        <p style={styles.commentExcerpt}>
                          💬 <em>"{comentarioVal}"</em>
                        </p>
                      )}
                    </div>

                    {/* Botón para abrir modal de detalle */}
                    <div style={styles.cardActionsRight}>
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        style={styles.detailsModalBtn}
                        title="Ver ficha completa y metadatos"
                      >
                        <Eye size={15} />
                        <span>Ver Ficha</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Paginación en modo general */}
          {!isSpecificScope && totalPages > 1 && (
            <div style={styles.paginationRow}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  ...styles.pageBtn,
                  opacity: currentPage <= 1 ? 0.5 : 1,
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                ← Anterior
              </button>

              <span style={styles.pageIndicator}>
                Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({totalCount} registros)
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  ...styles.pageBtn,
                  opacity: currentPage >= totalPages ? 0.5 : 1,
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>

        {/* Modal de Ficha Detallada */}
        {selectedLog && (
          <div style={styles.modalOverlay} onClick={() => setSelectedLog(null)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      ...styles.modalBadgeIcon,
                      background: (ENTITY_CONFIG[selectedLog.entity_type] || ENTITY_CONFIG.sistema).bg,
                    }}
                  >
                    {React.createElement(
                      (ENTITY_CONFIG[selectedLog.entity_type] || ENTITY_CONFIG.sistema).icon,
                      { size: 20, color: (ENTITY_CONFIG[selectedLog.entity_type] || ENTITY_CONFIG.sistema).color }
                    )}
                  </div>
                  <div>
                    <h3 style={styles.modalTitle}>Ficha de Operación #{selectedLog.id}</h3>
                    <span style={styles.modalSubtitle}>{formatFullDateTime(selectedLog.created_at)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  style={styles.closeModalBtn}
                  aria-label="Cerrar ficha"
                >
                  <X size={18} />
                </button>
              </div>

              <div style={styles.modalBody}>
                {/* Resumen */}
                <div style={styles.summaryBanner}>
                  <p style={styles.summaryBannerText}>
                    👤 <strong>{selectedLog.actor_name}</strong>{' '}
                    <span style={{ color: '#0369a1' }}>{(ACTION_CONFIG[selectedLog.action_type] || ACTION_CONFIG.update).verb}</span>{' '}
                    <strong>{selectedLog.entity_name}</strong>
                  </p>
                </div>

                {/* Accesos directos a la sección */}
                <div style={styles.navigationHubCard}>
                  <span style={styles.navigationHubTitle}>
                    <Compass size={16} color="#0284c7" /> Accesos Directos a la Sección:
                  </span>
                  <div style={styles.navigationButtonsGrid}>
                    {selectedLog.entity_type === 'placa' && (
                      <>
                        {selectedLog.details?.tema_id != null && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLog(null);
                              navigate(`/subtemas/${selectedLog.details.tema_id}`);
                            }}
                            style={styles.navActionBtnPrimary}
                          >
                            <Microscope size={15} />
                            <span>Ver Subtemas del Tema</span>
                            <ArrowRight size={13} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLog(null);
                            navigate('/mover-placa');
                          }}
                          style={styles.navActionBtnSecondary}
                        >
                          <Pencil size={14} />
                          <span>Reasignar / Mover Placas</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLog(null);
                            navigate('/placas');
                          }}
                          style={styles.navActionBtnSecondary}
                        >
                          <Layers size={14} />
                          <span>Gestión de Placas</span>
                        </button>
                      </>
                    )}

                    {selectedLog.entity_type === 'pagina' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLog(null);
                          navigate('/editor-paginas');
                        }}
                        style={styles.navActionBtnPrimary}
                      >
                        <FileText size={15} />
                        <span>Abrir Editor de Páginas</span>
                        <ArrowRight size={13} />
                      </button>
                    )}

                    {selectedLog.entity_type === 'prueba' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLog(null);
                          navigate('/gestion-pruebas');
                        }}
                        style={styles.navActionBtnPrimary}
                      >
                        <TestTube size={15} />
                        <span>Gestión de Pruebas</span>
                        <ArrowRight size={13} />
                      </button>
                    )}

                    {(selectedLog.entity_type === 'tema' || selectedLog.entity_type === 'subtema') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLog(null);
                          navigate('/temario-admin');
                        }}
                        style={styles.navActionBtnPrimary}
                      >
                        <BookOpen size={15} />
                        <span>Gestión del Temario</span>
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sección de Imagen Grande */}
                {Boolean(getPlateThumbnailUrl(selectedLog)) && (
                  <div style={styles.modalHeroImageCard}>
                    <div style={styles.modalHeroImageHeader}>
                      <span style={styles.modalHeroImageTitle}>
                        <ImageIcon size={16} color="#0284c7" /> Muestra Histológica
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setLightboxImageUrl(getPlateThumbnailUrl(selectedLog)!)}
                          style={styles.heroZoomBtn}
                        >
                          <Maximize2 size={13} /> Ampliar
                        </button>
                        <a
                          href={getPlateThumbnailUrl(selectedLog)!}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.openExternalLink}
                        >
                          <ExternalLink size={13} /> Original
                        </a>
                      </div>
                    </div>
                    <div
                      style={styles.modalHeroImageWrap}
                      onClick={() => setLightboxImageUrl(getPlateThumbnailUrl(selectedLog)!)}
                      title="Haz clic para ver en pantalla completa"
                    >
                      <img
                        src={getPlateThumbnailUrl(selectedLog)!}
                        alt="Imagen de la placa"
                        style={styles.modalHeroImg}
                      />
                    </div>
                  </div>
                )}

                {/* Información de Metadatos */}
                <div style={styles.modalGrid}>
                  <div style={styles.modalInfoCard}>
                    <span style={styles.modalInfoLabel}>Responsable / Autor</span>
                    <strong style={styles.modalInfoValue}>{selectedLog.actor_name}</strong>
                    {selectedLog.actor_username && (
                      <span style={styles.modalInfoSub}>@{selectedLog.actor_username}</span>
                    )}
                  </div>

                  <div style={styles.modalInfoCard}>
                    <span style={styles.modalInfoLabel}>Tipo de Recurso y Acción</span>
                    <strong style={styles.modalInfoValue}>
                      {(ENTITY_CONFIG[selectedLog.entity_type] || ENTITY_CONFIG.sistema).label}
                    </strong>
                    <span style={styles.modalInfoSub}>
                      {(ACTION_CONFIG[selectedLog.action_type] || ACTION_CONFIG.update).label}
                    </span>
                  </div>

                  {selectedLog.details.subtema_nombre != null && (
                    <div style={styles.modalInfoCard}>
                      <span style={styles.modalInfoLabel}>🏷️ Subtema</span>
                      <strong style={{ ...styles.modalInfoValue, color: '#4338ca' }}>
                        {String(selectedLog.details.subtema_nombre)}
                      </strong>
                    </div>
                  )}

                  {selectedLog.details.tema_nombre != null && (
                    <div style={styles.modalInfoCard}>
                      <span style={styles.modalInfoLabel}>📚 Tema</span>
                      <strong style={{ ...styles.modalInfoValue, color: '#1d4ed8' }}>
                        {String(selectedLog.details.tema_nombre)}
                      </strong>
                    </div>
                  )}

                  {selectedLog.details.aumento != null && (
                    <div style={styles.modalInfoCard}>
                      <span style={styles.modalInfoLabel}>🔬 Aumento</span>
                      <strong style={{ ...styles.modalInfoValue, color: '#15803d' }}>
                        {String(selectedLog.details.aumento)}
                      </strong>
                    </div>
                  )}

                  {selectedLog.details.tincion != null && (
                    <div style={styles.modalInfoCard}>
                      <span style={styles.modalInfoLabel}>🧪 Tinción</span>
                      <strong style={{ ...styles.modalInfoValue, color: '#b45309' }}>
                        {String(selectedLog.details.tincion)}
                      </strong>
                    </div>
                  )}

                  {selectedLog.entity_id && (
                    <div style={styles.modalInfoCard}>
                      <span style={styles.modalInfoLabel}>Identificador</span>
                      <strong style={styles.modalInfoValue}>ID #{selectedLog.entity_id}</strong>
                    </div>
                  )}
                </div>

                {/* Comentarios */}
                {Boolean(selectedLog.details.comentario || selectedLog.details.descripcion) && (
                  <div style={styles.commentBox}>
                    <span style={styles.modalInfoLabel}>📝 Comentario / Descripción</span>
                    <p style={styles.commentBoxText}>
                      {String(selectedLog.details.comentario || selectedLog.details.descripcion)}
                    </p>
                  </div>
                )}

                {/* JSON */}
                <details style={styles.jsonAccordion}>
                  <summary style={styles.jsonSummary}>▶ Ver metadatos técnicos avanzados (JSON)</summary>
                  <pre style={styles.jsonPre}>{JSON.stringify(selectedLog.details, null, 2)}</pre>
                </details>
              </div>

              <div style={styles.modalFooter}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const summary = `[AUDITORÍA ATLAS] ${selectedLog.actor_name} (${selectedLog.action_type}) en ${selectedLog.entity_type}: ${selectedLog.entity_name}`;
                      void navigator.clipboard.writeText(summary);
                      setCopiedFicha(true);
                      setTimeout(() => setCopiedFicha(false), 2500);
                    }}
                    style={styles.copySummaryBtn}
                  >
                    {copiedFicha ? <Check size={15} color="#059669" /> : <Copy size={15} />}
                    <span>{copiedFicha ? '¡Copiado!' : 'Copiar Resumen'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDeleteSingleLog(selectedLog.id)}
                    style={styles.deleteSingleLogBtn}
                  >
                    <Trash2 size={15} />
                    <span>Eliminar este registro</span>
                  </button>
                </div>

                <button type="button" onClick={() => setSelectedLog(null)} style={styles.modalCloseFooterBtn}>
                  Cerrar Ficha
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Limpieza y Purga */}
        {showPurgeModal && (
          <div style={styles.modalOverlay} onClick={() => !isPurging && setShowPurgeModal(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={styles.purgeModalIconWrap}>
                    <Trash2 size={20} color="#dc2626" />
                  </div>
                  <div>
                    <h3 style={styles.modalTitle}>Limpiar y Depurar Historial</h3>
                    <span style={styles.modalSubtitle}>Elimina registros de auditoría por fechas o rangos específicos</span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isPurging}
                  onClick={() => setShowPurgeModal(false)}
                  style={styles.closeModalBtn}
                  aria-label="Cerrar modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div style={styles.modalBody}>
                <div style={styles.purgeWarningBox}>
                  <AlertTriangle size={20} color="#b45309" style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#92400e', fontSize: '0.94em' }}>Acción Permanente e Irreversible</strong>
                    <p style={{ margin: '2px 0 0', color: '#b45309', fontSize: '0.85em', lineHeight: 1.4 }}>
                      Los registros que coincidan con los criterios seleccionados se eliminarán definitivamente.
                    </p>
                  </div>
                </div>

                <div style={styles.purgeOptionGroup}>
                  <label style={styles.purgeGroupLabel}>1. Selecciona cómo deseas limpiar:</label>
                  <div style={styles.purgeModePills}>
                    <button
                      type="button"
                      onClick={() => setPurgeMode('range')}
                      style={{
                        ...styles.purgeModeBtn,
                        background: purgeMode === 'range' ? '#0f172a' : '#f8fafc',
                        color: purgeMode === 'range' ? '#ffffff' : '#334155',
                        borderColor: purgeMode === 'range' ? '#0f172a' : '#cbd5e1',
                      }}
                    >
                      <Calendar size={15} />
                      <span>Rango de Fechas</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPurgeMode('single_day')}
                      style={{
                        ...styles.purgeModeBtn,
                        background: purgeMode === 'single_day' ? '#0f172a' : '#f8fafc',
                        color: purgeMode === 'single_day' ? '#ffffff' : '#334155',
                        borderColor: purgeMode === 'single_day' ? '#0f172a' : '#cbd5e1',
                      }}
                    >
                      <Clock size={15} />
                      <span>Un Día Específico</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPurgeMode('older_than')}
                      style={{
                        ...styles.purgeModeBtn,
                        background: purgeMode === 'older_than' ? '#0f172a' : '#f8fafc',
                        color: purgeMode === 'older_than' ? '#ffffff' : '#334155',
                        borderColor: purgeMode === 'older_than' ? '#0f172a' : '#cbd5e1',
                      }}
                    >
                      <ShieldAlert size={15} />
                      <span>Más antiguos de X días</span>
                    </button>
                  </div>
                </div>

                {purgeMode === 'range' && (
                  <div style={styles.purgeDatesRow}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.dropdownLabel}>Fecha Inicial (Desde):</label>
                      <input
                        type="date"
                        value={purgeDateFrom}
                        onChange={(e) => setPurgeDateFrom(e.target.value)}
                        style={styles.purgeDateInput}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.dropdownLabel}>Fecha Final (Hasta):</label>
                      <input
                        type="date"
                        value={purgeDateTo}
                        onChange={(e) => setPurgeDateTo(e.target.value)}
                        style={styles.purgeDateInput}
                      />
                    </div>
                  </div>
                )}

                {purgeMode === 'single_day' && (
                  <div>
                    <label style={styles.dropdownLabel}>Selecciona el día a limpiar:</label>
                    <input
                      type="date"
                      value={purgeSingleDate}
                      onChange={(e) => setPurgeSingleDate(e.target.value)}
                      style={styles.purgeDateInput}
                    />
                  </div>
                )}

                {purgeMode === 'older_than' && (
                  <div>
                    <label style={styles.dropdownLabel}>Eliminar registros anteriores a:</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {[7, 30, 60, 90, 180, 365].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setPurgeOlderThanDays(days)}
                          style={{
                            ...styles.presetBtn,
                            background: purgeOlderThanDays === days ? '#dc2626' : '#f1f5f9',
                            color: purgeOlderThanDays === days ? '#ffffff' : '#334155',
                            borderColor: purgeOlderThanDays === days ? '#dc2626' : '#cbd5e1',
                            fontWeight: purgeOlderThanDays === days ? 700 : 500,
                          }}
                        >
                          Más de {days >= 365 ? '1 año' : `${days} días`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={styles.purgeScopeGrid}>
                  <div>
                    <label style={styles.dropdownLabel}>2. Categoría a eliminar:</label>
                    <select
                      value={purgeEntityType}
                      onChange={(e) => setPurgeEntityType(e.target.value as AuditEntityType | 'all')}
                      style={styles.selectDropdown}
                    >
                      <option value="all">Todas las categorías</option>
                      {(Object.keys(ENTITY_CONFIG) as AuditEntityType[]).map((k) => (
                        <option key={k} value={k}>
                          {ENTITY_CONFIG[k].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.dropdownLabel}>3. Tipo de acción:</label>
                    <select
                      value={purgeActionType}
                      onChange={(e) => setPurgeActionType(e.target.value as AuditActionType | 'all')}
                      style={styles.selectDropdown}
                    >
                      <option value="all">Todas las acciones</option>
                      {(Object.keys(ACTION_CONFIG) as AuditActionType[]).map((k) => (
                        <option key={k} value={k}>
                          {ACTION_CONFIG[k].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={styles.purgeCountBanner}>
                  <span style={styles.purgeCountLabel}>Registros calculados:</span>
                  <strong style={styles.purgeCountNumber}>
                    {isCalculatingPurge ? 'Calculando...' : `${purgeEstimatedCount ?? 0} registros`}
                  </strong>
                </div>

                <label style={styles.purgeConfirmCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={purgeConfirmed}
                    onChange={(e) => setPurgeConfirmed(e.target.checked)}
                    style={styles.checkboxInput}
                  />
                  <span>
                    He verificado los criterios y confirmo que deseo eliminar estos registros permanentemente.
                  </span>
                </label>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  disabled={isPurging}
                  onClick={() => setShowPurgeModal(false)}
                  style={styles.purgeCancelBtn}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={!purgeConfirmed || isPurging || (purgeEstimatedCount === 0)}
                  onClick={() => void handleExecutePurge()}
                  style={{
                    ...styles.purgeConfirmActionBtn,
                    opacity: !purgeConfirmed || isPurging || purgeEstimatedCount === 0 ? 0.5 : 1,
                    cursor: !purgeConfirmed || isPurging || purgeEstimatedCount === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Trash2 size={16} />
                  <span>{isPurging ? 'Eliminando...' : `Eliminar ${purgeEstimatedCount ?? 0} registros ahora`}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox para fotos de placas */}
        {lightboxImageUrl && (
          <div style={styles.lightboxOverlay} onClick={() => setLightboxImageUrl(null)}>
            <div style={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setLightboxImageUrl(null)}
                style={styles.closeLightboxBtn}
                aria-label="Cerrar imagen"
              >
                <X size={24} />
              </button>
              <img src={lightboxImageUrl} alt="Placa ampliada" style={styles.lightboxImg} />
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

const styles: Record<string, any> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
    fontFamily: "'Inter', 'Segoe UI', -apple-system, sans-serif",
  },
  main: {
    maxWidth: '1280px',
    width: '100%',
    margin: '0 auto',
    padding: '24px 16px 56px',
    boxSizing: 'border-box',
    flex: 1,
    position: 'relative',
  },
  toastNotification: {
    position: 'fixed',
    top: '24px',
    right: '24px',
    color: '#ffffff',
    padding: '12px 18px',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    zIndex: 100001,
    fontSize: '0.92em',
    fontWeight: 600,
  },
  closeToastBtn: {
    background: 'transparent',
    border: 'none',
    color: '#ffffff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
  },
  topNavRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '20px',
  },
  topActionsRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  actionIconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: '#ffffff',
    border: '1.5px solid #e2e8f0',
    borderRadius: '10px',
    color: '#475569',
    fontSize: '0.86em',
    fontWeight: 600,
    cursor: 'pointer',
  },
  exportBtnCsv: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    border: 'none',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '0.86em',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
  },
  exportBtnJson: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
    border: 'none',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '0.86em',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
  },
  purgeOpenBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
    border: 'none',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '0.86em',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
  },
  specificHeaderCard: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    borderRadius: '18px',
    padding: '28px 32px',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '20px',
    marginBottom: '24px',
    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.2)',
    border: '1px solid #334155',
  },
  specificHeaderLeft: {
    flex: 1,
    minWidth: '280px',
  },
  specificBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
    borderRadius: '999px',
    fontSize: '0.78em',
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    marginBottom: '10px',
  },
  specificTitle: {
    fontSize: '1.65em',
    fontWeight: 800,
    color: '#ffffff',
    margin: '0 0 8px',
    lineHeight: 1.3,
  },
  specificSubtitle: {
    fontSize: '0.94em',
    color: '#cbd5e1',
    margin: 0,
    lineHeight: 1.5,
    maxWidth: '780px',
  },
  specificHeaderRight: {
    display: 'flex',
    alignItems: 'center',
  },
  backToGeneralBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    background: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    color: '#0f172a',
    fontSize: '0.88em',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    transition: 'transform 0.15s ease',
  },
  headerHero: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '24px 28px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)',
    marginBottom: '24px',
  },
  badgeTopHero: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    background: '#e0f2fe',
    borderRadius: '999px',
    color: '#0284c7',
    fontSize: '0.78em',
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  heroTitle: {
    fontSize: '1.75em',
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 6px',
  },
  heroSubtitle: {
    fontSize: '0.98em',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.5,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  metricCard: {
    background: '#ffffff',
    borderRadius: '14px',
    padding: '18px 20px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.02)',
  },
  metricIconWrap: (bg: string) => ({
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }),
  metricLabel: {
    display: 'block',
    fontSize: '0.78em',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  metricNumber: {
    fontSize: '1.65em',
    fontWeight: 800,
    color: '#0f172a',
    margin: '2px 0',
  },
  metricSub: {
    fontSize: '0.8em',
    color: '#94a3b8',
  },
  filtersSection: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '20px 22px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)',
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  filtersTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    flexWrap: 'wrap',
  },
  searchWrap: {
    position: 'relative',
    flex: 1,
    minWidth: '280px',
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '11px 40px 11px 42px',
    border: '1.5px solid #cbd5e1',
    borderRadius: '12px',
    fontSize: '0.92em',
    fontFamily: 'inherit',
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#f8fafc',
  },
  clearSearchBtn: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: '#e2e8f0',
    border: 'none',
    borderRadius: '50%',
    width: '22px',
    height: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#475569',
  },
  datePresetRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  presetBtn: {
    padding: '7px 12px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '0.82em',
    cursor: 'pointer',
  },
  categoriesRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    paddingTop: '8px',
    borderTop: '1px solid #f1f5f9',
  },
  filterGroupLabel: {
    fontSize: '0.84em',
    fontWeight: 700,
    color: '#475569',
  },
  categoryPillsWrap: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  catPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    border: '1.5px solid',
    fontSize: '0.82em',
    fontWeight: 600,
    cursor: 'pointer',
  },
  dropdownsGridRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
    alignItems: 'flex-end',
    paddingTop: '8px',
    borderTop: '1px solid #f1f5f9',
  },
  dropdownFieldWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  dropdownLabel: {
    fontSize: '0.82em',
    fontWeight: 700,
    color: '#475569',
  },
  selectDropdown: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#f8fafc',
    fontSize: '0.88em',
    color: '#0f172a',
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
  },
  timelineContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  timelineHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 4px',
  },
  timelineTitle: {
    fontSize: '1.25em',
    fontWeight: 800,
    color: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: 0,
  },
  timelineBadgeCount: {
    fontSize: '0.7em',
    background: '#e0f2fe',
    color: '#0284c7',
    padding: '2px 8px',
    borderRadius: '999px',
    fontWeight: 700,
  },
  pageSubtitleSmall: {
    fontSize: '0.84em',
    color: '#64748b',
  },
  loadingBox: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '48px 24px',
    textAlign: 'center',
    border: '1px solid #e2e8f0',
  },
  spinner: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '4px solid #e2e8f0',
    borderTopColor: '#0284c7',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 12px',
  },
  loadingText: {
    color: '#64748b',
    fontSize: '0.94em',
    margin: 0,
  },
  emptyStateBox: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '56px 24px',
    textAlign: 'center',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  emptyTitle: {
    fontSize: '1.15em',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  emptySubtitle: {
    fontSize: '0.9em',
    color: '#64748b',
    maxWidth: '440px',
    margin: 0,
    lineHeight: 1.5,
  },
  emptyResetBtn: {
    marginTop: '8px',
    padding: '8px 16px',
    background: '#0284c7',
    border: 'none',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '0.86em',
    fontWeight: 600,
    cursor: 'pointer',
  },
  logsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  auditCard: {
    background: '#ffffff',
    borderRadius: '14px',
    padding: '16px 20px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.02)',
  },
  cardThumbnailWrap: {
    width: '68px',
    height: '68px',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '2px solid #e2e8f0',
    flexShrink: 0,
    position: 'relative',
    cursor: 'pointer',
    background: '#f8fafc',
  },
  cardThumbnailImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  thumbnailOverlayBadge: {
    position: 'absolute',
    bottom: '3px',
    right: '3px',
    background: 'rgba(15, 23, 42, 0.75)',
    borderRadius: '4px',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLeftBadge: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1.5px solid',
    flexShrink: 0,
  },
  cardMainContent: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap',
  },
  actorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  actorAvatar: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
    color: '#ffffff',
    fontSize: '0.78em',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actorRealName: {
    fontSize: '0.94em',
    fontWeight: 700,
    color: '#0f172a',
  },
  actorUsername: {
    fontSize: '0.8em',
    color: '#64748b',
    marginLeft: '6px',
  },
  roleTag: {
    fontSize: '0.72em',
    fontWeight: 700,
    background: '#f1f5f9',
    color: '#475569',
    padding: '2px 6px',
    borderRadius: '6px',
    marginLeft: '6px',
  },
  timeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.8em',
    color: '#64748b',
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  actionBadge: {
    padding: '3px 8px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '0.76em',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  actionSentence: {
    margin: 0,
    fontSize: '0.94em',
    color: '#334155',
  },
  actionVerb: {
    color: '#64748b',
  },
  resourceName: {
    color: '#0f172a',
    fontWeight: 700,
  },
  resourceId: {
    color: '#94a3b8',
    fontSize: '0.85em',
  },
  quickDetailsPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  detailPillSubtema: {
    fontSize: '0.8em',
    background: '#e0e7ff',
    color: '#3730a3',
    padding: '3px 9px',
    borderRadius: '8px',
    border: '1px solid #c7d2fe',
  },
  detailPillTema: {
    fontSize: '0.8em',
    background: '#dbeafe',
    color: '#1e40af',
    padding: '3px 9px',
    borderRadius: '8px',
    border: '1px solid #bfdbfe',
  },
  detailPillAumento: {
    fontSize: '0.8em',
    background: '#dcfce7',
    color: '#166534',
    padding: '3px 9px',
    borderRadius: '8px',
    border: '1px solid #bbf7d0',
  },
  detailPillTincion: {
    fontSize: '0.8em',
    background: '#fef3c7',
    color: '#92400e',
    padding: '3px 9px',
    borderRadius: '8px',
    border: '1px solid #fde68a',
  },
  detailPill: {
    fontSize: '0.8em',
    background: '#f1f5f9',
    color: '#475569',
    padding: '3px 9px',
    borderRadius: '8px',
  },
  commentExcerpt: {
    margin: '4px 0 0',
    fontSize: '0.86em',
    color: '#475569',
    background: '#f8fafc',
    padding: '6px 10px',
    borderRadius: '8px',
    borderLeft: '3px solid #0284c7',
  },
  cardActionsRight: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  detailsModalBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 12px',
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '8px',
    color: '#0284c7',
    fontSize: '0.84em',
    fontWeight: 600,
    cursor: 'pointer',
  },
  paginationRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '16px',
    padding: '12px 0',
  },
  pageBtn: {
    padding: '8px 16px',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    fontSize: '0.86em',
    fontWeight: 600,
    cursor: 'pointer',
  },
  pageIndicator: {
    fontSize: '0.88em',
    color: '#475569',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px',
  },
  modalContent: {
    background: '#ffffff',
    borderRadius: '18px',
    maxWidth: '780px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalBadgeIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purgeModalIconWrap: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: '1.15em',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
  },
  modalSubtitle: {
    fontSize: '0.82em',
    color: '#64748b',
  },
  closeModalBtn: {
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#475569',
  },
  modalBody: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  summaryBanner: {
    background: '#f0f9ff',
    border: '1.5px solid #bae6fd',
    borderRadius: '12px',
    padding: '14px 18px',
  },
  summaryBannerText: {
    margin: 0,
    fontSize: '1em',
    color: '#0f172a',
    lineHeight: 1.4,
  },
  navigationHubCard: {
    background: '#f8fafc',
    borderRadius: '14px',
    border: '1.5px solid #e2e8f0',
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  navigationHubTitle: {
    fontSize: '0.86em',
    fontWeight: 700,
    color: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  navigationButtonsGrid: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  navActionBtnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
    border: 'none',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '0.86em',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
  },
  navActionBtnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: '#ffffff',
    border: '1.5px solid #cbd5e1',
    borderRadius: '10px',
    color: '#334155',
    fontSize: '0.86em',
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalHeroImageCard: {
    background: '#f8fafc',
    borderRadius: '14px',
    border: '1.5px solid #e2e8f0',
    overflow: 'hidden',
  },
  modalHeroImageHeader: {
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #e2e8f0',
    background: '#ffffff',
  },
  modalHeroImageTitle: {
    fontSize: '0.86em',
    fontWeight: 700,
    color: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  heroZoomBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    color: '#334155',
    fontSize: '0.78em',
    fontWeight: 600,
    cursor: 'pointer',
  },
  openExternalLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.8em',
    color: '#0284c7',
    fontWeight: 600,
    textDecoration: 'none',
    padding: '4px 8px',
  },
  modalHeroImageWrap: {
    maxHeight: '340px',
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'zoom-in',
  },
  modalHeroImg: {
    maxWidth: '100%',
    maxHeight: '340px',
    objectFit: 'contain',
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
  },
  modalInfoCard: {
    background: '#f8fafc',
    borderRadius: '12px',
    padding: '14px 16px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  modalInfoLabel: {
    fontSize: '0.76em',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  modalInfoValue: {
    fontSize: '1em',
    fontWeight: 700,
    color: '#0f172a',
  },
  modalInfoSub: {
    fontSize: '0.82em',
    color: '#64748b',
  },
  commentBox: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '12px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  commentBoxText: {
    margin: 0,
    fontSize: '0.94em',
    color: '#92400e',
    lineHeight: 1.5,
  },
  jsonAccordion: {
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '10px 14px',
  },
  jsonSummary: {
    fontSize: '0.84em',
    fontWeight: 600,
    color: '#64748b',
    cursor: 'pointer',
    outline: 'none',
  },
  jsonPre: {
    background: '#0f172a',
    color: '#38bdf8',
    padding: '14px',
    borderRadius: '8px',
    fontSize: '0.82em',
    overflowX: 'auto',
    marginTop: '10px',
    fontFamily: "'Fira Code', 'Consolas', monospace",
  },
  modalFooter: {
    padding: '16px 24px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '10px',
  },
  copySummaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 14px',
    background: '#f1f5f9',
    border: '1.5px solid #cbd5e1',
    borderRadius: '10px',
    color: '#334155',
    fontSize: '0.86em',
    fontWeight: 600,
    cursor: 'pointer',
  },
  deleteSingleLogBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 14px',
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: '10px',
    color: '#dc2626',
    fontSize: '0.86em',
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalCloseFooterBtn: {
    padding: '10px 20px',
    background: '#0f172a',
    border: 'none',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '0.9em',
    fontWeight: 600,
    cursor: 'pointer',
  },
  purgeWarningBox: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '12px',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  purgeOptionGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  purgeGroupLabel: {
    fontSize: '0.88em',
    fontWeight: 700,
    color: '#0f172a',
  },
  purgeModePills: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  purgeModeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1.5px solid',
    fontSize: '0.84em',
    fontWeight: 600,
    cursor: 'pointer',
  },
  purgeDatesRow: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap',
  },
  purgeDateInput: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#f8fafc',
    fontSize: '0.88em',
    color: '#0f172a',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  purgeScopeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },
  purgeCountBanner: {
    background: '#f1f5f9',
    borderRadius: '12px',
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    border: '1px solid #e2e8f0',
  },
  purgeCountLabel: {
    fontSize: '0.88em',
    color: '#475569',
    fontWeight: 600,
  },
  purgeCountNumber: {
    fontSize: '1.15em',
    fontWeight: 800,
    color: '#dc2626',
  },
  purgeConfirmCheckboxLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    cursor: 'pointer',
    fontSize: '0.88em',
    color: '#334155',
    lineHeight: 1.4,
    userSelect: 'none',
  },
  checkboxInput: {
    marginTop: '3px',
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  purgeCancelBtn: {
    padding: '10px 18px',
    background: '#f1f5f9',
    border: '1.5px solid #e2e8f0',
    borderRadius: '10px',
    color: '#475569',
    fontSize: '0.88em',
    fontWeight: 600,
    cursor: 'pointer',
  },
  purgeConfirmActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
    border: 'none',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '0.9em',
    fontWeight: 700,
    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
  },
  lightboxOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.9)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100000,
    padding: '24px',
    cursor: 'zoom-out',
  },
  lightboxContent: {
    position: 'relative',
    maxWidth: '92vw',
    maxHeight: '92vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLightboxBtn: {
    position: 'absolute',
    top: '-40px',
    right: '0',
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    cursor: 'pointer',
  },
  lightboxImg: {
    maxWidth: '90vw',
    maxHeight: '85vh',
    objectFit: 'contain',
    borderRadius: '10px',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
  },
};

export default HistorialAuditoria;
