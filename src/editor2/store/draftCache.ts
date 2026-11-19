import type { CanvasDoc } from '../domain/schema';

/**
 * Borradores en memoria de la Parte 4. No se escribe nada en disco ni en
 * Supabase: la persistencia real llega con la Parte 6.
 */
const drafts = new Map<string, CanvasDoc>();

export function readEditor2Draft(pageKey: string): CanvasDoc | null {
  return drafts.get(pageKey) ?? null;
}

export function writeEditor2Draft(doc: CanvasDoc): void {
  drafts.set(doc.pageKey, doc);
}

export function clearEditor2Drafts(): void {
  drafts.clear();
}
