import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function UnsavedChangesDialog({ onCancel, onSave }: {
  onCancel: () => void;
  onSave: () => Promise<boolean>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previousFocus?.focus();
  }, []);

  const saveAndLeave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      if (!await onSave()) setError('No se pudieron guardar los cambios. Puedes intentarlo de nuevo o cancelar.');
    } catch {
      setError('No se pudieron guardar los cambios. Puedes intentarlo de nuevo o cancelar.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return createPortal(
    <div className="page-editor-unsaved-backdrop">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="page-editor-unsaved-title" aria-describedby="page-editor-unsaved-description" className="page-editor-unsaved-dialog" onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (!savingRef.current) onCancel();
        }
        if (event.key === 'Tab') {
          const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
          if (!buttons?.length) { event.preventDefault(); return; }
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
        <h2 id="page-editor-unsaved-title">Hay cambios sin guardar</h2>
        <p id="page-editor-unsaved-description">¿Quieres guardar los cambios de esta versión antes de salir?</p>
        {error && <p role="alert">{error}</p>}
        <div className="page-editor-unsaved-actions">
          <button type="button" disabled={saving} onClick={onCancel}>Cancelar</button>
          <button type="button" disabled={saving} onClick={() => void saveAndLeave()}>{saving ? 'Guardando…' : 'Guardar y salir'}</button>
        </div>
      </div>
    </div>, document.body,
  );
}
