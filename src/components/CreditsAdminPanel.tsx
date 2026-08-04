import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Plus, Save, Trash2, UserRound } from 'lucide-react';
import { deleteFromCloudinary, uploadToCloudinary } from '../services/cloudinary';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { describeSupabaseError, supabase } from '../services/supabase';
import { loadCredits, type CreditContributor, type CreditProfile, type CreditProfileKey } from '../services/credits';

const PROFILE_LABELS: Record<CreditProfileKey, string> = {
  developer: 'Programador y diseñador del sitio',
  microscopy_coordinator: 'Coordinadora de microscopía',
};

type ContributorDraft = Omit<CreditContributor, 'id' | 'sort_order'>;
const EMPTY_DRAFT: ContributorDraft = { name: '', start_year: new Date().getFullYear(), end_year: new Date().getFullYear(), is_current: false, contribution: '' };
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

const CreditsAdminPanel: React.FC = () => {
  const [profiles, setProfiles] = useState<CreditProfile[]>([]);
  const [contributors, setContributors] = useState<CreditContributor[]>([]);
  const [draft, setDraft] = useState<ContributorDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const fileInputs = useRef<Partial<Record<CreditProfileKey, HTMLInputElement | null>>>({});

  const reload = async () => {
    setLoading(true);
    try { const data = await loadCredits(); setProfiles(data.profiles); setContributors(data.contributors); }
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

  const addContributor = async () => {
    const name = draft.name.trim();
    const contribution = draft.contribution?.trim() || null;
    if (name.length < 2) { setMessage('El nombre debe tener al menos 2 caracteres, sin contar espacios.'); return; }
    if (name.length > 160) { setMessage('El nombre no puede superar los 160 caracteres.'); return; }
    if (contribution && contribution.length > 600) { setMessage('La aportación no puede superar los 600 caracteres.'); return; }
    if (!draft.is_current && (!draft.end_year || draft.end_year < draft.start_year)) { setMessage('El año final debe ser igual o posterior al inicial.'); return; }
    setBusyKey('new'); setMessage('');
    const { data, error } = await supabase.from('credit_contributors').insert({
      name, start_year: draft.start_year, end_year: draft.is_current ? null : draft.end_year,
      is_current: draft.is_current, contribution, sort_order: contributors.length,
    }).select('id, name, start_year, end_year, is_current, contribution, sort_order').single();
    if (error) setMessage(databaseErrorMessage('No se pudo agregar el instructor.', error));
    else { setContributors(current => [...current, data as CreditContributor]); setDraft(EMPTY_DRAFT); setMessage('Instructor agregado.'); }
    setBusyKey(null);
  };

  const updateContributor = (id: number, updates: Partial<CreditContributor>) => setContributors(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  const saveContributor = async (item: CreditContributor) => {
    const cleanName = item.name.trim();
    if (cleanName.length < 2 || cleanName.length > 160) { setMessage('El nombre debe tener entre 2 y 160 caracteres, sin contar espacios.'); return; }
    if ((item.contribution?.trim().length ?? 0) > 600) { setMessage('La aportación no puede superar los 600 caracteres.'); return; }
    if (!item.is_current && (!item.end_year || item.end_year < item.start_year)) { setMessage('Revisa el período indicado.'); return; }
    setBusyKey(`save-${item.id}`);
    const { data, error } = await supabase.from('credit_contributors').update({ name: cleanName, start_year: item.start_year, end_year: item.is_current ? null : item.end_year, is_current: item.is_current, contribution: item.contribution?.trim() || null, updated_at: new Date().toISOString() }).eq('id', item.id).select('id').single();
    setMessage(error || !data ? databaseErrorMessage('No se pudieron guardar los cambios.', error ?? new Error('La actualización no devolvió ningún registro.')) : 'Cambios guardados.'); setBusyKey(null);
  };
  const removeContributor = async (item: CreditContributor) => {
    if (!window.confirm(`¿Eliminar a ${item.name} de los créditos?`)) return;
    setBusyKey(`delete-${item.id}`);
    const { data, error } = await supabase.from('credit_contributors').delete().eq('id', item.id).select('id').single();
    if (error || !data) setMessage(databaseErrorMessage('No se pudo eliminar el registro.', error ?? new Error('La eliminación no devolvió ningún registro.'))); else { setContributors(current => current.filter(row => row.id !== item.id)); setMessage('Registro eliminado.'); }
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
      <div style={s.formGrid}><label style={s.field}>Nombre<input value={draft.name} onChange={e => setDraft(current => ({ ...current, name: e.target.value }))} /></label><label style={s.field}>Desde<input type="number" min="1900" max="2200" value={draft.start_year} onChange={e => setDraft(current => ({ ...current, start_year: Number(e.target.value) }))} /></label><label style={s.field}>Hasta<input type="number" min="1900" max="2200" disabled={draft.is_current} value={draft.end_year ?? ''} onChange={e => setDraft(current => ({ ...current, end_year: Number(e.target.value) }))} /></label><label style={s.check}><input type="checkbox" checked={draft.is_current} onChange={e => setDraft(current => ({ ...current, is_current: e.target.checked, end_year: e.target.checked ? null : current.start_year }))} /> Actualmente</label><label style={{...s.field,gridColumn:'1 / -1'}}>Aportación al atlas (opcional)<textarea value={draft.contribution ?? ''} onChange={e => setDraft(current => ({ ...current, contribution: e.target.value }))} /></label></div><button style={s.primary} disabled={busyKey === 'new'} onClick={() => void addContributor()}><Plus size={16} /> Añadir instructor</button>
      <div style={s.list}>{contributors.map(item => <article key={item.id} style={s.row}><div style={s.formGrid}><label style={s.field}>Nombre<input value={item.name} onChange={e => updateContributor(item.id,{name:e.target.value})} /></label><label style={s.field}>Desde<input type="number" value={item.start_year} onChange={e => updateContributor(item.id,{start_year:Number(e.target.value)})} /></label><label style={s.field}>Hasta<input type="number" disabled={item.is_current} value={item.end_year ?? ''} onChange={e => updateContributor(item.id,{end_year:Number(e.target.value)})} /></label><label style={s.check}><input type="checkbox" checked={item.is_current} onChange={e => updateContributor(item.id,{is_current:e.target.checked,end_year:e.target.checked?null:item.start_year})} /> Actualmente</label><label style={{...s.field,gridColumn:'1 / -1'}}>Aportación (opcional)<textarea value={item.contribution ?? ''} onChange={e => updateContributor(item.id,{contribution:e.target.value})} /></label></div><div style={s.actions}><button style={s.primary} onClick={() => void saveContributor(item)}><Save size={15} /> Guardar</button><button style={s.danger} onClick={() => void removeContributor(item)}><Trash2 size={15} /> Eliminar</button></div></article>)}</div>
    </section>
  </div>;
};

const s: Record<string,React.CSSProperties> = { root:{display:'flex',flexDirection:'column',gap:22,padding:20},loading:{padding:50,textAlign:'center',color:'#64748b'},message:{padding:'11px 14px',borderRadius:10,background:'#eff6ff',border:'1px solid #bfdbfe',color:'#1e40af',fontWeight:700},section:{padding:'clamp(18px,3vw,28px)',border:'1px solid #e2e8f0',borderRadius:18,background:'#fff'},heading:{marginBottom:18},photoGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16},photoCard:{display:'grid',gridTemplateColumns:'92px 1fr',gap:12,alignItems:'center',padding:14,border:'1px solid #e2e8f0',borderRadius:15,background:'#f8fafc'},photoBox:{gridRow:'1 / 4',width:92,height:92,display:'grid',placeItems:'center',overflow:'hidden',borderRadius:13,background:'#e0f2fe',color:'#0284c7'},photo:{width:'100%',height:'100%',objectFit:'cover'},photoInfo:{display:'flex',flexDirection:'column',gap:3,fontSize:'.83rem'},primary:{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,width:'fit-content',border:0,borderRadius:9,padding:'9px 12px',background:'linear-gradient(135deg,#0ea5e9,#6366f1)',color:'#fff',fontWeight:800,cursor:'pointer'},danger:{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,width:'fit-content',border:'1px solid #fecaca',borderRadius:9,padding:'8px 11px',background:'#fff1f2',color:'#be123c',fontWeight:750,cursor:'pointer'},formGrid:{display:'grid',gridTemplateColumns:'minmax(180px,2fr) repeat(2,minmax(90px,.7fr)) minmax(120px,1fr)',gap:12,marginBottom:13},field:{display:'flex',flexDirection:'column',gap:6,color:'#475569',fontSize:'.76rem',fontWeight:750},check:{display:'flex',alignItems:'center',gap:7,color:'#475569',fontSize:'.78rem',fontWeight:750},list:{display:'flex',flexDirection:'column',gap:14,marginTop:22},row:{padding:16,border:'1px solid #dbeafe',borderRadius:14,background:'#f8fafc'},actions:{display:'flex',gap:8,justifyContent:'flex-end'} };

export default CreditsAdminPanel;
