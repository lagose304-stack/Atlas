import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { supabase } from '../services/supabase';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { ArrowRight, BookOpenCheck, CalendarDays, ClipboardCheck, Sparkles } from 'lucide-react';

interface PruebaPublica {
  id: string;
  nombre: string;
  instrucciones: string;
  scope: 'parcial' | 'tema' | 'subtema';
  parcial_key: 'primer' | 'segundo' | 'tercer';
  created_at: string;
  image_url?: string | null;
  tema?: { id: number; nombre: string } | null;
  subtema?: { id: number; nombre: string } | null;
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

const TestCard: React.FC<{
  prueba: PruebaPublica;
  badge: string;
  badges?: string[];
}> = ({ prueba, badge, badges = [] }) => {
  const [logoFailed, setLogoFailed] = React.useState(false);
  const logoSrc = prueba.image_url ? getCloudinaryImageUrl(prueba.image_url, 'cardWide') : '';
  const logoSrcSet = prueba.image_url
    ? `${getCloudinaryImageUrl(prueba.image_url, 'cardWideSmall')} 640w, ${getCloudinaryImageUrl(prueba.image_url, 'cardWide')} 960w`
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
            alt={prueba.nombre}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }}
            loading="lazy"
            decoding="async"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span style={s.imageFallback}><BookOpenCheck size={28} aria-hidden="true" /><strong>{prueba.nombre}</strong></span>
        )}
      </div>

      <div className="evaluacion-test-body" style={{ padding: '17px 18px', display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={s.badge}>{badge}</span>
          <span style={s.meta}><CalendarDays size={13} aria-hidden="true" />{new Date(prueba.created_at).toLocaleDateString('es-MX')}</span>
        </div>

        <h4 style={s.cardTitle}>{prueba.nombre}</h4>
        <p style={s.cardText}>{prueba.instrucciones || 'Sin instrucciones registradas.'}</p>

        <div style={s.cardFooter}>
          {badges.map((b) => (
            <span key={b} style={s.scopeTag}>{b}</span>
          ))}
          <Link to={`/evaluaciones/ejecutar/${prueba.id}`} state={{ from: '/evaluaciones' }} style={s.startButton}>Iniciar prueba <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </div>
    </article>
  );
};

