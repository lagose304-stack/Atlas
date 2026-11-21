import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { acquireAtlasScrollLock, releaseAtlasScrollLock } from '../constants/scrollLock';

type Props = {
  name: string; dirty: boolean; busy?: boolean; error?: string;
  onCancel: () => void; onConfirm: () => void;
} & ({ kind: 'draft' } | { kind?: 'submission'; account?: string | null; reference: string });

export default function InstructorDeleteConfirmation(props: Props) {
  const { name, dirty, busy, error, onCancel, onConfirm } = props;
  const isDraft = props.kind === 'draft';
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    acquireAtlasScrollLock();
    dialog.current?.querySelector('button')?.focus();
    return () => { releaseAtlasScrollLock(); previous?.focus(); };
  }, []);

  return createPortal(<div className="instructor-delete-backdrop" onClick={() => { if (!busy) onCancel(); }}>
    <div ref={dialog} role="alertdialog" aria-modal="true" aria-busy={busy} aria-labelledby="instructor-delete-title" aria-describedby="instructor-delete-description"
      className="instructor-delete-dialog" onClick={event => event.stopPropagation()} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); if (!busy) onCancel(); }
        if (event.key === 'Tab') {
          const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button');
          if (!buttons?.length) return;
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
      <span className="instructor-delete-warning"><AlertTriangle size={26} aria-hidden="true" /></span>
      <h2 id="instructor-delete-title">{isDraft ? '¿Eliminar este borrador?' : '¿Eliminar esta entrega?'}</h2>
      <div className="instructor-delete-identity"><strong>{name}</strong>
        {props.kind !== 'draft' && <>{props.account && <span>Cuenta: {props.account}</span>}<span>Entrega {props.reference}</span></>}
      </div>
      <p id="instructor-delete-description">{isDraft
        ? 'La configuración guardada se eliminará de forma permanente. Las preguntas seguirán en el banco.'
        : 'Se borrarán permanentemente sus respuestas, calificación y progreso asociado. Esta acción no se puede deshacer.'}</p>
      {dirty && <p>{isDraft ? 'También se descartarán los cambios sin guardar.' : 'También se descartará la revisión que no has guardado.'}</p>}
      {error && <p className="instructor-error" role="alert">{error}</p>}
      <div className="instructor-delete-actions">
        <button type="button" className="instructor-btn" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="button" className="instructor-btn instructor-btn-danger" disabled={busy} onClick={onConfirm}><Trash2 size={16} />{busy ? 'Eliminando…' : 'Eliminar definitivamente'}</button>
      </div>
    </div>
  </div>, document.body);
}
