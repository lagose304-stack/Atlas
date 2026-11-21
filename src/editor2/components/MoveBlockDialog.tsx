import { useId, useMemo, useRef, useState } from 'react';
import { prepareBlockMove, type MovePosition } from '../domain/blockMove';
import type { BlockType, CanvasDoc } from '../domain/schema';
import { useEditor2Store } from '../store/editor2Store';

type Props = {
  doc: CanvasDoc;
  sourceId: string;
  puckId: string;
  labelFor: (type: BlockType) => string;
};

export default function MoveBlockDialog({ doc, sourceId, puckId, labelFor }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MovePosition>('after');
  const [target, setTarget] = useState('');
  const plan = useMemo(() => open ? prepareBlockMove(doc, sourceId, position, labelFor) : null,
    [open, doc, sourceId, position, labelFor]);
  const chosen = plan?.destinations.find(option => option.key === target);

  function confirm() {
    if (!plan || !chosen) return;
    const moved = plan.move(chosen.key);
    if (!moved) return;
    dialog.current?.close();
    useEditor2Store.getState().applyBlockMove(doc, moved);
    requestAnimationFrame(() => {
      const block = document.querySelector<HTMLElement>(`.e2-puck-shell [data-puck-component="${CSS.escape(puckId)}"]`);
      if (block) {
        block.tabIndex = -1;
        block.focus();
      }
    });
  }

  return (
    <div>
      <button type="button" className="e2-button e2-button--quiet" aria-haspopup="dialog" onClick={() => {
        setTarget('');
        setOpen(true);
        dialog.current?.showModal();
      }}>Mover bloque</button>
      <dialog ref={dialog} className="e2-inspector-dialog e2-move-dialog" aria-labelledby={titleId} onClose={() => setOpen(false)}>
        <header><strong id={titleId}>Mover bloque</strong></header>
        <label>Posición
          <select value={position} onChange={event => {
            setPosition(event.target.value as MovePosition);
            setTarget('');
          }}>
            <option value="before">Antes de</option>
            <option value="after">Después de</option>
            <option value="inside">Dentro de, al final</option>
          </select>
        </label>
        <label>Destino
          <select value={chosen?.key ?? ''} onChange={event => setTarget(event.target.value)}>
            <option value="">{plan?.destinations.length ? 'Selecciona un destino' : 'Sin destinos para esta posición'}</option>
            {plan?.destinations.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
        <footer>
          <button type="button" className="e2-button e2-button--quiet" onClick={() => dialog.current?.close()}>Cancelar</button>
          <button type="button" className="e2-button" disabled={!chosen} onClick={confirm}>Confirmar movimiento</button>
        </footer>
      </dialog>
    </div>
  );
}
