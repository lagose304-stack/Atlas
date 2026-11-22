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
type SingleImageQuestion = BaseQuestion & { image?: InstructorReferenceImage; alternate_image?: InstructorReferenceImage };
// Las preguntas históricas sin type siguen siendo de selección única.
export type ChoiceQuestion = SingleImageQuestion & { type?: 'single_choice'; options: InstructorOption[]; correct_option_id: string; correct_option_ids?: string[]; multiple?: boolean };
export type InstructorImageAnnotation = MarkerLocation & { label: string };
export type InstructorReferenceImage = { url: string; source: 'upload' | 'catalog'; plate_id?: number; annotations?: InstructorImageAnnotation[] };
export type ShortQuestion = SingleImageQuestion & { type: 'short_answer'; accepted_answers: string[] };
export type CompletionQuestion = SingleImageQuestion & { type: 'completion'; blanks: { id: string; accepted_answers: string[] }[]; review_reference?: string };
export type MatchingQuestion = SingleImageQuestion & {
  type: 'matching';
  pairs: { id: string; term: string; definition: string; option_id: string }[];
  distractors?: InstructorOption[];
};
export const MAX_INSTRUCTOR_MATCHING_DISTRACTORS = 20;
export type PointQuestion = SingleImageQuestion & { type: 'image_point' };
export type InstructorVersusPlate = 'a' | 'b';
export type InstructorVersusPrompt = { id: string; titulo: string };
export type VersusQuestion = BaseQuestion & {
  type: 'image_versus';
  image_a?: InstructorReferenceImage;
  image_b?: InstructorReferenceImage;
  prompts?: Record<InstructorVersusPlate, InstructorVersusPrompt>;
};
export const INSTRUCTOR_VERSUS_PLATES = ['a', 'b'] as const;
export function newInstructorVersusPrompts(): NonNullable<VersusQuestion['prompts']> {
  const prompt = (plate: InstructorVersusPlate) => ({
    id: `versus-${plate}1-${crypto.randomUUID()}`, titulo: '',
  });
  return { a: prompt('a'), b: prompt('b') };
}

// Los incisos breves siguen al Versus tanto en el banco como en la entrega.
export function instructorVersusPrompts<T extends BaseQuestion & { type?: InstructorQuestionType }>(
  items: T[], index: number,
): Record<InstructorVersusPlate, [T, ...T[]]> | undefined {
  if (items[index]?.type !== 'image_versus') return;
  const [first, second, third, fourth] = items.slice(index + 1, index + 5);
  const matches = (item: T | undefined, slot: string) => item?.type === 'short_answer' && item.id.startsWith(`versus-${slot}-`);
  if (!matches(first, 'a1')) return;
  if (matches(second, 'b1')) return { a: [first], b: [second] };
  // Conserva el detalle de intentos que ya se hubieran asignado con cuatro incisos.
  if (matches(second, 'a2') && matches(third, 'b1') && matches(fourth, 'b2')) {
    return { a: [first, second], b: [third, fourth] };
  }
}
export function instructorVersusParts(items: PublicInstructorQuestion[]) {
  const byQuestion = new Map<string, NonNullable<ReturnType<typeof instructorVersusPrompts<PublicInstructorQuestion>>>>();
  const byPrompt = new Map<string, { plate: InstructorVersusPlate; number: number }>();
  items.forEach((item, index) => {
    if (item.type !== 'image_versus') return;
    const prompts = instructorVersusPrompts(items, index);
    if (!prompts || [...prompts.a, ...prompts.b].some(prompt => prompt.group?.id !== item.group?.id)) return;
    byQuestion.set(item.id, prompts);
    INSTRUCTOR_VERSUS_PLATES.forEach(plate => prompts[plate].forEach((prompt, i) => {
      byPrompt.set(prompt.id, { plate, number: i + 1 });
    }));
  });
  return { byQuestion, byPrompt };
}
export type InstructorPointCoordinate = { x: number; y: number; text?: string };
export type InstructorPointAnswer = InstructorPointCoordinate | InstructorPointCoordinate[];
export type InstructorQuestion = ChoiceQuestion | ShortQuestion | CompletionQuestion | MatchingQuestion | PointQuestion | VersusQuestion;
export type PublicInstructorImage = { url: string; annotations?: InstructorImageAnnotation[] };
export type PublicInstructorQuestion = (
  | (BaseQuestion & { type?: 'single_choice'; options: InstructorOption[]; multiple?: boolean; image?: PublicInstructorImage })
  | (BaseQuestion & { type: 'short_answer'; image?: PublicInstructorImage })
  | (BaseQuestion & { type: 'completion'; blanks: { id: string }[]; image?: PublicInstructorImage })
  | (BaseQuestion & { type: 'matching'; terms: InstructorOption[]; choices: InstructorOption[]; image?: PublicInstructorImage })
  | (BaseQuestion & { type: 'image_point'; image: { url: string } })
  | (BaseQuestion & { type: 'image_versus'; image_a: PublicInstructorImage; image_b: PublicInstructorImage })
) & { group?: PublicInstructorGroup };
export type InstructorAnswers = Record<string, string | string[] | Record<string, string> | InstructorPointAnswer>;
export type InstructorCompletionReviewGuide = { blanks: Record<string, string[]>; reference?: string };
export type InstructorSubmissionSnapshot = { nombre: string; scoring_version?: number; review_guides?: Record<string, string[] | InstructorCompletionReviewGuide>; questions: PublicInstructorQuestion[] };
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

