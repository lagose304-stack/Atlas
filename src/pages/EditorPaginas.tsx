import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PageContentEditor from '../components/PageContentEditor';
import { supabase } from '../services/supabase';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';

type PageTarget = 'home' | 'temario' | 'tema' | 'subtema';

interface TemaItem {
  id: number;
  nombre: string;
  parcial: string;
  sort_order?: number | null;
}

interface SubtemaItem {
  id: number;
  nombre: string;
  tema_id: number;
  sort_order?: number | null;
}

const PAGE_OPTIONS: Array<{
  key: PageTarget;
  title: string;
  description: string;
  route: string;
  accent: string;
}> = [
  {
    key: 'home',
    title: 'Inicio',
    description: 'Portada principal del atlas.',
    route: '/',
    accent: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
  },
  {
    key: 'temario',
    title: 'Temario',
    description: 'Página general del temario público.',
    route: '/temario',
    accent: 'linear-gradient(135deg, #6366f1, #818cf8)',
  },
  {
    key: 'tema',
    title: 'Tema individual',
    description: 'Contenido de la página de un tema.',
    route: '/subtemas/:temaId',
    accent: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
  },
  {
    key: 'subtema',
    title: 'Subtema individual',
    description: 'Contenido de la página de un subtema.',
    route: '/ver-placas/:subtemaId',
    accent: 'linear-gradient(135deg, #10b981, #34d399)',
  },
];

