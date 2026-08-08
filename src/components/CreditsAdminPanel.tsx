import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ImagePlus, Pencil, Plus, Save, Trash2, UserRound } from 'lucide-react';
import { deleteFromCloudinary, uploadToCloudinary } from '../services/cloudinary';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { describeSupabaseError, supabase } from '../services/supabase';
import { loadCredits, type CreditContributor, type CreditProfile, type CreditProfileKey } from '../services/credits';

const PROFILE_LABELS: Record<CreditProfileKey, string> = {
  developer: 'Programador y diseñador del sitio',
  microscopy_coordinator: 'Coordinadora de microscopía',
};

type ContributorDraft = Omit<CreditContributor, 'id' | 'sort_order'>;
const EMPTY_DRAFT: ContributorDraft = { name: '', start_year: new Date().getFullYear(), end_year: new Date().getFullYear(), is_current: false, contribution: '', photo_url: null };
const databaseErrorMessage = (prefix: string, error: unknown) => {
  const detail = describeSupabaseError(error);
  if (detail.includes('credit_contributors') && (detail.includes('does not exist') || detail.includes('schema cache'))) {
    return `${prefix} Falta ejecutar database/setup_credits.sql en Supabase.`;
  }
  if (detail.toLowerCase().includes('row-level security') || detail.includes('42501')) {
    return `${prefix} La base de datos no reconoció la sesión como Administrador. Cierra sesión, vuelve a entrar e inténtalo nuevamente.`;
  }
  return `${prefix} ${detail}`;
};

const ContributorPhotoPicker: React.FC<{
  url?: string | null;
  label: string;
  busy?: boolean;
  onSelect: (file?: File) => void;
  onRemove: () => void;
}> = ({ url, label, busy, onSelect, onRemove }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return <div style={s.contributorPhotoEditor}>
    <div style={s.contributorPhotoBox}>{url ? <img src={url.startsWith('blob:') ? url : getCloudinaryImageUrl(url, 'thumb')} alt={label} style={s.photo} /> : <UserRound size={35} />}</div>
    <div style={s.contributorPhotoActions}>
      <strong>Fotografía</strong>
      <span>{url ? 'Lista para mostrarse en la tarjeta' : 'Sin fotografía'}</span>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={event => { onSelect(event.target.files?.[0]); event.currentTarget.value = ''; }} />
      <div style={s.actions}>
        <button type="button" style={s.primary} disabled={busy} onClick={() => inputRef.current?.click()}><ImagePlus size={15} /> {url ? 'Cambiar' : 'Subir'}</button>
        {url && <button type="button" style={s.danger} disabled={busy} onClick={onRemove}><Trash2 size={14} /> Eliminar</button>}
      </div>
    </div>
  </div>;
};

