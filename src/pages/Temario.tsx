import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import LoadingToast, { LoadingToastType } from '../components/LoadingToast';
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
const styles: { [key: string]: React.CSSProperties } = {
  // Internos para los subformularios (CreateTemaForm, etc.)
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontWeight: 600, color: '#555', fontSize: '1em' },
  input: {
    padding: '12px', border: '1px solid #bdc3c7', borderRadius: '8px',
    width: '100%', boxSizing: 'border-box' as const, fontSize: '1em',
    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
  },
  select: {
    padding: '12px', border: '1px solid #bdc3c7', borderRadius: '8px',
    width: '100%', backgroundColor: 'white', fontSize: '1em',
  },
  actionButtons: { display: 'flex', gap: '10px', marginTop: '15px', justifyContent: 'flex-end' },
  primaryButton: {
    padding: '12px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer',
    backgroundColor: '#2ecc71', color: 'white', fontSize: '1em', fontWeight: 500,
    transition: 'background-color 0.3s ease',
  },
  cancelButton: {
    padding: '12px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer',
    backgroundColor: '#e74c3c', color: 'white', fontSize: '1em', fontWeight: 500,
    transition: 'background-color 0.3s ease',
  },
  secondaryButton: {
    padding: '10px 18px', border: '1px solid #3498db', borderRadius: '8px', cursor: 'pointer',
    backgroundColor: 'transparent', color: '#3498db', alignSelf: 'flex-start' as const,
    fontWeight: 600, transition: 'background-color 0.3s ease, color 0.3s ease',
  },
  button: {
    padding: '12px 25px', border: 'none', borderRadius: '8px', cursor: 'pointer',
    backgroundColor: '#3498db', color: 'white', fontSize: '1em', fontWeight: 500,
    transition: 'background-color 0.3s ease',
  },
};

