import type { MarkerLocation } from '../components/PlateAnnotationViewerEditor';

export type InstructorQuestionType = 'single_choice' | 'short_answer' | 'completion' | 'matching' | 'image_point' | 'image_versus';
export const INSTRUCTOR_QUESTION_TYPES: { value: InstructorQuestionType; label: string }[] = [
  { value: 'single_choice', label: 'Selección única' },
  { value: 'short_answer', label: 'Respuesta breve' },
  { value: 'completion', label: 'Completación' },
  { value: 'matching', label: 'Términos pareados' },
  { value: 'image_point', label: 'Señalar en imagen' },
  { value: 'image_versus', label: 'Versus de imágenes' },
];
export type InstructorOption = { id: string; texto: string };
export type InstructorSection = { id: string; tema_id: number; nombre: string; position?: number };
export type InstructorSectionResult = InstructorSection & { correct: number; total: number; pending_review: number; percentage: number | null };
export type InstructorQuestionGroup = { id: string; titulo: string; item_ids: string[]; section_id?: string };
export type PublicInstructorGroup = { id: string; titulo: string; position: number; section?: InstructorSection };
type BaseQuestion = { id: string; titulo: string };
// Las preguntas históricas sin type siguen siendo de selección única.
export type ChoiceQuestion = BaseQuestion & { type?: 'single_choice'; options: InstructorOption[]; correct_option_id: string; image?: InstructorReferenceImage };
export type InstructorImageAnnotation = MarkerLocation & { label: string };
export type InstructorReferenceImage = { url: string; source: 'upload' | 'catalog'; plate_id?: number; annotations?: InstructorImageAnnotation[] };
export type ShortQuestion = BaseQuestion & { type: 'short_answer'; accepted_answers: string[]; image?: InstructorReferenceImage };
export type CompletionQuestion = BaseQuestion & { type: 'completion'; blanks: { id: string; accepted_answers: string[] }[]; image?: InstructorReferenceImage };
export type MatchingQuestion = BaseQuestion & { type: 'matching'; pairs: { id: string; term: string; definition: string; option_id: string }[]; image?: InstructorReferenceImage };
export type PointQuestion = BaseQuestion & { type: 'image_point'; image?: InstructorReferenceImage };
export type VersusQuestion = BaseQuestion & { type: 'image_versus'; image_a?: InstructorReferenceImage; image_b?: InstructorReferenceImage };
export type InstructorPointCoordinate = { x: number; y: number; text?: string };
export type InstructorPointAnswer = InstructorPointCoordinate | InstructorPointCoordinate[];
export type InstructorQuestion = ChoiceQuestion | ShortQuestion | CompletionQuestion | MatchingQuestion | PointQuestion | VersusQuestion;
export type PublicInstructorImage = { url: string; annotations?: InstructorImageAnnotation[] };
export type PublicInstructorQuestion = (
  | (BaseQuestion & { type?: 'single_choice'; options: InstructorOption[]; image?: PublicInstructorImage })
  | (BaseQuestion & { type: 'short_answer'; image?: PublicInstructorImage })
  | (BaseQuestion & { type: 'completion'; blanks: { id: string }[]; image?: PublicInstructorImage })
  | (BaseQuestion & { type: 'matching'; terms: InstructorOption[]; choices: InstructorOption[]; image?: PublicInstructorImage })
  | (BaseQuestion & { type: 'image_point'; image: { url: string } })
  | (BaseQuestion & { type: 'image_versus'; image_a: PublicInstructorImage; image_b: PublicInstructorImage })
) & { group?: PublicInstructorGroup };
export type InstructorAnswers = Record<string, string | Record<string, string> | InstructorPointAnswer>;
export type InstructorSubmissionSnapshot = { nombre: string; scoring_version?: number; review_guides?: Record<string, string[]>; questions: PublicInstructorQuestion[] };
export function isInstructorGradedQuestion(question: { type?: InstructorQuestionType }): boolean {
  return question.type !== 'image_versus';
}
export function requiresInstructorReview(snapshot: InstructorSubmissionSnapshot, question: PublicInstructorQuestion): boolean {
  return question.type === 'image_point' || (snapshot.scoring_version === 2 && question.type === 'short_answer');
}
export function instructorIncisoWeight(snapshot: InstructorSubmissionSnapshot, question: PublicInstructorQuestion): number {
  if (!isInstructorGradedQuestion(question)) return 0;
  if (snapshot.scoring_version !== 2) return 1;
  const groupId = question.group?.id ?? question.id;
  const gradedCount = snapshot.questions.filter(q => isInstructorGradedQuestion(q) && (q.group?.id ?? q.id) === groupId).length;
  return gradedCount > 0 ? 1 / gradedCount : 0;
}
export function instructorReviewPoints(snapshot: InstructorSubmissionSnapshot, reviews: Record<string, boolean>): number {
  return snapshot.questions.reduce((sum, question) => sum + (requiresInstructorReview(snapshot, question) && reviews[question.id] === true ? instructorIncisoWeight(snapshot, question) : 0), 0);
}
export const formatInstructorPoints = (points: number): string => Number(points.toFixed(4)).toString();
export function instructorSectionResults(snapshot: InstructorSubmissionSnapshot, autoResults: Record<string, boolean>, reviews: Record<string, boolean>): InstructorSectionResult[] {
  const sections = new Map<string, InstructorSectionResult & { groups: Set<string> }>();
  snapshot.questions.forEach(question => {
    if (!isInstructorGradedQuestion(question)) return;
    const section = question.group?.section; if (!section) return;
    if (!sections.has(section.id)) sections.set(section.id, { ...section, correct: 0, total: 0, pending_review: 0, percentage: null, groups: new Set() });
    const result = sections.get(section.id)!; result.groups.add(question.group!.id);
    const manual = requiresInstructorReview(snapshot, question);
    if (manual && !(question.id in reviews)) result.pending_review++;
    if ((manual ? reviews : autoResults)[question.id] === true) result.correct += instructorIncisoWeight(snapshot, question);
  });
  return [...sections.values()].map(({ groups, ...result }) => ({ ...result, total: groups.size, percentage: result.pending_review ? null : Math.round(10000 * result.correct / groups.size) / 100 }));
}
function isPointCoordinate(value: unknown): value is InstructorPointCoordinate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const point = value as InstructorPointCoordinate;
  const validCoords = [point.x, point.y].every(coordinate => typeof coordinate === 'number' && Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1);
  const validText = point.text === undefined || (typeof point.text === 'string' && point.text.length <= 1000);
  return validCoords && validText;
}
export function getInstructorPointCoordinates(value: unknown): InstructorPointCoordinate[] {
  if (isPointCoordinate(value)) return [value];
  if (Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every(isPointCoordinate)) return value;
  return [];
}
export function isInstructorPointAnswer(value: unknown): value is InstructorPointAnswer {
  return getInstructorPointCoordinates(value).length > 0;
}

