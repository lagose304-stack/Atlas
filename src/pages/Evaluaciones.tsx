import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, Shield } from 'lucide-react';
import Footer from '../components/Footer';
import Header from '../components/Header';
import PublicInstructorTests from '../components/PublicInstructorTests';
import { useAuth } from '../contexts/AuthContext';
import { usePreservedParam } from '../hooks/usePreservedParam';
import { getCachedTemas, type CatalogTema } from '../services/catalogService';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { getRenderableBlocks } from '../services/contentPublication';
import { hasHtmlMarkup, toSafeHtml } from '../services/richText';
import {
  canBypassMaintenance,
  fetchSiteMaintenanceStatus,
  isFeatureDisabled,
  isParcialDisabled,
  isTemaDisabled,
  type SiteMaintenanceStatus,
} from '../services/siteMaintenance';
import { supabase } from '../services/supabase';
import type { PublicBankConfig } from '../types/publicQuestionBank';
import { collectWeeklyThemeIds, determineActiveWeeklyParcial } from './evaluacionesUtils';
import '../styles/instructorTests.css';
import '../styles/publicBankTests.css';

type ParcialKey = 'primer' | 'segundo' | 'tercer';

interface PruebaPublica {
  id: string;
  nombre: string;
  instrucciones: string;
  scope: 'parcial' | 'tema' | 'subtema';
  parcial_key: ParcialKey;
  created_at: string;
  image_url?: string | null;
  mode?: 'legacy' | 'bank' | null;
  bank_config?: PublicBankConfig | null;
  tema_id?: number | null;
  subtema_id?: number | null;
  tema?: { id: number; nombre: string; logo_url?: string | null; sort_order?: number | null } | null;
  subtema?: { id: number; nombre: string; logo_url?: string | null } | null;
}

const PARCIALES: Array<{ key: ParcialKey; label: string; title: string; num: string }> = [
  { key: 'primer', label: 'PRIMER PARCIAL', title: 'Primer parcial', num: '1' },
  { key: 'segundo', label: 'SEGUNDO PARCIAL', title: 'Segundo parcial', num: '2' },
  { key: 'tercer', label: 'TERCER PARCIAL', title: 'Tercer parcial', num: '3' },
];

const toPlainText = (value: string): string => (value || '').replace(/<[^>]+>/g, '').trim();

const InlineRichText: React.FC<{ value: string; fallback?: string }> = ({ value, fallback = '' }) => {
  const content = (value || '').trim();
  if (!content) return <span>{fallback}</span>;
  if (hasHtmlMarkup(content)) {
    return <span dangerouslySetInnerHTML={{ __html: toSafeHtml(content) }} />;
  }
  return <span>{content}</span>;
};

const getConfiguredQuestionTotal = (config: PublicBankConfig | null | undefined): number => {
  if (!config) return 0;
  const general = Math.max(0, Math.floor(Number(config.general_count) || 0));
  const subtemas = Object.values(config.subtema_counts ?? {}).reduce(
    (sum, val) => sum + Math.max(0, Math.floor(Number(val) || 0)),
    0,
  );
  return general + subtemas;
};

