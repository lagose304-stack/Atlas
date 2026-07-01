import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import Footer from '../components/Footer';
import Header from '../components/Header';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import { deleteFromCloudinary } from '../services/cloudinary';
import { supabase } from '../services/supabase';

type TestScope = 'parcial' | 'tema' | 'subtema';

type ParcialKey = 'primer' | 'segundo' | 'tercer';

interface PruebaResumen {
  id: string;
  nombre: string;
  instrucciones: string;
  scope: TestScope;
  parcial_key: ParcialKey;
  estado: string;
  created_at: string;
  image_url?: string | null;
  tema?: { id: number; nombre: string } | null;
  subtema?: { id: number; nombre: string } | null;
}

interface SubtemaGroup {
  key: string;
  label: string;
  items: PruebaResumen[];
}

interface TemaGroup {
  key: string;
  label: string;
  items: PruebaResumen[];
  subtemaGroups?: SubtemaGroup[];
}

interface ParcialGroup {
  key: ParcialKey;
  label: string;
  items: PruebaResumen[];
  temaGroups?: TemaGroup[];
}

const SCOPE_TABS: Array<{ value: TestScope; label: string; description: string }> = [
  { value: 'parcial', label: 'Pruebas por parcial', description: 'Agrupa por 1, 2 y 3.' },
  { value: 'tema', label: 'Pruebas por tema', description: 'Ver por tema dentro de cada parcial.' },
  { value: 'subtema', label: 'Pruebas por subtema', description: 'Ver por subtema dentro de cada tema.' },
];

const PARCIALES: Array<{ key: ParcialKey; label: string }> = [
  { key: 'primer', label: 'Primer parcial' },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer', label: 'Tercer parcial' },
];

