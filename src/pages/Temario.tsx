import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import Footer from '../components/Footer';
import Header from '../components/Header';
import CreateTemaForm from '../components/temario/CreateTemaForm';
import CreateSubtemaForm, { SubtemaInput } from '../components/temario/CreateSubtemaForm';
import EditTemaForm from '../components/temario/EditTemaForm';
import EditSubtemaForm from '../components/temario/EditSubtemaForm';
import DeleteTemaForm from '../components/temario/DeleteTemaForm';
import DeleteSubtemaForm from '../components/temario/DeleteSubtemaForm';
import { uploadToCloudinary, deleteFromCloudinary, getCloudinaryPublicId } from '../services/cloudinary';

// --- Interfaces ---
interface Tema {
  id: number;
  nombre: string;
  logo_url?: string;
}

interface Subtema {
  id: number;
  nombre: string;
  tema_id: number;
  logo_url?: string;
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
  const [subtemas, setSubtemas] = useState<SubtemaInput[]>([]);
  const [isEditingTema, setIsEditingTema] = useState(false);
  const [isEditingSubtema, setIsEditingSubtema] = useState(false);
  const [editingTemaId, setEditingTemaId] = useState<string>('');
  const [editingTemaNombre, setEditingTemaNombre] = useState('');
  const [editingSubtemaId, setEditingSubtemaId] = useState<string>('');
  const [editingSubtemaNombre, setEditingSubtemaNombre] = useState('');
  // Estados para edición de imágenes
  const [editingTemaLogoUrl, setEditingTemaLogoUrl] = useState('');
  const [editingTemaNewLogoFile, setEditingTemaNewLogoFile] = useState<File | null>(null);
  const [editingTemaNewLogoPreviewUrl, setEditingTemaNewLogoPreviewUrl] = useState('');
  const [editingSubtemaLogoUrl, setEditingSubtemaLogoUrl] = useState('');
  const [editingSubtemaNewLogoFile, setEditingSubtemaNewLogoFile] = useState<File | null>(null);
  const [editingSubtemaNewLogoPreviewUrl, setEditingSubtemaNewLogoPreviewUrl] = useState('');
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
    setEditingTemaLogoUrl(tema?.logo_url || '');
    // Limpiar nueva imagen al cambiar de tema seleccionado
    if (editingTemaNewLogoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(editingTemaNewLogoPreviewUrl);
    setEditingTemaNewLogoFile(null);
    setEditingTemaNewLogoPreviewUrl('');
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
    setEditingSubtemaLogoUrl(subtema?.logo_url || '');
    // Limpiar nueva imagen al cambiar de subtema seleccionado
    if (editingSubtemaNewLogoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(editingSubtemaNewLogoPreviewUrl);
    setEditingSubtemaNewLogoFile(null);
    setEditingSubtemaNewLogoPreviewUrl('');
  }, [editingSubtemaId, subtemasOfSelectedTema]);


