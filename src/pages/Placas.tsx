import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ImageUploader from '../components/ImageUploader';
import { supabase } from '../services/supabase';
import Footer from '../components/Footer';
import Header from '../components/Header';

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
  page: {
    minHeight: '100vh',
    backgroundColor: '#f5f7fa',
    color: '#0f172a',
    fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
  },
  container: {
    padding: '40px 20px',
    maxWidth: '800px',
    margin: '32px auto 48px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
  },
    header: {
        textAlign: 'center',
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '20px',
        marginBottom: '30px',
        fontSize: '2.5em',
        fontWeight: 700,
        color: '#2c3e50',
    },
    section: {
        backgroundColor: '#fdfdfd',
        border: '1px solid #ecf0f1',
        borderRadius: '10px',
        padding: '25px',
        marginBottom: '25px',
        transition: 'box-shadow 0.3s ease',
    },
    sectionTitle: {
        margin: '0 0 20px 0',
        color: '#34495e',
        textAlign: 'center',
        fontSize: '1.8em',
        fontWeight: 600,
    },
    button: {
        padding: '12px 25px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: '#3498db',
        color: 'white',
        fontSize: '1em',
        fontWeight: 500,
        transition: 'background-color 0.3s ease, transform 0.2s ease',
        textDecoration: 'none',
        display: 'inline-block',
        textAlign: 'center',
    },
    buttonContainer: {
        display: 'flex',
        justifyContent: 'center',
        gap: '15px',
        marginTop: '20px',
    },
    backButton: {
        display: 'inline-block',
        marginBottom: '30px',
        padding: '10px 20px',
        border: '1px solid #bdc3c7',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: '#ecf0f1',
        color: '#34495e',
        textDecoration: 'none',
        fontWeight: 600,
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
    },
    greenButton: {
        padding: '12px 25px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: '#27ae60',
        color: 'white',
        fontSize: '1em',
        fontWeight: 600,
        transition: 'background-color 0.3s ease, transform 0.2s ease',
        textDecoration: 'none',
        display: 'inline-block',
        textAlign: 'center',
        textShadow: '0 1px 2px rgba(0,0,0,0.2)',
    },
    yellowButton: {
        padding: '12px 25px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: '#f39c12',
        color: '#2c3e50',
        fontSize: '1em',
        fontWeight: 600,
        transition: 'background-color 0.3s ease, transform 0.2s ease',
        textDecoration: 'none',
        display: 'inline-block',
        textAlign: 'center',
    },
    formContainer: {
        backgroundColor: '#f8f9fa',
        border: '2px solid #27ae60',
        borderRadius: '12px',
        padding: '30px',
        marginTop: '20px',
    },
    formTitle: {
        margin: '0 0 25px 0',
        color: '#27ae60',
        fontSize: '1.5em',
        fontWeight: 600,
        textAlign: 'center',
    },
    cancelButton: {
        padding: '10px 20px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: '#e74c3c',
        color: 'white',
        fontSize: '1em',
        fontWeight: 600,
        marginTop: '20px',
        display: 'block',
        margin: '20px auto 0',
    },
    accordionContainer: {
        marginTop: '20px',
    },
    accordionLabel: {
        display: 'block',
        fontSize: '1em',
        fontWeight: 600,
        color: '#34495e',
        marginBottom: '8px',
    },
    select: {
        width: '100%',
        padding: '15px',
        fontSize: '1em',
        border: '2px solid #bdc3c7',
        borderRadius: '8px',
        backgroundColor: '#fff',
        cursor: 'pointer',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        outline: 'none',
        color: '#2c3e50',
        fontWeight: 500,
    }
};

const Placas: React.FC = () => {
  const [showClasificadasForm, setShowClasificadasForm] = useState(false);
  const [showSinClasificarForm, setShowSinClasificarForm] = useState(false);
  const [showReasignacionSection, setShowReasignacionSection] = useState(false);
  const [showEliminarSection, setShowEliminarSection] = useState(false);
  const [imageUploaded, setImageUploaded] = useState(false);
  const [selectedTema, setSelectedTema] = useState('');
  const [selectedSubtema, setSelectedSubtema] = useState('');
  const [temas, setTemas] = useState<Tema[]>([]);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);

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
    console.log('Imagen seleccionada:', file.name);
    setImageUploaded(true);
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
    setSelectedTema('');
    setSelectedSubtema('');
  };

  return (
    <div style={styles.page}>
      <Header />
      <div style={styles.container}>
        <h1 style={styles.header}>Placas</h1>
        <Link to="/edicion" style={styles.backButton}>
            Regresar a Edición
        </Link>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Subir placas</h2>
          {!isAnyFormActive && (
            <div style={styles.buttonContainer}>
                <button 
                  style={styles.greenButton}
                  onClick={() => setShowClasificadasForm(true)}
                >
                  Subir clasificadas
                </button>
                <button 
                  style={styles.yellowButton}
                  onClick={() => setShowSinClasificarForm(true)}
                >
                  Subir sin clasificar
                </button>
            </div>
          )}

          {showClasificadasForm && (
            <div style={styles.formContainer}>
              <h3 style={styles.formTitle}>Subir placas ya clasificadas</h3>
              
              <ImageUploader onImageSelect={handleImageSelect} />

              {imageUploaded && (
                <>
                  <div style={styles.accordionContainer}>
                    <label style={styles.accordionLabel}>Seleccionar Tema:</label>
                    <select
                      style={styles.select}
                      value={selectedTema}
                      onChange={handleTemaChange}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#27ae60'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#bdc3c7'}
                    >
                      <option value="">-- Selecciona un tema --</option>
                      {temas.map((tema) => (
                        <option key={tema.id} value={tema.id}>
                          {tema.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedTema && (
                    <div style={styles.accordionContainer}>
                      <label style={styles.accordionLabel}>Seleccionar Subtema:</label>
                      <select
                        style={styles.select}
                        value={selectedSubtema}
                        onChange={handleSubtemaChange}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#27ae60'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#bdc3c7'}
                      >
                        <option value="">-- Selecciona un subtema --</option>
                        {subtemas.map((subtema) => (
                          <option key={subtema.id} value={subtema.id}>
                            {subtema.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <button 
                style={styles.cancelButton}
                onClick={handleCancelForm}
              >
                Cancelar
              </button>
            </div>
          )}

          {showSinClasificarForm && (
            <div style={styles.formContainer}>
              <h3 style={styles.formTitle}>Subir placas sin clasificar</h3>
              
              <ImageUploader onImageSelect={handleImageSelect} />

              <button 
                style={styles.cancelButton}
                onClick={handleCancelForm}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {!isAnyFormActive && (
          <>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Reasignacion de valores</h2>
              <div style={styles.buttonContainer}>
                  <button style={styles.button}>Editar</button>
                  <button style={styles.button}>Lista de espera</button>
              </div>
            </div>

            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Eliminar placas</h2>
              <div style={styles.buttonContainer}>
                  <button style={styles.button}>Eliminar</button>
              </div>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Placas;
