import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';

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
    container: {
        padding: '40px 20px',
        fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        maxWidth: '800px',
        margin: '40px auto',
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

  const handleTemaSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!temaNombre.trim()) return alert('El nombre del tema no puede estar vacío.');
    const { data: temaData, error: temaError } = await supabase.from('temas').insert([{ nombre: temaNombre }]).select();
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

  // --- Renderizado de componentes con estilos ---
  const renderForm = (
    title: string,
    isOpen: boolean,
    buttons: React.ReactNode,
    form: React.ReactNode
  ) => (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      {!anyFormOpen && buttons}
      {isOpen && form}
    </div>
  );

  const renderCreateTemaForm = () => (
    <form onSubmit={handleTemaSubmit} style={styles.form}>
      <div style={styles.formGroup}><label style={styles.label}>Nombre del Tema:</label><input style={styles.input} type="text" value={temaNombre} onChange={(e) => setTemaNombre(e.target.value)} required /></div>
      {subtemas.map((subtema, index) => (<div style={styles.formGroup} key={index}><label style={styles.label}>Subtema {index + 1}:</label><input style={styles.input} type="text" value={subtema} onChange={(e) => handleSubtemaChange(index, e.target.value)} /></div>))}
      <button type="button" onClick={handleAddSubtema} style={styles.secondaryButton}>{subtemas.length === 0 ? 'Crear Subtema' : 'Agregar otro Subtema'}</button>
      <div style={styles.actionButtons}><button type="submit" style={styles.primaryButton}>Confirmar</button><button type="button" onClick={resetAllForms} style={styles.cancelButton}>Cancelar</button></div>
    </form>
  );

  const renderCreateSubtemaForm = () => (
    <form onSubmit={handleSubtemaSubmit} style={styles.form}>
      <div style={styles.formGroup}><label style={styles.label}>Seleccionar Tema:</label><select style={styles.select} value={selectedTemaId} onChange={(e) => setSelectedTemaId(e.target.value)} required><option value="" disabled>Selecciona un tema</option>{temas.map(t => (<option key={t.id} value={t.id}>{t.nombre}</option>))}</select></div>
      {subtemas.map((subtema, index) => (<div style={styles.formGroup} key={index}><label style={styles.label}>Subtema {index + 1}:</label><input style={styles.input} type="text" value={subtema} onChange={(e) => handleSubtemaChange(index, e.target.value)} /></div>))}
      <button type="button" onClick={handleAddSubtema} style={styles.secondaryButton}>{subtemas.length === 0 ? 'Crear Subtema' : 'Agregar otro Subtema'}</button>
      <div style={styles.actionButtons}><button type="submit" style={styles.primaryButton}>Confirmar</button><button type="button" onClick={resetAllForms} style={styles.cancelButton}>Cancelar</button></div>
    </form>
  );

  const renderEditTemaForm = () => (
    <form onSubmit={handleUpdateTema} style={styles.form}>
      <div style={styles.formGroup}><label style={styles.label}>Seleccionar Tema:</label><select style={styles.select} value={editingTemaId} onChange={(e) => setEditingTemaId(e.target.value)} required><option value="" disabled>Selecciona un tema</option>{temas.map(t => (<option key={t.id} value={t.id}>{t.nombre}</option>))}</select></div>
      {editingTemaId && <div style={styles.formGroup}><label style={styles.label}>Nuevo nombre del Tema:</label><input style={styles.input} type="text" value={editingTemaNombre} onChange={(e) => setEditingTemaNombre(e.target.value)} required /></div>}
      <div style={styles.actionButtons}><button type="submit" style={styles.primaryButton}>Guardar Cambios</button><button type="button" onClick={resetAllForms} style={styles.cancelButton}>Cancelar</button></div>
    </form>
  );

  const renderEditSubtemaForm = () => (
    <form onSubmit={handleUpdateSubtema} style={styles.form}>
        <div style={styles.formGroup}><label style={styles.label}>Seleccionar Tema:</label><select style={styles.select} value={selectedTemaId} onChange={(e) => setSelectedTemaId(e.target.value)} required><option value="" disabled>Selecciona un tema</option>{temas.map(t => (<option key={t.id} value={t.id}>{t.nombre}</option>))}</select></div>
        {selectedTemaId && subtemasOfSelectedTema.length > 0 && (
            <>
                <div style={styles.formGroup}><label style={styles.label}>Seleccionar Subtema:</label><select style={styles.select} value={editingSubtemaId} onChange={(e) => setEditingSubtemaId(e.target.value)} required><option value="" disabled>Selecciona un subtema</option>{subtemasOfSelectedTema.map(s => (<option key={s.id} value={s.id}>{s.nombre}</option>))}</select></div>
                {editingSubtemaId && <div style={styles.formGroup}><label style={styles.label}>Nuevo nombre del Subtema:</label><input style={styles.input} type="text" value={editingSubtemaNombre} onChange={(e) => setEditingSubtemaNombre(e.target.value)} required /></div>}
            </>
        )}
        {selectedTemaId && subtemasOfSelectedTema.length === 0 && <p>Este tema no tiene subtemas.</p>}
        <div style={styles.actionButtons}><button type="submit" style={styles.primaryButton}>Guardar Cambios</button><button type="button" onClick={resetAllForms} style={styles.cancelButton}>Cancelar</button></div>
    </form>
  );

  const renderDeleteTemaForm = () => (
    <form onSubmit={handleDeleteTema} style={styles.form}>
        <div style={styles.formGroup}><label style={styles.label}>Seleccionar Tema a Borrar:</label><select style={styles.select} value={deletingTemaId} onChange={(e) => setDeletingTemaId(e.target.value)} required><option value="" disabled>Selecciona un tema</option>{temas.map(t => (<option key={t.id} value={t.id}>{t.nombre}</option>))}</select></div>
        <div style={styles.actionButtons}><button type="submit" style={styles.cancelButton}>Borrar Tema</button><button type="button" onClick={resetAllForms} style={{...styles.primaryButton, backgroundColor: '#6c757d'}}>Cancelar</button></div>
    </form>
  );

  const renderDeleteSubtemaForm = () => (
    <form onSubmit={handleDeleteSubtema} style={styles.form}>
        <div style={styles.formGroup}><label style={styles.label}>Seleccionar Tema:</label><select style={styles.select} value={deletingTemaId} onChange={(e) => setDeletingTemaId(e.target.value)} required><option value="" disabled>Selecciona un tema</option>{temas.map(t => (<option key={t.id} value={t.id}>{t.nombre}</option>))}</select></div>
        {deletingTemaId && subtemasOfSelectedTema.length > 0 && (
            <div style={styles.formGroup}><label style={styles.label}>Seleccionar Subtema a Borrar:</label><select style={styles.select} value={deletingSubtemaId} onChange={(e) => setDeletingSubtemaId(e.target.value)} required><option value="" disabled>Selecciona un subtema</option>{subtemasOfSelectedTema.map(s => (<option key={s.id} value={s.id}>{s.nombre}</option>))}</select></div>
        )}
        {deletingTemaId && subtemasOfSelectedTema.length === 0 && <p>Este tema no tiene subtemas.</p>}
        <div style={styles.actionButtons}><button type="submit" style={styles.cancelButton}>Borrar Subtema</button><button type="button" onClick={resetAllForms} style={{...styles.primaryButton, backgroundColor: '#6c757d'}}>Cancelar</button></div>
    </form>
  );

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Gestión de Temario</h1>
      <Link to="/edicion" style={styles.backButton}>Volver a Edición</Link>
      
      {renderForm("Crear", isCreatingTema || isCreatingSubtema, 
        <div style={styles.buttonContainer}><button style={styles.button} onClick={openCreateTema}>Tema</button><button style={styles.button} onClick={openCreateSubtema}>Subtema</button></div>,
        isCreatingTema ? renderCreateTemaForm() : renderCreateSubtemaForm()
      )}

      {renderForm("Editar", isEditingTema || isEditingSubtema,
        <div style={styles.buttonContainer}><button style={styles.button} onClick={openEditTema}>Tema</button><button style={styles.button} onClick={openEditSubtema}>Subtema</button></div>,
        isEditingTema ? renderEditTemaForm() : renderEditSubtemaForm()
      )}

      {renderForm("Borrar", isDeletingTema || isDeletingSubtema,
        <div style={styles.buttonContainer}><button style={styles.button} onClick={openDeleteTema}>Tema</button><button style={styles.button} onClick={openDeleteSubtema}>Subtema</button></div>,
        isDeletingTema ? renderDeleteTemaForm() : renderDeleteSubtemaForm()
      )}
    </div>
  );
};

export default Temario;