export function instructorStoredIncisoCount(questions: InstructorQuestion[]): number {
  return questions.reduce((total, question) => total + (question.type === 'image_versus' && question.prompts ? 3 : 1), 0);
}

export function expandInstructorVersus<T extends { questions: InstructorQuestion[]; groups?: InstructorQuestionGroup[] }>(content: T): T {
  const responses = new Map<string, InstructorQuestion[]>();
  for (const question of content.questions) {
    if (question.type !== 'image_versus' || !question.prompts) continue;
    responses.set(question.id, [question.prompts.a, question.prompts.b].map(prompt => ({
      ...prompt, type: 'short_answer', accepted_answers: [''],
    })));
  }
  if (!responses.size) return content;
  return {
    ...content,
    questions: content.questions.flatMap(question => {
      if (question.type !== 'image_versus' || !question.prompts) return [question];
      const { prompts: _prompts, ...versus } = question;
      return [versus, ...responses.get(question.id)!];
    }),
    groups: instructorGroups(content).map(group => ({
      ...group, item_ids: group.item_ids.flatMap(id => [id, ...(responses.get(id) ?? []).map(response => response.id)]),
    })),
  };
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

export function groupPublicInstructorQuestions(questions: PublicInstructorQuestion[], showTopics = true) {
  const groups = new Map<string, { id: string; titulo: string; position: number; section?: InstructorSection; items: PublicInstructorQuestion[]; grouped: boolean }>();
  questions.forEach((q, index) => {
    const id = q.group?.id ?? `legacy-${q.id}`;
    if (!groups.has(id)) groups.set(id, { id, titulo: q.group?.titulo ?? '', position: q.group?.position ?? index + 1, section: showTopics ? q.group?.section : undefined, items: [], grouped: !!q.group });
    groups.get(id)!.items.push(q);
  });
  return [...groups.values()].sort((a, b) => (a.section?.position ?? 1000) - (b.section?.position ?? 1000) || a.position - b.position);
}

export function newInstructorQuestion(type: InstructorQuestionType = 'single_choice'): InstructorQuestion {
  const base = { id: crypto.randomUUID(), titulo: '' };
  if (type === 'short_answer') return { ...base, type, accepted_answers: [''] };
  if (type === 'image_point') return { ...base, type };
  if (type === 'image_versus') return { ...base, type, prompts: newInstructorVersusPrompts() };
  if (type === 'completion') return { ...base, type, titulo: '{{1}}', blanks: [{ id: crypto.randomUUID(), accepted_answers: [''] }] };
  if (type === 'matching') return { ...base, type, pairs: [0, 1].map(() => ({ id: crypto.randomUUID(), option_id: crypto.randomUUID(), term: '', definition: '' })) };
  return { ...base, type, correct_option_id: '', options: [0, 1, 2, 3].map(() => ({ id: crypto.randomUUID(), texto: '' })) };
}

export function changeInstructorQuestionFormat(question: InstructorQuestion, type: InstructorQuestionType): InstructorQuestion {
  if ((question.type ?? 'single_choice') === type) return question;
  const next = newInstructorQuestion(type);
  const id = question.id;
  const titulo = question.titulo || next.titulo;
  if (next.type === 'image_versus') {
    if (question.type === 'image_versus') return question;
    return { ...next, id, titulo, image_a: question.image, image_b: question.alternate_image };
  }
  if (question.type === 'image_versus') {
    return { ...next, id, titulo, image: question.image_a ?? question.image_b,
      alternate_image: question.image_a ? question.image_b : undefined };
  }
  return { ...next, id, titulo, image: question.image, alternate_image: question.alternate_image };
}

export function instructorQuestionImageUrls(question: InstructorQuestion): string[] {
  const images = question.type === 'image_versus'
    ? [question.image_a, question.image_b]
    : [question.image, question.alternate_image];
  return images.flatMap(image => image ? [image.url] : []);
}

export function replaceInstructorQuestionImageUrl(question: InstructorQuestion, from: string, to: string): InstructorQuestion {
  const replace = (image?: InstructorReferenceImage) => image?.url === from ? { ...image, url: to } : image;
  if (!instructorQuestionImageUrls(question).includes(from)) return question;
  return question.type === 'image_versus'
    ? { ...question, image_a: replace(question.image_a), image_b: replace(question.image_b) }
    : { ...question, image: replace(question.image), alternate_image: replace(question.alternate_image) };
}

export function isInstructorMultipleChoiceAnswer(answer: unknown): answer is string[] {
  return Array.isArray(answer) && answer.every(option => typeof option === 'string');
}

export function instructorChoiceAnswerText(options: InstructorOption[], answer: InstructorAnswers[string] | undefined): string {
  const ids = typeof answer === 'string' ? [answer] : isInstructorMultipleChoiceAnswer(answer) ? answer : [];
  return options
    .map((option, index) => {
      const letter = incisoLetter(index).toUpperCase();
      const text = option.texto.replace(/^[A-Za-z][.)]\s*/, '');
      return { id: option.id, label: `${letter}. ${text}` };
    })
    .filter(item => ids.includes(item.id))
    .map(item => item.label)
    .join(' · ');
}