const EditorPaginas: React.FC = () => {
  const navigate = useNavigate();
  const handleGoBack = useSmartBackNavigation('/edicion');
  const [selectedTarget, setSelectedTarget] = useState<PageTarget | null>(null);
  const [temas, setTemas] = useState<TemaItem[]>([]);
  const [subtemas, setSubtemas] = useState<SubtemaItem[]>([]);
  const [selectedTemaId, setSelectedTemaId] = useState<number | null>(null);
  const [selectedSubtemaId, setSelectedSubtemaId] = useState<number | null>(null);
  const [loadingTemas, setLoadingTemas] = useState(true);
  const [loadingSubtemas, setLoadingSubtemas] = useState(false);

  useEffect(() => {
    const loadTemas = async () => {
      setLoadingTemas(true);
      const { data } = await supabase
        .from('temas')
        .select('id, nombre, parcial, sort_order')
        .order('parcial', { ascending: true })
        .order('sort_order', { ascending: true });

      setTemas((data ?? []) as TemaItem[]);
      setLoadingTemas(false);
    };

    void loadTemas();
  }, []);

  useEffect(() => {
    if (!selectedTemaId || selectedTarget !== 'subtema') {
      setSubtemas([]);
      setSelectedSubtemaId(null);
      return;
    }

    const loadSubtemas = async () => {
      setLoadingSubtemas(true);
      const { data } = await supabase
        .from('subtemas')
        .select('id, nombre, tema_id, sort_order')
        .eq('tema_id', selectedTemaId)
        .order('sort_order', { ascending: true });

      setSubtemas((data ?? []) as SubtemaItem[]);
      setLoadingSubtemas(false);
    };

    void loadSubtemas();
  }, [selectedTarget, selectedTemaId]);

  const selectedPageOption = useMemo(
    () => PAGE_OPTIONS.find(option => option.key === selectedTarget) ?? null,
    [selectedTarget]
  );

  const selectedTema = useMemo(
    () => temas.find(tema => tema.id === selectedTemaId) ?? null,
    [selectedTemaId, temas]
  );

  const selectedSubtema = useMemo(
    () => subtemas.find(subtema => subtema.id === selectedSubtemaId) ?? null,
    [selectedSubtemaId, subtemas]
  );

  const editorConfig = useMemo(() => {
    if (selectedTarget === 'home') {
      return { entityType: 'home_page' as const, entityId: 0, title: 'Inicio', subtitle: 'Edita la portada pública del atlas.' };
    }

    if (selectedTarget === 'temario') {
      return { entityType: 'subtemas_page' as const, entityId: 0, title: 'Temario', subtitle: 'Edita la página pública del temario.' };
    }

    if (selectedTarget === 'tema' && selectedTema) {
      return {
        entityType: 'subtemas_page' as const,
        entityId: selectedTema.id,
        title: `Tema: ${selectedTema.nombre}`,
        subtitle: 'Edita el contenido que aparece antes de sus subtemas.',
      };
    }

    if (selectedTarget === 'subtema' && selectedSubtema) {
      return {
        entityType: 'placas_page' as const,
        entityId: selectedSubtema.id,
        title: `Subtema: ${selectedSubtema.nombre}`,
        subtitle: 'Edita el contenido que aparece antes de sus placas.',
      };
    }

    return null;
  }, [selectedTarget, selectedTema, selectedSubtema]);

  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>
        <BackButton onClick={handleGoBack} />

        <div style={s.heroCard}>
          <div>
            <p style={s.kicker}>Editor de páginas</p>
            <h1 style={s.title}>Primero eliges la página, luego editas su contenido</h1>
            <p style={s.subtitle}>
              Esta versión cubre Inicio, Temario, páginas de tema y páginas de subtema. Evaluaciones se deja para después.
            </p>
          </div>
          {selectedPageOption && (
            <div style={s.selectedBadge}>
              <span style={s.selectedBadgeLabel}>Editando</span>
              <strong>{selectedPageOption.title}</strong>
            </div>
          )}
        </div>

        <section style={s.sectionCard}>
          <div style={s.sectionHeader}>
            <h2 style={s.sectionTitle}>1. Selecciona la página</h2>
            <p style={s.sectionSubtitle}>Escoge qué vista pública quieres editar.</p>
          </div>

          <div style={s.pageGrid}>
            {PAGE_OPTIONS.map(option => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  setSelectedTarget(option.key);
                  if (option.key !== 'tema' && option.key !== 'subtema') {
                    setSelectedTemaId(null);
                    setSelectedSubtemaId(null);
                  }
                  if (option.key !== 'subtema') {
                    setSelectedSubtemaId(null);
                  }
                }}
                style={{
                  ...s.pageOption,
                  ...(selectedTarget === option.key ? s.pageOptionActive : {}),
                }}
              >
                <span style={{ ...s.pageOptionAccent, background: option.accent }} />
                <strong style={s.pageOptionTitle}>{option.title}</strong>
                <span style={s.pageOptionDesc}>{option.description}</span>
              </button>
            ))}
          </div>
        </section>

        {selectedTarget === 'tema' && (
          <section style={s.sectionCard}>
            <div style={s.sectionHeader}>
              <h2 style={s.sectionTitle}>2. Elige un tema</h2>
              <p style={s.sectionSubtitle}>Selecciona el tema que quieres editar.</p>
            </div>
            {loadingTemas ? (
              <div style={s.loadingState}>Cargando temas...</div>
            ) : (
              <select
                style={s.select}
                value={selectedTemaId ?? ''}
                onChange={e => setSelectedTemaId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Selecciona un tema...</option>
                {temas.map(tema => (
                  <option key={tema.id} value={tema.id}>
                    {tema.nombre}
                  </option>
                ))}
              </select>
            )}
          </section>
        )}

        {selectedTarget === 'subtema' && (
          <>
            <section style={s.sectionCard}>
              <div style={s.sectionHeader}>
                <h2 style={s.sectionTitle}>2. Elige un tema</h2>
                <p style={s.sectionSubtitle}>Primero selecciona el tema padre.</p>
              </div>
              {loadingTemas ? (
                <div style={s.loadingState}>Cargando temas...</div>
              ) : (
                <select
                  style={s.select}
                  value={selectedTemaId ?? ''}
                  onChange={e => {
                    const nextTemaId = e.target.value ? Number(e.target.value) : null;
                    setSelectedTemaId(nextTemaId);
                    setSelectedSubtemaId(null);
                  }}
                >
                  <option value="">Selecciona un tema...</option>
                  {temas.map(tema => (
                    <option key={tema.id} value={tema.id}>
                      {tema.nombre}
                    </option>
                  ))}
                </select>
              )}
            </section>

            <section style={s.sectionCard}>
              <div style={s.sectionHeader}>
                <h2 style={s.sectionTitle}>3. Elige un subtema</h2>
                <p style={s.sectionSubtitle}>Ahora selecciona el subtema que quieres editar.</p>
              </div>
              {!selectedTemaId ? (
                <div style={s.loadingState}>Primero selecciona un tema.</div>
              ) : loadingSubtemas ? (
                <div style={s.loadingState}>Cargando subtemas...</div>
              ) : (
                <select
                  style={s.select}
                  value={selectedSubtemaId ?? ''}
                  onChange={e => setSelectedSubtemaId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Selecciona un subtema...</option>
                  {subtemas.map(subtema => (
                    <option key={subtema.id} value={subtema.id}>
                      {subtema.nombre}
                    </option>
                  ))}
                </select>
              )}
            </section>
          </>
        )}

        {editorConfig ? (
          <section style={s.editorCard}>
            <div style={s.sectionHeader}>
              <h2 style={s.sectionTitle}>{editorConfig.title}</h2>
              <p style={s.sectionSubtitle}>{editorConfig.subtitle}</p>
            </div>
            <PageContentEditor entityType={editorConfig.entityType} entityId={editorConfig.entityId} />
          </section>
        ) : (
          <section style={s.sectionCard}>
            <div style={s.loadingState}>Selecciona una página para empezar.</div>
          </section>
        )}

        {editorConfig && (
          <section style={s.previewCard}>
            <div style={s.sectionHeader}>
              <h2 style={s.sectionTitle}>Vista pública</h2>
              <p style={s.sectionSubtitle}>Abre la página real en otra pestaña para revisar el resultado.</p>
            </div>
            <div style={s.previewActions}>
              <Link to={selectedTarget === 'home' ? '/' : selectedTarget === 'temario' ? '/temario' : selectedTarget === 'tema' && selectedTema ? `/subtemas/${selectedTema.id}` : selectedTarget === 'subtema' && selectedSubtema ? `/ver-placas/${selectedSubtema.id}` : '/'} style={s.previewButton}>
                Abrir vista pública
              </Link>
              <button type="button" style={s.previewButtonSecondary} onClick={() => navigate('/edicion')}>
                Volver al panel
              </button>
            </div>
          </section>
        )}
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
    background: 'transparent',
    color: '#0f172a',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
  },
  main: {
    width: '100%',
    maxWidth: '1300px',
    margin: '0 auto',
    padding: 'clamp(16px, 3vw, 40px) clamp(12px, 3vw, 40px) 120px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  heroCard: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '18px',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    background: 'linear-gradient(135deg, #eff6ff, #f8fafc)',
    border: '1px solid #dbeafe',
    borderRadius: '18px',
    padding: '18px 20px',
  },
  kicker: {
    margin: '0 0 8px',
    fontSize: '0.8em',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#2563eb',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(1.4em, 3vw, 2.2em)',
    letterSpacing: '-0.03em',
    fontWeight: 900,
  },
  subtitle: {
    margin: '10px 0 0',
    color: '#475569',
    maxWidth: '72ch',
  },
  selectedBadge: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: '220px',
    background: '#ffffff',
    border: '1px solid #dbeafe',
    borderRadius: '14px',
    padding: '14px 16px',
    boxShadow: '0 8px 20px rgba(15,23,42,0.06)',
  },
  selectedBadgeLabel: {
    fontSize: '0.78em',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#64748b',
  },
  sectionCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '18px',
    padding: '20px',
    boxShadow: '0 8px 24px rgba(15,23,42,0.05)',
  },
  editorCard: {
    background: '#ffffff',
    border: '1px solid #dbeafe',
    borderRadius: '18px',
    padding: '20px',
    boxShadow: '0 12px 28px rgba(15,23,42,0.06)',
  },
  previewCard: {
    background: 'linear-gradient(135deg, #f8fafc, #eef2ff)',
    border: '1px solid #e2e8f0',
    borderRadius: '18px',
    padding: '20px',
  },
  sectionHeader: {
    marginBottom: '16px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '1.2em',
    fontWeight: 900,
    color: '#0f172a',
  },
  sectionSubtitle: {
    margin: '6px 0 0',
    color: '#64748b',
  },
  pageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '12px',
  },
  pageOption: {
    position: 'relative',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '16px 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textAlign: 'left',
    gap: '8px',
    cursor: 'pointer',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
    minHeight: '112px',
  },
  pageOptionActive: {
    transform: 'translateY(-2px)',
    borderColor: '#93c5fd',
    boxShadow: '0 12px 26px rgba(59,130,246,0.14)',
    background: '#ffffff',
  },
  pageOptionAccent: {
    width: '100%',
    height: '4px',
    borderRadius: '999px',
    marginBottom: '2px',
  },
  pageOptionTitle: {
    fontSize: '1em',
    color: '#0f172a',
  },
  pageOptionDesc: {
    fontSize: '0.9em',
    color: '#475569',
  },
  select: {
    width: '100%',
    maxWidth: '640px',
    borderRadius: '12px',
    border: '1px solid #cbd5e1',
    padding: '12px 14px',
    fontSize: '1em',
    background: '#fff',
    color: '#0f172a',
  },
  loadingState: {
    padding: '20px 16px',
    borderRadius: '12px',
    border: '1px dashed #cbd5e1',
    color: '#64748b',
    background: '#f8fafc',
  },
  previewActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  previewButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 18px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
    color: '#fff',
    textDecoration: 'none',
    fontWeight: 800,
  },
  previewButtonSecondary: {
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    padding: '12px 18px',
    background: '#fff',
    color: '#334155',
    fontWeight: 800,
    cursor: 'pointer',
  },
};

export default EditorPaginas;