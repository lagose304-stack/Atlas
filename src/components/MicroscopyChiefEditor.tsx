import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

type Candidate = { id: number; nombre: string; username: string };
type ChiefState = { user_id: number | null; revision: number };

export default function MicroscopyChiefEditor({ target }: { target?: { id: number; nombre: string; rol: string } }) {
  const { user, refreshSession } = useAuth();
  const [state, setState] = useState<ChiefState | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<number | null>(target?.id ?? null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const authorized = user?.can_manage_microscopy === true;
  const eligible = !target || target.rol === 'Administrador';

  useEffect(() => {
    if (!authorized || !eligible) return;
    let cancelled = false;
    setState(null);
    void (async () => {
      try {
        const result = await supabase.rpc('atlas_get_microscopy_chief');
        if (result.error || !result.data || !Number.isInteger(result.data.revision)) throw new Error();
        let list: Candidate[] = [];
        if (!target) {
          const response = await supabase.rpc('atlas_list_microscopy_candidates');
          if (response.error || !Array.isArray(response.data)) throw new Error();
          list = response.data;
        }
        if (!cancelled) {
          setState(result.data as ChiefState);
          setCandidates(list);
          setSelected(target?.id ?? null);
          setChecked(target?.id === result.data.user_id);
        }
      } catch {
        if (!cancelled) setMessage('No se pudo comprobar la jefatura. Vuelve a abrir la edición del usuario.');
      }
    })();
    return () => { cancelled = true; };
  }, [authorized, eligible, target?.id]);

  if (!authorized) return savedMessage ? <p role="status">{savedMessage}</p> : null;
  if (!eligible) return <p>La jefatura solo puede asignarse a un usuario con rol Administrador. Guarda primero el cambio de rol.</p>;

  const save = async () => {
    if (!state || selected === null || busy) return;
    const nextId = checked ? selected : null;
    const name = target?.nombre ?? candidates.find(c => c.id === selected)?.nombre ?? '';
    const prompt = checked
      ? `¿Asignar la jefatura de Microscopia a ${name}? El titular anterior perderá esta función.`
      : '¿Retirar la jefatura de Microscopia? La cuenta inicial podrá volver a asignarla.';
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setMessage('');
    setSavedMessage('');
    try {
      const { error } = await supabase.rpc('atlas_set_microscopy_chief', {
        p_user_id: nextId, p_revision: state.revision,
      });
      if (error) {
        setState(null);
        setMessage(error.code === '40001'
          ? 'La jefatura cambió mientras editabas. Vuelve a abrir el usuario.'
          : error.code === '21000'
            ? 'La base de datos rechazó el guardado. La función de jefatura necesita una corrección SQL; no se guardaron los cambios.'
            : error.code === '42501'
              ? 'Tu sesión ya no tiene permiso para cambiar la jefatura. Vuelve a abrir el usuario.'
              : 'No se pudo guardar la jefatura. Vuelve a abrir el usuario para comprobar el estado e inténtalo de nuevo.');
        await refreshSession();
        return;
      }
      setState({ user_id: nextId, revision: state.revision + 1 });
      setSavedMessage(nextId === null
        ? `Se retiró la jefatura de Microscopia de ${name}. Cambio guardado correctamente.`
        : `${name} es ahora Jefe de Microscopia. Cambio guardado correctamente.`);
      await refreshSession();
    } catch {
      setState(null);
      setMessage('No se pudo confirmar el resultado. Vuelve a abrir el usuario antes de reintentar.');
    } finally {
      setBusy(false);
    }
  };

  const changed = selected !== null && state !== null && checked !== (selected === state.user_id);
  return (
    <fieldset style={{ margin: '20px 0', padding: 18, border: '1px solid #c4b5fd', borderRadius: 12 }}>
      <legend>Jefatura de Microscopia</legend>
      {!target && (
        <label style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
          Editar usuario
          <select value={selected ?? ''} disabled={!state || busy} onChange={event => {
            const id = event.target.value ? Number(event.target.value) : null;
            setSelected(id);
            setChecked(id !== null && id === state?.user_id);
            setMessage('');
            setSavedMessage('');
          }} style={{ width: '100%', padding: 10 }}>
            <option value="">Selecciona un usuario</option>
            {candidates.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.username})</option>)}
          </select>
        </label>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="checkbox" checked={checked} disabled={!state || selected === null || busy}
          onChange={event => setChecked(event.target.checked)} />
        Jefe de Microscopia
      </label>
      {state && selected !== null && <p style={{ fontWeight: 600, color: '#475569' }}>
        Estado guardado: {state.user_id === selected ? 'Jefe de Microscopia' : 'Sin jefatura de Microscopia'}.
        {changed && ' Hay cambios sin guardar.'}
      </p>}
      <p>Solo un Administrador puede tener esta función adicional. Al asignarla, se retira automáticamente al titular anterior. El usuario conserva su rol Administrador.</p>
      <button type="button" disabled={!changed || busy} onClick={() => void save()}
        style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
        {busy ? 'Guardando jefatura…' : 'Guardar jefatura'}
      </button>
      {message && <p role="status">{message}</p>}
      {savedMessage && <p role="status" style={{ padding: 12, borderRadius: 8, background: '#dcfce7', color: '#166534' }}>{savedMessage}</p>}
    </fieldset>
  );
}
