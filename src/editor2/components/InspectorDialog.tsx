import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export default function InspectorDialog({ label, icon, children, openRequest, onClose, mountOnOpen = false }: {
  label: string; icon?: ReactNode; children: ReactNode; openRequest?: boolean; onClose?: () => void; mountOnOpen?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (openRequest && !dialog.current?.open) {
      dialog.current?.showModal();
      setOpen(true);
    }
  }, [openRequest]);
  return (
    <div className="e2-inspector-tool">
      <button type="button" className="e2-button e2-button--quiet e2-inspector-tool__btn" aria-haspopup="dialog"
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}>
        {icon}
        <span>{label}</span>
      </button>
      <dialog ref={dialog} aria-labelledby={title} className="e2-inspector-dialog" onClose={() => {
        setOpen(false);
        onClose?.();
      }}>
        <header><strong id={title}>{label}</strong>
          <button type="button" className="e2-button e2-button--quiet" onClick={() => dialog.current?.close()}>Cerrar</button>
        </header>
        {(!mountOnOpen || open) && children}
      </dialog>
    </div>
  );
}
