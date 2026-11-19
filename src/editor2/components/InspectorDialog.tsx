import { useId, useRef, type ReactNode } from 'react';

export default function InspectorDialog({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  return (
    <div className="e2-inspector-tool">
      <button type="button" className="e2-button e2-button--quiet e2-inspector-tool__btn" aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}>
        {icon}
        <span>{label}</span>
      </button>
      <dialog ref={dialog} aria-labelledby={title} className="e2-inspector-dialog">
        <header><strong id={title}>{label}</strong>
          <button type="button" className="e2-button e2-button--quiet" onClick={() => dialog.current?.close()}>Cerrar</button>
        </header>
        {children}
      </dialog>
    </div>
  );
}
