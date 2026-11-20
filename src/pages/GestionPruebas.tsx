import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ArrowRightLeft, BookOpen, Check, ClipboardCheck, Eye, EyeOff,
  FolderOpen, LoaderCircle, Pencil, Play, Plus, RefreshCw, Search, Settings2, Shield,
  Sparkles, Trash2, X,
} from 'lucide-react';
import Footer from '../components/Footer';
import Header from '../components/Header';
import PublicBankTestConfig from '../components/PublicBankTestConfig';
import PublicBankTopicEditor from '../components/PublicBankTopicEditor';
import PublicLegacyMigrator from '../components/PublicLegacyMigrator';
import { useAuth } from '../contexts/AuthContext';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import { getCachedTemas, type CatalogTema } from '../services/catalogService';
import { deleteFromCloudinary } from '../services/cloudinary';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import {
  checkPublicBankImageRefs,
  countPendingSubtemaMigration,
  listLegacyPublicTestsForMigration,
  listPublicBankSummary,
  migrateSubtemaTestsToBank,
  publishPublicBankTest,
} from '../services/publicTestsBank';
import { supabase } from '../services/supabase';
import { deleteOwnedTestReferenceImages } from '../services/testReferenceImages';
import { logAuditEvent } from '../services/unifiedAuditService';
import {
  calculateExpectedBankTestCount,
  type LegacyMigrationTest,
  type PublicBankTestRow,
  type PublicBankTopicSummary,
} from '../types/publicQuestionBank';
import { groupTemasByParcial, PARCIAL_LABELS } from '../utils/instructorTopics';
import '../styles/instructorTests.css';
import '../styles/publicBankTests.css';

type ActiveTab = 'bank' | 'tests' | 'migrate';

const SUBTEMA_MIGRATION_DONE_KEY = 'atlas_public_bank_subtema_migrated_v1';

