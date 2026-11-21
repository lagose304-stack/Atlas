import { useEffect, useRef, useState } from 'react';
import { usePuck } from '@puckeditor/core';
import { ChevronRight } from 'lucide-react';
import { editor2PuckConfig } from './Editor2Blocks';

export default function BlockBreadcrumb() {
  const { selectedItem, getParentById, getSelectorForId, dispatch } = usePuck();
  const nav = useRef<HTMLElement>(null);
  const [hoverId, setHoverId] = useState<string>();
  const [focusId, setFocusId] = useState<string>();
  const path: { id: string; label: string }[] = [];
  let node = selectedItem;
  while (node && editor2PuckConfig.components[node.type]) {
    path.unshift({ id: node.props.id, label: editor2PuckConfig.components[node.type].label ?? node.type });
    node = getParentById(node.props.id) ?? null;
  }

  const highlighted = path.find(step => step.id === (hoverId ?? focusId))?.id;
  useEffect(() => {
    if (!highlighted) return;
    const canvas = nav.current?.closest('.e2-puck-shell');
    const element = canvas?.querySelector(`[data-puck-component="${CSS.escape(highlighted)}"]`);
    element?.setAttribute('data-e2-path-highlight', '');
    return () => element?.removeAttribute('data-e2-path-highlight');
  }, [highlighted, selectedItem?.props.id]);

  return (
    <nav className="e2-block-path" ref={nav} aria-label="Ruta del bloque seleccionado">
      <ol>
        {path.map(({ id, label }, index) => (
          <li key={id}>
            {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
            <button type="button" className="e2-button e2-button--quiet"
              aria-current={id === selectedItem?.props.id ? 'location' : undefined}
              onPointerEnter={() => setHoverId(id)} onPointerLeave={() => setHoverId(undefined)}
              onFocus={() => setFocusId(id)} onBlur={() => setFocusId(undefined)}
              onClick={() => {
                const selector = getSelectorForId(id);
                if (selector) dispatch({ type: 'setUi', ui: { itemSelector: selector } });
              }}>{label}</button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