export function isInstructorAnswerComplete(question: PublicInstructorQuestion, answer: InstructorAnswers[string] | undefined): boolean {
  if (question.type === 'image_versus') return true;
  if (question.type === 'image_point') {
    const points = getInstructorPointCoordinates(answer);
    return points.length > 0 && points.every(point => typeof point.text === 'string' && point.text.trim().length > 0);
  }
  if (question.type === 'completion' || question.type === 'matching') {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer) || isInstructorPointAnswer(answer)) return false;
    return question.type === 'completion'
      ? question.blanks.every(blank => typeof answer[blank.id] === 'string' && !!answer[blank.id].trim())
      : question.terms.every(term => question.choices.some(choice => choice.id === answer[term.id]));
  }
  if ((!question.type || question.type === 'single_choice') && question.multiple) {
    return isInstructorMultipleChoiceAnswer(answer) && answer.length > 0 && new Set(answer).size === answer.length
      && answer.every(id => question.options.some(option => option.id === id));
  }
  return typeof answer === 'string' && !!answer.trim();
}

export function hasInstructorQuestionResponses(question: InstructorQuestion): boolean {
  if (question.type === 'image_versus') return !!question.prompts && Object.values(question.prompts).some(prompt => !!prompt.titulo.trim());
  if (question.type === 'image_point') return false;
  if (question.type === 'short_answer') return question.accepted_answers.some(s => !!s.trim());
  if (question.type === 'completion') return !!question.review_reference?.trim()
    || question.blanks.some(b => b.accepted_answers.some(s => !!s.trim()));
  if (question.type === 'matching') return question.pairs.some(p => !!p.term.trim() || !!p.definition.trim())
    || !!question.distractors?.some(option => option.texto.trim());
  return !!question.correct_option_id || !!question.correct_option_ids?.length || question.options.some(o => !!o.texto.trim());
}

