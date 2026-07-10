import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { supabase } from '../services/supabase';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';

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
  const [hovered, setHovered] = React.useState(false);
  const [logoFailed, setLogoFailed] = React.useState(false);
  const logoSrc = prueba.image_url ? getCloudinaryImageUrl(prueba.image_url, 'cardWide') : '';
  const logoSrcSet = prueba.image_url
    ? `${getCloudinaryImageUrl(prueba.image_url, 'cardWideSmall')} 640w, ${getCloudinaryImageUrl(prueba.image_url, 'cardWide')} 960w`
    : undefined;

  const baseStyle: React.CSSProperties = {
    borderRadius: '12px',
    background: '#ffffff',
    boxShadow: hovered ? '0 18px 40px rgba(23,50,82,0.14)' : '0 8px 20px rgba(23,50,82,0.08)',
    cursor: 'pointer',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
    border: hovered ? '1px solid rgba(97,143,202,0.36)' : '1px solid rgba(199,215,232,0.92)',
    transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    gap: '8px',
    minHeight: '160px',
    overflow: 'hidden',
  };

  return (
    <article
      style={baseStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          height: '96px',
          width: '100%',
          overflow: 'hidden',
          borderBottom: '1px solid rgba(201,217,233,0.92)',
          background: '#e8f1fa',
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
          <span style={{ fontSize: '1em', color: '#1e3a5f', padding: '6px 10px' }}>{prueba.nombre}</span>
        )}
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={s.badge}>{badge}</span>
          <span style={s.meta}>{new Date(prueba.created_at).toLocaleDateString('es-MX')}</span>
        </div>

        <h4 style={s.cardTitle}>{prueba.nombre}</h4>
        <p style={s.cardText}>{prueba.instrucciones || 'Sin instrucciones registradas.'}</p>

        <div style={s.cardFooter}>
          {badges.map((b) => (
            <span key={b} style={s.scopeTag}>{b}</span>
          ))}
          <Link to={`/evaluaciones/ejecutar/${prueba.id}`} state={{ from: '/evaluaciones' }} style={s.startButton}>Iniciar prueba</Link>
        </div>
      </div>
    </article>
  );
};

const Evaluaciones: React.FC = () => {
  const [pruebas, setPruebas] = React.useState<PruebaPublica[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');

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

  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>
        <section style={s.card}>
          <p style={s.kicker}>Zona de reto académico</p>
          <h1 style={s.title}>Esta sección es especial para poner a prueba tus conocimientos</h1>
          <p style={s.text}>
            Encontrarás las evaluaciones publicadas organizadas por parcial. En cada parcial verás primero
            las pruebas generales, luego las de tema y al final las de subtema.
          </p>

          {isLoading ? (
            <div style={s.statusBox}>Cargando evaluaciones...</div>
          ) : error ? (
            <div style={s.statusBox}>{error}</div>
          ) : !hasAnyPublishedTest ? (
            <div style={s.statusBox}>Aún no hay evaluaciones publicadas.</div>
          ) : (
            <div style={s.parcialSections}>
              {parcialSections.map((section) => {
                const hasTests = section.parcialTests.length || section.temaTests.length || section.subtemaTests.length;

                return (
                  <section key={section.key} style={s.parcialBlock}>
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
                        <div style={s.scopeBlock}>
                          <h3 style={s.scopeTitle}>Pruebas por parcial</h3>
                          {section.parcialTests.length === 0 ? (
                            <div style={s.innerEmpty}>No hay pruebas de parcial publicadas.</div>
                          ) : (
                              <div className="evaluaciones-grid" style={s.grid}>
                              {section.parcialTests.map((prueba) => (
                                <TestCard key={prueba.id} prueba={prueba} badge="Parcial" />
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={s.scopeBlock}>
                          <h3 style={s.scopeTitle}>Pruebas por tema</h3>
                          {section.temaTests.length === 0 ? (
                            <div style={s.innerEmpty}>No hay pruebas por tema publicadas.</div>
                          ) : (
                            <div className="evaluaciones-grid" style={s.grid}>
                              {section.temaTests.map((prueba) => (
                                <TestCard key={prueba.id} prueba={prueba} badge="Tema" badges={[prueba.tema?.nombre ?? 'Tema sin identificar']} />
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={s.scopeBlock}>
                          <h3 style={s.scopeTitle}>Pruebas por subtema</h3>
                          {section.subtemaTests.length === 0 ? (
                            <div style={s.innerEmpty}>No hay pruebas por subtema publicadas.</div>
                          ) : (
                            <div className="evaluaciones-grid" style={s.grid}>
                              {section.subtemaTests.map((prueba) => (
                                <TestCard key={prueba.id} prueba={prueba} badge="Subtema" badges={[prueba.tema?.nombre ?? 'Tema sin identificar', prueba.subtema?.nombre ?? 'Subtema sin identificar']} />
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </section>
                );
              })}
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
    background: 'linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)',
  },
  main: {
    width: '100%',
    maxWidth: '1180px',
    margin: '0 auto',
    padding: '32px 16px 56px',
    boxSizing: 'border-box',
    flex: 1,
  },
  card: {
    width: '100%',
    borderRadius: '28px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    boxShadow: '0 18px 40px rgba(15,23,42,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '28px',
    gap: '18px',
  },
  kicker: {
    margin: 0,
    padding: '7px 12px',
    borderRadius: '999px',
    background: '#dbeafe',
    color: '#1d4ed8',
    fontSize: '0.82rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: 'clamp(1.8rem, 3.8vw, 2.8rem)',
    lineHeight: 1.15,
    fontWeight: 900,
    maxWidth: '28ch',
  },
  text: {
    margin: 0,
    maxWidth: '72ch',
    color: '#475569',
    fontSize: '1rem',
    lineHeight: 1.7,
  },
  statusBox: {
    width: '100%',
    maxWidth: '880px',
    borderRadius: '18px',
    border: '1px dashed #cbd5e1',
    background: '#f8fafc',
    color: '#475569',
    padding: '18px 20px',
    fontWeight: 700,
    textAlign: 'left',
  },
  parcialSections: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  parcialBlock: {
    width: '100%',
    borderRadius: '22px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    textAlign: 'left',
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
    fontSize: '1.2rem',
    color: '#0f172a',
    fontWeight: 900,
  },
  parcialCount: {
    borderRadius: '999px',
    padding: '6px 10px',
    background: '#eff6ff',
    color: '#1d4ed8',
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
    color: '#1e293b',
    fontSize: '0.95rem',
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
    gridTemplateColumns: 'repeat(3, 1fr)',
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
  },
  cardTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '1.02rem',
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
    display: 'inline-block',
    marginLeft: 'auto',
    padding: '8px 12px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    color: '#fff',
    fontWeight: 800,
    textDecoration: 'none',
  },
};

export default Evaluaciones;
