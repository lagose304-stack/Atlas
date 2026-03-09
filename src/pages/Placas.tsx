import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ImageUploader from '../components/ImageUploader';
import { supabase } from '../services/supabase';
import { uploadToCloudinary } from '../services/cloudinary';
import Footer from '../components/Footer';
import Header from '../components/Header';
import LoadingToast from '../components/LoadingToast';
import BoldField from '../components/BoldField';

// --- Interfaces ---
interface Tema {
  id: number;
  nombre: string;
}

interface Subtema {
  id: number;
  nombre: string;
  tema_id: number;
}

// --- Styles ---
const styles: { [key: string]: React.CSSProperties } = {
  saveButton: {
    display: 'block', width: '100%', padding: '14px', marginTop: '24px',
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    backgroundColor: '#16a34a', color: 'white', fontSize: '1.05em',
    fontWeight: 700, letterSpacing: '0.02em',
    transition: 'background-color 0.2s ease, opacity 0.2s ease',
  },
  saveButtonDisabled: {
    display: 'block', width: '100%', padding: '14px', marginTop: '24px',
    border: 'none', borderRadius: '8px', cursor: 'not-allowed',
    backgroundColor: '#86efac', color: 'white', fontSize: '1.05em',
    fontWeight: 700, opacity: 0.7,
  },
  successMsg: {
    marginTop: '16px', padding: '12px 16px', borderRadius: '8px',
    backgroundColor: '#dcfce7', border: '1px solid #86efac',
    color: '#15803d', fontWeight: 600, textAlign: 'center',
  },
  errorMsg: {
    marginTop: '16px', padding: '12px 16px', borderRadius: '8px',
    backgroundColor: '#fee2e2', border: '1px solid #fca5a5',
    color: '#b91c1c', fontWeight: 600, textAlign: 'center',
  },
  select: {
    width: '100%', padding: '15px', fontSize: '1em',
    border: '2px solid #bdc3c7', borderRadius: '8px',
    backgroundColor: '#fff', cursor: 'pointer',
    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
    outline: 'none', color: '#2c3e50', fontWeight: 500,
  },
  accordionLabel: {
    display: 'block', fontSize: '1em', fontWeight: 600,
    color: '#34495e', marginBottom: '8px',
  },
  aumentoGroup: {
    display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginTop: '4px',
  },
  aumentoBtn: {
    padding: '8px 16px', borderRadius: '20px', border: '2px solid #bdc3c7',
    background: '#fff', cursor: 'pointer', fontSize: '0.92em', fontWeight: 600,
    color: '#475569', transition: 'all 0.15s ease',
  },
  aumentoBtnActive: {
    padding: '8px 16px', borderRadius: '20px', border: '2px solid #10b981',
    background: 'linear-gradient(135deg, #10b981, #34d399)', cursor: 'pointer',
    fontSize: '0.92em', fontWeight: 700, color: '#fff', transition: 'all 0.15s ease',
  },
  senalTextField: {
    width: '100%', padding: '10px 12px', fontSize: '0.95em',
    border: '2px solid #bdc3c7', borderRadius: '8px', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'inherit', color: '#2c3e50',
    transition: 'border-color 0.2s',
  },
  senalRow: {
    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
  },
  senalNumber: {
    minWidth: '26px', height: '26px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #10b981, #34d399)', color: '#fff',
    fontWeight: 700, fontSize: '0.85em', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0,
  },
  removeBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444',
    fontSize: '1.1em', padding: '0 4px', lineHeight: 1, flexShrink: 0,
  },
  addBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '8px', border: '2px dashed #10b981',
    background: '#f0fdf4', color: '#059669', cursor: 'pointer',
    fontSize: '0.9em', fontWeight: 600, marginTop: '6px',
    transition: 'background 0.15s', fontFamily: 'inherit',
  },
  addComentarioBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '8px', border: '2px dashed #6366f1',
    background: '#f5f3ff', color: '#4f46e5', cursor: 'pointer',
    fontSize: '0.9em', fontWeight: 600, marginTop: '6px',
    transition: 'background 0.15s', fontFamily: 'inherit',
  },
  comentarioField: {
    width: '100%', padding: '10px 12px', fontSize: '0.95em',
    border: '2px solid #c7d2fe', borderRadius: '8px', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'inherit', color: '#2c3e50',
    resize: 'vertical' as const, minHeight: '80px', transition: 'border-color 0.2s',
  },
  addTincionBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '8px', border: '2px dashed #f59e0b',
    background: '#fffbeb', color: '#b45309', cursor: 'pointer',
    fontSize: '0.9em', fontWeight: 600, marginTop: '6px',
    transition: 'background 0.15s', fontFamily: 'inherit',
  },
  tincionField: {
    width: '100%', padding: '10px 12px', fontSize: '0.95em',
    border: '2px solid #fde68a', borderRadius: '8px', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'inherit', color: '#2c3e50',
    transition: 'border-color 0.2s', background: '#fffbeb',
  },
};