const PublicTestTopicCard: React.FC<{
  prueba: PruebaPublica;
  orderNum: string;
  isWeekly: boolean;
}> = ({ prueba, orderNum, isWeekly }) => {
  const { user } = useAuth();
  const candidateImages = React.useMemo(() => {
    return [
      prueba.image_url,
      prueba.subtema?.logo_url,
      prueba.tema?.logo_url,
    ].filter((url): url is string => Boolean(url && typeof url === 'string' && url.trim().length > 0));
  }, [prueba.image_url, prueba.subtema?.logo_url, prueba.tema?.logo_url]);

  const [imageIndex, setImageIndex] = React.useState(0);
  const [logoFailed, setLogoFailed] = React.useState(false);

  const plainName = toPlainText(prueba.nombre) || 'Prueba';
  const currentUrl = candidateImages[imageIndex] || '';
  const thumbSrc = currentUrl ? getCloudinaryImageUrl(currentUrl, 'thumb') : '';
  const configuredTotal = prueba.mode === 'bank' ? getConfiguredQuestionTotal(prueba.bank_config) : 0;

  const handleImageError = () => {
    if (imageIndex + 1 < candidateImages.length) {
      setImageIndex(prev => prev + 1);
    } else {
      setLogoFailed(true);
    }
  };

  const subtitleText = configuredTotal > 0
    ? `${configuredTotal} ${configuredTotal === 1 ? 'pregunta' : 'preguntas'} aleatorias`
    : 'Práctica interactiva';

  return (
    <li className="instructor-bank-topic-card pb-public-eval-card" data-filled="true">
      <div className="instructor-bank-topic-head">
        <div className="instructor-bank-topic-thumb" aria-hidden="true">
          {thumbSrc && !logoFailed ? (
            <img
              src={thumbSrc}
              alt=""
              loading="lazy"
              decoding="async"
              onError={handleImageError}
            />
          ) : (
            <span>{orderNum}</span>
          )}
        </div>
        <div className="instructor-bank-topic-info">
          <div className="pb-test-topic-eyebrow-row">
            <span className="instructor-bank-topic-order">
              {prueba.tema?.nombre ? `Tema ${orderNum}` : `Prueba ${orderNum}`}
            </span>
            {isWeekly && <span className="pb-weekly-pill">Esta semana</span>}
          </div>
          <h4>
            <InlineRichText value={prueba.nombre} fallback="Prueba" />
          </h4>
        </div>
      </div>

      <div className="instructor-bank-topic-foot">
        <span className="instructor-bank-count is-filled" title={subtitleText}>
          {subtitleText}
        </span>
        <div className="pb-public-eval-actions">
          {user?.rol === 'Administrador' && (
            <Link
              to={`/historial?scope=prueba&pruebaId=${encodeURIComponent(String(prueba.id))}&pruebaNombre=${encodeURIComponent(plainName)}`}
              className="instructor-btn pb-mini-btn pb-mini-icon"
              title="Ver historial de cambios de esta evaluación"
              aria-label={`Historial de ${plainName}`}
            >
              <Shield size={14} aria-hidden="true" />
            </Link>
          )}
          <Link
            to={`/evaluaciones/ejecutar/${prueba.id}`}
            state={{ from: '/evaluaciones' }}
            className="instructor-btn instructor-btn-primary instructor-bank-open-btn pb-start-eval-btn"
          >
            Iniciar
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </li>
  );
};

