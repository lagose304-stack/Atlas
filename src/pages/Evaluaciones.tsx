import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { hasHtmlMarkup, toSafeHtml } from '../services/richText';
import { getRenderableBlocks } from '../services/contentPublication';
import { collectWeeklyThemeIds, groupHistoricalTestsByPartial, orderTestsByWeeklyPriority } from './evaluacionesUtils';
import { ArrowRight, BookOpenCheck, CalendarDays, ClipboardCheck, Sparkles, Shield } from 'lucide-react';

interface PruebaPublica {
  id: string;
  nombre: string;
  instrucciones: string;
  scope: 'parcial' | 'tema' | 'subtema';
  parcial_key: 'primer' | 'segundo' | 'tercer';
  created_at: string;
  image_url?: string | null;
  tema_id?: number | null;
  subtema_id?: number | null;
  tema?: { id: number; nombre: string; logo_url?: string | null } | null;
  subtema?: { id: number; nombre: string; logo_url?: string | null } | null;
}

interface ParcialSection {
  key: 'primer' | 'segundo' | 'tercer';
  title: string;
  parcialTests: PruebaPublica[];
  temaTests: PruebaPublica[];
  subtemaTests: PruebaPublica[];
}

const PARCIALES: Array<{ key: 'primer' | 'segundo' | 'tercer'; title: string }> = [
  { key: 'primer', title: 'Primer parcial' },
  { key: 'segundo', title: 'Segundo parcial' },
  { key: 'tercer', title: 'Tercer parcial' },
];

