import { boldTextContent } from './boldTextContent';

export interface IdentificationAnnotation {
  label: string;
  x: number | null;
  y: number | null;
  startX?: number | null;
  startY?: number | null;
  regionPoints?: number[] | null;
  regionHoles?: number[][] | null;
  regionSmooth?: boolean | null;
}

export interface AnnotatedPlate {
  id: number;
  subtema_id: number;
  senalados?: string[] | null;
  senalados_meta?: unknown;
}

const coordinate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const polygon = (value: unknown): value is number[] => Array.isArray(value) && value.length >= 6 && value.length % 2 === 0 && value.every(coordinate);
const nameKey = (name: string) => boldTextContent(name).trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

export function positionedAnnotations(plate: AnnotatedPlate): IdentificationAnnotation[] {
  if (!Array.isArray(plate.senalados_meta)) return [];
  return plate.senalados_meta.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const marker = item as Record<string, unknown>;
    if (typeof marker.label !== 'string' || !nameKey(marker.label)) return [];
    const point = coordinate(marker.x) && coordinate(marker.y);
    if (!point && !polygon(marker.regionPoints)) return [];
    return [{
      label: boldTextContent(marker.label).trim(), x: point ? marker.x as number : null, y: point ? marker.y as number : null,
      startX: coordinate(marker.startX) && coordinate(marker.startY) ? marker.startX : null,
      startY: coordinate(marker.startX) && coordinate(marker.startY) ? marker.startY : null,
      regionPoints: polygon(marker.regionPoints) ? marker.regionPoints : null,
      regionHoles: Array.isArray(marker.regionHoles) ? marker.regionHoles.filter(polygon) : null,
      regionSmooth: marker.regionSmooth === true,
    }];
  });
}

function annotationNames(plate: AnnotatedPlate): string[] {
  const metadata = Array.isArray(plate.senalados_meta) ? plate.senalados_meta : [];
  const labels = metadata.length > 0 ? metadata.map(item => item?.label) : (Array.isArray(plate.senalados) ? plate.senalados : []);
  return labels
    .filter((label): label is string => typeof label === 'string' && Boolean(nameKey(label)))
    .map(label => boldTextContent(label).trim());
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function annotationDistractors(plate: AnnotatedPlate, correct: string, pool: AnnotatedPlate[]): string[] {
  const names = new Map<string, string>();
  const add = (name: string) => { if (nameKey(name) !== nameKey(correct) && !names.has(nameKey(name))) names.set(nameKey(name), name); };
  shuffled(annotationNames(plate)).forEach(add);
  shuffled(pool.filter(other => other.id !== plate.id && other.subtema_id === plate.subtema_id).flatMap(annotationNames)).forEach(add);
  return [...names.values()].slice(0, 3);
}

export function playableAnnotations(plate: AnnotatedPlate, pool: AnnotatedPlate[]): IdentificationAnnotation[] {
  const names = new Set(pool.filter(other => other.subtema_id === plate.subtema_id).flatMap(annotationNames).map(nameKey));
  return positionedAnnotations(plate).filter(marker => [...names].some(name => name !== nameKey(marker.label)));
}

export function eligibleAnnotationPlates<T extends AnnotatedPlate>(pool: T[]): T[] {
  const names = new Map<number, Set<string>>();
  for (const plate of pool) {
    const subtemaNames = names.get(plate.subtema_id) || new Set<string>();
    annotationNames(plate).forEach(name => subtemaNames.add(nameKey(name)));
    names.set(plate.subtema_id, subtemaNames);
  }
  return pool.filter(plate => (names.get(plate.subtema_id)?.size || 0) > 1 && positionedAnnotations(plate).length > 0);
}

export function generateAnnotationMatch<T extends AnnotatedPlate>(plates: T[], pool: AnnotatedPlate[], limit = 30): (T & { challengeAnnotation: IdentificationAnnotation })[] {
  const queues = plates.map(plate => {
    const unique = new Map<string, IdentificationAnnotation>();
    shuffled(playableAnnotations(plate, pool)).forEach(marker => unique.set(nameKey(marker.label), marker));
    return { plate, markers: shuffled([...unique.values()]), used: 0 };
  }).filter(queue => queue.markers.length > 0);
  const rounds: (T & { challengeAnnotation: IdentificationAnnotation })[] = [];
  while (rounds.length < limit) {
    const remaining = queues.filter(queue => queue.markers.length > 0);
    if (!remaining.length) break;
    const previous = rounds[rounds.length - 1];
    const previousName = previous ? nameKey(previous.challengeAnnotation.label) : '';
    const alternatives = remaining.filter(queue => queue.plate.id !== previous?.id);
    const plateCandidates = alternatives.length ? alternatives : remaining;
    const variedNames = plateCandidates.filter(queue => queue.markers.some(marker => nameKey(marker.label) !== previousName));
    const candidates = variedNames.length ? variedNames : plateCandidates;
    const leastUsed = Math.min(...candidates.map(queue => queue.used));
    const balanced = candidates.filter(queue => queue.used === leastUsed);
    const chosen = balanced[Math.floor(Math.random() * balanced.length)];
    const differentNameIndex = chosen.markers.findIndex(marker => nameKey(marker.label) !== previousName);
    const markerIndex = differentNameIndex >= 0 ? differentNameIndex : chosen.markers.length - 1;
    const [challengeAnnotation] = chosen.markers.splice(markerIndex, 1);
    chosen.used++;
    rounds.push({ ...chosen.plate, challengeAnnotation });
  }
  return rounds;
}

export function annotationQuestion(plate: AnnotatedPlate, pool: AnnotatedPlate[], selectedMarker?: IdentificationAnnotation) {
  const markers = playableAnnotations(plate, pool);
  if (!markers.length) return null;
  const marker = selectedMarker || markers[Math.floor(Math.random() * markers.length)];
  const options = shuffled([
    { id: 'annotation-correct', name: marker.label, isCorrect: true },
    ...annotationDistractors(plate, marker.label, pool).map((name, index) => ({ id: `annotation-${index}`, name, isCorrect: false })),
  ]);
  return { marker, options };
}
