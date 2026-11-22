import { ChevronDown, Images } from 'lucide-react';
import { useEffect, useId, useState, type MouseEvent } from 'react';
import { ResilientPlacaThumb } from '../../components/ResilientPlacaThumb';
import { supabase } from '../../services/supabase';
import { loadCatalog, type Editor2CatalogSnapshot } from '../services/catalogIndex';
import InspectorDialog from './InspectorDialog';

type PhotoSelection = { topicId: number; subtopicId: number; label: string };
type Plate = { id: number; photo_url: string; aumento: string | null; tincion: string | null };
type SelectPhoto = (url: string, label: string) => void;

function plateLabel(plate: Plate) {
  return [`Placa #${plate.id}`, plate.tincion, plate.aumento && `${plate.aumento}x`].filter(Boolean).join(' · ');
}

function PhotoResults({ selection, onSelect }: { selection: PhotoSelection; onSelect: SelectPhoto }) {
  const { topicId, subtopicId, label } = selection;
  const [photos, setPhotos] = useState<Plate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    async function load() {
      try {
        const { data, error } = await supabase.from('placas')
          .select('id, photo_url, aumento, tincion')
          .eq('tema_id', topicId)
          .eq('subtema_id', subtopicId)
          .order('id', { ascending: false })
          .limit(60)
          .abortSignal(request.signal);
        if (error) throw error;
        if (!request.signal.aborted) {
          setPhotos((data ?? []).filter((photo): photo is Plate =>
            typeof photo.photo_url === 'string' && photo.photo_url.startsWith('https://')));
        }
      } catch {
        if (!request.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => request.abort();
  }, [topicId, subtopicId, attempt]);

  function choose(event: MouseEvent<HTMLButtonElement>, plate: Plate) {
    event.currentTarget.closest('dialog')?.close();
    onSelect(plate.photo_url, plateLabel(plate));
  }

  if (failed) return (
    <div className="e2-catalog-picker__feedback">
      <p className="e2-catalog-picker__status" role="alert">No se pudieron cargar las placas.</p>
      <button type="button" className="e2-button e2-button--quiet" onClick={() => {
        setFailed(false);
        setAttempt(value => value + 1);
      }}>Reintentar</button>
    </div>
  );
  if (!photos) return <p className="e2-catalog-picker__status" role="status">Cargando placas de {label}…</p>;
  if (photos.length === 0) return <p className="e2-catalog-picker__status" role="status">No hay placas en esta selección.</p>;

  const query = search.trim().toLocaleLowerCase('es');
  const visible = photos.filter(plate => plateLabel(plate).toLocaleLowerCase('es').includes(query));
  return (
    <section className="e2-catalog-picker__results" aria-label={`Placas de ${label}`}>
      <label className="e2-design-field">
        <span className="e2-design-label">Buscar en {label}</span>
        <input type="search" placeholder="Tinción, aumento o número" value={search}
          onChange={event => setSearch(event.target.value)} />
      </label>
      {visible.length === 0 ? (
        <p className="e2-catalog-picker__status" role="status">No se encontraron placas con esa búsqueda.</p>
      ) : (
        <div className="e2-catalog-picker">
          {visible.map(plate => (
            <button key={plate.id} type="button" className="e2-catalog-picker__item"
              onClick={event => choose(event, plate)}>
              <ResilientPlacaThumb photoUrl={plate.photo_url} alt="" loading="lazy"
                className="e2-catalog-picker__thumb" />
              <span>{plateLabel(plate)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Catalog({ onSelect }: { onSelect: SelectPhoto }) {
  const groupName = useId();
  const [catalog, setCatalog] = useState<Editor2CatalogSnapshot>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<PhotoSelection>();

  useEffect(() => {
    let active = true;
    loadCatalog().then(data => {
      if (active) setCatalog(data);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [attempt]);

  if (failed) return (
    <div className="e2-catalog-picker__feedback">
      <p className="e2-catalog-picker__status" role="alert">No se pudo cargar el temario.</p>
      <button type="button" className="e2-button e2-button--quiet" onClick={() => {
        setFailed(false);
        setAttempt(value => value + 1);
      }}>Reintentar</button>
    </div>
  );
  if (!catalog) return <p className="e2-catalog-picker__status" role="status">Cargando temas del Atlas…</p>;
  if (catalog.temas.length === 0) return <p className="e2-catalog-picker__status" role="status">No hay temas disponibles.</p>;

  return (
    <div className="e2-catalog-picker-wrap">
      <p className="e2-catalog-picker__status">Abre un tema y elige un subtema para ver sus placas.</p>
      <div className="e2-destination-picker" role="group" aria-label="Temas del Atlas">
        {catalog.temas.map(topic => {
          const subtopics = catalog.subtemas.filter(subtopic => subtopic.tema_id === topic.id);
          return (
            <details key={topic.id} name={groupName} className="e2-destination-group" onToggle={event => {
              if (!event.currentTarget.open) setSelection(current => current?.topicId === topic.id ? undefined : current);
            }}>
              <summary><span>{topic.nombre}</span><ChevronDown size={14} aria-hidden="true" /></summary>
              <div className="e2-destination-group__body">
                {subtopics.length === 0 && <p className="e2-catalog-picker__status">Este tema no tiene subtemas.</p>}
                {subtopics.map(subtopic => {
                  const selected = selection?.subtopicId === subtopic.id;
                  return (
                    <div key={subtopic.id}>
                      <button type="button" className="e2-destination-link e2-catalog-picker__subtopic"
                        aria-expanded={selected}
                        onClick={() => setSelection(selected ? undefined : {
                          topicId: topic.id, subtopicId: subtopic.id, label: subtopic.nombre,
                        })}>
                        {subtopic.nombre}
                      </button>
                      {selected && <PhotoResults selection={selection} onSelect={onSelect} />}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

export default function AtlasPhotoPicker({ label = 'Elegir del Atlas', onSelect }: {
  label?: string;
  onSelect: SelectPhoto;
}) {
  return (
    <InspectorDialog label={label} icon={<Images size={14} aria-hidden="true" />} mountOnOpen>
      <Catalog onSelect={onSelect} />
    </InspectorDialog>
  );
}