const HISTORICAL_SCOPE_ORDER: Record<PruebaPublica['scope'], number> = {
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

const TestCard: React.FC<{
  prueba: PruebaPublica;
  badge: string;
  badges?: string[];
}> = ({ prueba, badge, badges = [] }) => {
  const { user } = useAuth();
  const [logoFailed, setLogoFailed] = React.useState(false);
  const plainName = toPlainText(prueba.nombre) || 'Prueba';
  const rawImage = prueba.image_url || prueba.subtema?.logo_url || prueba.tema?.logo_url || '';
  const logoSrc = rawImage ? getCloudinaryImageUrl(rawImage, 'cardWide') : '';
  const logoSrcSet = rawImage
    ? `${getCloudinaryImageUrl(rawImage, 'cardWideSmall')} 640w, ${getCloudinaryImageUrl(rawImage, 'cardWide')} 960w`
    : undefined;

  const baseStyle: React.CSSProperties = {
    borderRadius: '18px',
    background: '#ffffff',
    boxShadow: '0 7px 22px rgba(23,61,94,0.07)',
    border: '1px solid rgba(196,215,230,0.85)',
    display: 'grid',
    gridTemplateColumns: '132px minmax(0, 1fr)',
    padding: '0',
    minHeight: '190px',
    overflow: 'hidden',
  };

  return (
    <article
      className="evaluacion-test-card"
      style={baseStyle}
    >
      <div
        className="evaluacion-test-image"
        style={{
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          background: 'linear-gradient(145deg, #e1f2fc, #cfe5f5)',
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
          <span style={s.imageFallback}><BookOpenCheck size={28} aria-hidden="true" /><strong>{plainName}</strong></span>
        )}
      </div>

      <div className="evaluacion-test-body" style={{ padding: '17px 18px', display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={s.badge}>{badge}</span>
          <span style={s.meta}><CalendarDays size={13} aria-hidden="true" />{new Date(prueba.created_at).toLocaleDateString('es-MX')}</span>
        </div>

        <h4 style={s.cardTitle}><InlineRichText value={prueba.nombre} fallback="Prueba" /></h4>
        <p style={s.cardText}><InlineRichText value={prueba.instrucciones} fallback="Sin instrucciones registradas." /></p>

        <div style={s.cardFooter}>
          {badges.map((b) => (
            <span key={b} style={s.scopeTag}>{b}</span>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
            {user?.rol === 'Administrador' && (
              <Link
                to={`/historial?scope=prueba&pruebaId=${encodeURIComponent(String(prueba.id))}&pruebaNombre=${encodeURIComponent(plainName)}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '7px 11px',
                  background: '#faf5ff',
                  border: '1px solid #d8b4fe',
                  borderRadius: '10px',
                  color: '#7e22ce',
                  fontSize: '0.78rem',
                  fontWeight: 750,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 5px rgba(126, 34, 206, 0.1)',
                }}
                title="Ver historial exclusivo de cambios para esta evaluación"
              >
                <Shield size={13} />
                <span>Historial</span>
              </Link>
            )}
            <Link to={`/evaluaciones/ejecutar/${prueba.id}`} state={{ from: '/evaluaciones' }} style={s.startButton}>Iniciar prueba <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </div>
      </div>
    </article>
  );
};

const Evaluaciones: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pruebas, setPruebas] = React.useState<PruebaPublica[]>([]);
  const [weeklyThemeIds, setWeeklyThemeIds] = React.useState<number[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
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

  React.useEffect(() => {
    const loadPublicTests = async () => {
      setIsLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('pruebas')
        .select('id, nombre, instrucciones, scope, parcial_key, created_at, image_url, tema_id, subtema_id, tema:temas(id, nombre, logo_url), subtema:subtemas(id, nombre, logo_url)')
        .eq('estado', 'publicada')
        .order('created_at', { ascending: false });

      if (queryError) {
        setPruebas([]);
        setError('No se pudieron cargar las evaluaciones publicadas.');
      } else {
        setPruebas((data ?? []) as unknown as PruebaPublica[]);
      }

      setIsLoading(false);
    };

    void loadPublicTests();
  }, []);

  const orderedPruebas = React.useMemo(
    () => orderTestsByWeeklyPriority(pruebas, weeklyThemeIds),
    [pruebas, weeklyThemeIds],
  );

  const parcialSections = React.useMemo<ParcialSection[]>(() => {
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

  const getHistoricalParcialGroups = React.useCallback((section: ParcialSection) => {
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

  const getWeeklyThemeGroups = React.useCallback((section: ParcialSection) => {
    const weeklyItems = [
      ...section.parcialTests.filter((prueba) => prueba.tema_id != null && weeklyThemeIds.includes(prueba.tema_id)),
      ...section.temaTests.filter((prueba) => prueba.tema_id != null && weeklyThemeIds.includes(prueba.tema_id)),
      ...section.subtemaTests.filter((prueba) => prueba.tema_id != null && weeklyThemeIds.includes(prueba.tema_id)),
    ];

    const grouped = new Map<string, PruebaPublica[]>();

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

  const hasAnyPublishedTest = parcialSections.some(
    (section) => section.parcialTests.length || section.temaTests.length || section.subtemaTests.length,
  );

  return (
    <div style={s.page}>
      <style>{`
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
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
        }
      `}</style>
      <Header />
      <main style={s.main}>
        <section className="evaluaciones-hero" style={s.hero}>
          <div style={s.heroGlow} aria-hidden="true" />
          <div style={s.heroIcon}><ClipboardCheck size={30} strokeWidth={2} aria-hidden="true" /></div>
          <div style={s.heroCopy}>
            <p style={s.kicker}><Sparkles size={14} aria-hidden="true" /> Zona de reto académico</p>
            <h1 className="evaluaciones-title" style={s.title}>Pon a prueba lo que has aprendido</h1>
          </div>
          <div className="evaluaciones-hero-stat" style={s.heroStat}>
            <strong>{pruebas.length}</strong>
            <span>{pruebas.length === 1 ? 'evaluación disponible' : 'evaluaciones disponibles'}</span>
          </div>
        </section>

        <section style={s.card}>
          {isLoading ? (
            <div style={s.statusBox}><span className="route-loading-spinner" /> <div style={s.statusCopy}><strong>Preparando evaluaciones</strong><span>Estamos organizando el contenido disponible.</span></div></div>
          ) : error ? (
            <div style={{ ...s.statusBox, ...s.errorBox }}><div style={s.statusCopy}><strong>No pudimos cargar las evaluaciones</strong><span>{error}</span></div></div>
          ) : !hasAnyPublishedTest ? (
            <div style={s.statusBox}><BookOpenCheck size={28} aria-hidden="true" /><div style={s.statusCopy}><strong>Aún no hay evaluaciones publicadas</strong><span>Cuando haya contenido disponible, aparecerá organizado en esta página.</span></div></div>
          ) : (
            <>
              <div style={s.parcialSections}>
              {parcialSections.filter((section) => section.parcialTests.length || section.temaTests.length || section.subtemaTests.length).map((section) => {
                const hasTests = section.parcialTests.length || section.temaTests.length || section.subtemaTests.length;

                return (
                  <section className="evaluaciones-parcial" key={section.key} id={`evaluaciones-${section.key}`} style={s.parcialBlock}>
                    <header style={s.parcialHeader}>
                      <h2 style={s.parcialTitle}>{section.title}</h2>
                      <span style={s.parcialCount}>
                        {section.parcialTests.length + section.temaTests.length + section.subtemaTests.length} pruebas
                      </span>
                    </header>

                    {!hasTests ? (
                      <div style={s.innerEmpty}>Sin pruebas publicadas en este parcial.</div>
                    ) : (
                      <>
                        {(() => {
                          const weeklyThemeGroups = getWeeklyThemeGroups(section);
                          const hasWeeklyTests = weeklyThemeGroups.length > 0;

                          if (!hasWeeklyTests) {
                            return null;
                          }

                          return (
                            <div className="evaluaciones-scope" style={s.scopeBlock}>
                              <h3 style={s.scopeTitle}>{weeklyThemeIds.length > 0 ? 'Contenido actual de la semana' : 'Pruebas por parcial'}</h3>
                              <div style={{ display: 'grid', gap: '12px' }}>
                                {weeklyThemeGroups.map((themeGroup) => {
                                  const parcialItems = themeGroup.items.filter((prueba) => prueba.scope === 'parcial');
                                  const temaItems = themeGroup.items.filter((prueba) => prueba.scope === 'tema');
                                  const subtemaItems = themeGroup.items.filter((prueba) => prueba.scope === 'subtema');

                                  return (
                                    <details key={`${section.key}-${themeGroup.key}`} style={s.historyAccordion} open>
                                      <summary style={{ ...s.historySummary, background: 'linear-gradient(135deg, rgba(248,250,252,0.96), rgba(239,246,255,0.9))' }}>
                                        <span style={s.weekThemeSummary}>
                                          <span style={s.weekThemeLabelWrap}>
                                            {themeGroup.items[0]?.image_url ? (
                                              <img
                                                src={getCloudinaryImageUrl(themeGroup.items[0].image_url, 'thumb')}
                                                alt={themeGroup.temaNombre}
                                                style={s.weekThemeThumb}
                                              />
                                            ) : (
                                              <span style={s.weekThemeThumbFallback}>{(themeGroup.temaNombre || 'T').slice(0, 1).toUpperCase()}</span>
                                            )}
                                            <span style={s.weekThemeTitle}>{themeGroup.temaNombre}</span>
                                          </span>
                                          <span style={s.historySummaryMeta}>
                                            <span style={s.historySummaryCount}>{themeGroup.items.length} {themeGroup.items.length === 1 ? 'prueba' : 'pruebas'}</span>
                                            <span aria-hidden="true" style={s.historySummaryArrow}>▾</span>
                                          </span>
                                        </span>
                                      </summary>
                                      <div style={s.historyAccordionBody}>
                                        {parcialItems.length > 0 && (
                                          <div style={s.historyGroupBlock}>
                                            <h4 style={s.historyGroupTitle}>Parcial</h4>
                                            <div className="evaluaciones-grid" style={s.grid}>
                                              {parcialItems.map((prueba) => (
                                                <TestCard key={`week-${section.key}-${themeGroup.key}-parcial-${prueba.id}`} prueba={prueba} badge="Parcial" />
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {temaItems.length > 0 && (
                                          <div style={s.historyGroupBlock}>
                                            <h4 style={s.historyGroupTitle}>Tema</h4>
                                            <div className="evaluaciones-grid" style={s.grid}>
                                              {temaItems.map((prueba) => (
                                                <TestCard key={`week-${section.key}-${themeGroup.key}-tema-${prueba.id}`} prueba={prueba} badge="Tema" badges={[prueba.tema?.nombre ?? 'Tema sin identificar']} />
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {subtemaItems.length > 0 && (
                                          <div style={s.historyGroupBlock}>
                                            <h4 style={s.historyGroupTitle}>Subtema</h4>
                                            <div className="evaluaciones-grid" style={s.grid}>
                                              {subtemaItems.map((prueba) => (
                                                <TestCard key={`week-${section.key}-${themeGroup.key}-subtema-${prueba.id}`} prueba={prueba} badge="Subtema" badges={[prueba.tema?.nombre ?? 'Tema sin identificar', prueba.subtema?.nombre ?? 'Subtema sin identificar']} />
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

                        {(() => {
                          const historicalGroups = getHistoricalParcialGroups(section);
                          const hasHistoricalTests = historicalGroups.some((group) => group.items.length > 0);
                          return hasHistoricalTests ? (
                            <div className="evaluaciones-scope" style={{ ...s.scopeBlock, marginTop: '10px' }}>
                              <div style={s.historyDivider}>
                                <span style={s.historyDividerLabel}>Pruebas anteriores / historial</span>
                              </div>
                              <div style={{ display: 'grid', gap: '12px' }}>
                                {historicalGroups.map((partialGroup) => {
                                  const groupedByTema = new Map<string, PruebaPublica[]>();
                                  partialGroup.items.forEach((prueba) => {
                                    const themeKey = prueba.tema_id ?? prueba.tema?.id;
                                    if (themeKey == null) {
                                      return;
                                    }

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
                                    <details key={`${section.key}-${partialGroup.key}`} style={s.historyAccordion}>
                                      <summary style={{ ...s.historySummary, background: 'linear-gradient(135deg, rgba(248,250,252,0.96), rgba(239,246,255,0.9))' }}>
                                        <span style={s.historySummaryLabel}>{partialGroup.title}</span>
                                        <span style={s.historySummaryMeta}>
                                          <span style={s.historySummaryCount}>{partialGroup.items.length} {partialGroup.items.length === 1 ? 'prueba' : 'pruebas'}</span>
                                          <span aria-hidden="true" style={s.historySummaryArrow}>▾</span>
                                        </span>
                                      </summary>
                                      <div style={s.historyAccordionBody}>
                                        {partialGroup.items.filter((prueba) => prueba.scope === 'parcial').length > 0 && (
                                          <div style={s.historyGroupBlock}>
                                            <h4 style={s.historyGroupTitle}>Parcial</h4>
                                            <div className="evaluaciones-grid" style={s.grid}>
                                              {partialGroup.items.filter((prueba) => prueba.scope === 'parcial').map((prueba) => (
                                                <TestCard key={`history-${section.key}-${partialGroup.key}-${prueba.id}`} prueba={prueba} badge="Historial" />
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
                                                  <details key={`${section.key}-${partialGroup.key}-${themeGroup.key}`} style={{ ...s.historyAccordion, borderRadius: '14px' }}>
                                                    <summary style={{ ...s.historySummary, padding: '12px 14px', fontSize: '0.92rem', background: 'linear-gradient(135deg, rgba(248,250,252,0.9), rgba(224,242,254,0.8))' }}>
                                                      <span style={s.historySummaryLabel}>{themeGroup.temaNombre}</span>
                                                      <span style={s.historySummaryMeta}>
                                                        <span style={s.historySummaryCount}>{themeGroup.items.length} {themeGroup.items.length === 1 ? 'prueba' : 'pruebas'}</span>
                                                        <span aria-hidden="true" style={s.historySummaryArrow}>▾</span>
                                                      </span>
                                                    </summary>
                                                    <div style={{ ...s.historyAccordionBody, padding: '0 14px 14px' }}>
                                                      {partialThemeItems.length > 0 && (
                                                        <div style={s.historyGroupBlock}>
                                                          <h5 style={{ ...s.historyGroupTitle, fontSize: '0.68rem' }}>Parcial</h5>
                                                          <div className="evaluaciones-grid" style={s.grid}>
                                                            {partialThemeItems.map((prueba) => (
                                                              <TestCard key={`history-theme-partial-${section.key}-${prueba.id}`} prueba={prueba} badge="Historial" />
                                                            ))}
                                                          </div>
                                                        </div>
                                                      )}

                                                      {temaItems.length > 0 && (
                                                        <div style={s.historyGroupBlock}>
                                                          <h5 style={{ ...s.historyGroupTitle, fontSize: '0.68rem' }}>Tema</h5>
                                                          <div className="evaluaciones-grid" style={s.grid}>
                                                            {temaItems.map((prueba) => (
                                                              <TestCard key={`history-theme-tema-${section.key}-${prueba.id}`} prueba={prueba} badge="Historial" badges={[prueba.tema?.nombre ?? 'Tema sin identificar']} />
                                                            ))}
                                                          </div>
                                                        </div>
                                                      )}

                                                      {subtemaItems.length > 0 && (
                                                        <div style={s.historyGroupBlock}>
                                                          <h5 style={{ ...s.historyGroupTitle, fontSize: '0.68rem' }}>Subtema</h5>
                                                          <div className="evaluaciones-grid" style={s.grid}>
                                                            {subtemaItems.map((prueba) => (
                                                              <TestCard key={`history-theme-subtema-${section.key}-${prueba.id}`} prueba={prueba} badge="Historial" badges={[prueba.tema?.nombre ?? 'Tema sin identificar', prueba.subtema?.nombre ?? 'Subtema sin identificar']} />
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
                          ) : null;
                        })()}
                      </>
                    )}
                  </section>
                );
              })}
              </div>
            </>
          )}

          {user?.rol === 'Administrador' && (
            <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => navigate('/historial?entity=prueba')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '0.88em',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.25)',
                }}
                title="Ver historial y auditoría de creación y edición de pruebas"
              >
                <Shield size={16} />
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

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'radial-gradient(circle at 8% 8%, rgba(186,230,253,.55), transparent 28%), radial-gradient(circle at 92% 18%, rgba(219,234,254,.72), transparent 25%), linear-gradient(180deg, #f7fbff 0%, #edf5fc 52%, #f8fbff 100%)',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
  },
  main: {
    width: '100%',
    maxWidth: '1240px',
    margin: '0 auto',
    padding: 'clamp(20px, 4vw, 42px) 16px 58px',
    boxSizing: 'border-box',
    flex: 1,
  },
  hero: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '30px',
    border: '1px solid rgba(157,210,245,.75)',
    background: 'linear-gradient(125deg, rgba(255,255,255,.98), rgba(231,246,255,.96) 52%, rgba(218,238,255,.94))',
    boxShadow: '0 24px 58px rgba(20,72,118,.13)',
    padding: 'clamp(24px, 4vw, 42px)',
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0,1fr) auto',
    alignItems: 'center',
    gap: 'clamp(18px, 3vw, 30px)',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: '22px',
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
    width: '66px',
    height: '66px',
    borderRadius: '21px',
    display: 'grid',
    placeItems: 'center',
    color: '#fff',
    background: 'linear-gradient(145deg, #1677b8, #2563a9)',
    boxShadow: '0 14px 30px rgba(22,119,184,.25)',
  },
  heroCopy: { minWidth: 0 },
  heroStat: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '150px',
    padding: '15px 18px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,.72)',
    border: '1px solid rgba(147,197,253,.65)',
    color: '#315b82',
    fontSize: '.78rem',
    fontWeight: 700,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
  },
  kicker: {
    margin: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '6px 11px',
    borderRadius: '999px',
    background: 'rgba(219,234,254,.8)',
    color: '#176aa5',
    fontSize: '0.74rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '9px 0 8px',
    color: '#0f172a',
    fontSize: 'clamp(1.35rem, 2.2vw, 1.9rem)',
    lineHeight: 1.1,
    fontWeight: 900,
    maxWidth: '36ch',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'block',
  },
  text: {
    margin: 0,
    maxWidth: '68ch',
    color: '#475569',
    fontSize: '1rem',
    lineHeight: 1.7,
  },
  statusBox: {
    width: '100%',
    maxWidth: '100%',
    borderRadius: '18px',
    border: '1px solid #cfe3f4',
    background: 'rgba(255,255,255,.82)',
    color: '#475569',
    padding: '18px 20px',
    fontWeight: 700,
    textAlign: 'left',
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
  overviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
    gap: '12px',
  },
  overviewCard: {
    display: 'grid',
    gridTemplateColumns: '42px minmax(0,1fr) auto',
    alignItems: 'center',
    gap: '11px',
    padding: '13px 14px',
    borderRadius: '18px',
    border: '1px solid #cfe3f4',
    background: 'linear-gradient(145deg, rgba(255,255,255,.95), rgba(238,248,255,.92))',
    color: '#173f72',
    textDecoration: 'none',
    boxShadow: '0 8px 22px rgba(20,67,112,.07)',
  },
  overviewNumber: {
    width: '40px', height: '40px', borderRadius: '13px', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900,
    background: 'linear-gradient(145deg, #2296c9, #2563a9)', boxShadow: '0 6px 14px rgba(37,99,169,.2)',
  },
  overviewTitle: { display: 'block', fontSize: '.92rem' },
  overviewMeta: { display: 'block', marginTop: '2px', color: '#63809d', fontSize: '.75rem', fontWeight: 700 },
  contentIntro: {
    display: 'flex', alignItems: 'center', gap: '11px', padding: '13px 15px', borderRadius: '16px',
    color: '#315b82', background: 'rgba(231,244,253,.76)', border: '1px solid #cfe3f4', fontSize: '.84rem',
  },
  parcialSections: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  parcialBlock: {
    width: '100%',
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
    paddingBottom: '6px',
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
    padding: '6px 10px',
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
    transition: 'background 0.2s ease, border-color 0.2s ease',
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
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    objectFit: 'cover',
    border: '2px solid rgba(147,197,253,0.9)',
    boxShadow: '0 10px 24px rgba(59,130,246,0.18)',
    background: 'linear-gradient(135deg, #e0f2fe, #dbeafe)',
    flexShrink: 0,
  },
  weekThemeThumbFallback: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.06rem',
    fontWeight: 900,
    color: '#1d4ed8',
    background: 'linear-gradient(135deg, #dbeafe, #e0f2fe)',
    border: '2px solid rgba(147,197,253,0.9)',
    boxShadow: '0 10px 24px rgba(59,130,246,0.12)',
    flexShrink: 0,
  },
  weekThemeTitle: {
    margin: 0,
    fontSize: '1.08rem',
    lineHeight: 1.2,
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: '0.01em',
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
    padding: '5px 10px',
    fontSize: '0.76rem',
    fontWeight: 800,
    minWidth: '84px',
  },
  historySummaryArrow: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, rgba(191,219,254,0.7), rgba(224,242,254,0.9))',
    color: '#1d4ed8',
    fontSize: '1rem',
    fontWeight: 900,
    lineHeight: 1,
    boxShadow: 'inset 0 0 0 1px rgba(96,165,250,0.18)',
    transform: 'rotate(0deg)',
    transition: 'transform 0.2s ease',
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
  },
  grid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '14px',
    justifyContent: 'start',
  },
  testCard: {
    borderRadius: '18px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minHeight: '170px',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  badge: {
    borderRadius: '999px',
    padding: '5px 10px',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '0.75rem',
    fontWeight: 800,
  },
  badgeTema: {
    borderRadius: '999px',
    padding: '5px 10px',
    background: '#dbeafe',
    color: '#1d4ed8',
    fontSize: '0.75rem',
    fontWeight: 800,
  },
  badgeSubtema: {
    borderRadius: '999px',
    padding: '5px 10px',
    background: '#ede9fe',
    color: '#6d28d9',
    fontSize: '0.75rem',
    fontWeight: 800,
  },
  meta: {
    color: '#64748b',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  cardTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '1.08rem',
    lineHeight: 1.35,
  },
  cardText: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.55,
    fontSize: '0.92rem',
  },
  cardFooter: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: 'auto',
  },
  scopeTag: {
    borderRadius: '999px',
    padding: '5px 10px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '0.72rem',
    fontWeight: 800,
  },
  startButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginLeft: 'auto',
    padding: '8px 12px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #1677b8, #2563a9)',
    color: '#fff',
    fontWeight: 800,
    textDecoration: 'none',
    boxShadow: '0 8px 18px rgba(22,119,184,.2)',
  },
  imageFallback: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#315b82', padding: '12px', textAlign: 'center' },
};

export default Evaluaciones;
