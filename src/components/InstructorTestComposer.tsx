import { lazy, Suspense, useId, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Layers3, Plus, Settings2, ShieldCheck, Trash2, X } from 'lucide-react';
import HoldToRevealCodeInput from './HoldToRevealCodeInput';
import InstructorQuestionEditor from './InstructorQuestionEditor';
import InstructorFormatIcon from './InstructorFormatIcon';
import InstructorScheduleEditor from './InstructorScheduleEditor';
import type { InstructorContent } from '../services/instructorTests';
import {
  INSTRUCTOR_QUESTION_TYPES, incisoLetter, instructorGroups, instructorStoredIncisoCount, isInstructorGradedQuestion, newInstructorGroup, newInstructorQuestion,
  type ChoiceQuestion, type InstructorQuestion, type InstructorQuestionGroup, type InstructorQuestionType,
} from '../types/instructorQuestions';

const InstructorSectionsEditor = lazy(() => import('./InstructorSectionsEditor'));

type Props = {
  content: InstructorContent; code: string; hasCode: boolean; existing: boolean; busy: boolean;
  onChange: (content: InstructorContent) => void; onCodeChange: (code: string) => void;
  onSelectImageFile?: (questionId: string, file: File, slot?: 'image' | 'image_a' | 'image_b') => void;
  onMilestoneAction?: (nextContent?: InstructorContent) => void;
  bankTopicName?: string;
};

