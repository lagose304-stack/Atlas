import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { acquireAtlasScrollLock, releaseAtlasScrollLock } from '../constants/scrollLock';

export default function InstructorDeleteConfirmation({ name, account, reference, dirty, onCancel, onConfirm }: {
  name: string; account?: string | null; reference: string; dirty: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    acquireAtlasScrollLock();
    dialog.current?.querySelector('button')?.focus();
    return () => { releaseAtlasScrollLock(); previous?.focus(); };
  }, []);

  return createPortal(<div className="instructor-delete-backdrop" onClick={onCancel}>
    <div ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby="instructor-delete-title" aria-describedby="instructor-delete-description"
      className="instructor-delete-dialog" onClick={event => event.stopPropagation()} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
        if (event.key === 'Tab') {
          const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button');
          if (!buttons?.length) return;
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
      <span className="instructor-delete-warning"><AlertTriangle size={26} aria-hidden="true" /></span>
      <h2 id="instructor-delete-title">¿Eliminar esta entrega?</h2>
      <div className="instructor-delete-identity"><strong>{name}</strong>{account && <span>Cuenta: {account}</span>}<span>Entrega {reference}</span></div>
      <p id="instructor-delete-description">Se borrarán permanentemente sus respuestas, calificación y progreso asociado. Esta acción no se puede deshacer.</p>
      {dirty && <p>También se descartará la revisión que no has guardado.</p>}
      <div className="instructor-delete-actions">
        <button type="button" className="instructor-btn" onClick={onCancel}>Cancelar</button>
        <button type="button" className="instructor-btn instructor-btn-danger" onClick={onConfirm}><Trash2 size={16} />Eliminar definitivamente</button>
      </div>
    </div>
  </div>, document.body);
}
