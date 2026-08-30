import React, { useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useDraggableList } from '../hooks/useDraggableList';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { getCachedSubtemas, getQuickSubtemas } from '../services/catalogService';
import { usePreservedParam } from '../hooks/usePreservedParam';
import LoadingToast from './LoadingToast';

import EditorParcialAccordionPicker from './editor/EditorParcialAccordionPicker';

interface Tema { id: number; nombre: string; parcial: string; sort_order: number }
interface Subtema { id: number; nombre: string; tema_id: number; sort_order: number }
interface Placa { id: number; photo_url: string; aumento: string | null; sort_order: number }
interface MapRow { placa_id: number; sections: unknown[] | null }
interface Group { key: string; title: string; sortValue: number; items: Placa[] }

const aumentoValue = (value: string) => {
  const match = value.replace(',', '.').match(/\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : Number.POSITIVE_INFINITY;
};

const PlacasOrderManager: React.FC = () => {
  const drag = useDraggableList();
  const [temas, setTemas] = useState<Tema[]>([]);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [placas, setPlacas] = useState<Placa[]>([]);
  const [mapIds, setMapIds] = useState<Set<number>>(new Set());
  const [temaId, setTemaId] = usePreservedParam<number | null>('tema', null);
  const [subtemaId, setSubtemaId] = usePreservedParam<number | null>('subtema', null);
  const prevTemaRef = useRef<number | null>(temaId);
  const [loading, setLoading] = useState(false);
  const [loadingTemas, setLoadingTemas] = useState(true);
  const [loadingSubtemas, setLoadingSubtemas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    setLoadingTemas(true);
    void supabase.from('temas').select('id, nombre, parcial, sort_order')
      .order('parcial').order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setTemas(data as Tema[]);
        setLoadingTemas(false);
      });
  }, []);

  useEffect(() => {
    if (prevTemaRef.current !== temaId) {
      if (prevTemaRef.current !== null) {
        setSubtemaId(null);
      }
      prevTemaRef.current = temaId;
    }
    setPlacas([]); setMapIds(new Set()); setChanged(false); drag.resetDrag();
    if (!temaId) { setSubtemas([]); return; }

    const quick = getQuickSubtemas(temaId);
    if (quick && quick.length > 0) {
      setSubtemas(quick as unknown as Subtema[]);
      setLoadingSubtemas(false);
    } else {
      setLoadingSubtemas(true);
    }

    void getCachedSubtemas(temaId)
      .then((data) => {
        setSubtemas((data ?? []) as unknown as Subtema[]);
        setLoadingSubtemas(false);
      })
      .catch(() => {
        const fallback = getQuickSubtemas(temaId);
        if (fallback && fallback.length > 0) {
          setSubtemas(fallback as unknown as Subtema[]);
        } else {
          setMessage('No se pudieron cargar los subtemas.');
        }
        setLoadingSubtemas(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temaId]);

  useEffect(() => {
    setPlacas([]); setMapIds(new Set()); setChanged(false); setMessage(null); drag.resetDrag();
    if (!subtemaId) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('placas')
        .select('id, photo_url, aumento, sort_order').eq('subtema_id', subtemaId)
        .order('sort_order', { ascending: true });
      if (error) { setMessage('No se pudieron cargar las placas.'); setLoading(false); return; }
      const next = (data ?? []) as Placa[];
      setPlacas(next);
      if (next.length) {
        const { data: maps, error: mapsError } = await supabase.from('interactive_maps')
          .select('placa_id, sections').in('placa_id', next.map(item => item.id));
        if (mapsError) setMessage('No se pudo determinar qué placas tienen mapa.');
        setMapIds(new Set(((maps ?? []) as MapRow[])
          .filter(row => Array.isArray(row.sections) && row.sections.length > 0)
          .map(row => row.placa_id)));
      }
      setLoading(false);
    };
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtemaId]);

  const groups = useMemo<Group[]>(() => {
    const result = new Map<string, Group>();
    placas.forEach(placa => {
      const isMap = mapIds.has(placa.id);
      const raw = (placa.aumento ?? '').trim();
      const label = raw.replace(/\s+/g, '').toUpperCase();
      const key = isMap ? 'MAPAS' : raw ? `AUMENTO_${label}` : 'SIN_AUMENTO';
      const title = isMap ? 'Mapas interactivos' : raw ? `Aumento ${label}` : 'Sin aumento';
      const sortValue = isMap ? -1 : raw ? aumentoValue(raw) : Number.POSITIVE_INFINITY;
      if (!result.has(key)) result.set(key, { key, title, sortValue, items: [] });
      result.get(key)!.items.push(placa);
    });
    result.forEach(group => group.items.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
    return [...result.values()].sort((a, b) => a.sortValue - b.sortValue || a.title.localeCompare(b.title));
  }, [placas, mapIds]);

  const handleDrop = (event: React.DragEvent, group: Group) => {
    const reordered = drag.applyDrop(event, group.key, group.items);
    if (!reordered) return;
    const positions = new Map(reordered.map((item, index) => [item.id, index]));
    setPlacas(current => current.map(item => positions.has(item.id) ? { ...item, sort_order: positions.get(item.id)! } : item));
    setChanged(true);
  };

  const save = async () => {
    setSaving(true); setMessage(null);
    const updates = groups.flatMap(group => group.items.map((placa, index) => ({ id: placa.id, sort_order: index })));
    const results = await Promise.all(updates.map(item =>
      supabase.from('placas').update({ sort_order: item.sort_order }).eq('id', item.id)
    ));
    if (results.some(result => result.error)) setMessage('No se pudo guardar todo el orden. Intenta nuevamente.');
    else { setChanged(false); setMessage('Orden guardado correctamente.'); }
    setSaving(false);
  };

  return <div style={s.card}>
    <div style={s.header}><h2 style={s.title}>Placas</h2><p style={s.subtitle}>Selecciona tema y subtema; luego arrastra cada placa dentro de su propia sección.</p><div style={s.divider} /></div>
    
    <div style={{ marginBottom: '24px' }}>
      <EditorParcialAccordionPicker
        temas={temas}
        subtemas={subtemas}
        selectedTemaId={temaId}
        selectedSubtemaId={subtemaId}
        onSelectTema={(id) => setTemaId(id)}
        onSelectSubtema={(id) => setSubtemaId(id)}
        loadingTemas={loadingTemas}
        loadingSubtemas={loadingSubtemas}
        mode="tema-and-subtema"
        title="Selecciona tema y subtema"
        subtitle="Elige el tema y subtema cuyas placas deseas reordenar"
      />
    </div>
    {message && <div style={message.includes('correctamente') ? s.success : s.notice}>{message}</div>}
    {loading ? <div style={s.empty}>Cargando contenido...</div> : subtemaId && groups.length === 0 ? <div style={s.empty}>Este subtema no tiene placas.</div> : groups.map(group => {
      const renderItems = drag.getRenderItems(group.key, group.items);
      return <section key={group.key} style={s.section}>
        <div style={s.sectionHead}><h3 style={s.sectionTitle}>{group.title}</h3><span style={s.count}>{group.items.length} {group.items.length === 1 ? 'placa' : 'placas'}</span></div>
        <div className="temas-grid-home" onDragOver={e => drag.onDragOverContainer(e, group.key)} onDrop={e => handleDrop(e, group)}>
          {renderItems.map(item => item.type === 'placeholder' ? <div key={item.key} style={s.placeholder}>Suelta aquí</div> : <div key={item.item.id} draggable style={{...s.plate, opacity: drag.dragId === item.item.id ? .25 : 1}} onDragStart={e => drag.onDragStart(e, item.item.id, group.key)} onDragOver={e => drag.onDragOverCard(e, group.key, item.realIndex)} onDragEnd={drag.resetDrag}>
            <span style={s.position}>{item.realIndex + 1}</span><img src={getCloudinaryImageUrl(item.item.photo_url, 'thumb')} alt={`Placa ${item.realIndex + 1}`} style={s.image} loading="lazy" /><span style={s.dragText}>Arrastra para ordenar</span>
          </div>)}
        </div>
      </section>;
    })}
    {subtemaId && <div style={s.actions}><button type="button" style={changed && !saving ? s.button : s.buttonDisabled} disabled={!changed || saving} onClick={() => void save()}>{saving ? 'Guardando...' : changed ? 'Guardar orden' : 'Sin cambios'}</button></div>}
    <LoadingToast visible={saving} type="saving" message="Guardando orden" />
  </div>;
};

const s: Record<string, React.CSSProperties> = {
  card:{padding:'clamp(16px,3vw,36px)'}, header:{textAlign:'center',marginBottom:24}, title:{margin:'0 0 6px',fontSize:'clamp(1.4em,3vw,2.2em)'}, subtitle:{margin:'0 0 14px',color:'#64748b'}, divider:{width:56,height:4,margin:'auto',borderRadius:4,background:'linear-gradient(90deg,#38bdf8,#818cf8)'},
  filters:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16,padding:20,background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,marginBottom:24}, label:{display:'flex',flexDirection:'column',gap:7,fontWeight:700,color:'#334155'}, select:{padding:'12px 14px',border:'1.5px solid #cbd5e1',borderRadius:10,background:'#f8fafc',fontFamily:'inherit'},
  section:{padding:'clamp(14px,2vw,22px)',border:'1px solid #e2e8f0',borderRadius:16,background:'linear-gradient(135deg,#fff,#f8fafc)',marginBottom:20}, sectionHead:{display:'flex',alignItems:'center',gap:10,marginBottom:14}, sectionTitle:{margin:0,color:'#0f172a'}, count:{color:'#64748b',fontSize:'.85em'},
  plate:{position:'relative',overflow:'hidden',border:'1px solid #dbeafe',borderRadius:14,background:'#fff',padding:10,cursor:'grab',display:'flex',flexDirection:'column',gap:8}, image:{width:'100%',aspectRatio:'4 / 3',objectFit:'cover',borderRadius:10}, position:{position:'absolute',top:16,right:16,zIndex:1,background:'rgba(15,23,42,.8)',color:'#fff',borderRadius:99,padding:'4px 8px',fontWeight:800}, dragText:{textAlign:'center',color:'#64748b',fontSize:'.75em',fontWeight:700}, placeholder:{minHeight:150,border:'2px dashed #38bdf8',borderRadius:14,display:'grid',placeItems:'center',color:'#0284c7',background:'#f0f9ff'},
  empty:{padding:36,textAlign:'center',color:'#64748b',border:'1px dashed #cbd5e1',borderRadius:12}, notice:{padding:12,marginBottom:18,borderRadius:10,background:'#fff7ed',color:'#9a3412'}, success:{padding:12,marginBottom:18,borderRadius:10,background:'#ecfdf5',color:'#047857'}, actions:{display:'flex',justifyContent:'flex-end'}, button:{padding:'13px 22px',border:0,borderRadius:99,background:'linear-gradient(135deg,#0ea5e9,#6366f1)',color:'#fff',fontWeight:800,cursor:'pointer'}, buttonDisabled:{padding:'13px 22px',border:0,borderRadius:99,background:'#e2e8f0',color:'#94a3b8',fontWeight:800}
};

export default PlacasOrderManager;
