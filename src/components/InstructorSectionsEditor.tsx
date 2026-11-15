import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { getCachedTemas, type CatalogTema } from '../services/catalogService';
import type { InstructorContent } from '../services/instructorTests';

export default function InstructorSectionsEditor({ content, onChange }: { content: InstructorContent; onChange: (content: InstructorContent) => void }) {
  const [topics, setTopics] = useState<CatalogTema[]>([]), [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    void getCachedTemas().then(data => { if (active) setTopics(data); }).catch(() => { if (active) setError('No se pudieron cargar los temas del Atlas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const sections = content.sections ?? [];
  return <section className="instructor-settings-card" aria-label="Secciones por tema">
    <h4>Secciones por tema</h4><p className="instructor-muted">Agrega temas del Atlas y asigna cada pregunta a una sección. La nota se desglosará por tema. No se utilizan subtemas.</p>
    {loading && <p role="status">Cargando temas…</p>}
    {error && <p role="alert">{error} <button type="button" className="instructor-btn" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></p>}
    <div className="instructor-row"><label className="instructor-label">Tema del Atlas<select aria-label="Tema del Atlas" className="instructor-input" disabled={loading} value={topic} onChange={event => setTopic(event.target.value)}>
      <option value="">Selecciona un tema</option>{topics.filter(t => !sections.some(section => section.tema_id === t.id)).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
    </select></label><button type="button" className="instructor-btn" disabled={!topic || loading} onClick={() => {
      const selected = topics.find(t => t.id === Number(topic)); if (!selected) return;
      onChange({ ...content, sections: [...sections, { id: crypto.randomUUID(), tema_id: selected.id, nombre: selected.nombre }] }); setTopic('');
    }}><Plus size={16} />Agregar sección</button></div>
    <ul className="instructor-sections-list">{sections.map(section => <li key={section.id}><div><strong>{section.nombre}</strong><small>{content.groups?.filter(group => group.section_id === section.id).length ?? 0} preguntas · 1 punto por pregunta</small></div>
      <button type="button" className="instructor-btn instructor-btn-danger instructor-btn-icon" aria-label={`Quitar sección ${section.nombre}`} onClick={() => {
        if (!window.confirm('¿Quitar esta sección? Sus preguntas se conservarán sin sección asignada.')) return;
        onChange({ ...content, sections: sections.filter(s => s.id !== section.id), groups: content.groups?.map(group => {
          if (group.section_id !== section.id) return group; const next = { ...group }; delete next.section_id; return next;
        }) });
      }}><Trash2 size={16} /></button>
    </li>)}</ul>
    {!!sections.length && <p className="instructor-muted">Antes de publicar, todas las preguntas deben tener sección y cada sección debe incluir al menos una pregunta.</p>}
  </section>;
}