// Helper: extrae todas las URLs de imagen de un array de content_blocks (todos los tipos)
function extractBlockImageUrls(blocks: { block_type: string; content: Record<string, string> }[]): string[] {
  const urls: string[] = [];
  for (const b of blocks) {
    const c = b.content;
    switch (b.block_type) {
      case 'image':         if (c.url) urls.push(c.url); break;
      case 'text_image':    if (c.image_url) urls.push(c.image_url); break;
      case 'two_images':
        if (c.image_url_left)  urls.push(c.image_url_left);
        if (c.image_url_right) urls.push(c.image_url_right);
        break;
      case 'three_images':
        if (c.image_url_1) urls.push(c.image_url_1);
        if (c.image_url_2) urls.push(c.image_url_2);
        if (c.image_url_3) urls.push(c.image_url_3);
        break;
      case 'carousel':
      case 'text_carousel':
        for (let i = 1; i <= 8; i++) { const u = c[`image_url_${i}`]; if (u) urls.push(u); else break; }
        break;
      case 'double_carousel':
        for (let i = 1; i <= 5; i++) { const l = c[`left_image_url_${i}`];  if (l) urls.push(l); else break; }
        for (let i = 1; i <= 5; i++) { const r = c[`right_image_url_${i}`]; if (r) urls.push(r); else break; }
        break;
    }
  }
  return urls.filter(Boolean);
}

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
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingType, setLoadingType] = useState<LoadingToastType>('saving');
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
        const { data } = await supabase.from('subtemas').select('*').eq('tema_id', temaId).order('nombre', { ascending: true });
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
      setLoadingMessage('Creando tema'); setLoadingType('uploading');
      setIsUploadingLogo(true);
      const upload = await uploadToCloudinary(temaLogoFile, { folder: 'temas/logos' });
      const finalLogoUrl = upload.secure_url || '';
      const { data: maxData } = await supabase
        .from('temas')
        .select('sort_order')
        .eq('parcial', temaParcial)
        .order('sort_order', { ascending: false })
        .limit(1);
      const nextSortOrder = (maxData && maxData.length > 0 && maxData[0].sort_order != null)
        ? maxData[0].sort_order + 1
        : 0;
      const { data: temaData, error: temaError } = await supabase
        .from('temas')
        .insert([{ nombre: temaNombre, logo_url: finalLogoUrl || null, parcial: temaParcial, sort_order: nextSortOrder }])
        .select();
      if (temaError) return alert(`Error al crear el tema: ${temaError.message}`);
      const temaId = temaData[0].id;
      const subtemasValidos = subtemas.filter(s => s.nombre.trim() !== '');
      if (subtemasValidos.length > 0) {
        const subtemasConLogo = await Promise.all(
          subtemasValidos.map(async (s, index) => {
            let logoUrl: string | null = null;
            if (s.logoFile) {
              const up = await uploadToCloudinary(s.logoFile, { folder: 'temas' });
              logoUrl = up.secure_url || null;
            }
            return { nombre: s.nombre, tema_id: temaId, logo_url: logoUrl, sort_order: index };
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
      setLoadingMessage('Creando subtemas'); setLoadingType('uploading');
      setIsUploadingLogo(true);
      const { data: maxSubtemaData } = await supabase
        .from('subtemas')
        .select('sort_order')
        .eq('tema_id', parseInt(selectedTemaId, 10))
        .order('sort_order', { ascending: false })
        .limit(1);
      const baseSubtemaSortOrder = (maxSubtemaData && maxSubtemaData.length > 0 && maxSubtemaData[0].sort_order != null)
        ? maxSubtemaData[0].sort_order + 1
        : 0;
      const subtemasConLogo = await Promise.all(
        subtemasValidos.map(async (s, index) => {
          let logoUrl: string | null = null;
          if (s.logoFile) {
            const up = await uploadToCloudinary(s.logoFile, { folder: 'temas' });
            logoUrl = up.secure_url || null;
          }
          return { nombre: s.nombre, tema_id: parseInt(selectedTemaId, 10), logo_url: logoUrl, sort_order: baseSubtemaSortOrder + index };
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
      setLoadingMessage('Actualizando tema'); setLoadingType('updating');
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
      setLoadingMessage('Actualizando subtema'); setLoadingType('updating');
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
    if (!window.confirm('¿Estás seguro? Se borrarán el tema, todos sus subtemas, placas y el contenido de todas sus páginas.')) return;
    try {
      setLoadingMessage('Eliminando tema y contenido'); setLoadingType('deleting');
      setIsUploadingLogo(true);
      const temaIdNum = Number(deletingTemaId);

      // 1. Recopilar subtemas del tema
      const { data: subtemasData } = await supabase
        .from('subtemas').select('id, logo_url').eq('tema_id', temaIdNum);
      const subtemaIds = (subtemasData ?? []).map(s => s.id);
      const subtemaIdSet = new Set(subtemaIds);

      // 2. Recopilar placas del tema
      const { data: placasData } = await supabase
        .from('placas').select('id, photo_url').eq('tema_id', temaIdNum);

      // 2b. photo_urls de placas de OTROS temas — nunca borrar esas imágenes
      const { data: otherPlacasData } = await supabase
        .from('placas').select('photo_url').neq('tema_id', temaIdNum);
      const otherPlacasUrlSet = new Set((otherPlacasData ?? []).map(p => p.photo_url).filter(Boolean));

      // 3. Obtener TODOS los content_blocks para separar los propios de los externos
      const { data: allBlocks } = await supabase
        .from('content_blocks').select('block_type, content, entity_type, entity_id');

      // Bloques que pertenecen a las páginas que vamos a borrar
      const ownBlocks = (allBlocks ?? []).filter(b =>
        (b.entity_type === 'subtemas_page' && b.entity_id === temaIdNum) ||
        (b.entity_type === 'placas_page'   && subtemaIdSet.has(b.entity_id))
      );
      // Bloques de OTRAS páginas (no se borrarán)
      const externalBlocks = (allBlocks ?? []).filter(b =>
        !((b.entity_type === 'subtemas_page' && b.entity_id === temaIdNum) ||
          (b.entity_type === 'placas_page'   && subtemaIdSet.has(b.entity_id)))
      );
      const externalUrlSet = new Set(extractBlockImageUrls(externalBlocks as any));

      // 4. Placas que pueden borrarse: las que NO están referenciadas en páginas externas
      const placasToDelete = (placasData ?? []).filter(p => !externalUrlSet.has(p.photo_url));
      const placasToDeleteIds = placasToDelete.map(p => p.id);
      const placasToDeleteUrlSet = new Set(placasToDelete.map(p => p.photo_url));

      // 5. URLs de imágenes en los bloques propios (solo borrar las no protegidas externamente
      //    ni correspondientes a placas de otros temas)
      const ownBlockImageUrls = extractBlockImageUrls(ownBlocks as any);
      const blockUrlsToDelete = ownBlockImageUrls.filter(
        u => !externalUrlSet.has(u) && !otherPlacasUrlSet.has(u)
      );

      // 6. Borrar content_blocks en BD
      await supabase.from('content_blocks').delete()
        .eq('entity_type', 'subtemas_page').eq('entity_id', temaIdNum);
      if (subtemaIds.length > 0) {
        await supabase.from('content_blocks').delete()
          .eq('entity_type', 'placas_page').in('entity_id', subtemaIds);
      }

      // 7. Borrar solo las placas no protegidas en BD
      if (placasToDeleteIds.length > 0) {
        await supabase.from('placas').delete().in('id', placasToDeleteIds);
      }

      // 8. Borrar subtemas y tema en BD
      await supabase.from('subtemas').delete().eq('tema_id', temaIdNum);
      const { error } = await supabase.from('temas').delete().match({ id: temaIdNum });
      if (error) return alert(`Error al borrar el tema: ${error.message}`);

      // 9. Borrar imágenes en Cloudinary
      const deletePromises: Promise<any>[] = [];
      const temaABorrar = temas.find(t => t.id.toString() === deletingTemaId);
      if (temaABorrar?.logo_url) {
        const pid = getCloudinaryPublicId(temaABorrar.logo_url);
        if (pid) deletePromises.push(deleteFromCloudinary(pid).catch(e => console.warn('Logo tema:', e)));
      }
      for (const s of (subtemasData ?? [])) {
        if (s.logo_url) {
          const pid = getCloudinaryPublicId(s.logo_url);
          if (pid) deletePromises.push(deleteFromCloudinary(pid).catch(e => console.warn('Logo subtema:', e)));
        }
      }
      // Solo fotos de placas que no están protegidas
      for (const p of placasToDelete) {
        if (p.photo_url) {
          const pid = getCloudinaryPublicId(p.photo_url);
          if (pid) deletePromises.push(deleteFromCloudinary(pid).catch(e => console.warn('Placa foto:', e)));
        }
      }
      // Imágenes subidas en bloques que no son placas del tema (ya borradas arriba) y no están protegidas
      for (const url of blockUrlsToDelete) {
        if (!placasToDeleteUrlSet.has(url)) {
          const pid = getCloudinaryPublicId(url);
          if (pid) deletePromises.push(deleteFromCloudinary(pid).catch(e => console.warn('Bloque imagen:', e)));
        }
      }
      await Promise.allSettled(deletePromises);

      alert('Tema y todo su contenido borrado con éxito.');
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
    if (!window.confirm('¿Estás seguro? Se borrarán el subtema, sus placas y el contenido de su página.')) return;
    try {
      setLoadingMessage('Eliminando subtema'); setLoadingType('deleting');
      setIsUploadingLogo(true);
      const subtemaIdNum = Number(deletingSubtemaId);
      const subtemaABorrar = subtemasOfSelectedTema.find(s => s.id.toString() === deletingSubtemaId);

      // 1. Recopilar placas del subtema
      const { data: placasData } = await supabase
        .from('placas').select('id, photo_url').eq('subtema_id', subtemaIdNum);

      // 1b. photo_urls de placas de OTROS subtemas — nunca borrar esas imágenes
      const { data: otherPlacasData } = await supabase
        .from('placas').select('photo_url').neq('subtema_id', subtemaIdNum);
      const otherPlacasUrlSet = new Set((otherPlacasData ?? []).map(p => p.photo_url).filter(Boolean));

      // 2. Obtener TODOS los content_blocks para separar propios de externos
      const { data: allBlocks } = await supabase
        .from('content_blocks').select('block_type, content, entity_type, entity_id');

      // Bloques que pertenecen a la página que vamos a borrar
      const ownBlocks = (allBlocks ?? []).filter(b =>
        b.entity_type === 'placas_page' && b.entity_id === subtemaIdNum
      );
      // Bloques de OTRAS páginas (no se borrarán)
      const externalBlocks = (allBlocks ?? []).filter(b =>
        !(b.entity_type === 'placas_page' && b.entity_id === subtemaIdNum)
      );
      const externalUrlSet = new Set(extractBlockImageUrls(externalBlocks as any));

      // 3. Placas que pueden borrarse: las que NO están referenciadas en páginas externas
      const placasToDelete = (placasData ?? []).filter(p => !externalUrlSet.has(p.photo_url));
      const placasToDeleteIds = placasToDelete.map(p => p.id);
      const placasToDeleteUrlSet = new Set(placasToDelete.map(p => p.photo_url));

      // 4. URLs de imágenes en bloques propios (solo borrar las no protegidas externamente
      //    ni correspondientes a placas de otros subtemas)
      const ownBlockImageUrls = extractBlockImageUrls(ownBlocks as any);
      const blockUrlsToDelete = ownBlockImageUrls.filter(
        u => !externalUrlSet.has(u) && !otherPlacasUrlSet.has(u)
      );

      // 5. Borrar content_blocks en BD
      await supabase.from('content_blocks').delete()
        .eq('entity_type', 'placas_page').eq('entity_id', subtemaIdNum);

      // 6. Borrar solo las placas no protegidas en BD
      if (placasToDeleteIds.length > 0) {
        await supabase.from('placas').delete().in('id', placasToDeleteIds);
      }

      // 7. Borrar subtema en BD
      const { error } = await supabase.from('subtemas').delete().match({ id: subtemaIdNum });
      if (error) return alert(`Error al borrar el subtema: ${error.message}`);

      // 8. Borrar imágenes en Cloudinary
      const deletePromises: Promise<any>[] = [];
      if (subtemaABorrar?.logo_url) {
        const pid = getCloudinaryPublicId(subtemaABorrar.logo_url);
        if (pid) deletePromises.push(deleteFromCloudinary(pid).catch(e => console.warn('Logo subtema:', e)));
      }
      // Solo fotos de placas no protegidas
      for (const p of placasToDelete) {
        if (p.photo_url) {
          const pid = getCloudinaryPublicId(p.photo_url);
          if (pid) deletePromises.push(deleteFromCloudinary(pid).catch(e => console.warn('Placa foto:', e)));
        }
      }
      // Imágenes subidas en bloques que no son placas del subtema (ya borradas arriba) y no están protegidas
      for (const url of blockUrlsToDelete) {
        if (!placasToDeleteUrlSet.has(url)) {
          const pid = getCloudinaryPublicId(url);
          if (pid) deletePromises.push(deleteFromCloudinary(pid).catch(e => console.warn('Bloque imagen:', e)));
        }
      }
      await Promise.allSettled(deletePromises);

      alert('Subtema y todo su contenido borrado con éxito.');
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
  const navigate = useNavigate();

  return (
    <div style={t.page}>
      <Header />

      <main style={t.main}>

        {/* Breadcrumb */}
        <nav style={t.breadcrumb}>
          <button
            onClick={() => navigate('/')}
            style={t.breadcrumbLink}
            onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            🏠 Inicio
          </button>
          <span style={t.breadcrumbSep}>❯</span>
          <button
            onClick={() => navigate('/edicion')}
            style={t.breadcrumbLink}
            onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            Edición
          </button>
          <span style={t.breadcrumbSep}>❯</span>
          <span style={t.breadcrumbCurrent}>Temario</span>
        </nav>

        {/* Encabezado */}
        <div style={t.pageHeader}>
          <h1 style={t.pageTitle}>Gestión de Temario</h1>
          <p style={t.pageSubtitle}>Crea, edita o elimina los temas y subtemas del atlas histológico.</p>
          <div style={t.accentLine} />
        </div>

        {/* Contenido principal */}
        <div style={t.contentCard}>

          {!anyFormOpen && (
            <div style={t.actionGrid} className="temario-action-grid">

              {/* Crear */}
              <div style={t.actionSection}>
                <div style={{ ...t.sectionAccent, background: 'linear-gradient(135deg, #6366f1, #818cf8)' }} />
                <div style={t.sectionIcon}>➕</div>
                <h2 style={t.sectionTitle}>Crear</h2>
                <p style={t.sectionDesc}>Agrega un nuevo tema o subtema al atlas.</p>
                <div style={t.btnGroup}>
                  <button
                    style={t.actionBtn}
                    onClick={openCreateTema}
                    onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#6366f1,#818cf8)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
                  >
                    📚 Tema
                  </button>
                  <button
                    style={{ ...t.actionBtn, color: '#6366f1', background: '#f5f3ff', borderColor: '#c7d2fe' }}
                    onClick={openCreateSubtema}
                    onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#6366f1,#818cf8)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
                  >
                    📂 Subtema
                  </button>
                </div>
              </div>

              {/* Editar */}
              <div style={t.actionSection}>
                <div style={{ ...t.sectionAccent, background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }} />
                <div style={t.sectionIcon}>✏️</div>
                <h2 style={t.sectionTitle}>Editar</h2>
                <p style={t.sectionDesc}>Modifica el nombre o imagen de un tema o subtema.</p>
                <div style={t.btnGroup}>
                  <button
                    style={{ ...t.actionBtn, color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' }}
                    onClick={openEditTema}
                    onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#f59e0b,#fbbf24)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fffbeb'; e.currentTarget.style.color = '#b45309'; e.currentTarget.style.borderColor = '#fde68a'; }}
                  >
                    📚 Tema
                  </button>
                  <button
                    style={{ ...t.actionBtn, color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' }}
                    onClick={openEditSubtema}
                    onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#f59e0b,#fbbf24)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fffbeb'; e.currentTarget.style.color = '#b45309'; e.currentTarget.style.borderColor = '#fde68a'; }}
                  >
                    📂 Subtema
                  </button>
                </div>
              </div>

              {/* Borrar */}
              <div style={t.actionSection}>
                <div style={{ ...t.sectionAccent, background: 'linear-gradient(135deg, #ef4444, #f87171)' }} />
                <div style={t.sectionIcon}>🗑️</div>
                <h2 style={t.sectionTitle}>Borrar</h2>
                <p style={t.sectionDesc}>Elimina permanentemente un tema o subtema del atlas.</p>
                <div style={t.btnGroup}>
                  <button
                    style={{ ...t.actionBtn, color: '#dc2626', background: '#fff1f2', borderColor: '#fecaca' }}
                    onClick={openDeleteTema}
                    onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#ef4444,#f87171)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca'; }}
                  >
                    📚 Tema
                  </button>
                  <button
                    style={{ ...t.actionBtn, color: '#dc2626', background: '#fff1f2', borderColor: '#fecaca' }}
                    onClick={openDeleteSubtema}
                    onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#ef4444,#f87171)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca'; }}
                  >
                    📂 Subtema
                  </button>
                </div>
              </div>

            </div>
          )}

          {(isCreatingTema || isCreatingSubtema) && (
            <div style={t.formPanel}>
              <div style={t.formPanelHeader}>
                <h2 style={t.formPanelTitle}>
                  <span style={{ ...t.formPanelDot, background: 'linear-gradient(135deg,#6366f1,#818cf8)' }} />
                  {isCreatingTema ? 'Crear tema' : 'Crear subtema'}
                </h2>
              </div>
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
            <div style={t.formPanel}>
              <div style={t.formPanelHeader}>
                <h2 style={t.formPanelTitle}>
                  <span style={{ ...t.formPanelDot, background: 'linear-gradient(135deg,#f59e0b,#fbbf24)' }} />
                  {isEditingTema ? 'Editar tema' : 'Editar subtema'}
                </h2>
              </div>
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
            <div style={t.formPanel}>
              <div style={t.formPanelHeader}>
                <h2 style={t.formPanelTitle}>
                  <span style={{ ...t.formPanelDot, background: 'linear-gradient(135deg,#ef4444,#f87171)' }} />
                  {isDeletingTema ? 'Borrar tema' : 'Borrar subtema'}
                </h2>
              </div>
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
      </main>

      <Footer />
      <LoadingToast visible={isUploadingLogo} type={loadingType} message={loadingMessage} />
    </div>
  );
};

const t: { [key: string]: React.CSSProperties } = {
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
    background: 'linear-gradient(90deg, #6366f1, #818cf8)', borderRadius: '4px',
  },
  contentCard: {
    width: '100%',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '18px',
    padding: 'clamp(20px, 3vw, 36px)',
    boxShadow: '0 6px 24px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)',
    border: '1px solid rgba(15,23,42,0.05)',
    boxSizing: 'border-box',
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 'clamp(12px, 2vw, 20px)',
  },
  actionSection: {
    position: 'relative',
    background: '#f8fafc',
    borderRadius: '14px',
    padding: 'clamp(16px, 2.5vw, 28px)',
    border: '1px solid rgba(15,23,42,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflow: 'hidden',
    boxSizing: 'border-box',
  } as React.CSSProperties,
  sectionAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
    borderRadius: '14px 14px 0 0',
  } as React.CSSProperties,
  sectionIcon: { fontSize: 'clamp(1.6em, 2.5vw, 2em)', lineHeight: 1, marginTop: '4px' },
  sectionTitle: {
    fontSize: 'clamp(1em, 2vw, 1.25em)', fontWeight: 800, color: '#0f172a',
    letterSpacing: '-0.02em', margin: 0,
  },
  sectionDesc: { fontSize: 'clamp(0.78em, 1.4vw, 0.88em)', color: '#64748b', margin: 0, lineHeight: 1.55 },
  btnGroup: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' },
  actionBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '9px 16px', borderRadius: '10px', border: '1.5px solid #c7d2fe',
    background: '#f5f3ff', color: '#6366f1', fontSize: '0.84em', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease',
    letterSpacing: '0.01em',
  } as React.CSSProperties,
  formPanel: {
    background: '#f8fafc',
    borderRadius: '14px',
    border: '1px solid rgba(15,23,42,0.07)',
    overflow: 'hidden',
  },
  formPanelHeader: {
    padding: '16px 24px',
    borderBottom: '1px solid rgba(15,23,42,0.07)',
    background: 'rgba(255,255,255,0.6)',
  },
  formPanelTitle: {
    display: 'flex', alignItems: 'center', gap: '10px',
    fontSize: 'clamp(1em, 2vw, 1.2em)', fontWeight: 800, color: '#0f172a',
    margin: 0,
  },
  formPanelDot: {
    display: 'inline-block', width: '12px', height: '12px',
    borderRadius: '50%', flexShrink: 0,
  } as React.CSSProperties,
};

export default Temario;
