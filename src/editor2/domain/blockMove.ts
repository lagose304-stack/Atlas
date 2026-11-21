import {
  boxChildPlacedBlockSchema, canvasChildPlacedBlockSchema, canvasDocSchema,
  innerCanvasChildPlacedBlockSchema, leafPlacedBlockSchema, panelChildPlacedBlockSchema,
  rootPlacedBlockSchema, type BoxChildPlacedBlock, type BoxNode, type LayoutIntent, type CanvasDoc, type PlacedBlock,
} from './schema';
import { richTextToPlain } from './richText';

type Entry = { block: PlacedBlock['block'] | BoxNode | BoxChildPlacedBlock['block']; layout: LayoutIntent };
type Slot = {
  children: Entry[];
  accepts: (input: unknown) => { success: boolean };
  inBox?: boolean;
};
export type MovePosition = 'before' | 'after' | 'inside';
type Destination = { key: string; label: string; slot: Slot; index: number };

function placedInSlot(entry: Entry, slot: Slot): Entry {
  if (entry.block.type !== 'box') return entry;
  const boxDepth = slot.inBox ? 1 : 0;
  return { ...entry, block: { ...entry.block, props: { ...entry.block.props, boxDepth } } } as Entry;
}

// Los destinos apuntan a una copia privada. La página solo cambia al confirmar.
export function prepareBlockMove(doc: CanvasDoc, sourceId: string, position: MovePosition,
  labelFor: (type: Entry['block']['type']) => string) {
  const draft = structuredClone(doc);
  let source: { slot: Slot; index: number; entry: Entry } | undefined;
  const candidates: Destination[] = [];
  function visit(slot: Slot, path: string, withinPanel = false) {
    slot.children.forEach((entry, index) => {
      const block = entry.block;
      if (block.id === sourceId) {
        source = { slot, index, entry };
        return;
      }
      const caption = block.type === 'heading' || block.type === 'text' || block.type === 'badge'
        ? richTextToPlain(block.props.text).trim().slice(0, 45)
        : block.type === 'image' ? block.props.alt : '';
      const label = `${path}${index + 1}. ${labelFor(block.type)}${caption ? ' · ' + caption : ''}`;
      if (position !== 'inside') candidates.push({ key: block.id, label, slot, index: index + Number(position === 'after') });
      function descend(childSlot: Slot, key: string, childLabel: string, panel = withinPanel) {
        if (position === 'inside') candidates.push({ key, label: childLabel, slot: childSlot, index: childSlot.children.length });
        visit(childSlot, childLabel + ' › ', panel);
      }
      if (block.type === 'canvas') {
        descend({ children: block.slots.children, accepts: withinPanel ? innerCanvasChildPlacedBlockSchema.safeParse : canvasChildPlacedBlockSchema.safeParse }, block.id, label);
      } else if (block.type === 'box') {
        descend({ children: block.slots.children, accepts: block.props.boxDepth === 1 ? leafPlacedBlockSchema.safeParse : boxChildPlacedBlockSchema.safeParse, inBox: true }, block.id, label);
      } else if (block.type === 'tabs' || block.type === 'accordion') {
        block.props.items.forEach((panel, i) => {
          const children = panel.children ?? [];
          const childSlot = { children, accepts: panelChildPlacedBlockSchema.safeParse };
          descend(childSlot, `${block.id}/${i}`, `${label} › ${panel.title}`, true);
          // Conservar la ausencia del campo en todos los paneles que no reciben bloques.
          if (!panel.children) pendingPanels.set(childSlot, () => { panel.children = children; });
        });
      }
    });
  }
  const pendingPanels = new Map<Slot, () => void>();
  const rootSlot = { children: draft.root.slots.children, accepts: rootPlacedBlockSchema.safeParse };
  if (position === 'inside') {
    candidates.push({ key: draft.root.id, label: 'Lienzo', slot: rootSlot, index: rootSlot.children.length });
  }
  visit(rootSlot, '');
  const origin = source;
  const allowed = candidates.filter(({ slot, index }) => {
    if (!origin) return false;
    if (slot === origin.slot) return index !== origin.index && index !== origin.index + 1;
    return slot.accepts(placedInSlot(origin.entry, slot)).success;
  });
  let applied = false;
  return {
    destinations: allowed.map(({ key, label }) => ({ key, label })),
    move(key: string): CanvasDoc | undefined {
      const dest = allowed.find(candidate => candidate.key === key);
      if (!origin || !dest || applied) return;
      applied = true;
      const offset = dest.slot === origin.slot && dest.index > origin.index ? 1 : 0;
      origin.slot.children.splice(origin.index, 1);
      pendingPanels.get(dest.slot)?.();
      dest.slot.children.splice(dest.index - offset, 0, placedInSlot(origin.entry, dest.slot));
      return canvasDocSchema.parse(draft);
    },
  };
}