const Evaluaciones: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [pruebas, setPruebas] = React.useState<PruebaPublica[]>([]);
  const [maintenanceStatus, setMaintenanceStatus] = React.useState<SiteMaintenanceStatus | null>(null);
  const [weeklyThemeIds, setWeeklyThemeIds] = React.useState<number[]>([]);
  const [allTemasMap, setAllTemasMap] = React.useState<Map<number, CatalogTema>>(new Map());
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [reloadTick, setReloadTick] = React.useState(0);
  const [selectedParcial, setSelectedParcial] = usePreservedParam<ParcialKey>('parcial', 'primer');
  const hasUserManuallySelectedRef = React.useRef(false);
  const initialUrlParcial = React.useRef(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('parcial') : null,
  ).current;

  React.useEffect(() => {
    const loadCatalogAndWeekly = async () => {
      try {
        const [blocks, temas] = await Promise.all([
          getRenderableBlocks('home_page', 0),
          getCachedTemas(),
        ]);
        const map = new Map<number, CatalogTema>();
        temas.forEach(t => map.set(t.id, t));
        setAllTemasMap(map);
        setWeeklyThemeIds(collectWeeklyThemeIds(blocks, temas));

        if (!initialUrlParcial && !hasUserManuallySelectedRef.current) {
          const activeParcial = determineActiveWeeklyParcial(blocks, temas);
          if (activeParcial) {
            setSelectedParcial(activeParcial);
          }
        }
      } catch (loadError) {
        console.warn('No se pudieron cargar los temas activos de la semana.', loadError);
        setWeeklyThemeIds([]);
      }
    };

    void loadCatalogAndWeekly();
    void fetchSiteMaintenanceStatus().then(setMaintenanceStatus);
  }, [initialUrlParcial, setSelectedParcial]);

  React.useEffect(() => {
    const loadPublicTests = async () => {
      setIsLoading(true);
      setError('');

      try {
        const { data, error: queryError } = await supabase
          .from('pruebas')
          .select('id, nombre, instrucciones, scope, parcial_key, created_at, image_url, mode, bank_config, tema_id, subtema_id, tema:temas(id, nombre, logo_url, sort_order), subtema:subtemas(id, nombre, logo_url)')
          .eq('estado', 'publicada')
          .eq('mode', 'bank')
          .order('created_at', { ascending: false });

        if (queryError) {
          setPruebas([]);
          setError('No se pudieron cargar las evaluaciones publicadas. Revisa tu conexión a internet.');
        } else {
          setPruebas((data ?? []) as unknown as PruebaPublica[]);
        }
      } catch (err) {
        console.error('Error al cargar pruebas públicas:', err);
        setPruebas([]);
        setError('No se pudieron cargar las evaluaciones en este momento.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadPublicTests();
  }, [reloadTick]);

  const canBypass = canBypassMaintenance(user, isAuthenticated);

  const visiblePruebas = React.useMemo(() => {
    const bankOnly = pruebas.filter(
      p => p.mode === 'bank' && getConfiguredQuestionTotal(p.bank_config) > 0,
    );
    if (canBypass) return bankOnly;
    const disabled = maintenanceStatus?.disabledFeatures ?? [];
    if (isFeatureDisabled('evaluations', disabled)) return [];
    return bankOnly.filter(p => {
      if (isParcialDisabled(p.parcial_key, disabled)) return false;
      if (isTemaDisabled(p.tema_id, p.parcial_key, disabled)) return false;
      return true;
    });
  }, [pruebas, canBypass, maintenanceStatus]);

  const pruebasByParcial = React.useMemo(() => {
    const result: Record<ParcialKey, PruebaPublica[]> = { primer: [], segundo: [], tercer: [] };
    PARCIALES.forEach(({ key }) => {
      result[key] = visiblePruebas
        .filter(item => item.parcial_key === key)
        .sort((a, b) => {
          const temaA = a.tema_id != null ? allTemasMap.get(a.tema_id) : undefined;
          const temaB = b.tema_id != null ? allTemasMap.get(b.tema_id) : undefined;
          const sortA = temaA?.sort_order ?? a.tema?.sort_order ?? 9999;
          const sortB = temaB?.sort_order ?? b.tema?.sort_order ?? 9999;
          if (sortA !== sortB) return sortA - sortB;
          const idA = a.tema_id ?? 999999;
          const idB = b.tema_id ?? 999999;
          if (idA !== idB) return idA - idB;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    });
    return result;
  }, [visiblePruebas, allTemasMap]);

  const activeParcialMeta = PARCIALES.find(p => p.key === selectedParcial) ?? PARCIALES[0];
  const activeTests = pruebasByParcial[activeParcialMeta.key] ?? [];

  return (
    <div className="atlas-temario-page atlas-temario-typography" style={pageStyles.container}>
      <Header />
      <main className="atlas-temario-main" style={pageStyles.main}>
        <h1
          id="evaluaciones-main-title"
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Evaluaciones — Atlas de Histología
        </h1>

        <section className="temario-main-block" style={pageStyles.boardCard} aria-label="Evaluaciones por parcial">
          {isLoading ? (
            <div className="instructor-list-loading" role="status" style={{ padding: '56px 20px' }}>
              <span className="route-loading-spinner" />
              <span>Preparando evaluaciones…</span>
            </div>
          ) : error ? (
            <div className="instructor-list-empty" role="alert" style={{ padding: '56px 20px' }}>
              <h3>No pudimos cargar las evaluaciones</h3>
              <p>{error}</p>
              <button
                type="button"
                className="instructor-btn instructor-btn-primary"
                style={{ marginTop: 14 }}
                onClick={() => setReloadTick(t => t + 1)}
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div className="temario-unified-board">
              <nav className="temario-partial-nav-integrated" aria-label="Seleccionar parcial">
                {PARCIALES.map(({ key, label, num }) => {
                  const isActive = selectedParcial === key;
                  const count = pruebasByParcial[key].length;
                  const isParcialOff = isParcialDisabled(key, maintenanceStatus?.disabledFeatures ?? []);

                  return (
                    <button
                      key={key}
                      type="button"
                      className={`temario-integrated-tab ${isActive ? 'is-active' : ''}`}
                      style={{ opacity: isParcialOff && !isActive && !canBypass ? 0.7 : 1 }}
                      onClick={() => {
                        hasUserManuallySelectedRef.current = true;
                        setSelectedParcial(key);
                      }}
                    >
                      {isActive && <span className="integrated-tab-indicator" aria-hidden="true" />}
                      <span className="integrated-tab-num">{num}</span>
                      <span className="integrated-tab-copy">
                        <strong className="integrated-tab-name">
                          {label}
                          {isParcialOff && <span className="temario-maint-tag">(Mantenimiento)</span>}
                        </strong>
                        <span className="integrated-tab-count">
                          {count} {count === 1 ? 'prueba' : 'pruebas'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>

              <div className="temario-main-section temario-section-enter public-bank-scope pb-eval-board-body" key={activeParcialMeta.key}>
                <h2
                  style={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    padding: 0,
                    margin: '-1px',
                    overflow: 'hidden',
                    clip: 'rect(0, 0, 0, 0)',
                    whiteSpace: 'nowrap',
                    border: 0,
                  }}
                >
                  {activeParcialMeta.title}
                </h2>

                {activeTests.length === 0 ? (
                  <div className="instructor-list-empty" style={{ padding: '44px 16px' }}>
                    <span className="instructor-empty-icon"><BookOpenCheck size={26} aria-hidden="true" /></span>
                    <h3>Aún no hay evaluaciones publicadas en este parcial</h3>
                    <p>Cuando se publiquen pruebas de este parcial, aparecerán organizadas por tema aquí.</p>
                  </div>
                ) : (
                  <ul className="instructor-bank-topic-list pb-eval-topic-list">
                    {activeTests.map((prueba, idx) => (
                      <PublicTestTopicCard
                        key={prueba.id}
                        prueba={prueba}
                        orderNum={String(idx + 1).padStart(2, '0')}
                        isWeekly={prueba.tema_id != null && weeklyThemeIds.includes(prueba.tema_id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {!isLoading && (canBypass || !isFeatureDisabled('evaluations', maintenanceStatus?.disabledFeatures ?? [])) && (
            <div className="pb-eval-instructors-slot">
              <PublicInstructorTests reloadKey={reloadTick} />
            </div>
          )}

          {user?.rol === 'Administrador' && (
            <div className="pb-eval-audit-bar">
              <button
                type="button"
                className="instructor-btn"
                onClick={() => navigate('/historial?entity=prueba')}
                title="Ver historial y auditoría de creación y edición de pruebas"
              >
                <Shield size={16} aria-hidden="true" />
                <span>Ver Historial y Auditoría de Pruebas</span>
              </button>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

const pageStyles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'transparent',
    color: '#0f172a',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    boxSizing: 'border-box',
    width: '100%',
    padding: 'clamp(8px, 2vw, 24px)',
  },
  main: {
    width: '100%',
    maxWidth: '1600px',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    flexDirection: 'column',
    gap: 0,
    padding: 0,
    margin: '0 auto',
    background: '#ffffff',
    borderLeft: '1px solid rgba(186, 225, 249, 0.92)',
    borderRight: '1px solid rgba(186, 225, 249, 0.92)',
    borderTop: 'none',
    borderBottom: 'none',
    boxShadow: '0 16px 42px rgba(8, 33, 75, 0.16)',
    boxSizing: 'border-box',
    flex: 1,
  },
  boardCard: {
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
    background: '#ffffff',
    borderRadius: 0,
    padding: 0,
    boxShadow: 'none',
    border: 'none',
    margin: 0,
    boxSizing: 'border-box',
    flex: 1,
  },
};

export default Evaluaciones;