export function getInstructorQuestionMissingReasons(question: InstructorQuestion): string[] {
  const reasons: string[] = [];

  if (question.type === 'image_versus') {
    if (!question.image_a?.url) reasons.push('Falta la imagen A');
    if (!question.image_b?.url) reasons.push('Falta la imagen B');
    return reasons;
  }

  if (question.type === 'image_point') {
    if (!question.image?.url) reasons.push('Falta la imagen de referencia');
    return reasons;
  }

  if (question.type === 'short_answer') {
    const answers = question.accepted_answers ?? [];
    if (!answers.some(a => !!a?.trim())) {
      reasons.push('Agrega al menos una respuesta aceptada');
    }
    return reasons;
  }

  if (question.type === 'completion') {
    const blanks = question.blanks ?? [];
    if (blanks.length === 0) {
      reasons.push('Agrega al menos un hueco o espacio');
    } else if (blanks.some(b => !b.accepted_answers?.some(a => !!a?.trim()))) {
      reasons.push('Cada hueco debe tener al menos una respuesta aceptada');
    }
    return reasons;
  }

  if (question.type === 'matching') {
    const pairs = question.pairs ?? [];
    if (pairs.length < 2) {
      reasons.push('Configura al menos 2 parejas');
    } else if (pairs.some(p => !p.term?.trim() || !p.definition?.trim())) {
      reasons.push('Completa el término y su pareja en todas las filas');
    }
    if (question.distractors?.some(d => !d.texto?.trim())) {
      reasons.push('Hay opciones incorrectas con texto vacío');
    }
    return reasons;
  }

  const choice = question as ChoiceQuestion;
  const opts = choice.options ?? [];
  if (opts.length < 2) {
    reasons.push('Se requieren al menos 2 opciones');
  } else if (opts.some(o => !o.texto?.trim())) {
    reasons.push('Hay opciones con texto vacío');
  }

  if (choice.multiple || choice.correct_option_ids !== undefined) {
    const selected = choice.correct_option_ids ?? [];
    if (selected.length === 0) {
      reasons.push('Selecciona al menos una respuesta correcta');
    } else if (!selected.every(id => opts.some(o => o.id === id))) {
      reasons.push('Hay respuestas correctas que no coinciden con las opciones');
    }
  } else {
    if (!choice.correct_option_id || !opts.some(o => o.id === choice.correct_option_id)) {
      reasons.push('Selecciona la respuesta correcta');
    }
  }
  return reasons;
}

export function isInstructorQuestionIncomplete(question: InstructorQuestion): boolean {
  return getInstructorQuestionMissingReasons(question).length > 0;
}

export function isInstructorGroupIncomplete(group: InstructorQuestionGroup, questions: InstructorQuestion[]): boolean {
  if (!group.item_ids || group.item_ids.length === 0) return true;
  const byId = new Map(questions.map(q => [q.id, q]));
  return group.item_ids.some(id => {
    const q = byId.get(id);
    return !q || isInstructorQuestionIncomplete(q);
  });
}

export function isInstructorContentIncomplete(content: { groups?: InstructorQuestionGroup[]; questions: InstructorQuestion[] }): boolean {
  const groups = instructorGroups(content);
  if (groups.length === 0) return false;
  return groups.some(g => isInstructorGroupIncomplete(g, content.questions));
}