  const handleAddSubtema = () => setSubtemas([...subtemas, { nombre: '', logoUrl: '', logoFile: null }]);
  const handleSubtemaChange = (index: number, value: string) => {
    const newSubtemas = [...subtemas];
    newSubtemas[index] = { ...newSubtemas[index], nombre: value };
    setSubtemas(newSubtemas);
  };
  const handleSubtemaLogoUpload = (index: number, file: File) => {
    const newSubtemas = [...subtemas];
    if (newSubtemas[index].logoUrl.startsWith('blob:')) URL.revokeObjectURL(newSubtemas[index].logoUrl);
    newSubtemas[index] = { ...newSubtemas[index], logoUrl: URL.createObjectURL(file), logoFile: file };
    setSubtemas(newSubtemas);
  };
  const handleSubtemaRemoveLogo = (index: number) => {
    const newSubtemas = [...subtemas];
    if (newSubtemas[index].logoUrl.startsWith('blob:')) URL.revokeObjectURL(newSubtemas[index].logoUrl);
    newSubtemas[index] = { ...newSubtemas[index], logoUrl: '', logoFile: null };
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

  const handleUploadNewTemaLogo = (file: File) => {
    if (editingTemaNewLogoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(editingTemaNewLogoPreviewUrl);
    setEditingTemaNewLogoFile(file);
    setEditingTemaNewLogoPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveNewTemaLogo = () => {
    if (editingTemaNewLogoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(editingTemaNewLogoPreviewUrl);
    setEditingTemaNewLogoFile(null);
    setEditingTemaNewLogoPreviewUrl('');
  };

  const handleUploadNewSubtemaLogo = (file: File) => {
    if (editingSubtemaNewLogoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(editingSubtemaNewLogoPreviewUrl);
    setEditingSubtemaNewLogoFile(file);
    setEditingSubtemaNewLogoPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveNewSubtemaLogo = () => {
    if (editingSubtemaNewLogoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(editingSubtemaNewLogoPreviewUrl);
    setEditingSubtemaNewLogoFile(null);
    setEditingSubtemaNewLogoPreviewUrl('');
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
      const subtemasValidos = subtemas.filter(s => s.nombre.trim() !== '');
      if (subtemasValidos.length > 0) {
        const subtemasConLogo = await Promise.all(
          subtemasValidos.map(async (s) => {
            let logoUrl: string | null = null;
            if (s.logoFile) {
              const up = await uploadToCloudinary(s.logoFile, { folder: 'temas' });
              logoUrl = up.secure_url || null;
            }
            return { nombre: s.nombre, tema_id: temaId, logo_url: logoUrl };
          })
        );
        const { error: subtemaError } = await supabase.from('subtemas').insert(subtemasConLogo);
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
    const subtemasValidos = subtemas.filter(s => s.nombre.trim() !== '');
    if (subtemasValidos.length === 0) return alert('Agrega al menos un subtema.');
    try {
      setIsUploadingLogo(true);
      const subtemasConLogo = await Promise.all(
        subtemasValidos.map(async (s) => {
          let logoUrl: string | null = null;
          if (s.logoFile) {
            const up = await uploadToCloudinary(s.logoFile, { folder: 'temas' });
            logoUrl = up.secure_url || null;
          }
          return { nombre: s.nombre, tema_id: parseInt(selectedTemaId, 10), logo_url: logoUrl };
        })
      );
      const { error } = await supabase.from('subtemas').insert(subtemasConLogo);
      if (error) return alert(`Error al crear subtemas: ${error.message}`);
      alert('Subtemas agregados con éxito.');
      resetAllForms();
    } catch (err: any) {
      console.error('Error al crear subtemas:', err);
      alert('No se pudo crear los subtemas. Intenta de nuevo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleUpdateTema = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTemaId) return alert('Por favor, selecciona un tema para editar.');
    if (!editingTemaNombre.trim()) return alert('El nombre no puede estar vacío.');
    try {
      setIsUploadingLogo(true);
      const updateData: { nombre: string; logo_url?: string } = { nombre: editingTemaNombre };
      if (editingTemaNewLogoFile) {
        const upload = await uploadToCloudinary(editingTemaNewLogoFile, { folder: 'temas/logos' });
        updateData.logo_url = upload.secure_url;
        // Borrar imagen antigua de Cloudinary
        if (editingTemaLogoUrl) {
          const publicId = getCloudinaryPublicId(editingTemaLogoUrl);
          if (publicId) deleteFromCloudinary(publicId).catch(e => console.warn('No se pudo borrar imagen antigua:', e));
        }
      }
      const { error } = await supabase.from('temas').update(updateData).match({ id: editingTemaId });
      if (error) return alert(`Error al actualizar el tema: ${error.message}`);
      alert('Tema actualizado con éxito.');
      fetchTemas();
      resetAllForms();
    } catch (err: any) {
      console.error('Error al actualizar tema:', err);
      alert('No se pudo actualizar el tema. Intenta de nuevo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleUpdateSubtema = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingSubtemaId) return alert('Por favor, selecciona un subtema para editar.');
    if (!editingSubtemaNombre.trim()) return alert('El nombre no puede estar vacío.');
    try {
      setIsUploadingLogo(true);
      const updateData: { nombre: string; logo_url?: string } = { nombre: editingSubtemaNombre };
      if (editingSubtemaNewLogoFile) {
        const upload = await uploadToCloudinary(editingSubtemaNewLogoFile, { folder: 'temas' });
        updateData.logo_url = upload.secure_url;
        // Borrar imagen antigua de Cloudinary
        if (editingSubtemaLogoUrl) {
          const publicId = getCloudinaryPublicId(editingSubtemaLogoUrl);
          if (publicId) deleteFromCloudinary(publicId).catch(e => console.warn('No se pudo borrar imagen antigua:', e));
        }
      }
      const { error } = await supabase.from('subtemas').update(updateData).match({ id: editingSubtemaId });
      if (error) return alert(`Error al actualizar el subtema: ${error.message}`);
      alert('Subtema actualizado con éxito.');
      resetAllForms();
    } catch (err: any) {
      console.error('Error al actualizar subtema:', err);
      alert('No se pudo actualizar el subtema. Intenta de nuevo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDeleteTema = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deletingTemaId) return alert('Por favor, selecciona un tema para borrar.');
    if (!window.confirm('¿Estás seguro de que quieres borrar este tema? Todos los subtemas asociados también se eliminarán.')) return;
    try {
      setIsUploadingLogo(true);
      // Obtener subtemas para borrar sus fotos
      const { data: subtemasData } = await supabase
        .from('subtemas')
        .select('id, logo_url')
        .eq('tema_id', deletingTemaId);

      // Obtener foto del tema
      const temaABorrar = temas.find(t => t.id.toString() === deletingTemaId);

      // Borrar el tema de la BD (los subtemas se borran en cascada si está configurado,
      // si no, los borramos primero)
      const { error: subtemaDeleteError } = await supabase
        .from('subtemas')
        .delete()
        .eq('tema_id', deletingTemaId);
      if (subtemaDeleteError) console.warn('Error al borrar subtemas de BD:', subtemaDeleteError.message);

      const { error } = await supabase.from('temas').delete().match({ id: deletingTemaId });
      if (error) return alert(`Error al borrar el tema: ${error.message}`);

      // Borrar fotos de Cloudinary (en segundo plano, sin bloquear)
      const deletePromises: Promise<any>[] = [];
      if (temaABorrar?.logo_url) {
        const pid = getCloudinaryPublicId(temaABorrar.logo_url);
        if (pid) deletePromises.push(deleteFromCloudinary(pid).catch(e => console.warn('No se pudo borrar foto del tema:', e)));
      }
      if (subtemasData) {
        for (const s of subtemasData) {
          if (s.logo_url) {
            const pid = getCloudinaryPublicId(s.logo_url);
            if (pid) deletePromises.push(deleteFromCloudinary(pid).catch(e => console.warn('No se pudo borrar foto de subtema:', e)));
          }
        }
      }
      await Promise.allSettled(deletePromises);

      alert('Tema y sus subtemas borrados con éxito.');
      fetchTemas();
      resetAllForms();
    } catch (err: any) {
      console.error('Error al borrar tema:', err);
      alert('No se pudo borrar el tema. Intenta de nuevo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDeleteSubtema = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deletingSubtemaId) return alert('Por favor, selecciona un subtema para borrar.');
    if (!window.confirm('¿Estás seguro de que quieres borrar este subtema?')) return;
    try {
      setIsUploadingLogo(true);
      const subtemaABorrar = subtemasOfSelectedTema.find(s => s.id.toString() === deletingSubtemaId);

      const { error } = await supabase.from('subtemas').delete().match({ id: deletingSubtemaId });
      if (error) return alert(`Error al borrar el subtema: ${error.message}`);

      // Borrar foto de Cloudinary
      if (subtemaABorrar?.logo_url) {
        const pid = getCloudinaryPublicId(subtemaABorrar.logo_url);
        if (pid) deleteFromCloudinary(pid).catch(e => console.warn('No se pudo borrar foto del subtema:', e));
      }

      alert('Subtema borrado con éxito.');
      resetAllForms();
    } catch (err: any) {
      console.error('Error al borrar subtema:', err);
      alert('No se pudo borrar el subtema. Intenta de nuevo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const resetAllForms = () => {
    setIsCreatingTema(false); setIsCreatingSubtema(false);
    setIsEditingTema(false); setIsEditingSubtema(false);
    setIsDeletingTema(false); setIsDeletingSubtema(false);
    setTemaNombre('');
    subtemas.forEach(s => { if (s.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(s.logoUrl); });
    setSubtemas([]);
    if (temaLogoUrl.startsWith('blob:')) URL.revokeObjectURL(temaLogoUrl);
    setTemaLogoUrl(''); setTemaLogoFile(null); setIsUploadingLogo(false);
    setTemaParcial('');
    setSelectedTemaId(''); setEditingTemaId(''); setEditingSubtemaId('');
    setDeletingTemaId(''); setDeletingSubtemaId('');
    // Limpiar estados de edición de imágenes
    if (editingTemaNewLogoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(editingTemaNewLogoPreviewUrl);
    setEditingTemaLogoUrl(''); setEditingTemaNewLogoFile(null); setEditingTemaNewLogoPreviewUrl('');
    if (editingSubtemaNewLogoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(editingSubtemaNewLogoPreviewUrl);
    setEditingSubtemaLogoUrl(''); setEditingSubtemaNewLogoFile(null); setEditingSubtemaNewLogoPreviewUrl('');
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
                onSubtemaLogoUpload={handleSubtemaLogoUpload}
                onSubtemaRemoveLogo={handleSubtemaRemoveLogo}
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
                onSubtemaLogoUpload={handleSubtemaLogoUpload}
                onSubtemaRemoveLogo={handleSubtemaRemoveLogo}
                isUploadingLogo={isUploadingLogo}
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
                editingTemaCurrentLogoUrl={editingTemaLogoUrl}
                editingTemaNewLogoPreviewUrl={editingTemaNewLogoPreviewUrl}
                isUploadingLogo={isUploadingLogo}
                onChangeEditingTemaId={setEditingTemaId}
                onChangeEditingTemaNombre={setEditingTemaNombre}
                onUploadNewLogo={handleUploadNewTemaLogo}
                onRemoveNewLogo={handleRemoveNewTemaLogo}
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
                editingSubtemaCurrentLogoUrl={editingSubtemaLogoUrl}
                editingSubtemaNewLogoPreviewUrl={editingSubtemaNewLogoPreviewUrl}
                isUploadingLogo={isUploadingLogo}
                onChangeSelectedTema={setSelectedTemaId}
                onChangeEditingSubtemaId={setEditingSubtemaId}
                onChangeEditingSubtemaNombre={setEditingSubtemaNombre}
                onUploadNewLogo={handleUploadNewSubtemaLogo}
                onRemoveNewLogo={handleRemoveNewSubtemaLogo}
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
