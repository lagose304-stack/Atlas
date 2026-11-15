import { CalendarClock } from 'lucide-react';
import type { InstructorContent } from '../services/instructorTests';

export const instructorLocalDateTime = (iso: string): string => {
  const time = Date.parse(iso); return Number.isFinite(time) ? new Date(time - 6 * 3600000).toISOString().slice(0, 16) : '';
};
export const instructorScheduleIso = (local: string): string => {
  if (!local) return ''; const time = new Date(`${local}:00-06:00`); return Number.isFinite(time.getTime()) ? time.toISOString() : '';
};
export default function InstructorScheduleEditor({ content, onChange }: { content: InstructorContent; onChange: (content: InstructorContent) => void }) {
  const schedule = content.schedule;
  const valid = schedule && Date.parse(schedule.opens_at) < Date.parse(schedule.closes_at);
  return <section className="instructor-settings-card" aria-label="Horario de la prueba">
    <h4><CalendarClock size={18} /> Horario de la prueba</h4>
    <label className="instructor-option"><input type="checkbox" checked={!!schedule} onChange={event => {
      const next = { ...content }; if (event.target.checked) next.schedule = { opens_at: '', closes_at: '' }; else delete next.schedule; onChange(next);
    }} />Habilitar solo durante un rango de fechas y horas</label>
    <p className="instructor-muted">Zona horaria: Honduras (UTC−06:00). Guarda y publica los cambios para aplicar el horario.</p>
    {schedule && <><div className="instructor-pair-editor">
      <label className="instructor-label">Fecha y hora de apertura<input type="datetime-local" className="instructor-input" value={instructorLocalDateTime(schedule.opens_at)} onChange={event => onChange({ ...content, schedule: { ...schedule, opens_at: instructorScheduleIso(event.target.value) } })} /></label>
      <label className="instructor-label">Fecha y hora de cierre<input type="datetime-local" className="instructor-input" value={instructorLocalDateTime(schedule.closes_at)} onChange={event => onChange({ ...content, schedule: { ...schedule, closes_at: instructorScheduleIso(event.target.value) } })} /></label>
    </div>{!valid && <p className="instructor-error">Completa ambas fechas. El cierre debe ser posterior a la apertura para poder publicar.</p>}</>}
  </section>;
}
