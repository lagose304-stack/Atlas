export function weeklyButtonDestination(href: string) {
  const match = /^\/(subtemas|ver-placas)\/([1-9]\d*)\/?(?:[?#].*)?$/.exec(href);
  if (!match) return null;
  const id = Number(match[2]);
  if (!Number.isSafeInteger(id)) return null;
  return { kind: match[1] === 'subtemas' ? 'tema' as const : 'subtema' as const, id };
}