export default function InstructorTestComposer({ content, code, hasCode, existing, busy, onChange, onCodeChange, onSelectImageFile, onMilestoneAction, bankTopicName }: Props) {
  const groups = instructorGroups(content);
  const isBankMode = !!bankTopicName;
  const [showSettings, setShowSettings] = useState(!isBankMode && (!existing || groups.length === 0));
  const [activeGroupId, setActiveGroupId] = useState(groups[0]?.id ?? '');
  const [selectedItems, setSelectedItems] = useState<Record<string, string>>({});
  const [addingItem, setAddingItem] = useState(false);
  const [showSections, setShowSections] = useState(false);
  const workspaceId = useId();
  const incisoPanelId = useId();
  const groupIndex = Math.max(0, groups.findIndex(g => g.id === activeGroupId));
  const group = groups[groupIndex];
  const items = group?.item_ids.map(id => content.questions.find(q => q.id === id)).filter((q): q is InstructorQuestion => !!q) ?? [];
  const itemIndex = Math.max(0, items.findIndex(q => q.id === selectedItems[group?.id]));
  const item = items[itemIndex];
  const totalIncisos = instructorStoredIncisoCount(content.questions);
  const fits = (type: InstructorQuestionType) => totalIncisos + (type === 'image_versus' ? 3 : 1) <= 100;

  const apply = (nextGroups: InstructorQuestionGroup[], nextItems = content.questions): InstructorContent => {
    const byId = new Map(nextItems.map(q => [q.id, q]));
    const ordered = content.sections?.length ? [...nextGroups].sort((a, b) => {
      const rank = (id?: string) => { const index = content.sections!.findIndex(section => section.id === id); return index < 0 ? 1000 : index; };
      return rank(a.section_id) - rank(b.section_id);
    }) : nextGroups;
    const nextContent: InstructorContent = { ...content, groups: ordered, questions: ordered.flatMap(g => g.item_ids.map(id => byId.get(id)).filter((q): q is InstructorQuestion => !!q)) };
    onChange(nextContent);
    return nextContent;
  };
  const selectGroup = (id: string) => {
    setActiveGroupId(id); setShowSettings(false); setAddingItem(false);
  };
  const addGroup = () => {
    const next = newInstructorGroup();
    if (group?.section_id) next.section_id = group.section_id;
    const nextContent = apply([...groups, next]);
    selectGroup(next.id);
    onMilestoneAction?.(nextContent);
  };
  const selectItem = (id: string) => {
    if (group) setSelectedItems(previous => ({ ...previous, [group.id]: id }));
  };
  const addItem = (type: InstructorQuestionType, multiple = false) => {
    if (!group || !fits(type)) return;
    const next = newInstructorQuestion(type);
    if (type === 'single_choice' && multiple) {
      (next as ChoiceQuestion).correct_option_ids = [];
    }
    const nextContent = apply(groups.map(g => g.id === group.id ? { ...g, item_ids: [...g.item_ids, next.id] } : g), [...content.questions, next]);
    selectItem(next.id); setAddingItem(false);
    onMilestoneAction?.(nextContent);
  };
  const composerFormats: { value: InstructorQuestionType; label: string; desc: string; multiple?: boolean }[] = [
    { value: 'single_choice', label: 'Selección única', desc: 'Una respuesta correcta (círculo)', multiple: false },
    { value: 'single_choice', label: 'Selección múltiple', desc: 'Varias respuestas correctas (cuadradito)', multiple: true },
    { value: 'short_answer', label: 'Respuesta breve', desc: 'Texto libre · Revisión manual' },
    { value: 'completion', label: 'Completación', desc: 'Enunciado con espacios por completar' },
    { value: 'matching', label: 'Términos pareados', desc: 'Relacionar términos y conceptos' },
    { value: 'image_point', label: 'Señalar en imagen', desc: 'Colocar un señalado · Revisión manual' },
    { value: 'image_versus', label: 'Versus de imágenes', desc: 'Dos placas con respuestas breves opcionales' },
  ];
  const itemCount = instructorStoredIncisoCount(items);
  const gradedItemsCount = itemCount - items.filter(q => !isInstructorGradedQuestion(q)).length;

  return <div className="instructor-composer">
    <aside className="instructor-question-nav" aria-label="Navegación del editor">
      {!isBankMode && <>
        <button type="button" className="instructor-nav-entry instructor-settings-entry" aria-current={showSettings ? 'page' : undefined}
          aria-controls={workspaceId} onClick={() => setShowSettings(true)}>
          <Settings2 size={19} aria-hidden="true" />
          <span>Datos de la prueba<small>Nombre, instrucciones y código</small></span>
        </button>
        <button type="button" className="instructor-btn" onClick={() => { setShowSettings(true); setShowSections(true); }}><Layers3 size={16} />Secciones por tema</button>
      </>}
      {isBankMode && <div className="instructor-bank-topic-pill"><Layers3 size={16} aria-hidden="true" /><span>Tema asignado<strong>{bankTopicName}</strong></span></div>}
      <div className="instructor-row instructor-between instructor-nav-heading"><h3>Preguntas</h3><span className="instructor-badge">{groups.length}</span></div>
      <ol className="instructor-question-nav-list" aria-label="Preguntas de la prueba">
        {groups.map((g, index) => <li key={g.id}>
          {!!content.sections?.length && (index === 0 || groups[index - 1].section_id !== g.section_id) && <span className="instructor-nav-section-label">{content.sections.find(section => section.id === g.section_id)?.nombre ?? 'Sin sección'}</span>}
          <button type="button" className="instructor-question-tile" aria-current={!showSettings && g.id === group?.id ? 'page' : undefined}
            data-empty={g.item_ids.length === 0 ? true : undefined}
            title={`Pregunta ${index + 1} · ${g.item_ids.length} ${g.item_ids.length === 1 ? 'inciso' : 'incisos'}${g.titulo.trim() ? ` · ${g.titulo.trim()}` : ''}`}
            aria-controls={workspaceId} aria-label={`Ir a pregunta ${index + 1}`} onClick={() => selectGroup(g.id)}>
            {index + 1}
            {g.section_id && <span className="instructor-tile-section" title={content.sections?.find(s => s.id === g.section_id)?.nombre}>{(content.sections?.findIndex(s => s.id === g.section_id) ?? -1) + 1}</span>}
          </button>
        </li>)}
      </ol>
      <button type="button" className="instructor-btn instructor-btn-primary" aria-label="Agregar nueva pregunta" disabled={groups.length >= 100} onClick={addGroup}><Plus size={17} aria-hidden="true" />Nueva pregunta</button>
      <div className="instructor-nav-foot"><Layers3 size={15} aria-hidden="true" /><span>{totalIncisos} incisos en total<small>Cada pregunta vale 1 punto, dividido entre sus incisos</small></span></div>
    </aside>

    <section id={workspaceId} className="instructor-question-workspace" aria-label="Área de edición">
      {showSettings ? <>
        {showSections && <Suspense fallback={<p role="status">Abriendo secciones…</p>}><InstructorSectionsEditor content={{ ...content, groups }} onChange={onChange} /></Suspense>}
        <div className="instructor-workspace-heading"><span className="instructor-eyebrow">Configuración</span><h3>Datos de la prueba</h3><p>Define cómo se identificará la evaluación y quién podrá comenzar.</p></div>
        <div className="instructor-settings-card">
        <label className="instructor-label">Nombre de la prueba
          <input className="instructor-input" value={content.nombre} required maxLength={200} onChange={e => onChange({ ...content, nombre: e.target.value })} />
        </label>
        <label className="instructor-label">Instrucciones
          <textarea className="instructor-input" aria-label="Instrucciones" value={content.instrucciones} maxLength={10000} onChange={e => onChange({ ...content, instrucciones: e.target.value })} />
        </label>
        </div>
        <section className="instructor-settings-card instructor-access-card" aria-label="Acceso a la prueba">
        <div className="instructor-setting-heading"><span className="instructor-setting-icon"><ShieldCheck size={20} aria-hidden="true" /></span><div><h4>Acceso con código</h4><p>Comparte el código únicamente con quienes realizarán la prueba.</p></div><span className="instructor-badge">{code ? code.length === 6 ? 'Código por guardar' : 'Completa los 6 dígitos' : hasCode ? 'Configurado' : 'Sin configurar'}</span></div>
        <HoldToRevealCodeInput label="Código de acceso de 6 dígitos" inputMode="numeric" autoComplete="new-password" maxLength={6} pattern="[0-9]{6}" value={code} disabled={busy}
          placeholder={hasCode ? '••••••' : '000000'} onChange={e => onCodeChange(e.target.value.replace(/[^0-9]/g, ''))} />
        <p className="instructor-muted">{hasCode ? 'Ya hay un código configurado. Deja el campo vacío para conservarlo.' : 'Define un código antes de publicar y compártelo con los instructores.'} El código nuevo se usará desde que guardes.</p>
        </section>
        <InstructorScheduleEditor content={content} onChange={onChange} />
        <button type="button" className="instructor-btn" onClick={() => groups.length ? selectGroup(groups[0].id) : addGroup()}>Continuar a preguntas<ArrowRight size={17} aria-hidden="true" /></button>
      </> : group ? <>
        <div className="instructor-row instructor-between instructor-active-question-heading">
          <div><span className="instructor-eyebrow">Edición de preguntas</span><h3>Pregunta {groupIndex + 1} de {groups.length}</h3><p>{gradedItemsCount !== itemCount ? `${itemCount} ${itemCount === 1 ? 'inciso' : 'incisos'} (${gradedItemsCount} con puntaje) · 1 punto repartido entre los incisos evaluables.` : `${itemCount} ${itemCount === 1 ? 'inciso' : 'incisos'} · 1 punto repartido entre sus incisos.`}</p></div>
          <div className="instructor-row">
          {!!items.length && <button type="button" className="instructor-btn" aria-expanded={addingItem} aria-controls={`${workspaceId}-formats`} disabled={totalIncisos >= 100} onClick={() => setAddingItem(value => !value)}><Plus size={17} aria-hidden="true" />Agregar inciso</button>}
          <button type="button" className="instructor-btn instructor-btn-danger instructor-btn-icon" aria-label={`Eliminar pregunta ${groupIndex + 1}`} title={`Eliminar pregunta ${groupIndex + 1}`} onClick={() => {
            if (!window.confirm(`¿Eliminar la pregunta ${groupIndex + 1} y sus ${items.length} incisos?`)) return;
            const next = groups.filter(g => g.id !== group.id);
            const nextContent = apply(next);
            if (next.length) selectGroup(next[Math.min(groupIndex, next.length - 1)].id);
            else { setActiveGroupId(''); if (!isBankMode) setShowSettings(true); }
            onMilestoneAction?.(nextContent);
          }}><Trash2 size={17} aria-hidden="true" /></button>
          </div>
        </div>
        {!!content.sections?.length && <label className="instructor-label instructor-section-assignment">Sección de la pregunta {groupIndex + 1}
          <select aria-label={`Sección de la pregunta ${groupIndex + 1}`} className="instructor-input" value={group.section_id ?? ''} onChange={event => apply(groups.map(g => {
            if (g.id !== group.id) return g; const next = { ...g }; if (event.target.value) next.section_id = event.target.value; else delete next.section_id; return next;
          }))}><option value="">Sin sección</option>{content.sections.map(section => <option key={section.id} value={section.id}>{section.nombre}</option>)}</select>
        </label>}
        {(addingItem || !items.length) && <section id={`${workspaceId}-formats`} className="instructor-format-picker" aria-label="Elegir formato del nuevo inciso" onKeyDown={event => {
          if (event.key === 'Escape' && items.length) { setAddingItem(false); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('[aria-controls$="-formats"]')?.focus(); }
        }}>
          <div className="instructor-row instructor-between"><div><h4>{items.length ? 'Elige el formato' : 'Agrega el primer inciso'}</h4><p>Selecciona un formato para empezar a escribir.</p></div>
            {!!items.length && <button type="button" className="instructor-btn instructor-btn-ghost instructor-btn-icon" aria-label="Cerrar selección de formato" onClick={() => setAddingItem(false)}><X size={17} aria-hidden="true" /></button>}
          </div>
          <div className="instructor-format-grid">{composerFormats.map(fmt => <button type="button" className="instructor-format-card" key={`${fmt.value}-${fmt.multiple ? 'm' : 's'}`}
            disabled={!fits(fmt.value)} aria-label={`Agregar inciso de ${fmt.label.toLowerCase()}`} onClick={() => addItem(fmt.value, fmt.multiple)}>
            <span className="instructor-format-symbol"><InstructorFormatIcon type={fmt.value} multiple={fmt.multiple} /></span>
            <strong>{fmt.label}</strong><span>{fmt.desc}</span><Plus size={15} aria-hidden="true" className="instructor-format-plus" />
          </button>)}</div>
        </section>}
        {items.length ? <>
          <div role="tablist" aria-label={`Incisos de pregunta ${groupIndex + 1}`} className="instructor-inciso-tabs">
            {items.map((q, i) => <button key={q.id} id={`${incisoPanelId}-${q.id}`} type="button" role="tab" aria-selected={i === itemIndex}
              tabIndex={i === itemIndex ? 0 : -1} aria-controls={incisoPanelId} onClick={() => { selectItem(q.id); setAddingItem(false); }}
              onKeyDown={event => {
                const next = event.key === 'ArrowRight' ? (i + 1) % items.length : event.key === 'ArrowLeft' ? (i - 1 + items.length) % items.length
                  : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
                if (next === null) return;
                event.preventDefault(); selectItem(items[next].id);
                (event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[next])?.focus();
              }}>
              <span className="instructor-inciso-letter" aria-hidden="true">{incisoLetter(i).toUpperCase()}</span>
              <span><strong>Inciso {incisoLetter(i)}</strong>
                <small><InstructorFormatIcon type={q.type} multiple={(!q.type || q.type === 'single_choice') && !!q.correct_option_ids} />{(!q.type || q.type === 'single_choice') && q.correct_option_ids
                  ? 'Selección múltiple'
                  : INSTRUCTOR_QUESTION_TYPES.find(type => type.value === (q.type ?? 'single_choice'))?.label}</small></span>
            </button>)}
          </div>
          {item && <div role="tabpanel" id={incisoPanelId} aria-labelledby={`${incisoPanelId}-${item.id}`}>
            <InstructorQuestionEditor key={item.id} question={item} index={itemIndex} label={`Inciso ${incisoLetter(itemIndex)}`}
              onSelectImageFile={onSelectImageFile ? (file, slot) => onSelectImageFile(item.id, file, slot) : undefined}
              contextLabel={`inciso ${incisoLetter(itemIndex)} de pregunta ${groupIndex + 1}`}
              onChange={next => apply(groups, content.questions.map(q => q.id === item.id ? next : q))}
              onRemove={() => {
                const nextContent = apply(groups.map(g => g.id === group.id ? { ...g, item_ids: g.item_ids.filter(id => id !== item.id) } : g));
                selectItem(items.filter(q => q.id !== item.id)[Math.min(itemIndex, items.length - 2)]?.id ?? '');
                onMilestoneAction?.(nextContent);
              }} />
          </div>}
        </> : null}
        <nav className="instructor-row instructor-between instructor-question-pager" aria-label="Cambiar de pregunta">
          <button type="button" className="instructor-btn" disabled={groupIndex === 0} onClick={() => selectGroup(groups[groupIndex - 1].id)}><ChevronLeft size={17} aria-hidden="true" />Pregunta anterior</button>
          <span aria-live="polite">{groupIndex + 1} / {groups.length}</span>
          <button type="button" className="instructor-btn" disabled={groupIndex === groups.length - 1} onClick={() => selectGroup(groups[groupIndex + 1].id)}>Pregunta siguiente<ChevronRight size={17} aria-hidden="true" /></button>
        </nav>
      </> : <div className="instructor-composer-empty"><p>Agrega una pregunta para comenzar.</p><button type="button" className="instructor-btn" onClick={addGroup}><Plus size={17} aria-hidden="true" />Agregar primera pregunta</button></div>}
    </section>
  </div>;
}
