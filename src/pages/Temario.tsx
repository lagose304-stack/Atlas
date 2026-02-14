import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import Footer from '../components/Footer';
import Header from '../components/Header';
import CreateTemaForm from '../components/temario/CreateTemaForm';
import CreateSubtemaForm from '../components/temario/CreateSubtemaForm';
import EditTemaForm from '../components/temario/EditTemaForm';
import EditSubtemaForm from '../components/temario/EditSubtemaForm';
import DeleteTemaForm from '../components/temario/DeleteTemaForm';
import DeleteSubtemaForm from '../components/temario/DeleteSubtemaForm';
import { uploadToCloudinary } from '../services/cloudinary';

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
    buttonContainer: {
        display: 'flex',
        justifyContent: 'center',
        gap: '15px',
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
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    label: {
        fontWeight: 600,
        color: '#555',
        fontSize: '1em',
    },
    input: {
        padding: '12px',
        border: '1px solid #bdc3c7',
        borderRadius: '8px',
        width: '100%',
        boxSizing: 'border-box',
        fontSize: '1em',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
    },
    select: {
        padding: '12px',
        border: '1px solid #bdc3c7',
        borderRadius: '8px',
        width: '100%',
        backgroundColor: 'white',
        fontSize: '1em',
    },
    actionButtons: {
        display: 'flex',
        gap: '10px',
        marginTop: '15px',
        justifyContent: 'flex-end',
    },
    primaryButton: {
        padding: '12px 20px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: '#2ecc71',
        color: 'white',
        fontSize: '1em',
        fontWeight: 500,
        transition: 'background-color 0.3s ease',
    },
    cancelButton: {
        padding: '12px 20px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: '#e74c3c',
        color: 'white',
        fontSize: '1em',
        fontWeight: 500,
        transition: 'background-color 0.3s ease',
    },
    secondaryButton: {
        padding: '10px 18px',
        border: '1px solid #3498db',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: 'transparent',
        color: '#3498db',
        alignSelf: 'flex-start',
        fontWeight: 600,
        transition: 'background-color 0.3s ease, color 0.3s ease',
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
    }
};

