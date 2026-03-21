import React, { useEffect, useMemo, useState } from 'react';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { supabase } from '../services/supabase';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import {
  clearAllAnalyticsEvents,
  fetchAnalyticsEvents,
  type AnalyticsEvent,
  type AnalyticsEventType,
  type AnalyticsRangePreset,
} from '../services/analytics';
import { useAuth } from '../contexts/AuthContext';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';

type BucketBy = 'year' | 'month' | 'week' | 'day';
type EventFilter = 'all' | AnalyticsEventType;

interface TemaRef {
  id: number;
  nombre: string;
}

interface SubtemaRef {
  id: number;
  nombre: string;
}

interface EntityVisitRow {
  label: string;
  views: number;
  visitors: number;
}

interface PlateActivityLog {
  id: number;
  action_type:
    | 'upload_classified'
    | 'upload_unclassified'
    | 'classify_waiting_plate'
    | 'edit_plate'
    | 'delete_classified'
    | 'delete_unclassified';
  placa_id: number | null;
  waiting_plate_id: number | null;
  target_table: 'placas' | 'placas_sin_clasificar';
  actor_user_id: number | null;
  actor_username: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface PlateRef {
  id: number;
  photo_url: string;
  tema_id: number | null;
  subtema_id: number | null;
}

interface WaitingPlateRef {
  id: number;
  photo_url: string;
}

const RANGE_OPTIONS: Array<{ key: AnalyticsRangePreset; label: string }> = [
  { key: 'all', label: 'Desde siempre' },
  { key: 'year', label: 'Este anio' },
  { key: 'month', label: 'Este mes' },
  { key: 'week', label: 'Esta semana' },
  { key: 'day', label: 'Hoy' },
];

const BUCKET_OPTIONS: Array<{ key: BucketBy; label: string }> = [
  { key: 'year', label: 'Por anio' },
  { key: 'month', label: 'Por mes' },
  { key: 'week', label: 'Por semana' },
  { key: 'day', label: 'Por dia' },
];

const EVENT_FILTER_OPTIONS: Array<{ key: EventFilter; label: string }> = [
  { key: 'all', label: 'Todos los eventos' },
  { key: 'site_visit', label: 'Visitas al sitio' },
  { key: 'tema_view', label: 'Consultas de tema' },
  { key: 'subtema_view', label: 'Consultas de subtema' },
  { key: 'placa_view', label: 'Consultas de placa' },
];

const EVENT_TYPE_LABEL: Record<AnalyticsEventType, string> = {
  site_visit: 'Visita',
  tema_view: 'Tema',
  subtema_view: 'Subtema',
  placa_view: 'Placa',
};

const PLATE_ACTION_LABEL: Record<PlateActivityLog['action_type'], string> = {
  upload_classified: 'Subio placa clasificada',
  upload_unclassified: 'Subio placa sin clasificar',
  classify_waiting_plate: 'Clasifico placa de lista de espera',
  edit_plate: 'Edito/Reasigno placa',
  delete_classified: 'Elimino placa clasificada',
  delete_unclassified: 'Elimino placa sin clasificar',
};

const UPLOAD_ACTIONS: PlateActivityLog['action_type'][] = [
  'upload_classified',
  'upload_unclassified',
  'classify_waiting_plate',
];

const DELETE_ACTIONS: PlateActivityLog['action_type'][] = [
  'delete_classified',
  'delete_unclassified',
];

const PAGE_SIZE = 20;

const formatBucket = (date: Date, bucketBy: BucketBy): string => {
  if (bucketBy === 'year') {
    return String(date.getFullYear());
  }

  if (bucketBy === 'month') {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}`;
  }

  if (bucketBy === 'week') {
    const current = new Date(date);
    const day = current.getDay();
    const diffToMonday = (day + 6) % 7;
    current.setDate(current.getDate() - diffToMonday);
    const month = `${current.getMonth() + 1}`.padStart(2, '0');
    const dayOfMonth = `${current.getDate()}`.padStart(2, '0');
    return `Semana ${current.getFullYear()}-${month}-${dayOfMonth}`;
  }

  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const dayOfMonth = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${dayOfMonth}`;
};

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toCsvSafe = (value: string | number | null): string => {
  const text = value == null ? '' : String(value);
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
};

const toDayStart = (value: string): number => new Date(`${value}T00:00:00`).getTime();
const toDayEnd = (value: string): number => new Date(`${value}T23:59:59.999`).getTime();

const aggregateEntityVisits = (
  events: AnalyticsEvent[],
  eventType: AnalyticsEventType,
  idSelector: (event: AnalyticsEvent) => number | null,
  labelSelector: (id: number) => string,
  limit: number,
): EntityVisitRow[] => {
  const totals = new Map<number, { views: number; visitors: Set<string> }>();

  events.forEach((event) => {
    if (event.event_type !== eventType) {
      return;
    }

    const id = idSelector(event);
    if (!id) {
      return;
    }

    const current = totals.get(id) ?? { views: 0, visitors: new Set<string>() };
    current.views += 1;
    current.visitors.add(event.visitor_id);
    totals.set(id, current);
  });

  return Array.from(totals.entries())
    .map(([id, data]) => ({
      label: labelSelector(id),
      views: data.views,
      visitors: data.visitors.size,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
};

const Estadisticas: React.FC = () => {
  const { user } = useAuth();
  const [range, setRange] = useState<AnalyticsRangePreset>('all');
  const [bucketBy, setBucketBy] = useState<BucketBy>('month');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [visitorFilter, setVisitorFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [topLimit, setTopLimit] = useState(10);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [plateHistory, setPlateHistory] = useState<PlateActivityLog[]>([]);
  const [plateRefs, setPlateRefs] = useState<Map<number, PlateRef>>(new Map());
  const [waitingPlateRefs, setWaitingPlateRefs] = useState<Map<number, WaitingPlateRef>>(new Map());
  const [loadingPlateHistory, setLoadingPlateHistory] = useState(true);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [temasRef, setTemasRef] = useState<TemaRef[]>([]);
  const [subtemasRef, setSubtemasRef] = useState<SubtemaRef[]>([]);

  const canResetStats = user?.is_protected === true;

  const loadAnalytics = async () => {
    setLoading(true);
    const data = await fetchAnalyticsEvents(range);
    setEvents(data);
    setLoading(false);
  };

  const loadPlateHistory = async () => {
    setLoadingPlateHistory(true);
    const { data, error } = await supabase
      .from('placas_activity_logs')
      .select('id, action_type, placa_id, waiting_plate_id, target_table, actor_user_id, actor_username, details, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error || !data) {
      setPlateHistory([]);
      setPlateRefs(new Map());
      setWaitingPlateRefs(new Map());
      setLoadingPlateHistory(false);
      return;
    }

    const logs = data as PlateActivityLog[];
    setPlateHistory(logs);

    const placaIds = Array.from(new Set(logs.map((log) => log.placa_id).filter((id): id is number => typeof id === 'number')));
    const waitingIds = Array.from(new Set(logs.map((log) => log.waiting_plate_id).filter((id): id is number => typeof id === 'number')));

    const [placasRes, waitingRes] = await Promise.all([
      placaIds.length > 0
        ? supabase
            .from('placas')
            .select('id, photo_url, tema_id, subtema_id')
            .in('id', placaIds)
        : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: unknown }),
      waitingIds.length > 0
        ? supabase
            .from('placas_sin_clasificar')
            .select('id, photo_url')
            .in('id', waitingIds)
        : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: unknown }),
    ]);

    const plateMap = new Map<number, PlateRef>();
    ((placasRes.data ?? []) as PlateRef[]).forEach((row) => {
      plateMap.set(row.id, row);
    });
    setPlateRefs(plateMap);

    const waitingMap = new Map<number, WaitingPlateRef>();
    ((waitingRes.data ?? []) as WaitingPlateRef[]).forEach((row) => {
      waitingMap.set(row.id, row);
    });
    setWaitingPlateRefs(waitingMap);

    setLoadingPlateHistory(false);
  };

  useEffect(() => {
    const loadRefs = async () => {
      const [{ data: temas }, { data: subtemas }] = await Promise.all([
        supabase.from('temas').select('id, nombre'),
        supabase.from('subtemas').select('id, nombre'),
      ]);

      setTemasRef((temas ?? []) as TemaRef[]);
      setSubtemasRef((subtemas ?? []) as SubtemaRef[]);
    };

    void loadRefs();
    void loadPlateHistory();
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [range]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const timerId = window.setInterval(() => {
      void loadAnalytics();
      void loadPlateHistory();
    }, 30000);
    return () => window.clearInterval(timerId);
  }, [autoRefresh, range]);

  const handleResetStats = async () => {
    const confirmed = window.confirm('Esto eliminara todas las estadisticas del sitio. Deseas continuar?');
    if (!confirmed) {
      return;
    }

    setResetting(true);
    const result = await clearAllAnalyticsEvents();
    setResetting(false);

    if (!result.ok) {
      window.alert(`No fue posible reiniciar las estadisticas: ${result.error ?? 'error desconocido'}`);
      return;
    }

    await loadAnalytics();
  };

  const handleClearExtraFilters = () => {
    setVisitorFilter('');
    setDateFrom('');
    setDateTo('');
    setEventFilter('all');
    setCurrentPage(1);
  };

  const uploadsHistory = useMemo(
    () => plateHistory.filter((log) => UPLOAD_ACTIONS.includes(log.action_type)).slice(0, 25),
    [plateHistory],
  );

  const editsHistory = useMemo(
    () => plateHistory.filter((log) => log.action_type === 'edit_plate').slice(0, 25),
    [plateHistory],
  );

  const deletesHistory = useMemo(
    () => plateHistory.filter((log) => DELETE_ACTIONS.includes(log.action_type)).slice(0, 25),
    [plateHistory],
  );

  const temaMap = useMemo(() => new Map(temasRef.map((t) => [t.id, t.nombre])), [temasRef]);
  const subtemaMap = useMemo(() => new Map(subtemasRef.map((s) => [s.id, s.nombre])), [subtemasRef]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (eventFilter !== 'all' && event.event_type !== eventFilter) {
        return false;
      }

      if (visitorFilter.trim()) {
        const visitorNeedle = visitorFilter.trim().toLowerCase();
        if (!event.visitor_id.toLowerCase().includes(visitorNeedle)) {
          return false;
        }
      }

      const createdAt = new Date(event.created_at).getTime();

      if (dateFrom) {
        const start = toDayStart(dateFrom);
        if (createdAt < start) {
          return false;
        }
      }

      if (dateTo) {
        const end = toDayEnd(dateTo);
        if (createdAt > end) {
          return false;
        }
      }

      return true;
    });
  }, [events, eventFilter, visitorFilter, dateFrom, dateTo]);

  useEffect(() => {
    setCurrentPage(1);
  }, [eventFilter, visitorFilter, dateFrom, dateTo, range]);

  const totalVisits = filteredEvents.filter((event) => event.event_type === 'site_visit').length;
  const uniqueVisitors = useMemo(() => new Set(filteredEvents.map((event) => event.visitor_id)).size, [filteredEvents]);
  const temaViewsTotal = filteredEvents.filter((event) => event.event_type === 'tema_view').length;
  const subtemaViewsTotal = filteredEvents.filter((event) => event.event_type === 'subtema_view').length;
  const placaViews = filteredEvents.filter((event) => event.event_type === 'placa_view').length;
  const avgEventsPerVisitor = uniqueVisitors === 0 ? 0 : filteredEvents.length / uniqueVisitors;
  const placaConversionRate = totalVisits === 0 ? 0 : (placaViews / totalVisits) * 100;

  const visitsByBucket = useMemo(() => {
    const bucketCounter = new Map<string, number>();

    filteredEvents.forEach((event) => {
      if (event.event_type !== 'site_visit') {
        return;
      }

      const date = new Date(event.created_at);
      const bucket = formatBucket(date, bucketBy);
      bucketCounter.set(bucket, (bucketCounter.get(bucket) ?? 0) + 1);
    });

    return Array.from(bucketCounter.entries())
      .map(([bucket, count]) => ({ bucket, count }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));
  }, [filteredEvents, bucketBy]);

  const maxBucketCount = visitsByBucket.reduce((max, row) => Math.max(max, row.count), 0);

  const temaInsights = useMemo(
    () => aggregateEntityVisits(
      filteredEvents,
      'tema_view',
      (e) => e.tema_id,
      (id) => temaMap.get(id) ?? `Tema ID ${id}`,
      topLimit,
    ),
    [filteredEvents, temaMap, topLimit],
  );

  const subtemaInsights = useMemo(
    () => aggregateEntityVisits(
      filteredEvents,
      'subtema_view',
      (e) => e.subtema_id,
      (id) => subtemaMap.get(id) ?? `Subtema ID ${id}`,
      topLimit,
    ),
    [filteredEvents, subtemaMap, topLimit],
  );

  const placaInsights = useMemo(
    () => aggregateEntityVisits(
      filteredEvents,
      'placa_view',
      (e) => e.placa_id,
      (id) => `Placa #${id}`,
      topLimit,
    ),
    [filteredEvents, topLimit],
  );

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const pagedEvents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEvents.slice(start, start + PAGE_SIZE);
  }, [filteredEvents, currentPage]);

  const resolveTarget = (event: AnalyticsEvent): string => {
    if (event.event_type === 'tema_view') {
      return event.tema_id ? (temaMap.get(event.tema_id) ?? `Tema ID ${event.tema_id}`) : '-';
    }
    if (event.event_type === 'subtema_view') {
      return event.subtema_id ? (subtemaMap.get(event.subtema_id) ?? `Subtema ID ${event.subtema_id}`) : '-';
    }
    if (event.event_type === 'placa_view') {
      return event.placa_id ? `Placa #${event.placa_id}` : '-';
    }
    return '-';
  };

  const exportCsv = () => {
    const lines = [
      ['fecha_hora', 'tipo_evento', 'visitante', 'tema_id', 'subtema_id', 'placa_id'].join(','),
      ...filteredEvents.map((event) => [
        toCsvSafe(event.created_at),
        toCsvSafe(event.event_type),
        toCsvSafe(event.visitor_id),
        toCsvSafe(event.tema_id),
        toCsvSafe(event.subtema_id),
        toCsvSafe(event.placa_id),
      ].join(',')),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `atlas_estadisticas_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatHistoryTarget = (log: PlateActivityLog): string => {
    if (log.target_table === 'placas') {
      return log.placa_id ? `Placa #${log.placa_id}` : 'Placa no identificada';
    }
    return log.waiting_plate_id ? `Espera #${log.waiting_plate_id}` : 'Placa en espera';
  };

  const formatHistoryActor = (log: PlateActivityLog): string => {
    if (log.actor_username && log.actor_user_id) {
      return `${log.actor_username} (#${log.actor_user_id})`;
    }
    if (log.actor_username) {
      return log.actor_username;
    }
    if (log.actor_user_id) {
      return `Usuario #${log.actor_user_id}`;
    }
    return 'Usuario no identificado';
  };

  const toggleHistoryDetails = (id: number) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const shouldShowThumbnail = (log: PlateActivityLog): boolean => {
    return (
      log.action_type === 'upload_classified' ||
      log.action_type === 'classify_waiting_plate' ||
      log.action_type === 'edit_plate'
    );
  };

  const shouldShowTemaSubtema = (log: PlateActivityLog): boolean => {
    return (
      log.action_type === 'upload_classified' ||
      log.action_type === 'classify_waiting_plate' ||
      log.action_type === 'edit_plate' ||
      log.action_type === 'delete_classified' ||
      log.action_type === 'delete_unclassified'
    );
  };

  const getHistoryPlateThumb = (log: PlateActivityLog): string | null => {
    if (log.placa_id) {
      const plate = plateRefs.get(log.placa_id);
      if (plate?.photo_url) {
        return getCloudinaryImageUrl(plate.photo_url, 'thumb');
      }
    }

    if (log.waiting_plate_id) {
      const waiting = waitingPlateRefs.get(log.waiting_plate_id);
      if (waiting?.photo_url) {
        return getCloudinaryImageUrl(waiting.photo_url, 'thumb');
      }
    }

    return null;
  };

  const getHistoryTemaSubtema = (log: PlateActivityLog): { tema: string; subtema: string } => {
    const details = (log.details ?? {}) as Record<string, unknown>;
    const detailsTemaId = Number(details.tema_id);
    const detailsSubtemaId = Number(details.subtema_id);
    const fromTemaId = Number(details.from_tema_id);
    const fromSubtemaId = Number(details.from_subtema_id);
    const plate = log.placa_id ? plateRefs.get(log.placa_id) : undefined;

    if (log.action_type === 'upload_unclassified' || log.action_type === 'delete_unclassified') {
      return {
        tema: 'Sin tema asignado (lista de espera)',
        subtema: 'Sin subtema asignado (lista de espera)',
      };
    }

    // Para edicion, mostrar pertenencia original (antes del cambio).
    if (log.action_type === 'edit_plate') {
      const temaId = !Number.isNaN(fromTemaId)
        ? fromTemaId
        : (!Number.isNaN(detailsTemaId) ? detailsTemaId : (plate?.tema_id ?? null));
      const subtemaId = !Number.isNaN(fromSubtemaId)
        ? fromSubtemaId
        : (!Number.isNaN(detailsSubtemaId) ? detailsSubtemaId : (plate?.subtema_id ?? null));

      return {
        tema: temaId ? (temaMap.get(temaId) ?? `Tema ID ${temaId}`) : 'Tema no identificado',
        subtema: subtemaId ? (subtemaMap.get(subtemaId) ?? `Subtema ID ${subtemaId}`) : 'Subtema no identificado',
      };
    }

    // Para borrado clasificado, usar snapshot guardado al eliminar.
    if (log.action_type === 'delete_classified') {
      const temaId = !Number.isNaN(detailsTemaId) ? detailsTemaId : (plate?.tema_id ?? null);
      const subtemaId = !Number.isNaN(detailsSubtemaId) ? detailsSubtemaId : (plate?.subtema_id ?? null);

      return {
        tema: temaId ? (temaMap.get(temaId) ?? `Tema ID ${temaId}`) : 'Tema no identificado',
        subtema: subtemaId ? (subtemaMap.get(subtemaId) ?? `Subtema ID ${subtemaId}`) : 'Subtema no identificado',
      };
    }

    const temaId = !Number.isNaN(detailsTemaId) ? detailsTemaId : (plate?.tema_id ?? null);
    const subtemaId = !Number.isNaN(detailsSubtemaId) ? detailsSubtemaId : (plate?.subtema_id ?? null);

    return {
      tema: temaId ? (temaMap.get(temaId) ?? `Tema ID ${temaId}`) : 'Tema no identificado',
      subtema: subtemaId ? (subtemaMap.get(subtemaId) ?? `Subtema ID ${subtemaId}`) : 'Subtema no identificado',
    };
  };

  const handleGoBack = useSmartBackNavigation('/edicion');

  return (
    <div style={s.page}>
      <Header />

      <main style={s.main}>
                <BackButton onClick={handleGoBack} />

        <section style={s.card}>
          <div style={s.headerRow}>
            <h1 style={s.title}>Estadisticas del sitio</h1>
            <div style={s.filtersWrap}>
              <select value={range} onChange={(e) => setRange(e.target.value as AnalyticsRangePreset)} style={s.select}>
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
              <select value={bucketBy} onChange={(e) => setBucketBy(e.target.value as BucketBy)} style={s.select}>
                {BUCKET_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
              <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value as EventFilter)} style={s.select}>
                {EVENT_FILTER_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
              <select value={topLimit} onChange={(e) => setTopLimit(Number(e.target.value))} style={s.select}>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
              </select>
              <label style={s.switchLabel}>
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                Autoactualizar (30s)
              </label>
              <button
                type="button"
                style={s.ghostButton}
                onClick={() => {
                  void loadAnalytics();
                }}
                disabled={loading}
              >
                Actualizar ahora
              </button>
              <button
                type="button"
                style={s.ghostButton}
                onClick={exportCsv}
                disabled={filteredEvents.length === 0}
              >
                Exportar CSV
              </button>
              {canResetStats && (
                <button
                  type="button"
                  style={s.resetButton}
                  onClick={handleResetStats}
                  disabled={resetting}
                >
                  {resetting ? 'Reiniciando...' : 'Reiniciar estadisticas'}
                </button>
              )}
            </div>
          </div>

          <div style={s.advancedFiltersWrap}>
            <input
              type="text"
              value={visitorFilter}
              onChange={(e) => setVisitorFilter(e.target.value)}
              placeholder="Filtrar por visitor_id"
              style={s.input}
            />
            <div style={s.dateFilterGroup}>
              <label style={s.smallLabel}>
                Desde
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={s.input}
                />
              </label>
              <label style={s.smallLabel}>
                Hasta
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={s.input}
                />
              </label>
            </div>
            <button type="button" style={s.ghostButton} onClick={handleClearExtraFilters}>
              Limpiar filtros
            </button>
          </div>

          {loading ? (
            <p style={s.loading}>Cargando estadisticas...</p>
          ) : (
            <>
              <div style={s.kpiGrid}>
                <div style={s.kpiCard}>
                  <span style={s.kpiLabel}>Personas que visitaron el sitio</span>
                  <strong style={s.kpiValue}>{uniqueVisitors}</strong>
                </div>
                <div style={s.kpiCard}>
                  <span style={s.kpiLabel}>Visitas al sitio</span>
                  <strong style={s.kpiValue}>{totalVisits}</strong>
                </div>
                <div style={s.kpiCard}>
                  <span style={s.kpiLabel}>Visitas a temas</span>
                  <strong style={s.kpiValue}>{temaViewsTotal}</strong>
                </div>
                <div style={s.kpiCard}>
                  <span style={s.kpiLabel}>Visitas a subtemas</span>
                  <strong style={s.kpiValue}>{subtemaViewsTotal}</strong>
                </div>
                <div style={s.kpiCard}>
                  <span style={s.kpiLabel}>Visitas a placas</span>
                  <strong style={s.kpiValue}>{placaViews}</strong>
                </div>
                <div style={s.kpiCard}>
                  <span style={s.kpiLabel}>Promedio eventos por persona</span>
                  <strong style={s.kpiValue}>{avgEventsPerVisitor.toFixed(2)}</strong>
                </div>
              </div>

              <div style={s.sectionBox}>
                <h2 style={s.sectionTitle}>Embudo general</h2>
                <div style={s.funnelGrid}>
                  <div style={s.funnelCard}>
                    <span style={s.funnelLabel}>Sitio</span>
                    <strong style={s.funnelValue}>{totalVisits}</strong>
                  </div>
                  <div style={s.funnelArrow}>→</div>
                  <div style={s.funnelCard}>
                    <span style={s.funnelLabel}>Temas</span>
                    <strong style={s.funnelValue}>{temaViewsTotal}</strong>
                  </div>
                  <div style={s.funnelArrow}>→</div>
                  <div style={s.funnelCard}>
                    <span style={s.funnelLabel}>Subtemas</span>
                    <strong style={s.funnelValue}>{subtemaViewsTotal}</strong>
                  </div>
                  <div style={s.funnelArrow}>→</div>
                  <div style={s.funnelCard}>
                    <span style={s.funnelLabel}>Placas</span>
                    <strong style={s.funnelValue}>{placaViews}</strong>
                  </div>
                </div>
                <p style={s.helperText}>
                  Tasa de paso sitio a placa: {placaConversionRate.toFixed(1)}%
                </p>
              </div>

              <div style={s.sectionBox}>
                <h2 style={s.sectionTitle}>Visitas por periodo</h2>
                {visitsByBucket.length === 0 ? (
                  <p style={s.emptyText}>Sin datos de visitas para el rango seleccionado.</p>
                ) : (
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Periodo</th>
                        <th style={s.th}>Visitas</th>
                        <th style={s.th}>Intensidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitsByBucket.map((row) => (
                        <tr key={row.bucket}>
                          <td style={s.td}>{row.bucket}</td>
                          <td style={s.td}>{row.count}</td>
                          <td style={s.td}>
                            <div style={s.barTrack}>
                              <div
                                style={{
                                  ...s.barFill,
                                  width: `${maxBucketCount === 0 ? 0 : (row.count / maxBucketCount) * 100}%`,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div style={s.chartGrid}>
                <EntityChartCard
                  title="Temas mas visitados"
                  subtitle="Visitas y personas unicas por tema"
                  rows={temaInsights}
                  accent="#2563eb"
                />
                <EntityChartCard
                  title="Subtemas mas visitados"
                  subtitle="Visitas y personas unicas por subtema"
                  rows={subtemaInsights}
                  accent="#0ea5e9"
                />
                <EntityChartCard
                  title="Placas mas visitadas"
                  subtitle="Visitas y personas unicas por placa"
                  rows={placaInsights}
                  accent="#14b8a6"
                />
              </div>

              <div style={s.sectionBox}>
                <div style={s.recentHeader}>
                  <h2 style={s.sectionTitle}>Eventos recientes</h2>
                  <span style={s.smallText}>Pagina {currentPage} de {totalPages}</span>
                </div>
                {pagedEvents.length === 0 ? (
                  <p style={s.emptyText}>No hay eventos con los filtros actuales.</p>
                ) : (
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Fecha y hora</th>
                        <th style={s.th}>Tipo</th>
                        <th style={s.th}>Objetivo</th>
                        <th style={s.th}>Visitante</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedEvents.map((event) => (
                        <tr key={event.id}>
                          <td style={s.td}>{formatDateTime(event.created_at)}</td>
                          <td style={s.td}>{EVENT_TYPE_LABEL[event.event_type]}</td>
                          <td style={s.td}>{resolveTarget(event)}</td>
                          <td style={s.td}>{event.visitor_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div style={s.paginationWrap}>
                  <button
                    type="button"
                    style={s.ghostButton}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    style={s.ghostButton}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                  </button>
                </div>
              </div>

              <div style={s.sectionBox}>
                <div style={s.recentHeader}>
                  <h2 style={s.sectionTitle}>Historial de cambios en placas</h2>
                  <span style={s.smallText}>Ultimos registros del sistema de edicion</span>
                </div>
                {loadingPlateHistory ? (
                  <p style={s.emptyText}>Cargando historial de cambios...</p>
                ) : (
                  <div style={s.auditGrid}>
                    <AuditHistoryCard
                      title="Quien subio"
                      rows={uploadsHistory}
                      emptyLabel="Sin subidas registradas aun."
                      formatActor={formatHistoryActor}
                      formatTarget={formatHistoryTarget}
                      expandedIds={expandedHistoryIds}
                      onToggle={toggleHistoryDetails}
                      shouldShowThumbnail={shouldShowThumbnail}
                      shouldShowTemaSubtema={shouldShowTemaSubtema}
                      getThumbUrl={getHistoryPlateThumb}
                      getTemaSubtema={getHistoryTemaSubtema}
                    />
                    <AuditHistoryCard
                      title="Quien edito"
                      rows={editsHistory}
                      emptyLabel="Sin ediciones registradas aun."
                      formatActor={formatHistoryActor}
                      formatTarget={formatHistoryTarget}
                      expandedIds={expandedHistoryIds}
                      onToggle={toggleHistoryDetails}
                      shouldShowThumbnail={shouldShowThumbnail}
                      shouldShowTemaSubtema={shouldShowTemaSubtema}
                      getThumbUrl={getHistoryPlateThumb}
                      getTemaSubtema={getHistoryTemaSubtema}
                    />
                    <AuditHistoryCard
                      title="Quien borro"
                      rows={deletesHistory}
                      emptyLabel="Sin borrados registrados aun."
                      formatActor={formatHistoryActor}
                      formatTarget={formatHistoryTarget}
                      expandedIds={expandedHistoryIds}
                      onToggle={toggleHistoryDetails}
                      shouldShowThumbnail={shouldShowThumbnail}
                      shouldShowTemaSubtema={shouldShowTemaSubtema}
                      getThumbUrl={getHistoryPlateThumb}
                      getTemaSubtema={getHistoryTemaSubtema}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

const EntityChartCard: React.FC<{
  title: string;
  subtitle: string;
  rows: EntityVisitRow[];
  accent: string;
}> = ({ title, subtitle, rows, accent }) => {
  const maxViews = rows.reduce((acc, row) => Math.max(acc, row.views), 0);
  const maxVisitors = rows.reduce((acc, row) => Math.max(acc, row.visitors), 0);

  return (
    <div style={s.entityCard}>
      <h3 style={s.rankTitle}>{title}</h3>
      <p style={s.entitySubtitle}>{subtitle}</p>
      {rows.length === 0 ? (
        <p style={s.emptyText}>Sin datos aun.</p>
      ) : (
        <div style={s.entityRowsWrap}>
          {rows.map((row) => (
            <div key={row.label} style={s.entityRow}>
              <div style={s.entityHead}>
                <span style={s.entityName}>{row.label}</span>
                <span style={s.entityStats}>Visitas: {row.views} | Personas: {row.visitors}</span>
              </div>
              <div style={s.metricRow}>
                <span style={s.metricLabel}>V</span>
                <div style={s.barTrackLarge}>
                  <div
                    style={{
                      ...s.barFill,
                      width: `${maxViews === 0 ? 0 : (row.views / maxViews) * 100}%`,
                      background: accent,
                    }}
                  />
                </div>
              </div>
              <div style={s.metricRow}>
                <span style={s.metricLabel}>P</span>
                <div style={s.barTrackLarge}>
                  <div
                    style={{
                      ...s.barFill,
                      width: `${maxVisitors === 0 ? 0 : (row.visitors / maxVisitors) * 100}%`,
                      background: '#64748b',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AuditHistoryCard: React.FC<{
  title: string;
  rows: PlateActivityLog[];
  emptyLabel: string;
  formatActor: (row: PlateActivityLog) => string;
  formatTarget: (row: PlateActivityLog) => string;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  shouldShowThumbnail: (row: PlateActivityLog) => boolean;
  shouldShowTemaSubtema: (row: PlateActivityLog) => boolean;
  getThumbUrl: (row: PlateActivityLog) => string | null;
  getTemaSubtema: (row: PlateActivityLog) => { tema: string; subtema: string };
}> = ({
  title,
  rows,
  emptyLabel,
  formatActor,
  formatTarget,
  expandedIds,
  onToggle,
  shouldShowThumbnail,
  shouldShowTemaSubtema,
  getThumbUrl,
  getTemaSubtema,
}) => {
  return (
    <div style={s.auditCard}>
      <h3 style={s.rankTitle}>{title}</h3>
      {rows.length === 0 ? (
        <p style={s.emptyText}>{emptyLabel}</p>
      ) : (
        <div style={s.auditList}>
          {rows.map((row) => (
            <div key={row.id} style={s.auditItem}>
              <div style={s.auditTopLine}>
                <strong style={s.auditActor}>{formatActor(row)}</strong>
                <span style={s.auditTime}>{formatDateTime(row.created_at)}</span>
              </div>
              <div style={s.auditBottomLine}>
                <span>{PLATE_ACTION_LABEL[row.action_type]}</span>
                <span>{formatTarget(row)}</span>
              </div>
              <button
                type="button"
                style={s.auditDetailsButton}
                onClick={() => onToggle(row.id)}
              >
                {expandedIds.has(row.id) ? 'Ocultar detalles' : 'Ver detalles'}
              </button>

              {expandedIds.has(row.id) && (
                <div style={s.auditDetailsBox}>
                  <div style={s.auditDetailsRow}><strong>Usuario:</strong> {formatActor(row)}</div>
                  <div style={s.auditDetailsRow}><strong>Fecha:</strong> {formatDateTime(row.created_at)}</div>
                  <div style={s.auditDetailsRow}><strong>Accion:</strong> {PLATE_ACTION_LABEL[row.action_type]}</div>
                  <div style={s.auditDetailsRow}><strong>Objetivo:</strong> {formatTarget(row)}</div>

                  {shouldShowThumbnail(row) && (
                    <>
                      {getThumbUrl(row) ? (
                        <img
                          src={getThumbUrl(row) as string}
                          alt="Miniatura de placa"
                          style={s.auditThumb}
                        />
                      ) : (
                        <p style={s.auditNoThumb}>Miniatura no disponible.</p>
                      )}
                      <div style={s.auditDetailsRow}><strong>Tema:</strong> {getTemaSubtema(row).tema}</div>
                      <div style={s.auditDetailsRow}><strong>Subtema:</strong> {getTemaSubtema(row).subtema}</div>
                    </>
                  )}

                  {!shouldShowThumbnail(row) && shouldShowTemaSubtema(row) && (
                    <>
                      <div style={s.auditDetailsRow}><strong>Tema:</strong> {getTemaSubtema(row).tema}</div>
                      <div style={s.auditDetailsRow}><strong>Subtema:</strong> {getTemaSubtema(row).subtema}</div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'transparent',
  },
  main: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px 16px 48px',
    boxSizing: 'border-box',
  },
  breadcrumb: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '18px',
    background: 'rgba(255,255,255,0.8)',
    border: '1px solid #bfdbfe',
    borderRadius: '10px',
    padding: '8px 12px',
  },
  breadcrumbLink: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#0369a1',
    fontWeight: 600,
  },
  breadcrumbSep: {
    color: '#64748b',
  },
  breadcrumbCurrent: {
    color: '#0f172a',
    fontWeight: 700,
  },
  card: {
    background: 'transparent',
    border: 'none',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: 'none',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: '1.8rem',
    color: '#0f172a',
  },
  filtersWrap: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  advancedFiltersWrap: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    padding: '12px',
    marginBottom: '12px',
    border: '1px dashed #bfdbfe',
    borderRadius: '10px',
    background: '#f8fbff',
  },
  dateFilterGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  smallLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '0.85rem',
    color: '#334155',
  },
  select: {
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '8px 12px',
    background: '#fff',
    color: '#0f172a',
  },
  input: {
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '8px 10px',
    background: '#fff',
    color: '#0f172a',
    minWidth: '180px',
  },
  switchLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '8px 10px',
    background: '#fff',
    color: '#334155',
    fontWeight: 600,
  },
  ghostButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '8px 12px',
    background: '#fff',
    color: '#0f172a',
    fontWeight: 600,
    cursor: 'pointer',
  },
  resetButton: {
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '8px 12px',
    background: '#fff1f2',
    color: '#be123c',
    fontWeight: 700,
    cursor: 'pointer',
  },
  loading: {
    color: '#475569',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px',
    marginBottom: '16px',
  },
  kpiCard: {
    border: '1px solid #dbeafe',
    background: '#f8fafc',
    borderRadius: '12px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  kpiLabel: {
    color: '#475569',
    fontSize: '0.9rem',
  },
  kpiValue: {
    color: '#0f172a',
    fontSize: '1.6rem',
  },
  sectionBox: {
    marginBottom: '16px',
  },
  helperText: {
    margin: '8px 0 0 0',
    color: '#475569',
    fontSize: '0.9rem',
  },
  funnelGrid: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  funnelCard: {
    background: '#f8fafc',
    border: '1px solid #dbeafe',
    borderRadius: '10px',
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '110px',
  },
  funnelLabel: {
    color: '#475569',
    fontSize: '0.82rem',
  },
  funnelValue: {
    color: '#0f172a',
    fontSize: '1.1rem',
  },
  funnelArrow: {
    color: '#64748b',
    fontWeight: 700,
    fontSize: '1.2rem',
  },
  recentHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '8px',
  },
  smallText: {
    color: '#475569',
    fontSize: '0.9rem',
  },
  sectionTitle: {
    margin: '0 0 8px 0',
    color: '#0f172a',
  },
  breakdownRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '10px',
  },
  breakdownHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    color: '#1e293b',
    fontWeight: 600,
  },
  barTrack: {
    width: '100%',
    height: '8px',
    borderRadius: '999px',
    background: '#e2e8f0',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #38bdf8 0%, #2563eb 100%)',
    borderRadius: '999px',
    minWidth: '2px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  th: {
    textAlign: 'left',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
    padding: '10px',
    color: '#0f172a',
  },
  td: {
    borderBottom: '1px solid #f1f5f9',
    padding: '10px',
    color: '#334155',
  },
  rankGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '12px',
  },
  chartGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '12px',
    marginBottom: '16px',
  },
  auditGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '12px',
  },
  auditCard: {
    border: '1px solid #dbeafe',
    borderRadius: '12px',
    background: '#fff',
    padding: '12px',
  },
  auditList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '420px',
    overflowY: 'auto',
    paddingRight: '2px',
  },
  auditItem: {
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#f8fafc',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  auditTopLine: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    flexWrap: 'wrap',
  },
  auditBottomLine: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    flexWrap: 'wrap',
    color: '#475569',
    fontSize: '0.88rem',
  },
  auditActor: {
    color: '#0f172a',
    fontSize: '0.9rem',
  },
  auditTime: {
    color: '#64748b',
    fontSize: '0.82rem',
  },
  auditDetailsButton: {
    alignSelf: 'flex-start',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '0.82rem',
    fontWeight: 700,
    padding: '5px 8px',
    cursor: 'pointer',
  },
  auditDetailsBox: {
    marginTop: '6px',
    padding: '8px',
    border: '1px dashed #bfdbfe',
    borderRadius: '8px',
    background: '#f8fbff',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  auditDetailsRow: {
    color: '#334155',
    fontSize: '0.84rem',
  },
  auditThumb: {
    width: '100%',
    maxWidth: '190px',
    aspectRatio: '1 / 1',
    objectFit: 'cover',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    marginTop: '6px',
    marginBottom: '2px',
  },
  auditNoThumb: {
    margin: '4px 0',
    color: '#64748b',
    fontSize: '0.82rem',
  },
  rankCard: {
    border: '1px solid #dbeafe',
    borderRadius: '12px',
    background: '#fff',
    padding: '12px',
  },
  rankTitle: {
    margin: '0 0 10px 0',
    color: '#0f172a',
    fontSize: '1rem',
  },
  rankList: {
    margin: 0,
    paddingLeft: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  rankItem: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    color: '#334155',
  },
  entityCard: {
    border: '1px solid #dbeafe',
    borderRadius: '12px',
    background: '#fff',
    padding: '12px',
  },
  entitySubtitle: {
    margin: '0 0 10px 0',
    color: '#64748b',
    fontSize: '0.9rem',
  },
  entityRowsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  entityRow: {
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '8px',
    background: '#f8fafc',
  },
  entityHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '6px',
  },
  entityName: {
    color: '#0f172a',
    fontWeight: 700,
  },
  entityStats: {
    color: '#475569',
    fontSize: '0.86rem',
  },
  metricRow: {
    display: 'grid',
    gridTemplateColumns: '22px 1fr',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '5px',
  },
  metricLabel: {
    color: '#334155',
    fontWeight: 700,
    fontSize: '0.8rem',
    textAlign: 'center',
  },
  barTrackLarge: {
    width: '100%',
    height: '10px',
    borderRadius: '999px',
    background: '#e2e8f0',
    overflow: 'hidden',
  },
  emptyText: {
    margin: 0,
    color: '#64748b',
  },
  paginationWrap: {
    marginTop: '10px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    flexWrap: 'wrap',
  },
};

export default Estadisticas;