const GestionPruebas: React.FC = () => {
  const handleGoBack = useSmartBackNavigation('/edicion');
  const navigate = useNavigate();

  const [scope, setScope] = useState<TestScope>('parcial');
  const [search, setSearch] = useState('');
  const [pruebas, setPruebas] = useState<PruebaResumen[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatingTestId, setUpdatingTestId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PruebaResumen | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const fetchPruebas = async () => {
        setIsLoading(true);
        setError('');

        let query = supabase
          .from('pruebas')
          .select(
            scope === 'parcial'
              ? 'id, nombre, instrucciones, scope, parcial_key, estado, created_at, image_url'
              : scope === 'tema'
                ? 'id, nombre, instrucciones, scope, parcial_key, estado, created_at, image_url, tema:temas(id, nombre)'
                : 'id, nombre, instrucciones, scope, parcial_key, estado, created_at, image_url, tema:temas(id, nombre), subtema:subtemas(id, nombre)'
          )
          .eq('scope', scope)
          .order('created_at', { ascending: false });

        if (search.trim()) {
          query = query.ilike('nombre', `%${search.trim()}%`);
        }

        const { data, error: queryError } = await query;

        if (queryError) {
          setPruebas([]);
          setError('No se pudieron cargar las pruebas.');
        } else {
          setPruebas((data ?? []) as PruebaResumen[]);
        }

        setIsLoading(false);
      };

      void fetchPruebas();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [scope, search]);

  const groupedPruebas = useMemo(() => {
    return PARCIALES.map(parcial => {
      const parcialItems = pruebas.filter(prueba => prueba.parcial_key === parcial.key);

      if (scope === 'parcial') {
        return {
          key: parcial.key,
          label: parcial.label,
          items: parcialItems,
        } satisfies ParcialGroup;
      }

      const temaMap = new Map<string, TemaGroup>();

      parcialItems.forEach(prueba => {
        const temaId = prueba.tema?.id ?? prueba.id;
        const temaKey = prueba.tema?.id ? String(prueba.tema.id) : `sin-tema-${prueba.id}`;
        const temaLabel = prueba.tema?.nombre ?? 'Tema sin identificar';

        if (!temaMap.has(temaKey)) {
          temaMap.set(temaKey, {
            key: temaKey,
            label: temaLabel,
            items: [],
          });
        }

        const temaGroup = temaMap.get(temaKey);
        if (!temaGroup) return;
        temaGroup.items.push(prueba);
      });

      const temaGroups = Array.from(temaMap.values()).map(temaGroup => {
        if (scope === 'tema') {
          return temaGroup;
        }

        const subtemaMap = new Map<string, SubtemaGroup>();

        temaGroup.items.forEach(prueba => {
          const subtemaKey = prueba.subtema?.id ? String(prueba.subtema.id) : `sin-subtema-${prueba.id}`;
          const subtemaLabel = prueba.subtema?.nombre ?? 'Subtema sin identificar';

          if (!subtemaMap.has(subtemaKey)) {
            subtemaMap.set(subtemaKey, {
              key: subtemaKey,
              label: subtemaLabel,
              items: [],
            });
          }

          const subtemaGroup = subtemaMap.get(subtemaKey);
          if (!subtemaGroup) return;
          subtemaGroup.items.push(prueba);
        });

        return {
          ...temaGroup,
          subtemaGroups: Array.from(subtemaMap.values()),
        };
      });

      return {
        key: parcial.key,
        label: parcial.label,
        items: parcialItems,
        temaGroups,
      } satisfies ParcialGroup;
    });
  }, [pruebas, scope]);

  const scopeTitle = scope === 'parcial' ? 'Pruebas por parcial' : scope === 'tema' ? 'Pruebas por tema' : 'Pruebas por subtema';

  const handleTogglePublication = async (prueba: PruebaResumen) => {
    if (updatingTestId) {
      return;
    }

    const nextEstado = prueba.estado === 'publicada' ? 'borrador' : 'publicada';
    setUpdatingTestId(prueba.id);

    const { error: updateError } = await supabase
      .from('pruebas')
      .update({ estado: nextEstado })
      .eq('id', prueba.id);

    if (updateError) {
      setError('No se pudo cambiar el estado de la prueba.');
      setUpdatingTestId(null);
      return;
    }

    setPruebas(prev => prev.map(item => (
      item.id === prueba.id ? { ...item, estado: nextEstado } : item
    )));
    setUpdatingTestId(null);
  };

  const requestDeletePrueba = (prueba: PruebaResumen) => {
    if (updatingTestId) {
      return;
    }

    setDeleteTarget(prueba);
    setShowDeleteModal(true);
  };

  const confirmDeletePrueba = async () => {
    if (!deleteTarget || updatingTestId) {
      return;
    }

    const prueba = deleteTarget;
    setUpdatingTestId(prueba.id);
    setError('');
    setShowDeleteModal(false);

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

    setPruebas(prev => prev.filter(item => item.id !== prueba.id));
    setDeleteTarget(null);
    setUpdatingTestId(null);
  };

  return (
    <div style={s.page}>
      <Header />

      <main style={s.main} className="edicion-main">
        <BackButton onClick={handleGoBack} />

        <section style={s.hero} className="edicion-card">
          <div style={s.heroText}>
            <p style={s.kicker}>Pruebas</p>
            <h1 style={s.title}>Administrar pruebas</h1>
            <p style={s.subtitle}>
              Revisa las pruebas en el orden que te conviene: por parcial, por tema o por subtema.
            </p>
          </div>
        </section>

        <section style={s.toolbar} className="edicion-card">
          <div style={s.searchBlock}>
            <label style={s.label}>Buscar prueba</label>
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Escribe parte del nombre..."
              style={s.searchInput}
            />
          </div>

          <div style={s.tabs}>
            {SCOPE_TABS.map(tab => {
              const active = scope === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setScope(tab.value)}
                  style={active ? s.activeTab : s.tab}
                >
                  <strong style={s.tabLabel}>{tab.label}</strong>
                  <span style={s.tabDesc}>{tab.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section style={s.listCard} className="edicion-card">
          <div style={s.sectionHeader}>
            <span style={s.sectionDot} />
            <h2 style={s.sectionTitle}>{scopeTitle}</h2>
          </div>

          {isLoading ? (
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>Cargando pruebas...</p>
            </div>
          ) : error ? (
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>{error}</p>
            </div>
          ) : pruebas.length === 0 ? (
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>No hay pruebas para mostrar.</p>
              <p style={s.emptyText}>Prueba otro scope o cambia el texto de búsqueda.</p>
            </div>
          ) : (
            <div style={s.groups}>
              {groupedPruebas.map(group => (
                <div key={group.key} style={s.groupBlock}>
                  <div style={s.groupHeader}>
                    <span style={s.groupTitle}>{group.label}</span>
                    <span style={s.groupCount}>{group.items.length} pruebas</span>
                  </div>

                  {scope === 'parcial' ? (
                    <div style={s.cardsGrid}>
                      {group.items.map(prueba => (
                        <article key={prueba.id} style={s.testCard}>
                          <div style={s.testCardTop}>
                            <div>
                              <h3 style={s.testTitle}>{prueba.nombre}</h3>
                              <p style={s.testMeta}>{prueba.estado} · {new Date(prueba.created_at).toLocaleDateString('es-MX')}</p>
                            </div>
                            <span style={s.statePill}>{prueba.estado}</span>
                          </div>

                          <p style={s.testDesc}>{prueba.instrucciones || 'Sin instrucciones registradas.'}</p>

                          <div style={s.cardActions}>
                            <button
                              type="button"
                              onClick={() => handleTogglePublication(prueba)}
                              style={prueba.estado === 'publicada' ? s.unpublishButton : s.publishButton}
                              disabled={updatingTestId === prueba.id}
                            >
                              {prueba.estado === 'publicada' ? 'Pasar a borrador' : 'Publicar'}
                            </button>

                            <button
                              type="button"
                              onClick={() => navigate(`/pruebas/ejecutar/${prueba.id}`, { state: { from: '/pruebas' } })}
                              style={s.runButton}
                            >
                              Ejecutar prueba
                            </button>

                            <button
                              type="button"
                              onClick={() => navigate(`/pruebas/editor/${prueba.id}`, { state: { from: '/pruebas' } })}
                              style={s.editButton}
                            >
                              Editar prueba
                            </button>

                            <button
                              type="button"
                              onClick={() => requestDeletePrueba(prueba)}
                              style={s.deleteButton}
                              disabled={updatingTestId === prueba.id}
                            >
                              Borrar
                            </button>

                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div style={s.nestedGroups}>
                      {group.temaGroups?.map(temaGroup => (
                        <div key={temaGroup.key} style={s.nestedGroupBlock}>
                          <div style={s.nestedGroupHeader}>
                            <span style={s.nestedGroupTitle}>{temaGroup.label}</span>
                            <span style={s.groupCount}>{temaGroup.items.length} pruebas</span>
                          </div>

                          {scope === 'tema' ? (
                            <div style={s.cardsGrid}>
                              {temaGroup.items.map(prueba => (
                                <article key={prueba.id} style={s.testCard}>
                                  <div style={s.testCardTop}>
                                    <div>
                                      <h3 style={s.testTitle}>{prueba.nombre}</h3>
                                      <p style={s.testMeta}>{prueba.estado} · {new Date(prueba.created_at).toLocaleDateString('es-MX')}</p>
                                    </div>
                                    <span style={s.statePill}>{prueba.estado}</span>
                                  </div>
                                  <p style={s.testDesc}>{prueba.instrucciones || 'Sin instrucciones registradas.'}</p>
                                  <div style={s.cardActions}>
                                    <button
                                      type="button"
                                      onClick={() => handleTogglePublication(prueba)}
                                      style={prueba.estado === 'publicada' ? s.unpublishButton : s.publishButton}
                                      disabled={updatingTestId === prueba.id}
                                    >
                                      {prueba.estado === 'publicada' ? 'Pasar a borrador' : 'Publicar'}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => navigate(`/pruebas/ejecutar/${prueba.id}`, { state: { from: '/pruebas' } })}
                                      style={s.runButton}
                                    >
                                      Ejecutar prueba
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => navigate(`/pruebas/editor/${prueba.id}`, { state: { from: '/pruebas' } })}
                                      style={s.editButton}
                                    >
                                      Editar prueba
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => requestDeletePrueba(prueba)}
                                      style={s.deleteButton}
                                      disabled={updatingTestId === prueba.id}
                                    >
                                      Borrar
                                    </button>
                                  </div>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <div style={s.nestedGroups}>
                              {temaGroup.subtemaGroups?.map(subtemaGroup => (
                                <div key={subtemaGroup.key} style={s.subNestedGroupBlock}>
                                  <div style={s.subNestedGroupHeader}>
                                    <span style={s.nestedGroupTitle}>{subtemaGroup.label}</span>
                                    <span style={s.groupCount}>{subtemaGroup.items.length} pruebas</span>
                                  </div>

                                  <div style={s.cardsGrid}>
                                    {subtemaGroup.items.map(prueba => (
                                      <article key={prueba.id} style={s.testCard}>
                                        <div style={s.testCardTop}>
                                          <div>
                                            <h3 style={s.testTitle}>{prueba.nombre}</h3>
                                            <p style={s.testMeta}>{prueba.estado} · {new Date(prueba.created_at).toLocaleDateString('es-MX')}</p>
                                          </div>
                                          <span style={s.statePill}>{prueba.estado}</span>
                                        </div>
                                        <p style={s.testDesc}>{prueba.instrucciones || 'Sin instrucciones registradas.'}</p>
                                        <div style={s.cardActions}>
                                          <button
                                            type="button"
                                            onClick={() => handleTogglePublication(prueba)}
                                            style={prueba.estado === 'publicada' ? s.unpublishButton : s.publishButton}
                                            disabled={updatingTestId === prueba.id}
                                          >
                                            {prueba.estado === 'publicada' ? 'Pasar a borrador' : 'Publicar'}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => navigate(`/pruebas/ejecutar/${prueba.id}`, { state: { from: '/pruebas' } })}
                                            style={s.runButton}
                                          >
                                            Ejecutar prueba
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => navigate(`/pruebas/editor/${prueba.id}`, { state: { from: '/pruebas' } })}
                                            style={s.editButton}
                                          >
                                            Editar prueba
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => requestDeletePrueba(prueba)}
                                            style={s.deleteButton}
                                            disabled={updatingTestId === prueba.id}
                                          >
                                            Borrar
                                          </button>
                                        </div>
                                      </article>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={s.footerActions}>
            <Link to="/pruebas/crear" style={s.secondaryButton}>
              Crear nueva prueba
            </Link>
          </div>
        </section>
      </main>

      {showDeleteModal && deleteTarget && (
        <div
          style={s.deleteModalOverlay}
          onClick={() => {
            if (updatingTestId) return;
            setShowDeleteModal(false);
            setDeleteTarget(null);
          }}
        >
          <div style={s.deleteModal} onClick={event => event.stopPropagation()}>
            <div style={s.deleteModalHeader}>
              <p style={s.deleteModalKicker}>Confirmar eliminación</p>
              <h3 style={s.deleteModalTitle}>Borrar prueba</h3>
            </div>

            <p style={s.deleteModalText}>
              Esta acción eliminará permanentemente <strong>{deleteTarget.nombre}</strong>, sus preguntas y la imagen asociada.
              No se puede deshacer.
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
                onClick={() => { void confirmDeletePrueba(); }}
                style={s.deleteModalDangerButton}
                disabled={Boolean(updatingTestId)}
              >
                Sí, borrar prueba
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    color: '#0f172a',
    background: 'radial-gradient(circle at top left, rgba(224,231,255,0.85), transparent 28%), radial-gradient(circle at top right, rgba(224,242,254,0.8), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 42%, #ffffff 100%)',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1400px',
    margin: '0 auto',
    boxSizing: 'border-box',
    padding: '0 20px 44px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  hero: {
    display: 'block',
    padding: '0',
  },
  heroText: {
    borderRadius: '28px',
    padding: '28px 30px',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(239,246,255,0.96) 45%, rgba(255,255,255,0.98) 100%)',
    border: '1px solid rgba(191,219,254,0.9)',
    boxShadow: '0 20px 50px rgba(15,23,42,0.10)',
  },
  kicker: {
    margin: 0,
    color: '#7c3aed',
    fontWeight: 900,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    fontSize: '0.74em',
  },
  title: {
    margin: '10px 0 8px',
    fontSize: 'clamp(1.8rem, 4vw, 3rem)',
    lineHeight: 1.05,
    letterSpacing: '-0.04em',
  },
  subtitle: {
    margin: 0,
    maxWidth: '62ch',
    color: '#475569',
    lineHeight: 1.65,
    fontSize: '0.98rem',
  },
  toolbar: {
    borderRadius: '28px',
    border: '1px solid rgba(226,232,240,0.95)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.96) 100%)',
    boxShadow: '0 22px 60px rgba(15,23,42,0.10)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  searchBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: 800,
    color: '#334155',
  },
  searchInput: {
    width: '100%',
    borderRadius: '16px',
    border: '1.5px solid #cbd5e1',
    padding: '15px 16px',
    fontFamily: 'inherit',
    fontSize: '0.98rem',
    color: '#0f172a',
    outline: 'none',
    background: '#fff',
    boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.03)',
  },
  tabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
  },
  tab: {
    borderRadius: '18px',
    border: '1.5px solid #dbeafe',
    padding: '14px 16px',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  activeTab: {
    borderRadius: '18px',
    border: '1.5px solid #c7d2fe',
    padding: '14px 16px',
    background: 'linear-gradient(135deg, #eef2ff, #ffffff)',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 12px 28px rgba(99,102,241,0.12)',
  },
  tabLabel: {
    color: '#0f172a',
    fontSize: '0.95rem',
  },
  tabDesc: {
    color: '#64748b',
    fontSize: '0.82rem',
    lineHeight: 1.5,
  },
  listCard: {
    borderRadius: '28px',
    border: '1px solid rgba(226,232,240,0.95)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.96) 100%)',
    boxShadow: '0 22px 60px rgba(15,23,42,0.10)',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    width: '100%',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(248,250,252,0.9), rgba(255,255,255,0.95))',
    border: '1px solid rgba(226,232,240,0.8)',
  },
  sectionDot: {
    width: '12px',
    height: '12px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #8b5cf6, #38bdf8)',
    flexShrink: 0,
  },
  sectionTitle: {
    margin: 0,
    fontSize: '1.1rem',
    color: '#0f172a',
    fontWeight: 900,
  },
  groups: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  nestedGroups: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  groupBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  nestedGroupBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '14px',
    borderRadius: '20px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
  },
  subNestedGroupBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px',
    borderRadius: '18px',
    border: '1px dashed #cbd5e1',
    background: '#fff',
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: '18px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(135deg, #f8fafc, #ffffff)',
  },
  groupTitle: {
    fontWeight: 900,
    color: '#0f172a',
  },
  nestedGroupHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #eff6ff, #ffffff)',
    border: '1px solid #dbeafe',
  },
  subNestedGroupHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '14px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
  },
  nestedGroupTitle: {
    fontWeight: 800,
    color: '#1d4ed8',
  },
  groupCount: {
    fontSize: '0.82rem',
    fontWeight: 800,
    color: '#64748b',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '12px',
  },
  testCard: {
    borderRadius: '20px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
  },
  testCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'flex-start',
  },
  testTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '1rem',
    lineHeight: 1.35,
  },
  testMeta: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: '0.82rem',
  },
  statePill: {
    borderRadius: '999px',
    padding: '4px 10px',
    background: '#eef2ff',
    color: '#4338ca',
    fontSize: '0.72rem',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  testDesc: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.6,
    fontSize: '0.92rem',
  },
  cardActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '10px',
  },
  runButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #2563eb, #0f766e)',
    color: '#fff',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 14px 30px rgba(37,99,235,0.16)',
  },
  publishButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #16a34a, #0f766e)',
    color: '#fff',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 14px 30px rgba(22,163,74,0.16)',
  },
  unpublishButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: '#fff',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 14px 30px rgba(245,158,11,0.16)',
  },
  infoRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px',
    borderRadius: '14px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
  },
  infoTag: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#64748b',
    fontWeight: 900,
  },
  infoValue: {
    color: '#0f172a',
    fontWeight: 700,
  },
  editButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
    color: '#fff',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 14px 30px rgba(109,40,217,0.18)',
  },
  deleteButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #b91c1c, #ef4444)',
    color: '#fff',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 14px 30px rgba(239,68,68,0.18)',
  },
  deleteModalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2500,
    background: 'rgba(15, 23, 42, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  deleteModal: {
    width: 'min(520px, 100%)',
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
    fontSize: '0.98rem',
  },
  deleteModalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },
  deleteModalCancelButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    padding: '12px 16px',
    background: '#fff',
    color: '#334155',
    fontWeight: 800,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  deleteModalDangerButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #b91c1c, #ef4444)',
    color: '#fff',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 14px 30px rgba(239,68,68,0.18)',
  },
  footerActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '6px',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 16px',
    borderRadius: '14px',
    border: '1.5px solid #cbd5e1',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    color: '#334155',
    textDecoration: 'none',
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    borderRadius: '20px',
    padding: '24px',
    border: '1px dashed #cbd5e1',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    alignItems: 'flex-start',
  },
  emptyTitle: {
    margin: 0,
    fontWeight: 900,
    color: '#0f172a',
    fontSize: '1.05rem',
  },
  emptyText: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.6,
  },
};

export default GestionPruebas;