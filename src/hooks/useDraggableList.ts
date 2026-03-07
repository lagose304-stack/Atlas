import { useState } from 'react';
import React from 'react';

interface DragState {
  dragId: number | null;
  dragKey: string | null;
  dropIndex: number | null;
  dropKey: string | null;
}

export type DraggableRenderItem<T> =
  | { type: 'placeholder'; key: string }
  | { type: 'item'; item: T; realIndex: number };

const INITIAL: DragState = { dragId: null, dragKey: null, dropIndex: null, dropKey: null };

/**
 * Hook reutilizable para drag-and-drop de reordenamiento de tarjetas.
 * Soporta múltiples listas identificadas por un listKey (string).
 * Para una sola lista, usa siempre el mismo listKey (ej: 'items').
 */
export function useDraggableList() {
  const [state, setState] = useState<DragState>(INITIAL);

  const onDragStart = (e: React.DragEvent, id: number, listKey: string) => {
    setState({ dragId: id, dragKey: listKey, dropIndex: null, dropKey: null });
    const ghost = document.createElement('div');
    ghost.style.position = 'fixed';
    ghost.style.top = '-9999px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOverCard = (e: React.DragEvent, listKey: string, cardIndex: number) => {
    if (state.dragKey !== listKey) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const idx = e.clientY < rect.top + rect.height / 2 ? cardIndex : cardIndex + 1;
    if (idx !== state.dropIndex || listKey !== state.dropKey) {
      setState(prev => ({ ...prev, dropIndex: idx, dropKey: listKey }));
    }
  };

  const onDragOverContainer = (e: React.DragEvent, listKey: string) => {
    if (state.dragKey !== listKey) return;
    e.preventDefault();
  };

  /**
   * Aplica el drop: calcula el nuevo orden de la lista.
   * Retorna el array reordenado, o null si no hubo cambio (drag cancelado, misma posición, etc.).
   */
  const applyDrop = <T extends { id: number }>(
    e: React.DragEvent,
    listKey: string,
    items: T[]
  ): T[] | null => {
    e.preventDefault();
    const { dragId, dragKey, dropIndex } = state;
    if (dragId === null || dragKey !== listKey || dropIndex === null) {
      setState(INITIAL);
      return null;
    }
    const next = [...items];
    const from = next.findIndex(t => t.id === dragId);
    if (from === -1) { setState(INITIAL); return null; }
    let to = dropIndex;
    if (from < to) to--;
    if (to === from) { setState(INITIAL); return null; }
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setState(INITIAL);
    return next;
  };

  const resetDrag = () => setState(INITIAL);

  /**
   * Construye el array de items a renderizar, con placeholders intercalados
   * en la posición donde se soltará el elemento arrastrado.
   */
  const getRenderItems = <T extends { id: number }>(
    listKey: string,
    items: T[]
  ): DraggableRenderItem<T>[] => {
    const { dragKey, dropIndex, dropKey } = state;
    const isActive = dragKey === listKey;
    const result: DraggableRenderItem<T>[] = [];
    items.forEach((item, idx) => {
      if (isActive && dropIndex === idx && dropKey === listKey) {
        result.push({ type: 'placeholder', key: `ph-${idx}` });
      }
      result.push({ type: 'item', item, realIndex: idx });
    });
    if (isActive && dropIndex === items.length && dropKey === listKey) {
      result.push({ type: 'placeholder', key: 'ph-end' });
    }
    return result;
  };

  return {
    dragId: state.dragId,
    dragKey: state.dragKey,
    onDragStart,
    onDragOverCard,
    onDragOverContainer,
    applyDrop,
    resetDrag,
    getRenderItems,
  };
}
