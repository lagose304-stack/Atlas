import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ResilientPlacaThumb from '../components/ResilientPlacaThumb';
import { supabase } from '../services/supabase';
import { getCachedTemas, getCachedSubtemas } from '../services/catalogService';
import { movePlate, type PlateLocation } from '../services/movePlate';
import { logPlateActivity } from '../services/plateActivityAudit';
import { useAuth } from '../contexts/AuthContext';
import './trasladarPlaca.css';

type Option = { id: number; nombre: string };
type Plate = PlateLocation & { photo_url: string };
const PAGE_SIZE = 48;
export default function TrasladarPlaca() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [temas, setTemas] = useState<Option[]>([]);
  const [sourceTema, setSourceTema] = useState(0), [sourceSubtema, setSourceSubtema] = useState(0);
  const [targetTema, setTargetTema] = useState(0), [targetSubtema, setTargetSubtema] = useState(0);
  const [sourceOptions, setSourceOptions] = useState<Option[]>([]), [targetOptions, setTargetOptions] = useState<Option[]>([]);
  const [plates, setPlates] = useState<Plate[]>([]), [selected, setSelected] = useState<Plate | null>(null);
  const [page, setPage] = useState(0), [hasMore, setHasMore] = useState(false), [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => {
    let alive = true;
    getCachedTemas().then(data => { if (alive) setTemas(data); }).catch(() => { if (alive) setError('No se pudieron cargar los temas. Recarga la página.'); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true; setSourceOptions([]);
    if (sourceTema) getCachedSubtemas(sourceTema).then(data => { if (alive) setSourceOptions(data); }).catch(() => { if (alive) setError('No se pudieron cargar los subtemas de origen.'); });
    return () => { alive = false; };
  }, [sourceTema]);
  useEffect(() => {
    let alive = true; setTargetOptions([]);
    if (targetTema) getCachedSubtemas(targetTema).then(data => { if (alive) setTargetOptions(data); }).catch(() => { if (alive) setError('No se pudieron cargar los subtemas de destino.'); });
    return () => { alive = false; };
  }, [targetTema]);
  useEffect(() => {
    let alive = true; setPlates([]); setHasMore(false);
    if (!sourceSubtema) { setLoading(false); return; }
    setLoading(true); setError('');
    void (async () => {
      try {
        const { data, error: failure } = await supabase.from('placas').select('id,photo_url,tema_id,subtema_id')
          .eq('tema_id', sourceTema).eq('subtema_id', sourceSubtema).order('sort_order').order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        if (failure) throw failure;
        if (alive) { setPlates((data ?? []).slice(0, PAGE_SIZE)); setHasMore((data?.length ?? 0) > PAGE_SIZE); }
      } catch { if (alive) setError('No se pudieron cargar las placas. Usa Actualizar listado para reintentar.'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [sourceTema, sourceSubtema, page, reload]);
  const name = (options: Option[], id: number) => options.find(option => option.id === id)?.nombre ?? '';
  const destination = `${name(temas, targetTema)} / ${name(targetOptions, targetSubtema)}`;
  const save = async () => {
    if (!selected || savingRef.current || !confirm) return;
    savingRef.current = true; setSaving(true); setError(''); setMessage('');
    try {
      const result = await movePlate(selected, targetTema, targetSubtema);
      void logPlateActivity({ actionType: 'edit_plate', targetTable: 'placas', placaId: selected.id,
        actor: { id: user?.id, username: user?.username, name: user?.nombre, role: user?.rol },
        details: { source: 'trasladar_placa', from_tema_id: selected.tema_id, from_subtema_id: selected.subtema_id, to_tema_id: targetTema, to_subtema_id: targetSubtema, map_id: result.map_id, map_number: result.map_number },
      }).catch(() => {});
      setMessage(`Placa #${selected.id} movida a ${destination}. Conserva su código, imagen, señalados y mapas.`);
      setSelected(null); setConfirm(false); setPage(0); setReload(value => value + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo mover la placa.'); setConfirm(false); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const select = (label: string, value: number, options: Option[], change: (id: number) => void) => <label>{label}<select value={value} onChange={event => change(Number(event.target.value))} disabled={saving || !options.length}><option value={0}>Seleccionar…</option>{options.map(option => <option key={option.id} value={option.id}>{option.nombre}</option>)}</select></label>;
  return <><Header /><main className="plate-transfer"><button type="button" disabled={saving} onClick={() => navigate('/placas')}>← Gestión de placas</button><h1>Mover placa</h1><p>Cambia el tema y subtema conservando el código único, la imagen, los señalados y los mapas interactivos.</p>
    {error && <p role="alert" className="plate-transfer__error">{error}</p>}{message && <p role="status" className="plate-transfer__success">{message}</p>}
    <section><h2>1. Buscar placa</h2><div className="plate-transfer__fields">
      {select('Tema de origen', sourceTema, temas, id => { setSourceTema(id); setSourceSubtema(0); setPage(0); setSelected(null); setConfirm(false); })}
      {select('Subtema de origen', sourceSubtema, sourceOptions, id => { setSourceSubtema(id); setPage(0); setSelected(null); setConfirm(false); })}
    </div><button type="button" disabled={saving || loading || !sourceSubtema} onClick={() => { setSelected(null); setConfirm(false); setReload(value => value + 1); }}>Actualizar listado</button>
      {loading ? <p role="status">Cargando miniaturas…</p> : sourceSubtema > 0 && !plates.length ? <p>No hay placas en esta página.</p> : null}
      <div className="plate-transfer__grid">{plates.map(plate => <button type="button" key={plate.id} aria-pressed={selected?.id === plate.id} disabled={saving} onClick={() => { setSelected(plate); setConfirm(false); setError(''); setMessage(''); }}><ResilientPlacaThumb photoUrl={plate.photo_url} alt={`Placa #${plate.id}`} loading="lazy" /><span>Placa #{plate.id}</span></button>)}</div>
      {sourceSubtema > 0 && <nav aria-label="Páginas de placas"><button disabled={saving || loading || page === 0} onClick={() => { setPage(value => value - 1); setSelected(null); setConfirm(false); }}>Anterior</button><span>Página {page + 1}</span><button disabled={saving || loading || !hasMore} onClick={() => { setPage(value => value + 1); setSelected(null); setConfirm(false); }}>Siguiente</button></nav>}
    </section>
    {selected && <section><h2>2. Destino de la placa #{selected.id}</h2><p>Origen: {name(temas, sourceTema)} / {name(sourceOptions, sourceSubtema)}</p><div className="plate-transfer__fields">
      {select('Tema de destino', targetTema, temas, id => { setTargetTema(id); setTargetSubtema(0); setConfirm(false); })}
      {select('Subtema de destino', targetSubtema, targetOptions, id => { setTargetSubtema(id); setConfirm(false); })}
    </div><p>La placa se colocará al final del subtema destino. Si el número del mapa ya existe en ese tema, recibirá otro número; su identidad y contenido se conservan.</p>
      {confirm ? <div role="group" aria-label="Confirmar movimiento"><p>¿Mover la placa #{selected.id} a <strong>{destination}</strong>?</p><button disabled={saving} onClick={() => void save()}>{saving ? 'Moviendo…' : 'Confirmar movimiento'}</button><button disabled={saving} onClick={() => setConfirm(false)}>Cancelar</button></div> : <button disabled={saving || !targetSubtema || !targetOptions.some(option => option.id === targetSubtema) || (selected.tema_id === targetTema && selected.subtema_id === targetSubtema)} onClick={() => setConfirm(true)}>Mover placa</button>}
    </section>}
  </main><Footer /></>;
}