export function instructorGroups(content: { questions: InstructorQuestion[]; groups?: InstructorQuestionGroup[] }): InstructorQuestionGroup[] {
  return content.groups ?? content.questions.map(q => ({ id: `legacy-${q.id}`, titulo: '', item_ids: [q.id] }));
}

export function newInstructorGroup(): InstructorQuestionGroup {
  return { id: crypto.randomUUID(), titulo: '', item_ids: [] };
}

export function incisoLetter(index: number): string {
  let number = index + 1;
  let text = '';
  while (number > 0) { number--; text = String.fromCharCode(97 + number % 26) + text; number = Math.floor(number / 26); }
  return text;
}

export function groupPublicInstructorQuestions(questions: PublicInstructorQuestion[]) {
  const groups = new Map<string, { id: string; titulo: string; position: number; section?: InstructorSection; items: PublicInstructorQuestion[]; grouped: boolean }>();
  questions.forEach((q, index) => {
    const id = q.group?.id ?? `legacy-${q.id}`;
    if (!groups.has(id)) groups.set(id, { id, titulo: q.group?.titulo ?? '', position: q.group?.position ?? index + 1, section: q.group?.section, items: [], grouped: !!q.group });
    groups.get(id)!.items.push(q);
  });
  return [...groups.values()].sort((a, b) => (a.section?.position ?? 1000) - (b.section?.position ?? 1000) || a.position - b.position);
}

export function newInstructorQuestion(type: InstructorQuestionType = 'single_choice'): InstructorQuestion {
  const base = { id: crypto.randomUUID(), titulo: '' };
  if (type === 'short_answer') return { ...base, type, accepted_answers: [''] };
  if (type === 'image_point') return { ...base, type };
  if (type === 'image_versus') return { ...base, type };
  if (type === 'completion') return { ...base, type, titulo: '{{1}}', blanks: [{ id: crypto.randomUUID(), accepted_answers: [''] }] };
  if (type === 'matching') return { ...base, type, pairs: [0, 1].map(() => ({ id: crypto.randomUUID(), option_id: crypto.randomUUID(), term: '', definition: '' })) };
  return { ...base, type, correct_option_id: '', options: [0, 1, 2, 3].map(() => ({ id: crypto.randomUUID(), texto: '' })) };
}

export function isInstructorAnswerComplete(question: PublicInstructorQuestion, answer: InstructorAnswers[string] | undefined): boolean {
  if (question.type === 'image_versus') return true;
  if (question.type === 'image_point') {
    const points = getInstructorPointCoordinates(answer);
    return points.length > 0 && points.every(point => typeof point.text === 'string' && point.text.trim().length > 0);
  }
  if (question.type === 'completion' || question.type === 'matching') {
    if (!answer || typeof answer !== 'object' || isInstructorPointAnswer(answer)) return false;
    return question.type === 'completion'
      ? question.blanks.every(blank => typeof answer[blank.id] === 'string' && !!answer[blank.id].trim())
      : question.terms.every(term => question.choices.some(choice => choice.id === answer[term.id]))
        && new Set(question.terms.map(term => answer[term.id])).size === question.terms.length;
  }
  return typeof answer === 'string' && !!answer.trim();
}

export function hasInstructorQuestionResponses(question: InstructorQuestion): boolean {
  if (question.type === 'image_versus') return !!question.image_a || !!question.image_b;
  if (question.type === 'image_point') return !!question.image;
  if (question.type === 'short_answer') return !!question.image || question.accepted_answers.some(s => !!s.trim());
  if (question.type === 'completion') return !!question.image || question.blanks.some(b => b.accepted_answers.some(s => !!s.trim()));
  if (question.type === 'matching') return !!question.image || question.pairs.some(p => !!p.term.trim() || !!p.definition.trim());
  return !!question.image || !!question.correct_option_id || question.options.some(o => !!o.texto.trim());
}