const Evaluaciones: React.FC = () => {
  const [pruebas, setPruebas] = React.useState<PruebaPublica[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [selectedParcial, setSelectedParcial] = React.useState<ParcialSection['key']>('primer');

  React.useEffect(() => {
    const loadPublicTests = async () => {
      setIsLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('pruebas')
        .select('id, nombre, instrucciones, scope, parcial_key, created_at, image_url, tema:temas(id, nombre), subtema:subtemas(id, nombre)')
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

  const parcialSections = React.useMemo<ParcialSection[]>(() => {
    return PARCIALES.map((parcial) => {
      const testsForParcial = pruebas.filter((item) => item.parcial_key === parcial.key);

      return {
        key: parcial.key,
        title: parcial.title,
        parcialTests: testsForParcial.filter((item) => item.scope === 'parcial'),
        temaTests: testsForParcial.filter((item) => item.scope === 'tema'),
        subtemaTests: testsForParcial.filter((item) => item.scope === 'subtema'),
      };
    });
  }, [pruebas]);

  const hasAnyPublishedTest = parcialSections.some(
    (section) => section.parcialTests.length || section.temaTests.length || section.subtemaTests.length,
  );

  const availableSections = React.useMemo(
    () => parcialSections.filter((section) => section.parcialTests.length || section.temaTests.length || section.subtemaTests.length),
    [parcialSections],
  );

  React.useEffect(() => {
    if (availableSections.length > 0 && !availableSections.some((section) => section.key === selectedParcial)) {
      setSelectedParcial(availableSections[0].key);
    }
  }, [availableSections, selectedParcial]);

  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>
        <section className="evaluaciones-hero" style={s.hero}>
          <div style={s.heroGlow} aria-hidden="true" />
          <div style={s.heroIcon}><ClipboardCheck size={30} strokeWidth={2} aria-hidden="true" /></div>
          <div style={s.heroCopy}>
            <p style={s.kicker}><Sparkles size={14} aria-hidden="true" /> Zona de reto académico</p>
            <h1 style={s.title}>Pon a prueba lo que has aprendido</h1>
          </div>
          <div className="evaluaciones-hero-stat" style={s.heroStat}>
            <strong>{pruebas.length}</strong>
            <span>{pruebas.length === 1 ? 'evaluación disponible' : 'evaluaciones disponibles'}</span>
          </div>
        </section>

        <section style={s.card}>
          {isLoading ? (
            <div style={s.statusBox}><span className="route-loading-spinner" /> <div><strong>Preparando evaluaciones</strong><span>Estamos organizando el contenido disponible.</span></div></div>
          ) : error ? (
            <div style={{ ...s.statusBox, ...s.errorBox }}><strong>No pudimos cargar las evaluaciones</strong><span>{error}</span></div>
          ) : !hasAnyPublishedTest ? (
            <div style={s.statusBox}><BookOpenCheck size={28} aria-hidden="true" /><div><strong>Aún no hay evaluaciones publicadas</strong><span>Cuando haya contenido disponible aparecerá organizado en esta página.</span></div></div>
          ) : (
            <>
              <div className="evaluaciones-overview-grid" style={s.overviewGrid}>
                {availableSections.map((section, index) => {
                  const count = section.parcialTests.length + section.temaTests.length + section.subtemaTests.length;
                  const isActive = section.key === selectedParcial;
                  return <button
                    key={section.key}
                    type="button"
                    className={`evaluaciones-filter${isActive ? ' is-active' : ''}`}
                    aria-pressed={isActive}
                    onClick={() => setSelectedParcial(section.key)}
                    style={s.overviewCard}
                  >
                    <span style={s.overviewNumber}>{index + 1}</span>
                    <span><strong style={s.overviewTitle}>{section.title}</strong><small style={s.overviewMeta}>{count} {count === 1 ? 'prueba' : 'pruebas'}</small></span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>;
                })}
              </div>
              <div style={s.parcialSections}>
              {availableSections.filter((section) => section.key === selectedParcial).map((section) => {
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
                        {section.parcialTests.length > 0 && <div className="evaluaciones-scope" style={s.scopeBlock}>
                          <h3 style={s.scopeTitle}>Pruebas por parcial</h3>
                          <div className="evaluaciones-grid" style={s.grid}>
                              {section.parcialTests.map((prueba) => (
                                <TestCard key={prueba.id} prueba={prueba} badge="Parcial" />
                              ))}
                            </div>
                        </div>}

                        {section.temaTests.length > 0 && <div className="evaluaciones-scope" style={s.scopeBlock}>
                          <h3 style={s.scopeTitle}>Pruebas por tema</h3>
                          <div className="evaluaciones-grid" style={s.grid}>
                              {section.temaTests.map((prueba) => (
                                <TestCard key={prueba.id} prueba={prueba} badge="Tema" badges={[prueba.tema?.nombre ?? 'Tema sin identificar']} />
                              ))}
                            </div>
                        </div>}

                        {section.subtemaTests.length > 0 && <div className="evaluaciones-scope" style={s.scopeBlock}>
                          <h3 style={s.scopeTitle}>Pruebas por subtema</h3>
                          <div className="evaluaciones-grid" style={s.grid}>
                              {section.subtemaTests.map((prueba) => (
                                <TestCard key={prueba.id} prueba={prueba} badge="Subtema" badges={[prueba.tema?.nombre ?? 'Tema sin identificar', prueba.subtema?.nombre ?? 'Subtema sin identificar']} />
                              ))}
                            </div>
                        </div>}
                      </>
                    )}
                  </section>
                );
              })}
              </div>
            </>
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
    fontSize: 'clamp(1.8rem, 3.8vw, 2.8rem)',
    lineHeight: 1.15,
    fontWeight: 900,
    maxWidth: '30ch',
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