export default function GestionPruebas() {
  const handleGoBack = useSmartBackNavigation('/edicion');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const initialTab = (searchParams.get('tab') as ActiveTab | null) ?? 'bank';
  const [tab, setTab] = useState<ActiveTab>(
    initialTab === 'tests' || initialTab === 'migrate' ? initialTab : 'bank',
  );

  const [temas, setTemas] = useState<CatalogTema[]>([]);
  const [bankSummary, setBankSummary] = useState<PublicBankTopicSummary[]>([]);
  const [tests, setTests] = useState<PublicBankTestRow[]>([]);
  const [legacyMigrationTests, setLegacyMigrationTests] = useState<LegacyMigrationTest[]>([]);
  const [pendingSubtemaMigration, setPendingSubtemaMigration] = useState<{
    pending_questions: number;
    pending_tests: number;
  } | null>(null);
  const [subtemaMigrationDismissed, setSubtemaMigrationDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SUBTEMA_MIGRATION_DONE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [autoMigrating, setAutoMigrating] = useState(false);
  const [error, setError] = useState('');
  const [bankWarning, setBankWarning] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  const [activeBankTema, setActiveBankTema] = useState<CatalogTema | null>(null);
  const [configuringTest, setConfiguringTest] = useState<{
    test: PublicBankTestRow | null;
    defaultTemaId?: number | null;
  } | null>(null);
  const [migratingTest, setMigratingTest] = useState<LegacyMigrationTest | null>(null);

  const [topicQuery, setTopicQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState<'all' | 'filled' | 'empty'>('all');
  const [testTopicQuery, setTestTopicQuery] = useState('');
  const [testTopicFilter, setTestTopicFilter] = useState<'all' | 'configured' | 'unconfigured'>('all');
  const [failedLogos, setFailedLogos] = useState<Record<number, boolean>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    setBankWarning('');

    const [temasRes, bankRes, pruebasRes, legacyRes, pendingSubRes] = await Promise.allSettled([
      getCachedTemas(),
      listPublicBankSummary(),
      supabase
        .from('pruebas')
        .select('id, nombre, instrucciones, scope, parcial_key, tema_id, subtema_id, estado, image_url, mode, bank_config, revision, created_at, updated_at, created_by_id, created_by_name, updated_by_id, updated_by_name')
        .order('created_at', { ascending: false }),
      listLegacyPublicTestsForMigration(),
      countPendingSubtemaMigration(),
    ]);

    if (temasRes.status === 'fulfilled') setTemas(temasRes.value);
    else setError('No se pudieron cargar los temas del Atlas.');

    if (bankRes.status === 'fulfilled') setBankSummary(bankRes.value);
    else {
      setBankWarning(
        bankRes.reason instanceof Error
          ? bankRes.reason.message
          : 'El banco de preguntas públicas todavía no está habilitado en la base de datos.',
      );
    }

    if (pruebasRes.status === 'fulfilled' && !pruebasRes.value.error) {
      setTests((pruebasRes.value.data ?? []) as PublicBankTestRow[]);
    } else {
      // Fallback si las columnas nuevas aún no están aplicadas en Supabase
      const fallback = await supabase
        .from('pruebas')
        .select('id, nombre, instrucciones, scope, parcial_key, tema_id, subtema_id, estado, image_url, created_at')
        .order('created_at', { ascending: false });
      if (!fallback.error) {
        setTests((fallback.data ?? []) as PublicBankTestRow[]);
      } else {
        setError('No se pudieron cargar las pruebas.');
      }
    }

    if (legacyRes.status === 'fulfilled') {
      setLegacyMigrationTests(legacyRes.value);
    } else {
      setLegacyMigrationTests([]);
    }

    if (pendingSubRes.status === 'fulfilled') {
      setPendingSubtemaMigration(pendingSubRes.value);
    } else {
      setPendingSubtemaMigration(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll, reload]);

  const refreshBankSummary = useCallback(async () => {
    try {
      const next = await listPublicBankSummary();
      setBankSummary(next);
    } catch {
      // mantener resumen actual si falla temporalmente
    }
  }, []);

  const bankByTema = useMemo(
    () => new Map(bankSummary.map(item => [item.tema_id, item])),
    [bankSummary],
  );

  const bankTests = useMemo(
    () => tests.filter(t => t.mode === 'bank'),
    [tests],
  );
  const bankTestByTemaId = useMemo(() => {
    const map = new Map<number, PublicBankTestRow>();
    bankTests.forEach(t => {
      if (t.tema_id != null) map.set(t.tema_id, t);
    });
    return map;
  }, [bankTests]);

  const normalizedTestQuery = testTopicQuery.trim().toLowerCase();
  const filteredTestTemas = useMemo(() => {
    return temas.filter(tema => {
      const existing = bankTestByTemaId.get(tema.id);
      if (normalizedTestQuery) {
        const matchTema = tema.nombre.toLowerCase().includes(normalizedTestQuery);
        const matchTestName = (existing?.nombre ?? '').toLowerCase().includes(normalizedTestQuery);
        if (!matchTema && !matchTestName) return false;
      }
      if (testTopicFilter === 'configured') return Boolean(existing);
      if (testTopicFilter === 'unconfigured') return !existing;
      return true;
    });
  }, [temas, bankTestByTemaId, normalizedTestQuery, testTopicFilter]);

  const groupedTestTemas = useMemo(() => groupTemasByParcial(filteredTestTemas), [filteredTestTemas]);

  const legacySubtemaTests = useMemo(
    () => tests.filter(t => t.mode !== 'bank' && t.scope === 'subtema' && t.estado !== 'archivada'),
    [tests],
  );
  const showAutoMigrationBanner = useMemo(() => {
    if (loading || bankWarning || migratingTest) return false;
    // Si la RPC exacta está instalada en BD, mostrar solo cuando haya preguntas pendientes reales.
    if (pendingSubtemaMigration !== null) {
      return pendingSubtemaMigration.pending_questions > 0;
    }
    // Fallback si aún no se aplicó la RPC de conteo: ocultar tras ejecutar la migración.
    return !subtemaMigrationDismissed && legacySubtemaTests.length > 0;
  }, [loading, bankWarning, migratingTest, pendingSubtemaMigration, subtemaMigrationDismissed, legacySubtemaTests.length]);
  const usedBankTemaIds = useMemo(
    () => new Set(bankTests.map(t => t.tema_id).filter((id): id is number => id != null)),
    [bankTests],
  );

  const totalBankQuestions = useMemo(
    () => bankSummary.reduce((sum, item) => sum + item.total_count, 0),
    [bankSummary],
  );
  const totalGeneralQuestions = useMemo(
    () => bankSummary.reduce((sum, item) => sum + item.general_count, 0),
    [bankSummary],
  );
  const totalSubtemaQuestions = useMemo(
    () => bankSummary.reduce((sum, item) => sum + item.subtema_total_count, 0),
    [bankSummary],
  );

  const normalizedQuery = topicQuery.trim().toLowerCase();
  const filteredTemas = useMemo(() => {
    return temas.filter(tema => {
      if (normalizedQuery && !tema.nombre.toLowerCase().includes(normalizedQuery)) return false;
      const count = bankByTema.get(tema.id)?.total_count ?? 0;
      if (topicFilter === 'filled') return count > 0;
      if (topicFilter === 'empty') return count === 0;
      return true;
    });
  }, [temas, normalizedQuery, topicFilter, bankByTema]);

  const groupedTemas = useMemo(() => groupTemasByParcial(filteredTemas), [filteredTemas]);

  const handleAutoMigrateSubtemas = async () => {
    if (autoMigrating || busy) return;
    if (!window.confirm('¿Importar automáticamente todas las preguntas de las pruebas antiguas de subtema hacia su subtema correspondiente en el banco? Esta operación es segura y no duplica preguntas ya migradas.')) {
      return;
    }
    setAutoMigrating(true);
    setError('');
    setMessage('');
    try {
      const result = await migrateSubtemaTestsToBank();
      try {
        localStorage.setItem(SUBTEMA_MIGRATION_DONE_KEY, '1');
      } catch {}
      setSubtemaMigrationDismissed(true);
      await loadAll();
      void logAuditEvent({
        entityType: 'prueba',
        actionType: 'update',
        entityId: 'public-bank-auto-migration',
        entityName: 'Migración automática de subtemas al banco',
        actor: user ? { id: user.id, username: user.username, name: user.nombre, role: user.rol } : null,
        details: result as unknown as Record<string, unknown>,
      });
      setMessage(
        result.migrated_questions > 0
          ? `Migración automática completada: ${result.migrated_questions} preguntas agregadas al banco en ${result.affected_temas} temas (${result.skipped_questions} omitidas o ya migradas).`
          : `No había preguntas nuevas de subtema por migrar (${result.skipped_questions} ya estaban en el banco).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la migración automática.');
    } finally {
      setAutoMigrating(false);
    }
  };

  const handleTogglePublish = async (test: PublicBankTestRow) => {
    if (busy) return;
    const nextPublish = test.estado !== 'publicada';
    const confirmMsg = nextPublish
      ? `¿Publicar «${test.nombre}» en Evaluaciones? Las pruebas antiguas de subtema de este tema que ya estén migradas al banco se archivarán automáticamente para evitar duplicados.`
      : `¿Pasar «${test.nombre}» a borrador y ocultarla al público?`;
    if (!window.confirm(confirmMsg)) return;

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { test: updated, archived_legacy_count } = await publishPublicBankTest(test.id, nextPublish, true);
      setTests(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      if (archived_legacy_count > 0) {
        await loadAll();
      }
      void logAuditEvent({
        entityType: 'prueba',
        actionType: nextPublish ? 'publish' : 'unpublish',
        entityId: updated.id,
        entityName: `Prueba: ${updated.nombre}`,
        actor: user ? { id: user.id, username: user.username, name: user.nombre, role: user.rol } : null,
        details: { mode: 'bank', tema_id: updated.tema_id, archived_legacy_count },
      });
      setMessage(
        nextPublish
          ? archived_legacy_count > 0
            ? `«${updated.nombre}» publicada. Se archivaron ${archived_legacy_count} pruebas antiguas de subtema ya migradas.`
            : `«${updated.nombre}» publicada en Evaluaciones.`
          : `«${updated.nombre}» pasada a borrador.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado de publicación.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTest = async (test: PublicBankTestRow) => {
    if (busy) return;
    if (!window.confirm(`¿Eliminar permanentemente la prueba «${test.nombre}»? Las preguntas guardadas en el banco de preguntas NO se eliminarán.`)) {
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      // Si es prueba legacy, proteger imágenes de R2 que ya estén referenciadas en el banco
      if (test.mode !== 'bank') {
        const { data: legacyQuestions } = await supabase
          .from('prueba_preguntas')
          .select('reference_photo_url')
          .eq('prueba_id', test.id);
        const rawUrls = (legacyQuestions ?? [])
          .map((row: { reference_photo_url?: string | null }) => row.reference_photo_url)
          .filter((url): url is string => Boolean(url));
        const protectedUrls = new Set(await checkPublicBankImageRefs(rawUrls));
        const safeToDelete = rawUrls.filter(url => !protectedUrls.has(url));
        if (safeToDelete.length > 0) {
          await deleteOwnedTestReferenceImages(safeToDelete, test.id);
        }
      }

      if (test.image_url) {
        try {
          await deleteFromCloudinary({ imageUrl: test.image_url });
        } catch {
          // no bloquear borrado de fila si falla limpieza de portada
        }
      }

      const { error: deleteError } = await supabase.from('pruebas').delete().eq('id', test.id);
      if (deleteError) throw deleteError;

      setTests(prev => prev.filter(t => t.id !== test.id));
      void logAuditEvent({
        entityType: 'prueba',
        actionType: 'delete',
        entityId: test.id,
        entityName: `Prueba: ${test.nombre}`,
        actor: user ? { id: user.id, username: user.username, name: user.nombre, role: user.rol } : null,
        details: { mode: test.mode ?? 'legacy', tema_id: test.tema_id },
      });
      setMessage(`Prueba «${test.nombre}» eliminada.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la prueba.');
    } finally {
      setBusy(false);
    }
  };

  if (activeBankTema) {
    return (
      <PublicBankTopicEditor
        tema={activeBankTema}
        summary={bankByTema.get(activeBankTema.id)}
        onSummaryUpdated={refreshBankSummary}
        onClose={() => setActiveBankTema(null)}
      />
    );
  }

  if (configuringTest) {
    return (
      <PublicBankTestConfig
        existingTest={configuringTest.test}
        defaultTemaId={configuringTest.defaultTemaId}
        temas={temas}
        usedTemaIds={usedBankTemaIds}
        bankSummaryByTema={bankByTema}
        onSaved={(saved, msg) => {
          setTests(prev =>
            prev.some(t => t.id === saved.id)
              ? prev.map(t => (t.id === saved.id ? saved : t))
              : [saved, ...prev],
          );
          setConfiguringTest(null);
          setTab('tests');
          setMessage(msg);
          void logAuditEvent({
            entityType: 'prueba',
            actionType: configuringTest.test ? 'update' : 'create',
            entityId: saved.id,
            entityName: `Prueba: ${saved.nombre}`,
            actor: user ? { id: user.id, username: user.username, name: user.nombre, role: user.rol } : null,
            details: { mode: 'bank', tema_id: saved.tema_id, bank_config: saved.bank_config },
          });
        }}
        onClose={() => setConfiguringTest(null)}
      />
    );
  }

  return (
    <div className="instructor-page instructor-editor-scope public-bank-scope">
      <Header onBeforeNavigate={proceed => { if (!busy && !autoMigrating) proceed(); }} />
      <main className="instructor-main">
        <div className="instructor-row instructor-between" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className="instructor-btn instructor-btn-ghost"
            disabled={busy || autoMigrating}
            onClick={handleGoBack}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Panel de edición
          </button>
          {user?.rol === 'Administrador' && (
            <button
              type="button"
              className="instructor-btn"
              onClick={() => navigate('/historial?entity=prueba')}
            >
              <Shield size={15} aria-hidden="true" />
              Auditoría de pruebas
            </button>
          )}
        </div>

        <section className="instructor-module-hero" aria-labelledby="gestion-pruebas-title">
          <span className="instructor-module-icon"><ClipboardCheck size={26} aria-hidden="true" /></span>
          <div>
            <p className="instructor-eyebrow">Evaluaciones públicas · Banco en vivo</p>
            <h1 id="gestion-pruebas-title">Gestión de pruebas y banco de preguntas</h1>
            <p className="instructor-muted">
              Administra preguntas generales por tema y específicas por subtema. Configura una única prueba por tema con selección aleatoria en vivo y calificación inmediata.
            </p>
          </div>
        </section>

        <div className="instructor-overview" aria-label="Resumen del banco público">
          <div>
            <span>Preguntas en banco</span>
            <strong>{loading ? '—' : totalBankQuestions}</strong>
          </div>
          <div>
            <span>Generales / Subtemas</span>
            <strong>{loading ? '—' : `${totalGeneralQuestions} / ${totalSubtemaQuestions}`}</strong>
          </div>
          <div>
            <span>Pruebas por tema (publicadas)</span>
            <strong>
              {loading ? '—' : `${bankTests.length} (${bankTests.filter(t => t.estado === 'publicada').length})`}
            </strong>
          </div>
        </div>

        {error && <p role="alert" className="instructor-error">{error}</p>}
        {bankWarning && <p role="alert" className="instructor-error">{bankWarning}</p>}
        {message && <p role="status" className="instructor-success">{message}</p>}

        {/* Banner de migración 100% automática para pruebas antiguas de subtema */}
        {showAutoMigrationBanner && (
          <section className="public-bank-auto-banner" aria-label="Migración automática de pruebas de subtema">
            <div>
              <h3>
                Migración automática disponible (
                {pendingSubtemaMigration
                  ? `${pendingSubtemaMigration.pending_questions} ${pendingSubtemaMigration.pending_questions === 1 ? 'pregunta' : 'preguntas'} en ${pendingSubtemaMigration.pending_tests} ${pendingSubtemaMigration.pending_tests === 1 ? 'prueba' : 'pruebas'}`
                  : `${legacySubtemaTests.length} pruebas antiguas de subtema`}
                )
              </h3>
              <p>
                Suma automáticamente las preguntas pendientes de las pruebas de subtema a su subtema correspondiente en el banco (idempotente: nunca duplica preguntas ya migradas).
              </p>
            </div>
            <button
              type="button"
              className="instructor-btn instructor-btn-primary"
              disabled={autoMigrating || busy}
              onClick={() => void handleAutoMigrateSubtemas()}
            >
              {autoMigrating
                ? <LoaderCircle size={16} className="instructor-spin" aria-hidden="true" />
                : <Sparkles size={16} aria-hidden="true" />}
              {autoMigrating ? 'Migrando preguntas…' : 'Migrar subtemas automáticamente'}
            </button>
          </section>
        )}

        {migratingTest ? (
          <PublicLegacyMigrator
            initialTest={migratingTest}
            temas={temas}
            onMigrated={loadAll}
            onClose={() => setMigratingTest(null)}
          />
        ) : (
          <>
            <div className="instructor-mode-tabs" role="tablist" aria-label="Secciones de gestión de pruebas">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'bank'}
                className="instructor-btn"
                onClick={() => setTab('bank')}
              >
                <BookOpen size={16} aria-hidden="true" />
                Banco de preguntas
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'tests'}
                className="instructor-btn"
                onClick={() => setTab('tests')}
              >
                <Settings2 size={16} aria-hidden="true" />
                Pruebas por tema ({bankTests.length})
              </button>
              {legacyMigrationTests.length > 0 && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'migrate'}
                  className="instructor-btn"
                  onClick={() => setTab('migrate')}
                >
                  <ArrowRightLeft size={16} aria-hidden="true" />
                  Migrar tema/parcial ({legacyMigrationTests.length})
                </button>
              )}
            </div>

            {tab === 'bank' && (
              <section className="instructor-panel" aria-label="Banco de preguntas por tema">
                <div className="instructor-row instructor-between instructor-list-heading">
                  <div>
                    <h2>Banco de preguntas por tema</h2>
                    <p className="instructor-muted">
                      Entra a cualquier tema para gestionar sus preguntas generales y las preguntas específicas de cada subtema.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="instructor-btn instructor-btn-ghost"
                    disabled={busy || loading}
                    onClick={() => setReload(n => n + 1)}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    Actualizar
                  </button>
                </div>

                {!loading && temas.length > 0 && (
                  <div className="instructor-bank-toolbar" role="search" aria-label="Filtrar temas del banco">
                    <div className="instructor-bank-search">
                      <Search size={16} aria-hidden="true" />
                      <input
                        type="search"
                        className="instructor-input"
                        aria-label="Buscar tema en el banco"
                        placeholder="Buscar tema por nombre…"
                        value={topicQuery}
                        onChange={event => setTopicQuery(event.target.value)}
                      />
                      {topicQuery && (
                        <button
                          type="button"
                          className="instructor-bank-clear"
                          aria-label="Limpiar búsqueda"
                          onClick={() => setTopicQuery('')}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <div className="instructor-bank-filters" role="group" aria-label="Filtrar por estado">
                      <button
                        type="button"
                        className="instructor-filter-chip"
                        aria-pressed={topicFilter === 'all'}
                        onClick={() => setTopicFilter('all')}
                      >
                        Todos ({temas.length})
                      </button>
                      <button
                        type="button"
                        className="instructor-filter-chip"
                        aria-pressed={topicFilter === 'filled'}
                        onClick={() => setTopicFilter('filled')}
                      >
                        Con preguntas ({temas.filter(t => (bankByTema.get(t.id)?.total_count ?? 0) > 0).length})
                      </button>
                      <button
                        type="button"
                        className="instructor-filter-chip"
                        aria-pressed={topicFilter === 'empty'}
                        onClick={() => setTopicFilter('empty')}
                      >
                        Sin preguntas ({temas.filter(t => (bankByTema.get(t.id)?.total_count ?? 0) === 0).length})
                      </button>
                    </div>
                  </div>
                )}

                {loading ? (
                  <p role="status" className="instructor-list-loading">
                    <LoaderCircle size={20} className="instructor-spin" aria-hidden="true" />
                    Cargando temas y banco…
                  </p>
                ) : groupedTemas.length === 0 ? (
                  <div className="instructor-list-empty">
                    <span className="instructor-empty-icon"><FolderOpen size={26} aria-hidden="true" /></span>
                    <h3>No se encontraron temas con este filtro.</h3>
                    <button
                      type="button"
                      className="instructor-btn"
                      style={{ marginTop: 12 }}
                      onClick={() => { setTopicQuery(''); setTopicFilter('all'); }}
                    >
                      Mostrar todos los temas
                    </button>
                  </div>
                ) : (
                  <div className="instructor-bank-parciales">
                    {groupedTemas.map((group, groupIndex) => {
                      const groupTotal = group.temas.reduce((sum, t) => sum + (bankByTema.get(t.id)?.total_count ?? 0), 0);
                      return (
                        <section key={group.parcial} className="instructor-bank-parcial-group" aria-label={group.label}>
                          <header className="instructor-bank-parcial-header">
                            <div className="instructor-bank-parcial-title">
                              <span className="instructor-bank-parcial-num" aria-hidden="true">
                                {String(groupIndex + 1).padStart(2, '0')}
                              </span>
                              <h3>{group.label}</h3>
                            </div>
                            <span className="instructor-bank-parcial-meta">
                              <strong>{groupTotal}</strong> {groupTotal === 1 ? 'pregunta' : 'preguntas'} en banco
                            </span>
                          </header>

                          <ul className="instructor-bank-topic-list">
                            {group.temas.map((tema, idx) => {
                              const stats = bankByTema.get(tema.id);
                              const total = stats?.total_count ?? 0;
                              const gen = stats?.general_count ?? 0;
                              const sub = stats?.subtema_total_count ?? 0;
                              const hasLogo = Boolean(tema.logo_url) && !failedLogos[tema.id];
                              const orderNum = String(idx + 1).padStart(2, '0');
                              return (
                                <li key={tema.id} className="instructor-bank-topic-card" data-filled={total > 0 ? 'true' : 'false'}>
                                  <div className="instructor-bank-topic-head">
                                    <div className="instructor-bank-topic-thumb" aria-hidden="true">
                                      {hasLogo ? (
                                        <img
                                          src={getCloudinaryImageUrl(tema.logo_url!, 'thumb')}
                                          alt=""
                                          loading="lazy"
                                          onError={() => setFailedLogos(prev => ({ ...prev, [tema.id]: true }))}
                                        />
                                      ) : (
                                        <span>{orderNum}</span>
                                      )}
                                    </div>
                                    <div className="instructor-bank-topic-info">
                                      <span className="instructor-bank-topic-order">Tema {orderNum}</span>
                                      <h4>{tema.nombre}</h4>
                                    </div>
                                  </div>
                                  <div className="instructor-bank-topic-foot">
                                    <span className={`instructor-bank-count${total > 0 ? ' is-filled' : ''}`}>
                                      {total === 0
                                        ? 'Sin preguntas'
                                        : `${gen} generales · ${sub} en subtemas`}
                                    </span>
                                    <button
                                      type="button"
                                      className="instructor-btn instructor-bank-open-btn"
                                      disabled={busy}
                                      aria-label={`Abrir banco de ${tema.nombre}`}
                                      onClick={() => setActiveBankTema(tema)}
                                    >
                                      {total > 0 ? 'Editar' : 'Agregar'}
                                      <ArrowRight size={15} aria-hidden="true" />
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {tab === 'tests' && (
              <section className="instructor-panel" aria-label="Pruebas configuradas por tema">
                <div className="instructor-row instructor-between instructor-list-heading">
                  <div>
                    <h2>Pruebas por tema (1 por tema)</h2>
                    <p className="instructor-muted">
                      Temas ordenados por parcial y orden del programa. Configura, prueba o publica la evaluación de cada tema.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="instructor-btn instructor-btn-ghost"
                    disabled={busy || loading}
                    onClick={() => setReload(n => n + 1)}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    Actualizar
                  </button>
                </div>

                {!loading && temas.length > 0 && (
                  <div className="instructor-bank-toolbar" role="search" aria-label="Filtrar pruebas por tema">
                    <div className="instructor-bank-search">
                      <Search size={16} aria-hidden="true" />
                      <input
                        type="search"
                        className="instructor-input"
                        aria-label="Buscar tema o prueba"
                        placeholder="Buscar tema o prueba…"
                        value={testTopicQuery}
                        onChange={event => setTestTopicQuery(event.target.value)}
                      />
                      {testTopicQuery && (
                        <button
                          type="button"
                          className="instructor-bank-clear"
                          aria-label="Limpiar búsqueda"
                          onClick={() => setTestTopicQuery('')}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <div className="instructor-bank-filters" role="group" aria-label="Filtrar por estado de configuración">
                      <button
                        type="button"
                        className="instructor-filter-chip"
                        aria-pressed={testTopicFilter === 'all'}
                        onClick={() => setTestTopicFilter('all')}
                      >
                        Todos ({temas.length})
                      </button>
                      <button
                        type="button"
                        className="instructor-filter-chip"
                        aria-pressed={testTopicFilter === 'configured'}
                        onClick={() => setTestTopicFilter('configured')}
                      >
                        Configuradas ({bankTests.length})
                      </button>
                      <button
                        type="button"
                        className="instructor-filter-chip"
                        aria-pressed={testTopicFilter === 'unconfigured'}
                        onClick={() => setTestTopicFilter('unconfigured')}
                      >
                        Sin prueba ({Math.max(0, temas.length - bankTests.length)})
                      </button>
                    </div>
                  </div>
                )}

                {loading ? (
                  <p role="status" className="instructor-list-loading">
                    <LoaderCircle size={20} className="instructor-spin" aria-hidden="true" />
                    Cargando temas y pruebas…
                  </p>
                ) : groupedTestTemas.length === 0 ? (
                  <div className="instructor-list-empty">
                    <span className="instructor-empty-icon"><FolderOpen size={26} aria-hidden="true" /></span>
                    <h3>No se encontraron temas con este filtro.</h3>
                    <button
                      type="button"
                      className="instructor-btn"
                      style={{ marginTop: 12 }}
                      onClick={() => { setTestTopicQuery(''); setTestTopicFilter('all'); }}
                    >
                      Mostrar todos los temas
                    </button>
                  </div>
                ) : (
                  <div className="instructor-bank-parciales">
                    {groupedTestTemas.map((group, groupIndex) => {
                      const configuredInGroup = group.temas.filter(t => bankTestByTemaId.has(t.id)).length;
                      const publishedInGroup = group.temas.filter(t => bankTestByTemaId.get(t.id)?.estado === 'publicada').length;
                      return (
                        <section key={group.parcial} className="instructor-bank-parcial-group" aria-label={group.label}>
                          <header className="instructor-bank-parcial-header">
                            <div className="instructor-bank-parcial-title">
                              <span className="instructor-bank-parcial-num" aria-hidden="true">
                                {String(groupIndex + 1).padStart(2, '0')}
                              </span>
                              <h3>{group.label}</h3>
                            </div>
                            <span className="instructor-bank-parcial-meta">
                              <strong>{configuredInGroup}</strong> de {group.temas.length} configuradas · {publishedInGroup}{' '}
                              {publishedInGroup === 1 ? 'publicada' : 'publicadas'}
                            </span>
                          </header>

                          <ul className="instructor-bank-topic-list">
                            {group.temas.map((tema, idx) => {
                              const test = bankTestByTemaId.get(tema.id) ?? null;
                              const summary = bankByTema.get(tema.id);
                              const bankTotal = summary?.total_count ?? 0;
                              const thumbUrl = test?.image_url || tema.logo_url;
                              const hasLogo = Boolean(thumbUrl) && !failedLogos[tema.id];
                              const orderNum = String(idx + 1).padStart(2, '0');
                              const isPublished = test?.estado === 'publicada';
                              const counts = test ? calculateExpectedBankTestCount(test.bank_config, summary) : null;

                              return (
                                <li
                                  key={tema.id}
                                  className="instructor-bank-topic-card pb-test-topic-card"
                                  data-filled={test ? 'true' : 'false'}
                                >
                                  <div className="instructor-bank-topic-head">
                                    <div className="instructor-bank-topic-thumb" aria-hidden="true">
                                      {hasLogo ? (
                                        <img
                                          src={getCloudinaryImageUrl(thumbUrl!, 'thumb')}
                                          alt=""
                                          loading="lazy"
                                          onError={() => setFailedLogos(prev => ({ ...prev, [tema.id]: true }))}
                                        />
                                      ) : (
                                        <span>{orderNum}</span>
                                      )}
                                    </div>
                                    <div className="instructor-bank-topic-info">
                                      <div className="pb-test-topic-eyebrow-row">
                                        <span className="instructor-bank-topic-order">Tema {orderNum}</span>
                                        {test && (
                                          <span className={`public-bank-status-pill ${isPublished ? 'is-published' : 'is-draft'}`}>
                                            {isPublished ? '● Publicada' : '○ Borrador'}
                                          </span>
                                        )}
                                      </div>
                                      <h4>{tema.nombre}</h4>
                                    </div>
                                  </div>

                                  {test ? (
                                    <div className="pb-test-topic-footer">
                                      <span className="instructor-bank-count is-filled">
                                        {counts?.available ?? 0} de {counts?.configured ?? 0} preguntas hoy · {test.bank_config?.general_count ?? 0} gen
                                      </span>
                                      <div className="pb-test-topic-actions">
                                        <button
                                          type="button"
                                          className={isPublished ? 'instructor-btn pb-mini-btn' : 'instructor-btn instructor-btn-publish pb-mini-btn'}
                                          disabled={busy}
                                          title={isPublished ? 'Pasar a borrador' : 'Publicar prueba'}
                                          onClick={() => void handleTogglePublish(test)}
                                        >
                                          {isPublished ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                                          <span>{isPublished ? 'Borrador' : 'Publicar'}</span>
                                        </button>
                                        <button
                                          type="button"
                                          className="instructor-btn pb-mini-btn"
                                          disabled={busy}
                                          title="Probar sorteo aleatorio"
                                          onClick={() => navigate(`/pruebas/ejecutar/${test.id}`, { state: { from: '/pruebas?tab=tests' } })}
                                        >
                                          <Play size={14} aria-hidden="true" />
                                          <span>Probar</span>
                                        </button>
                                        <button
                                          type="button"
                                          className="instructor-btn pb-mini-btn"
                                          disabled={busy}
                                          title={`Configurar prueba de ${tema.nombre}`}
                                          onClick={() => setConfiguringTest({ test })}
                                        >
                                          <Pencil size={14} aria-hidden="true" />
                                          <span>Configurar</span>
                                        </button>
                                        <button
                                          type="button"
                                          className="instructor-btn instructor-btn-danger pb-mini-btn pb-mini-icon"
                                          disabled={busy}
                                          aria-label={`Eliminar prueba de ${tema.nombre}`}
                                          onClick={() => void handleDeleteTest(test)}
                                        >
                                          <Trash2 size={14} aria-hidden="true" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="instructor-bank-topic-foot">
                                      <span className="instructor-bank-count">
                                        {bankTotal > 0 ? `Sin prueba · ${bankTotal} en banco` : 'Sin prueba · Banco vacío'}
                                      </span>
                                      <button
                                        type="button"
                                        className="instructor-btn instructor-bank-open-btn"
                                        disabled={busy}
                                        aria-label={`Configurar prueba de ${tema.nombre}`}
                                        onClick={() => setConfiguringTest({ test: null, defaultTemaId: tema.id })}
                                      >
                                        <Plus size={15} aria-hidden="true" />
                                        Configurar
                                      </button>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {tab === 'migrate' && (
              <section className="instructor-panel" aria-label="Pruebas antiguas de tema o parcial pendientes de migrar">
                <div className="instructor-list-heading">
                  <h2>Migrar pruebas antiguas de tema o parcial</h2>
                  <p className="instructor-muted">
                    Estas pruebas antiguas no estaban ligadas a un subtema único. Revisa cada pregunta y decide si va a Generales del tema o a un Subtema específico.
                  </p>
                </div>

                {legacyMigrationTests.length === 0 ? (
                  <div className="instructor-list-empty">
                    <span className="instructor-empty-icon"><Check size={24} aria-hidden="true" /></span>
                    <h3>No quedan pruebas de tema o parcial pendientes</h3>
                    <p>Todas las preguntas fueron migradas al banco.</p>
                  </div>
                ) : (
                  <ul className="instructor-test-list">
                    {legacyMigrationTests.map(item => (
                      <li key={item.id} className="instructor-test-item">
                        <div className="instructor-test-info">
                          <span className="instructor-summary-name">{item.nombre}</span>
                          <p className="instructor-muted">
                            Alcance: <strong>{item.scope}</strong> · {PARCIAL_LABELS[item.parcial_key] ?? item.parcial_key} ·{' '}
                            {item.questions.length} {item.questions.length === 1 ? 'pregunta pendiente' : 'preguntas pendientes'}
                          </p>
                        </div>
                        <div className="instructor-test-actions">
                          <button
                            type="button"
                            className="instructor-btn instructor-btn-primary"
                            onClick={() => setMigratingTest(item)}
                          >
                            <ArrowRightLeft size={15} aria-hidden="true" />
                            Migrar preguntas
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