// Convierte un nombre en slug seguro para carpeta de Cloudinary
const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const Placas: React.FC = () => {
  const navigate = useNavigate();
  const [showClasificadasForm, setShowClasificadasForm] = useState(false);
  const [showSinClasificarForm, setShowSinClasificarForm] = useState(false);
  const [showReasignacionSection, setShowReasignacionSection] = useState(false);
  const [showEliminarSection, setShowEliminarSection] = useState(false);
  const [imageUploaded, setImageUploaded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTema, setSelectedTema] = useState('');
  const [selectedSubtema, setSelectedSubtema] = useState('');
  const [temas, setTemas] = useState<Tema[]>([]);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [selectedAumento, setSelectedAumento] = useState('');
  const [senalados, setSenalados] = useState<string[]>([]);
  const [comentario, setComentario] = useState('');
  const [showComentario, setShowComentario] = useState(false);
  const [tincion, setTincion] = useState('');
  const [showTincion, setShowTincion] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Variable para verificar si alguna sección está activa
  const isAnyFormActive = showClasificadasForm || showSinClasificarForm || showReasignacionSection || showEliminarSection;

  // Cargar temas desde la base de datos
  useEffect(() => {
    const fetchTemas = async () => {
      const { data, error } = await supabase
        .from('temas')
        .select('*')
        .order('nombre', { ascending: true });
      
      if (data) {
        setTemas(data);
      }
      if (error) {
        console.error('Error al cargar temas:', error);
      }
    };

    fetchTemas();
  }, []);

  // Cargar subtemas cuando se selecciona un tema
  useEffect(() => {
    const fetchSubtemas = async () => {
      if (selectedTema) {
        const { data, error } = await supabase
          .from('subtemas')
          .select('*')
          .eq('tema_id', selectedTema)
          .order('nombre', { ascending: true });
        
        if (data) {
          setSubtemas(data);
        }
        if (error) {
          console.error('Error al cargar subtemas:', error);
        }
      } else {
        setSubtemas([]);
      }
    };

    fetchSubtemas();
  }, [selectedTema]);

  const handleImageSelect = (file: File) => {
    setSelectedFile(file);
    setImageUploaded(true);
    setSaveSuccess(false);
    setSaveError('');
  };

  const handleGuardar = async () => {
    if (!selectedFile || !selectedTema || !selectedSubtema) return;
    const temaObj = temas.find(t => String(t.id) === selectedTema);
    const subtemaObj = subtemas.find(s => String(s.id) === selectedSubtema);
    if (!temaObj || !subtemaObj) return;

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const folder = `placas/${slugify(temaObj.nombre)}/${slugify(subtemaObj.nombre)}`;
      const uploadResult = await uploadToCloudinary(selectedFile, { folder });

      const senalados_filtrados = senalados.filter(s => s.trim() !== '');
      const { data: maxPlacaData } = await supabase
        .from('placas')
        .select('sort_order')
        .eq('subtema_id', Number(selectedSubtema))
        .order('sort_order', { ascending: false })
        .limit(1);
      const nextPlacaSortOrder = (maxPlacaData && maxPlacaData.length > 0 && maxPlacaData[0].sort_order != null)
        ? maxPlacaData[0].sort_order + 1
        : 0;
      const { error } = await supabase.from('placas').insert({
        photo_url: uploadResult.secure_url,
        tema_id: Number(selectedTema),
        subtema_id: Number(selectedSubtema),
        aumento: selectedAumento || null,
        senalados: senalados_filtrados.length > 0 ? senalados_filtrados : null,
        comentario: comentario.trim() || null,
        tincion: tincion.trim() || null,
        sort_order: nextPlacaSortOrder,
      });

      if (error) throw error;

      setSaveSuccess(true);
      setSelectedFile(null);
      setImageUploaded(false);
      setSelectedTema('');
      setSelectedSubtema('');
      setSelectedAumento('');
      setSenalados([]);
      setComentario('');
      setShowComentario(false);
      setTincion('');
      setShowTincion(false);
    } catch (err) {
      console.error('Error al guardar placa:', err);
      setSaveError('Error al guardar. Por favor intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTema(e.target.value);
    setSelectedSubtema(''); // Resetear subtema cuando cambia el tema
  };

  const handleSubtemaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubtema(e.target.value);
  };

  const handleCancelForm = () => {
    setShowClasificadasForm(false);
    setShowSinClasificarForm(false);
    setShowReasignacionSection(false);
    setShowEliminarSection(false);
    setImageUploaded(false);
    setSelectedFile(null);
    setSelectedTema('');
    setSelectedSubtema('');
    setSelectedAumento('');
    setSenalados([]);
    setComentario('');
    setShowComentario(false);
    setTincion('');
    setShowTincion(false);
    setSaveSuccess(false);
    setSaveError('');
  };

  return (
    <div style={p.page}>
      <Header />

      <main style={p.main}>

        {/* Breadcrumb */}
        <nav style={p.breadcrumb}>
          <button
            onClick={() => navigate('/')}
            style={p.breadcrumbLink}
            onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            🏠 Inicio
          </button>
          <span style={p.breadcrumbSep}>❯</span>
          <button
            onClick={() => navigate('/edicion')}
            style={p.breadcrumbLink}
            onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            Edición
          </button>
          <span style={p.breadcrumbSep}>❯</span>
          <span style={p.breadcrumbCurrent}>Placas</span>
        </nav>

        {/* Encabezado */}
        <div style={p.pageHeader}>
          <h1 style={p.pageTitle}>Gestión de Placas</h1>
          <p style={p.pageSubtitle}>Sube, clasifica, reasigna y elimina las placas histológicas del atlas.</p>
          <div style={p.accentLine} />
        </div>

        {/* Grid de tarjetas */}
        <div style={{ ...p.grid, ...(isAnyFormActive ? { gridTemplateColumns: '1fr' } : {}) }} className="placas-grid">

          {/* Subir placas */}
          <div style={p.card}>
            <div style={{ ...p.cardAccent, background: 'linear-gradient(135deg, #10b981, #34d399)' }} />
            <div style={p.cardIcon}>📤</div>
            <div style={p.cardBody}>
              <h2 style={p.cardTitle}>Subir placas</h2>
              <p style={p.cardDesc}>Agrega nuevas placas histológicas, con o sin clasificación de tema y subtema.</p>
            </div>

            {!showClasificadasForm && !showSinClasificarForm && (
              <div style={p.btnGroup}>
                <button
                  style={{ ...p.actionBtn, color: '#059669', background: '#ecfdf5', borderColor: '#a7f3d0' }}
                  onClick={() => setShowClasificadasForm(true)}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#10b981,#34d399)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#ecfdf5'; e.currentTarget.style.color = '#059669'; e.currentTarget.style.borderColor = '#a7f3d0'; }}
                >
                  ✅ Clasificadas
                </button>
                <button
                  style={{ ...p.actionBtn, color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' }}
                  onClick={() => setShowSinClasificarForm(true)}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#f59e0b,#fbbf24)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fffbeb'; e.currentTarget.style.color = '#b45309'; e.currentTarget.style.borderColor = '#fde68a'; }}
                >
                  📋 Sin clasificar
                </button>
              </div>
            )}

            {showClasificadasForm && (
              <div style={p.formPanel}>
                <div style={p.formPanelHeader}>
                  <span style={{ ...p.formPanelDot, background: 'linear-gradient(135deg,#10b981,#34d399)' }} />
                  <span style={p.formPanelTitle}>Subir placa clasificada</span>
                </div>
                <div style={p.formPanelBody}>
                  <ImageUploader onImageSelect={handleImageSelect} />
                  {imageUploaded && (
                    <>
                      <div style={{ marginTop: '16px' }}>
                        <label style={styles.accordionLabel}>Seleccionar Tema:</label>
                        <select
                          style={styles.select}
                          value={selectedTema}
                          onChange={handleTemaChange}
                          onFocus={e => (e.currentTarget.style.borderColor = '#10b981')}
                          onBlur={e => (e.currentTarget.style.borderColor = '#bdc3c7')}
                        >
                          <option value="">-- Selecciona un tema --</option>
                          {temas.map(tema => (
                            <option key={tema.id} value={tema.id}>{tema.nombre}</option>
                          ))}
                        </select>
                      </div>
                      {selectedTema && (
                        <div style={{ marginTop: '16px' }}>
                          <label style={styles.accordionLabel}>Seleccionar Subtema:</label>
                          <select
                            style={styles.select}
                            value={selectedSubtema}
                            onChange={handleSubtemaChange}
                            onFocus={e => (e.currentTarget.style.borderColor = '#10b981')}
                            onBlur={e => (e.currentTarget.style.borderColor = '#bdc3c7')}
                          >
                            <option value="">-- Selecciona un subtema --</option>
                            {subtemas.map(subtema => (
                              <option key={subtema.id} value={subtema.id}>{subtema.nombre}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* --- Aumento --- */}
                      {selectedSubtema && (
                        <div style={{ marginTop: '20px' }}>
                          <label style={styles.accordionLabel}>🔬 Aumento:</label>
                          <div style={styles.aumentoGroup}>
                            {['x4', 'x10', 'x40', 'x50', 'x100'].map(op => (
                              <button
                                key={op}
                                type="button"
                                style={selectedAumento === op ? styles.aumentoBtnActive : styles.aumentoBtn}
                                onClick={() => setSelectedAumento(prev => prev === op ? '' : op)}
                              >
                                {op}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* --- Tinción --- */}
                      {selectedSubtema && (
                        <div style={{ marginTop: '16px' }}>
                          {!showTincion ? (
                            <button
                              type="button"
                              style={styles.addTincionBtn}
                              onClick={() => setShowTincion(true)}
                            >
                              🧪 Añadir tinción
                            </button>
                          ) : (
                            <>
                              <label style={{ ...styles.accordionLabel, color: '#b45309' }}>🧪 Tinción:</label>
                              <BoldField
                                as="input"
                                style={styles.tincionField}
                                value={tincion}
                                placeholder="Ej: H&E, PAS, Azul de toluidina..."
                                onChange={setTincion}
                              />
                            </>
                          )}
                        </div>
                      )}

                      {/* --- Señalados --- */}
                      {selectedSubtema && (
                        <div style={{ marginTop: '20px' }}>
                          <label style={styles.accordionLabel}>📌 Señalados:</label>
                          {senalados.map((val, idx) => (
                            <div key={idx} style={styles.senalRow}>
                              <span style={styles.senalNumber}>{idx + 1}</span>
                              <BoldField
                                as="input"
                                inline
                                style={styles.senalTextField}
                                value={val}
                                placeholder={`Señalado ${idx + 1}`}
                                onChange={v => {
                                  const updated = [...senalados];
                                  updated[idx] = v;
                                  setSenalados(updated);
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = '#10b981')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#bdc3c7')}
                              />
                              <button
                                type="button"
                                style={styles.removeBtn}
                                title="Eliminar señalado"
                                onClick={() => setSenalados(prev => prev.filter((_, i) => i !== idx))}
                              >✕</button>
                            </div>
                          ))}
                          <button
                            type="button"
                            style={styles.addBtn}
                            onClick={() => setSenalados(prev => [...prev, ''])}
                          >
                            ＋ Añadir señalado
                          </button>
                        </div>
                      )}

                      {/* --- Comentario --- */}
                      {selectedSubtema && (
                        <div style={{ marginTop: '16px' }}>
                          {!showComentario ? (
                            <button
                              type="button"
                              style={styles.addComentarioBtn}
                              onClick={() => setShowComentario(true)}
                            >
                              💬 Añadir comentario
                            </button>
                          ) : (
                            <>
                              <label style={{ ...styles.accordionLabel, color: '#4f46e5' }}>💬 Comentario:</label>
                              <BoldField
                                as="textarea"
                                style={styles.comentarioField}
                                value={comentario}
                                placeholder="Escribe un comentario para esta placa..."
                                onChange={setComentario}
                              />
                            </>
                          )}
                        </div>
                      )}

                      {selectedFile && selectedTema && selectedSubtema && (
                        <button
                          style={isSaving ? styles.saveButtonDisabled : styles.saveButton}
                          onClick={handleGuardar}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Guardando...' : '💾 Guardar placa'}
                        </button>
                      )}
                      {saveSuccess && <div style={styles.successMsg}>✅ Placa guardada correctamente.</div>}
                      {saveError && <div style={styles.errorMsg}>❌ {saveError}</div>}
                    </>
                  )}
                  <button style={p.cancelBtn} onClick={handleCancelForm}>✕ Cancelar</button>
                </div>
              </div>
            )}

            {showSinClasificarForm && (
              <div style={p.formPanel}>
                <div style={p.formPanelHeader}>
                  <span style={{ ...p.formPanelDot, background: 'linear-gradient(135deg,#f59e0b,#fbbf24)' }} />
                  <span style={p.formPanelTitle}>Subir placa sin clasificar</span>
                </div>
                <div style={p.formPanelBody}>
                  <ImageUploader onImageSelect={handleImageSelect} />
                  <button style={p.cancelBtn} onClick={handleCancelForm}>✕ Cancelar</button>
                </div>
              </div>
            )}
          </div>

          {/* Reasignación y Eliminar — solo visibles cuando ningún form está abierto */}
          {!isAnyFormActive && (<>

          {/* Reasignación */}
          <div style={p.card}>
            <div style={{ ...p.cardAccent, background: 'linear-gradient(135deg, #6366f1, #818cf8)' }} />
            <div style={p.cardIcon}>🔄</div>
            <div style={p.cardBody}>
              <h2 style={p.cardTitle}>Reasignación</h2>
              <p style={p.cardDesc}>Mueve placas entre temas o subtemas, o gestiona la lista de espera de clasificación.</p>
            </div>
            <div style={p.btnGroup}>
              <button
                style={{ ...p.actionBtn, color: '#6366f1', background: '#f5f3ff', borderColor: '#c7d2fe' }}
                onClick={() => navigate('/mover-placa')}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#6366f1,#818cf8)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
              >
                📂 Mover placa
              </button>
              <button
                style={{ ...p.actionBtn, color: '#6366f1', background: '#f5f3ff', borderColor: '#c7d2fe' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#6366f1,#818cf8)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
              >
                ⏳ Lista de espera
              </button>
            </div>
          </div>

          {/* Eliminar */}
          <div style={p.card}>
            <div style={{ ...p.cardAccent, background: 'linear-gradient(135deg, #ef4444, #f87171)' }} />
            <div style={p.cardIcon}>🗑️</div>
            <div style={p.cardBody}>
              <h2 style={p.cardTitle}>Eliminar placas</h2>
              <p style={p.cardDesc}>Borra permanentemente placas del atlas. Esta acción no se puede deshacer.</p>
            </div>
            <div style={p.btnGroup}>
              <button
                style={{ ...p.actionBtn, color: '#dc2626', background: '#fff1f2', borderColor: '#fecaca' }}
                onClick={() => navigate('/eliminar-placas')}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#ef4444,#f87171)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca'; }}
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>

          </>)}
        </div>
      </main>

      <Footer />
      <LoadingToast visible={isSaving} type="uploading" message="Guardando placa" />
    </div>
  );
};

const p: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(ellipse at top, #dbeafe 0%, #f5f7fa 50%, #eef2ff 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    color: '#0f172a',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'clamp(16px, 3vw, 28px)',
    padding: 'clamp(16px, 4vw, 40px) clamp(12px, 3vw, 24px) clamp(24px, 5vw, 56px)',
    width: '100%',
    maxWidth: '960px',
    boxSizing: 'border-box',
  },
  breadcrumb: {
    display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap',
    background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)',
    border: '1px solid rgba(186,230,253,0.6)', borderRadius: '12px',
    padding: '8px 16px', boxShadow: '0 2px 8px rgba(14,165,233,0.07)',
  },
  breadcrumbLink: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#0ea5e9',
    fontWeight: 600, fontSize: '0.88em', padding: '4px 8px', borderRadius: '8px',
    transition: 'background 0.15s', fontFamily: 'inherit', letterSpacing: '0.01em',
  },
  breadcrumbSep: { color: '#94a3b8', fontWeight: 700, fontSize: '0.75em', userSelect: 'none' },
  breadcrumbCurrent: {
    color: '#0f172a', fontWeight: 800, fontSize: '0.88em', padding: '4px 8px',
    background: 'linear-gradient(135deg, #e0f2fe, #ede9fe)', borderRadius: '8px',
    border: '1px solid #bae6fd', letterSpacing: '0.01em',
  },
  pageHeader: { width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' },
  pageTitle: {
    fontSize: 'clamp(1.6em, 4vw, 2.4em)', fontWeight: 900, color: '#0f172a',
    letterSpacing: '-0.03em', margin: 0,
  },
  pageSubtitle: { fontSize: 'clamp(0.88em, 2vw, 1em)', color: '#64748b', margin: 0, lineHeight: 1.6 },
  accentLine: {
    marginTop: '10px', width: '56px', height: '4px',
    background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '4px',
  },
  grid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 'clamp(12px, 2.5vw, 20px)',
    alignItems: 'start',
  },
  card: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '18px',
    padding: 'clamp(18px, 2.5vw, 28px)',
    boxShadow: '0 6px 24px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)',
    border: '1px solid rgba(15,23,42,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
  } as React.CSSProperties,
  cardAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
    borderRadius: '18px 18px 0 0',
  } as React.CSSProperties,
  cardIcon: { fontSize: 'clamp(1.8em, 2.5vw, 2.2em)', lineHeight: 1, marginTop: '4px' },
  cardBody: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  cardTitle: {
    fontSize: 'clamp(1em, 2vw, 1.25em)', fontWeight: 800, color: '#0f172a',
    letterSpacing: '-0.02em', margin: 0,
  },
  cardDesc: { fontSize: 'clamp(0.78em, 1.4vw, 0.88em)', color: '#64748b', margin: 0, lineHeight: 1.6 },
  btnGroup: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  actionBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '9px 14px', borderRadius: '10px', border: '1.5px solid #c7d2fe',
    background: '#f5f3ff', color: '#6366f1', fontSize: '0.82em', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease',
    letterSpacing: '0.01em',
  } as React.CSSProperties,
  formPanel: {
    background: 'rgba(248,250,252,0.9)',
    borderRadius: '12px',
    border: '1px solid rgba(15,23,42,0.08)',
    overflow: 'hidden',
    marginTop: '4px',
  },
  formPanelHeader: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '12px 16px', borderBottom: '1px solid rgba(15,23,42,0.07)',
    background: 'rgba(255,255,255,0.6)',
  },
  formPanelDot: {
    display: 'inline-block', width: '10px', height: '10px',
    borderRadius: '50%', flexShrink: 0,
  } as React.CSSProperties,
  formPanelTitle: { fontSize: '0.9em', fontWeight: 700, color: '#0f172a' },
  formPanelBody: { padding: '16px' },
  cancelBtn: {
    marginTop: '14px', padding: '9px 16px', border: '1.5px solid #fecaca',
    borderRadius: '10px', background: '#fff1f2', color: '#dc2626',
    fontSize: '0.84em', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
};

export default Placas;