const Temario: React.FC = () => {
  // ... (todos los estados permanecen igual)
  const [isCreatingTema, setIsCreatingTema] = useState(false);
  const [isCreatingSubtema, setIsCreatingSubtema] = useState(false);
  const [temaNombre, setTemaNombre] = useState('');
  const [temaLogoUrl, setTemaLogoUrl] = useState('');
  const [temaLogoFile, setTemaLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [temaParcial, setTemaParcial] = useState<'primer' | 'segundo' | 'tercer' | ''>('');
  const [subtemas, setSubtemas] = useState<string[]>([]);
  const [isEditingTema, setIsEditingTema] = useState(false);
  const [isEditingSubtema, setIsEditingSubtema] = useState(false);
  const [editingTemaId, setEditingTemaId] = useState<string>('');
  const [editingTemaNombre, setEditingTemaNombre] = useState('');
  const [editingSubtemaId, setEditingSubtemaId] = useState<string>('');
  const [editingSubtemaNombre, setEditingSubtemaNombre] = useState('');
  const [isDeletingTema, setIsDeletingTema] = useState(false);
  const [isDeletingSubtema, setIsDeletingSubtema] = useState(false);
  const [deletingTemaId, setDeletingTemaId] = useState<string>('');
  const [deletingSubtemaId, setDeletingSubtemaId] = useState<string>('');
  const [temas, setTemas] = useState<Tema[]>([]);
  const [subtemasOfSelectedTema, setSubtemasOfSelectedTema] = useState<Subtema[]>([]);
  const [selectedTemaId, setSelectedTemaId] = useState<string>('');

  // ... (toda la lógica de useEffect y los handlers permanece igual)
  const fetchTemas = async () => {
    const { data, error } = await supabase.from('temas').select('*').order('nombre', { ascending: true });
    if (data) setTemas(data);
    if (error) console.error('Error fetching temas:', error);
  };

  useEffect(() => {
    fetchTemas();
  }, []);

  useEffect(() => {
    const tema = temas.find(t => t.id.toString() === editingTemaId);
    setEditingTemaNombre(tema ? tema.nombre : '');
  }, [editingTemaId, temas]);

  useEffect(() => {
    const fetchSubtemas = async () => {
      const temaId = isEditingSubtema ? selectedTemaId : (isDeletingSubtema ? deletingTemaId : null);
      if (temaId) {
        const { data, error } = await supabase.from('subtemas').select('*').eq('tema_id', temaId).order('nombre', { ascending: true });
        setSubtemasOfSelectedTema(data || []);
        if (isEditingSubtema) {
            setEditingSubtemaId('');
            setEditingSubtemaNombre('');
        }
        if (isDeletingSubtema) {
            setDeletingSubtemaId('');
        }
      }
    };
    if (isEditingSubtema || isDeletingSubtema) {
        fetchSubtemas();
    }
  }, [selectedTemaId, deletingTemaId, isEditingSubtema, isDeletingSubtema]);

  useEffect(() => {
    const subtema = subtemasOfSelectedTema.find(s => s.id.toString() === editingSubtemaId);
    setEditingSubtemaNombre(subtema ? subtema.nombre : '');
  }, [editingSubtemaId, subtemasOfSelectedTema]);


  const handleAddSubtema = () => setSubtemas([...subtemas, '']);
  const handleSubtemaChange = (index: number, value: string) => {
    const newSubtemas = [...subtemas];
    newSubtemas[index] = value;
    setSubtemas(newSubtemas);
  };

  const handleLogoUpload = (file: File) => {
    if (temaLogoUrl.startsWith('blob:')) URL.revokeObjectURL(temaLogoUrl);
    setTemaLogoFile(file);
    setTemaLogoUrl(URL.createObjectURL(file));
  };

  const handleRemoveLogo = () => {
    if (temaLogoUrl.startsWith('blob:')) URL.revokeObjectURL(temaLogoUrl);
    setTemaLogoUrl('');
    setTemaLogoFile(null);
    setIsUploadingLogo(false);
  };

  const handleTemaSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!temaNombre.trim()) return alert('El nombre del tema no puede estar vacío.');
    if (!temaLogoFile) return alert('Debes subir un logo para el tema.');
    if (!temaParcial) return alert('Selecciona el parcial al que pertenece el tema.');
    try {
      setIsUploadingLogo(true);
      const upload = await uploadToCloudinary(temaLogoFile, { folder: 'temas/logos' });
      const finalLogoUrl = upload.secure_url || '';
      const { data: temaData, error: temaError } = await supabase
        .from('temas')
        .insert([{ nombre: temaNombre, logo_url: finalLogoUrl || null, parcial: temaParcial }])
        .select();
      if (temaError) return alert(`Error al crear el tema: ${temaError.message}`);
      const temaId = temaData[0].id;
      const subtemasParaInsertar = subtemas.filter(n => n.trim() !== '').map(nombre => ({ nombre, tema_id: temaId }));
      if (subtemasParaInsertar.length > 0) {
        const { error: subtemaError } = await supabase.from('subtemas').insert(subtemasParaInsertar);
        if (subtemaError) return alert(`Error al crear subtemas: ${subtemaError.message}`);
      }
      alert('Tema y subtemas creados con éxito.');
      fetchTemas();
      resetAllForms();
    } catch (error: any) {
      console.error('Error al crear tema:', error);
      alert('No se pudo crear el tema. Intenta de nuevo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubtemaSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTemaId) return alert('Por favor, selecciona un tema.');
    const subtemasParaInsertar = subtemas.filter(n => n.trim() !== '').map(nombre => ({ nombre, tema_id: parseInt(selectedTemaId, 10) }));
    if (subtemasParaInsertar.length > 0) {
      const { error } = await supabase.from('subtemas').insert(subtemasParaInsertar);
      if (error) return alert(`Error al crear subtemas: ${error.message}`);
    }
    alert('Subtemas agregados con éxito.');
    resetAllForms();
  };

  const handleUpdateTema = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTemaId) return alert('Por favor, selecciona un tema para editar.');
    if (!editingTemaNombre.trim()) return alert('El nombre no puede estar vacío.');
    const { error } = await supabase.from('temas').update({ nombre: editingTemaNombre }).match({ id: editingTemaId });
    if (error) return alert(`Error al actualizar el tema: ${error.message}`);
    alert('Tema actualizado con éxito.');
    fetchTemas();
    resetAllForms();
  };

  const handleUpdateSubtema = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingSubtemaId) return alert('Por favor, selecciona un subtema para editar.');
    if (!editingSubtemaNombre.trim()) return alert('El nombre no puede estar vacío.');
    const { error } = await supabase.from('subtemas').update({ nombre: editingSubtemaNombre }).match({ id: editingSubtemaId });
    if (error) return alert(`Error al actualizar el subtema: ${error.message}`);
    alert('Subtema actualizado con éxito.');
    resetAllForms();
  };

  const handleDeleteTema = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deletingTemaId) return alert('Por favor, selecciona un tema para borrar.');
    if (window.confirm("¿Estás seguro de que quieres borrar este tema? Todos los subtemas asociados también se eliminarán.")) {
        const { error } = await supabase.from('temas').delete().match({ id: deletingTemaId });
        if (error) return alert(`Error al borrar el tema: ${error.message}`);
        alert('Tema borrado con éxito.');
        fetchTemas();
        resetAllForms();
    }
  };

  const handleDeleteSubtema = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deletingSubtemaId) return alert('Por favor, selecciona un subtema para borrar.');
    if (window.confirm("¿Estás seguro de que quieres borrar este subtema?")) {
        const { error } = await supabase.from('subtemas').delete().match({ id: deletingSubtemaId });
        if (error) return alert(`Error al borrar el subtema: ${error.message}`);
        alert('Subtema borrado con éxito.');
        resetAllForms();
    }
  };

  const resetAllForms = () => {
    setIsCreatingTema(false); setIsCreatingSubtema(false);
    setIsEditingTema(false); setIsEditingSubtema(false);
    setIsDeletingTema(false); setIsDeletingSubtema(false);
    setTemaNombre(''); setSubtemas([]);
    if (temaLogoUrl.startsWith('blob:')) URL.revokeObjectURL(temaLogoUrl);
    setTemaLogoUrl(''); setTemaLogoFile(null); setIsUploadingLogo(false);
    setTemaParcial('');
    setSelectedTemaId(''); setEditingTemaId(''); setEditingSubtemaId('');
    setDeletingTemaId(''); setDeletingSubtemaId('');
  };

  const openCreateTema = () => { resetAllForms(); setIsCreatingTema(true); };
  const openCreateSubtema = () => { resetAllForms(); setIsCreatingSubtema(true); };
  const openEditTema = () => { resetAllForms(); setIsEditingTema(true); };
  const openEditSubtema = () => { resetAllForms(); setIsEditingSubtema(true); };
  const openDeleteTema = () => { resetAllForms(); setIsDeletingTema(true); };
  const openDeleteSubtema = () => { resetAllForms(); setIsDeletingSubtema(true); };

  const anyFormOpen = isCreatingTema || isCreatingSubtema || isEditingTema || isEditingSubtema || isDeletingTema || isDeletingSubtema;

  return (
    <div style={styles.page}>
      <Header />
      <div style={styles.container}>
        <h1 style={styles.header}>Gestión de Temario</h1>
        <Link to="/edicion" style={styles.backButton}>Volver a Edición</Link>
        
        {!anyFormOpen && (
          <>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Crear</h2>
              <div style={styles.buttonContainer}>
                <button style={styles.button} onClick={openCreateTema}>Tema</button>
                <button style={styles.button} onClick={openCreateSubtema}>Subtema</button>
              </div>
            </div>

            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Editar</h2>
              <div style={styles.buttonContainer}>
                <button style={styles.button} onClick={openEditTema}>Tema</button>
                <button style={styles.button} onClick={openEditSubtema}>Subtema</button>
              </div>
            </div>

            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Borrar</h2>
              <div style={styles.buttonContainer}>
                <button style={styles.button} onClick={openDeleteTema}>Tema</button>
                <button style={styles.button} onClick={openDeleteSubtema}>Subtema</button>
              </div>
            </div>
          </>
        )}

        {(isCreatingTema || isCreatingSubtema) && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Crear</h2>
            {isCreatingTema ? (
              <CreateTemaForm
                styles={styles}
                temaNombre={temaNombre}
                temaLogoUrl={temaLogoUrl}
                isUploadingLogo={isUploadingLogo}
                onUploadLogo={handleLogoUpload}
                onRemoveLogo={handleRemoveLogo}
                temaParcial={temaParcial}
                onChangeParcial={setTemaParcial}
                subtemas={subtemas}
                onChangeTemaNombre={setTemaNombre}
                onAddSubtema={handleAddSubtema}
                onSubtemaChange={handleSubtemaChange}
                onSubmit={handleTemaSubmit}
                onCancel={resetAllForms}
              />
            ) : (
              <CreateSubtemaForm
                styles={styles}
                temas={temas}
                selectedTemaId={selectedTemaId}
                subtemas={subtemas}
                onChangeSelectedTema={setSelectedTemaId}
                onAddSubtema={handleAddSubtema}
                onSubtemaChange={handleSubtemaChange}
                onSubmit={handleSubtemaSubmit}
                onCancel={resetAllForms}
              />
            )}
          </div>
        )}

        {(isEditingTema || isEditingSubtema) && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Editar</h2>
            {isEditingTema ? (
              <EditTemaForm
                styles={styles}
                temas={temas}
                editingTemaId={editingTemaId}
                editingTemaNombre={editingTemaNombre}
                onChangeEditingTemaId={setEditingTemaId}
                onChangeEditingTemaNombre={setEditingTemaNombre}
                onSubmit={handleUpdateTema}
                onCancel={resetAllForms}
              />
            ) : (
              <EditSubtemaForm
                styles={styles}
                temas={temas}
                selectedTemaId={selectedTemaId}
                subtemasOfSelectedTema={subtemasOfSelectedTema}
                editingSubtemaId={editingSubtemaId}
                editingSubtemaNombre={editingSubtemaNombre}
                onChangeSelectedTema={setSelectedTemaId}
                onChangeEditingSubtemaId={setEditingSubtemaId}
                onChangeEditingSubtemaNombre={setEditingSubtemaNombre}
                onSubmit={handleUpdateSubtema}
                onCancel={resetAllForms}
              />
            )}
          </div>
        )}

        {(isDeletingTema || isDeletingSubtema) && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Borrar</h2>
            {isDeletingTema ? (
              <DeleteTemaForm
                styles={styles}
                temas={temas}
                deletingTemaId={deletingTemaId}
                onChangeDeletingTemaId={setDeletingTemaId}
                onSubmit={handleDeleteTema}
                onCancel={resetAllForms}
              />
            ) : (
              <DeleteSubtemaForm
                styles={styles}
                temas={temas}
                deletingTemaId={deletingTemaId}
                subtemasOfSelectedTema={subtemasOfSelectedTema}
                deletingSubtemaId={deletingSubtemaId}
                onChangeDeletingTemaId={setDeletingTemaId}
                onChangeDeletingSubtemaId={setDeletingSubtemaId}
                onSubmit={handleDeleteSubtema}
                onCancel={resetAllForms}
              />
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Temario;