const CreditsAdminPanel: React.FC = () => {
  const [profiles, setProfiles] = useState<CreditProfile[]>([]);
  const [contributors, setContributors] = useState<CreditContributor[]>([]);
  const [draft, setDraft] = useState<ContributorDraft>(EMPTY_DRAFT);
  const [draftPhotoFile, setDraftPhotoFile] = useState<File | null>(null);
  const [draftPhotoPreview, setDraftPhotoPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [supportsContributorPhotos, setSupportsContributorPhotos] = useState(true);
  const [dirtyContributorIds, setDirtyContributorIds] = useState<Set<number>>(() => new Set());
  const [selectedContributorId, setSelectedContributorId] = useState<number | null>(null);
  const fileInputs = useRef<Partial<Record<CreditProfileKey, HTMLInputElement | null>>>({});

  const reload = async () => {
    setLoading(true);
    try { const data = await loadCredits(); setProfiles(data.profiles); setContributors(data.contributors); setDirtyContributorIds(new Set()); setSupportsContributorPhotos(data.supportsContributorPhotos); if (!data.supportsContributorPhotos) setMessage('Falta agregar la columna photo_url en Supabase. Puedes guardar instructores sin fotografía, pero debes ejecutar database/setup_credits.sql para habilitar sus fotos.'); }
    catch { setMessage('No se pudieron cargar los créditos. Ejecuta primero la migración de base de datos.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);

  const profileFor = (key: CreditProfileKey) => profiles.find(profile => profile.profile_key === key);

  const uploadPhoto = async (key: CreditProfileKey, file?: File) => {
    if (!file) return;
    setBusyKey(key); setMessage('');
    const previousUrl = profileFor(key)?.photo_url ?? null;
    try {
      const upload = await uploadToCloudinary(file, { folder: 'creditos', optimizeImage: true });
      const nextUrl = String(upload.secure_url ?? '');
      const { error } = await supabase.from('credit_profiles').upsert({ profile_key: key, photo_url: nextUrl, updated_at: new Date().toISOString() });
      if (error) { await deleteFromCloudinary(nextUrl).catch(() => undefined); throw error; }
      if (previousUrl) await deleteFromCloudinary(previousUrl).catch(() => undefined);
      setProfiles(current => [...current.filter(item => item.profile_key !== key), { profile_key: key, photo_url: nextUrl }]);
      setMessage('Fotografía actualizada correctamente.');
    } catch { setMessage('No se pudo actualizar la fotografía.'); }
    finally { setBusyKey(null); if (fileInputs.current[key]) fileInputs.current[key]!.value = ''; }
  };

  const removePhoto = async (key: CreditProfileKey) => {
    const previousUrl = profileFor(key)?.photo_url;
    if (!previousUrl || !window.confirm('¿Deseas borrar esta fotografía?')) return;
    setBusyKey(key); setMessage('');
    const { error } = await supabase.from('credit_profiles').update({ photo_url: null, updated_at: new Date().toISOString() }).eq('profile_key', key);
    if (error) setMessage('No se pudo borrar la fotografía.');
    else {
      await deleteFromCloudinary(previousUrl).catch(() => undefined);
      setProfiles(current => current.map(item => item.profile_key === key ? { ...item, photo_url: null } : item));
      setMessage('Fotografía eliminada.');
    }
    setBusyKey(null);
  };

  const selectDraftPhoto = (file?: File) => {
    if (!file) return;
    if (draftPhotoPreview) URL.revokeObjectURL(draftPhotoPreview);
    setDraftPhotoFile(file);
    setDraftPhotoPreview(URL.createObjectURL(file));
  };

  const clearDraftPhoto = () => {
    if (draftPhotoPreview) URL.revokeObjectURL(draftPhotoPreview);
    setDraftPhotoFile(null);
    setDraftPhotoPreview('');
  };

  const updateContributor = (id: number, updates: Partial<CreditContributor>, markDirty = true) => {
    setContributors(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
    if (markDirty) setDirtyContributorIds(current => new Set(current).add(id));
  };

  const uploadContributorPhoto = async (item: CreditContributor, file?: File) => {
    if (!file) return;
    if (!supportsContributorPhotos) { setMessage('Primero ejecuta database/setup_credits.sql en Supabase para habilitar las fotografías de instructores.'); return; }
    setBusyKey(`photo-${item.id}`); setMessage('');
    const previousUrl = item.photo_url;
    try {
      const upload = await uploadToCloudinary(file, { folder: 'creditos/instructores', optimizeImage: true });
      const nextUrl = String(upload.secure_url ?? '');
      const { error } = await supabase.from('credit_contributors').update({ photo_url: nextUrl, updated_at: new Date().toISOString() }).eq('id', item.id);
      if (error) { await deleteFromCloudinary(nextUrl).catch(() => undefined); throw error; }
      if (previousUrl) await deleteFromCloudinary(previousUrl).catch(() => undefined);
      updateContributor(item.id, { photo_url: nextUrl }, false);
      setMessage('Fotografía del instructor actualizada.');
    } catch (error) { setMessage(databaseErrorMessage('No se pudo actualizar la fotografía.', error)); }
    finally { setBusyKey(null); }
  };

  const removeContributorPhoto = async (item: CreditContributor) => {
    if (!item.photo_url || !window.confirm(`¿Eliminar la fotografía de ${item.name}?`)) return;
    setBusyKey(`photo-${item.id}`); setMessage('');
    const previousUrl = item.photo_url;
    const { error } = await supabase.from('credit_contributors').update({ photo_url: null, updated_at: new Date().toISOString() }).eq('id', item.id);
    if (error) setMessage(databaseErrorMessage('No se pudo eliminar la fotografía.', error));
    else {
      await deleteFromCloudinary(previousUrl).catch(() => undefined);
      updateContributor(item.id, { photo_url: null }, false);
      setMessage('Fotografía del instructor eliminada.');
    }
    setBusyKey(null);
  };

  const addContributor = async () => {
    const name = draft.name.trim();
    const contribution = draft.contribution?.trim() || null;
    if (name.length < 2) { setMessage('El nombre debe tener al menos 2 caracteres, sin contar espacios.'); return; }
    if (name.length > 160) { setMessage('El nombre no puede superar los 160 caracteres.'); return; }
    if (contribution && contribution.length > 600) { setMessage('La aportación no puede superar los 600 caracteres.'); return; }
    if (!draft.is_current && (!draft.end_year || draft.end_year < draft.start_year)) { setMessage('El año final debe ser igual o posterior al inicial.'); return; }
    if (draftPhotoFile && !supportsContributorPhotos) { setMessage('No se puede guardar la fotografía todavía: ejecuta database/setup_credits.sql en Supabase y vuelve a intentarlo.'); return; }
    setBusyKey('new'); setMessage('Guardando instructor…');
    let uploadedPhotoUrl: string | null = null;
    if (draftPhotoFile) {
      try {
        const upload = await uploadToCloudinary(draftPhotoFile, { folder: 'creditos/instructores', optimizeImage: true });
        uploadedPhotoUrl = String(upload.secure_url ?? '');
      } catch (error) {
        setMessage(`No se pudo subir la fotografía. ${describeSupabaseError(error)}`);
        setBusyKey(null);
        return;
      }
    }
    const contributorPayload = {
      name, start_year: draft.start_year, end_year: draft.is_current ? null : draft.end_year,
      is_current: draft.is_current, contribution, sort_order: contributors.length,
      ...(supportsContributorPhotos ? { photo_url: uploadedPhotoUrl } : {}),
    };
    const contributorInsert = supabase.from('credit_contributors').insert(contributorPayload);
    const { data, error } = supportsContributorPhotos
      ? await contributorInsert.select('id, name, start_year, end_year, is_current, contribution, photo_url, sort_order').single()
      : await contributorInsert.select('id, name, start_year, end_year, is_current, contribution, sort_order').single();
    if (error) {
      if (uploadedPhotoUrl) await deleteFromCloudinary(uploadedPhotoUrl).catch(() => undefined);
      setMessage(databaseErrorMessage('No se pudo agregar el instructor.', error));
    }
    else { const added = { ...(data as CreditContributor), photo_url: (data as CreditContributor).photo_url ?? null }; setContributors(current => [...current, added]); setSelectedContributorId(added.id); setDraft(EMPTY_DRAFT); clearDraftPhoto(); setMessage('Instructor agregado correctamente.'); }
    setBusyKey(null);
  };

  const saveContributor = async (item: CreditContributor) => {
    const cleanName = item.name.trim();
    if (cleanName.length < 2 || cleanName.length > 160) { setMessage('El nombre debe tener entre 2 y 160 caracteres, sin contar espacios.'); return; }
    if ((item.contribution?.trim().length ?? 0) > 600) { setMessage('La aportación no puede superar los 600 caracteres.'); return; }
    if (!item.is_current && (!item.end_year || item.end_year < item.start_year)) { setMessage('Revisa el período indicado.'); return; }
    setBusyKey(`save-${item.id}`);
    const { data, error } = await supabase.from('credit_contributors').update({ name: cleanName, start_year: item.start_year, end_year: item.is_current ? null : item.end_year, is_current: item.is_current, contribution: item.contribution?.trim() || null, updated_at: new Date().toISOString() }).eq('id', item.id).select('id').single();
    if (error || !data) {
      setMessage(databaseErrorMessage('No se pudieron guardar los cambios.', error ?? new Error('La actualización no devolvió ningún registro.')));
    } else {
      setDirtyContributorIds(current => { const next = new Set(current); next.delete(item.id); return next; });
      setMessage('Cambios guardados.');
    }
    setBusyKey(null);
  };
  const removeContributor = async (item: CreditContributor) => {
    if (!window.confirm(`¿Eliminar a ${item.name} de los créditos?`)) return;
    setBusyKey(`delete-${item.id}`);
    const { data, error } = await supabase.from('credit_contributors').delete().eq('id', item.id).select('id').single();
    if (error || !data) setMessage(databaseErrorMessage('No se pudo eliminar el registro.', error ?? new Error('La eliminación no devolvió ningún registro.'))); else { if (item.photo_url) await deleteFromCloudinary(item.photo_url).catch(() => undefined); setContributors(current => current.filter(row => row.id !== item.id)); setDirtyContributorIds(current => { const next = new Set(current); next.delete(item.id); return next; }); setSelectedContributorId(current => current === item.id ? null : current); setMessage('Registro eliminado.'); }
    setBusyKey(null);
  };

  const moveContributor = async (id: number, direction: -1 | 1) => {
    const currentIndex = contributors.findIndex(item => item.id === id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= contributors.length) return;
    const previous = contributors;
    const reordered = [...contributors];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    const normalized = reordered.map((item, index) => ({ ...item, sort_order: index }));
    setContributors(normalized);
    setBusyKey('reorder');
    const results = await Promise.all(normalized.map(item => supabase.from('credit_contributors').update({ sort_order: item.sort_order, updated_at: new Date().toISOString() }).eq('id', item.id)));
    const failed = results.find(result => result.error);
    if (failed?.error) {
      setContributors(previous);
      setMessage(databaseErrorMessage('No se pudo guardar el nuevo orden.', failed.error));
    } else {
      setMessage('Orden de instructores actualizado.');
    }
    setBusyKey(null);
  };

  if (loading) return <div style={s.loading}>Cargando editor de créditos…</div>;
  return <div className="credits-admin" style={s.root}>
    {message && <div style={s.message}>{message}</div>}
    <section style={s.section}><div style={s.heading}><h2>Fotografías destacadas</h2><p>Sube, reemplaza o elimina las fotografías de los dos reconocimientos principales.</p></div>
      <div style={s.photoGrid}>{(Object.keys(PROFILE_LABELS) as CreditProfileKey[]).map(key => {
        const url = profileFor(key)?.photo_url;
        return <article key={key} style={s.photoCard}><div style={s.photoBox}>{url ? <img src={getCloudinaryImageUrl(url, 'thumb')} alt={PROFILE_LABELS[key]} style={s.photo} /> : <UserRound size={42} />}</div><div style={s.photoInfo}><strong>{PROFILE_LABELS[key]}</strong><span>{url ? 'Fotografía publicada' : 'Sin fotografía'}</span></div><input ref={node => { fileInputs.current[key] = node; }} type="file" accept="image/*" hidden onChange={event => void uploadPhoto(key, event.target.files?.[0])} /><button style={s.primary} disabled={busyKey === key} onClick={() => fileInputs.current[key]?.click()}><ImagePlus size={16} /> {url ? 'Cambiar' : 'Subir'} fotografía</button>{url && <button style={s.danger} disabled={busyKey === key} onClick={() => void removePhoto(key)}><Trash2 size={15} /> Borrar</button>}</article>;
      })}</div>
    </section>
    <section style={s.section}><div style={s.heading}><h2>Historial de instructores</h2><p>Estos reconocimientos aparecerán debajo del mensaje final de la página pública.</p></div>
      <ContributorPhotoPicker url={draftPhotoPreview} label="Vista previa del nuevo instructor" busy={busyKey === 'new'} onSelect={selectDraftPhoto} onRemove={clearDraftPhoto} />
      <div style={s.formGrid}><label style={s.field}>Nombre<input value={draft.name} onChange={e => setDraft(current => ({ ...current, name: e.target.value }))} /></label><label style={s.field}>Desde<input type="number" min="1900" max="2200" value={draft.start_year} onChange={e => setDraft(current => ({ ...current, start_year: Number(e.target.value) }))} /></label><label style={s.field}>Hasta<input type="number" min="1900" max="2200" disabled={draft.is_current} value={draft.end_year ?? ''} onChange={e => setDraft(current => ({ ...current, end_year: Number(e.target.value) }))} /></label><label style={s.check}><input type="checkbox" checked={draft.is_current} onChange={e => setDraft(current => ({ ...current, is_current: e.target.checked, end_year: e.target.checked ? null : current.start_year }))} /> Actualmente</label><label style={{...s.field,gridColumn:'1 / -1'}}>Aportación al atlas (opcional)<textarea value={draft.contribution ?? ''} onChange={e => setDraft(current => ({ ...current, contribution: e.target.value }))} /></label></div><button style={s.primary} disabled={busyKey === 'new'} onClick={() => void addContributor()}><Plus size={16} /> Añadir instructor</button>
      <div style={s.list}>
        {contributors.map((item, index) => <React.Fragment key={item.id}><div style={{...s.listItem,borderColor:selectedContributorId===item.id?'#818cf8':'#dbeafe',background:selectedContributorId===item.id?'#eef2ff':'#fff'}}>
          <button type="button" style={s.listSelect} onClick={() => setSelectedContributorId(current => current === item.id ? null : item.id)}>
            <span style={s.listPosition}>{index + 1}</span>
            <span style={s.listThumb}>{item.photo_url ? <img src={getCloudinaryImageUrl(item.photo_url,'thumb')} alt="" style={s.photo} /> : <UserRound size={22} />}</span>
            <span style={s.listIdentity}><strong>{item.name}</strong><small>{item.start_year} — {item.is_current ? 'Actualidad' : item.end_year}</small></span>
            {dirtyContributorIds.has(item.id) && <span style={s.unsavedBadge}>Sin guardar</span>}
            <Pencil size={16} />
          </button>
          <div style={s.orderActions}>
            <button type="button" style={s.orderButton} title="Subir en el orden" aria-label={`Subir a ${item.name}`} disabled={index===0 || busyKey==='reorder'} onClick={() => void moveContributor(item.id,-1)}><ChevronUp size={17}/></button>
            <button type="button" style={s.orderButton} title="Bajar en el orden" aria-label={`Bajar a ${item.name}`} disabled={index===contributors.length-1 || busyKey==='reorder'} onClick={() => void moveContributor(item.id,1)}><ChevronDown size={17}/></button>
          </div>
        </div>
        {selectedContributorId === item.id && <article style={{...s.row,borderColor:'#a5b4fc',borderTopLeftRadius:6,borderTopRightRadius:6}}>
          <ContributorPhotoPicker url={item.photo_url} label={`Fotografía de ${item.name}`} busy={busyKey === `photo-${item.id}`} onSelect={file => void uploadContributorPhoto(item,file)} onRemove={() => void removeContributorPhoto(item)} />
          <div style={s.formGrid}><label style={s.field}>Nombre<input value={item.name} onChange={e => updateContributor(item.id,{name:e.target.value})} /></label><label style={s.field}>Desde<input type="number" value={item.start_year} onChange={e => updateContributor(item.id,{start_year:Number(e.target.value)})} /></label><label style={s.field}>Hasta<input type="number" disabled={item.is_current} value={item.end_year ?? ''} onChange={e => updateContributor(item.id,{end_year:Number(e.target.value)})} /></label><label style={s.check}><input type="checkbox" checked={item.is_current} onChange={e => updateContributor(item.id,{is_current:e.target.checked,end_year:e.target.checked?null:item.start_year})} /> Actualmente</label><label style={{...s.field,gridColumn:'1 / -1'}}>Aportación (opcional)<textarea value={item.contribution ?? ''} onChange={e => updateContributor(item.id,{contribution:e.target.value})} /></label></div>
          <div style={s.actions}><button style={{...s.primary,opacity:dirtyContributorIds.has(item.id)?1:.5,cursor:dirtyContributorIds.has(item.id)?'pointer':'not-allowed'}} disabled={!dirtyContributorIds.has(item.id) || busyKey === `save-${item.id}`} onClick={() => void saveContributor(item)}><Save size={15} /> {busyKey === `save-${item.id}` ? 'Guardando…' : 'Guardar'}</button><button style={s.danger} onClick={() => void removeContributor(item)}><Trash2 size={15} /> Eliminar</button></div>
        </article>}
        </React.Fragment>)}
      </div>
    </section>
  </div>;
};

const s: Record<string,React.CSSProperties> = { root:{display:'flex',flexDirection:'column',gap:22,padding:20},loading:{padding:50,textAlign:'center',color:'#64748b'},message:{padding:'11px 14px',borderRadius:10,background:'#eff6ff',border:'1px solid #bfdbfe',color:'#1e40af',fontWeight:700},section:{padding:'clamp(18px,3vw,28px)',border:'1px solid #e2e8f0',borderRadius:18,background:'#fff'},heading:{marginBottom:18},photoGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16},photoCard:{display:'grid',gridTemplateColumns:'92px 1fr',gap:12,alignItems:'center',padding:14,border:'1px solid #e2e8f0',borderRadius:15,background:'#f8fafc'},photoBox:{gridRow:'1 / 4',width:92,height:92,display:'grid',placeItems:'center',overflow:'hidden',borderRadius:13,background:'#e0f2fe',color:'#0284c7'},photo:{width:'100%',height:'100%',objectFit:'cover'},photoInfo:{display:'flex',flexDirection:'column',gap:3,fontSize:'.83rem'},contributorPhotoEditor:{display:'flex',alignItems:'center',gap:13,marginBottom:14,padding:12,border:'1px solid #dbeafe',borderRadius:13,background:'#fff'},contributorPhotoBox:{flexShrink:0,width:82,height:82,display:'grid',placeItems:'center',overflow:'hidden',borderRadius:13,background:'#e0f2fe',color:'#0284c7'},contributorPhotoActions:{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:5,color:'#475569',fontSize:'.78rem'},primary:{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,width:'fit-content',border:0,borderRadius:9,padding:'9px 12px',background:'linear-gradient(135deg,#0ea5e9,#6366f1)',color:'#fff',fontWeight:800,cursor:'pointer'},danger:{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,width:'fit-content',border:'1px solid #fecaca',borderRadius:9,padding:'8px 11px',background:'#fff1f2',color:'#be123c',fontWeight:750,cursor:'pointer'},formGrid:{display:'grid',gridTemplateColumns:'minmax(180px,2fr) repeat(2,minmax(90px,.7fr)) minmax(120px,1fr)',gap:12,marginBottom:13},field:{display:'flex',flexDirection:'column',gap:6,color:'#475569',fontSize:'.76rem',fontWeight:750},check:{display:'flex',alignItems:'center',gap:7,color:'#475569',fontSize:'.78rem',fontWeight:750},list:{display:'flex',flexDirection:'column',gap:14,marginTop:22},row:{padding:16,border:'1px solid #dbeafe',borderRadius:14,background:'#f8fafc'},actions:{display:'flex',gap:8,justifyContent:'flex-end',flexWrap:'wrap'} };

Object.assign(s, {
  listItem: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'stretch', overflow: 'hidden', border: '1px solid', borderRadius: 12, transition: 'all .18s ease' },
  listSelect: { minWidth: 0, display: 'grid', gridTemplateColumns: '28px 42px minmax(0,1fr) auto auto', alignItems: 'center', gap: 10, padding: '9px 12px', border: 0, background: 'transparent', color: '#334155', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' },
  listPosition: { width: 25, height: 25, display: 'grid', placeItems: 'center', borderRadius: 8, background: '#e0e7ff', color: '#4338ca', fontSize: '.7rem', fontWeight: 900 },
  listThumb: { width: 40, height: 40, display: 'grid', placeItems: 'center', overflow: 'hidden', borderRadius: 10, background: '#e0f2fe', color: '#0284c7' },
  listIdentity: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 },
  unsavedBadge: { padding: '4px 7px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontSize: '.62rem', fontWeight: 850 },
  orderActions: { display: 'grid', gridTemplateRows: '1fr 1fr', borderLeft: '1px solid #dbeafe' },
  orderButton: { width: 38, border: 0, borderBottom: '1px solid #dbeafe', background: '#f8fafc', color: '#4f46e5', cursor: 'pointer' },
});

export default CreditsAdminPanel;
