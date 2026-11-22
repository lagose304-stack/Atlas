import { supabase } from './supabase';
import { expandInstructorVersus, instructorGroups, instructorVersusPrompts } from '../types/instructorQuestions';
import type { InstructorQuestion, PublicInstructorQuestion, InstructorAnswers, InstructorQuestionGroup, InstructorSubmissionSnapshot, InstructorSection, InstructorSectionResult, VersusQuestion } from '../types/instructorQuestions';
export { newInstructorQuestion } from '../types/instructorQuestions';
export type { InstructorQuestion, InstructorOption } from '../types/instructorQuestions';

export type InstructorContent = {
  nombre: string;
  instrucciones: string;
  questions: InstructorQuestion[];
  groups?: InstructorQuestionGroup[];
  sections?: InstructorSection[];
  schedule?: { opens_at: string; closes_at: string };
  mode?: 'bank';
  questions_per_topic?: number;
};
export type InstructorSummary = {
  id: string;
  nombre: string;
  estado: 'borrador' | 'publicada';
  revision: number;
  published_revision: number | null;
  can_delete_draft?: boolean;
  mode?: 'bank' | 'legacy';
  legacy_question_count?: number;
};
export type InstructorBankContent = { groups: InstructorQuestionGroup[]; questions: InstructorQuestion[] };
export type InstructorBankSummary = { tema_id: number; question_count: number; inciso_count: number; has_incomplete?: boolean; revision: number; updated_at?: string | null };
export type InstructorBankTopic = { tema_id: number; content: InstructorBankContent; revision: number };
function collapseInstructorVersus<T extends InstructorContent | InstructorBankContent>(content: T): T {
  const byId = new Map(content.questions.map(question => [question.id, question]));
  const nestedIds = new Set<string>();
  const versusById = new Map<string, VersusQuestion>();
  for (const group of instructorGroups(content)) {
    const items = group.item_ids.flatMap(id => byId.get(id) ?? []);
    items.forEach((item, index) => {
      if (item.type !== 'image_versus') return;
      const prompts = instructorVersusPrompts(items, index);
      if (!prompts) return;
      [...prompts.a, ...prompts.b].forEach(prompt => nestedIds.add(prompt.id));
      const extract = ({ id, titulo }: InstructorQuestion) => ({ id, titulo });
      versusById.set(item.id, {
        ...item, prompts: {
          a: extract(prompts.a[0]),
          b: extract(prompts.b[0]),
        },
      });
    });
  }
  if (!nestedIds.size) return content;
  return {
    ...content,
    questions: content.questions.filter(question => !nestedIds.has(question.id)).map(question => versusById.get(question.id) ?? question),
    groups: content.groups?.map(group => ({ ...group, item_ids: group.item_ids.filter(id => !nestedIds.has(id)) })),
  };
}
export type InstructorEditor = Omit<InstructorSummary, 'nombre'> & { content: InstructorContent; has_code: boolean };
export type PublicInstructorSummary = { id: string; nombre: string; instrucciones: string; question_count: number; inciso_count?: number | null; opens_at?: string | null; closes_at?: string | null; server_time?: string; availability?: 'open' | 'scheduled' | 'closed' };
export type PublicInstructorContent = Omit<InstructorContent, 'questions'> & {
  questions: PublicInstructorQuestion[];
};
export type InstructorResult = { ok: true; correct: number; total: number; percentage: number | null; pending_review?: number; submission_id?: string; sections?: InstructorSectionResult[] };
export type InstructorUnlock = { ok: true; token: string; test: PublicInstructorContent } |
{ ok: false; status: 'invalid_code' | 'locked' | 'unavailable' | 'outside_schedule' };
export type InstructorGrade = InstructorResult | { ok: false; status: 'expired' | 'unavailable' };

export const isSixDigitCode = (value: string) => /^[0-9]{6}$/.test(value);

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('El sistema de pruebas de instructores todavía no está habilitado en la base de datos.');
    }
    if (error.code === '42501') throw new Error('Tu sesión ya no tiene permiso para administrar estas pruebas.');
    if (error.code === '40001') throw new Error('Otra persona modificó esta prueba. Vuelve a abrirla antes de guardar.');
    if (error.code === 'P0001') throw new Error(error.message);
    throw new Error('No se pudo completar la operación. Comprueba tu conexión e inténtalo de nuevo.');
  }
  if (data === null || data === undefined) throw new Error('No se pudo confirmar la respuesta del servidor.');
  return data as T;
}

export const listInstructorTests = () => rpc<InstructorSummary[]>('atlas_list_instructor_tests');
export const getInstructorTest = async (id: string) => {
  const test = await rpc<InstructorEditor>('atlas_get_instructor_test', { p_id: id });
  return { ...test, content: collapseInstructorVersus(test.content) };
};
export const saveInstructorTest = (test: InstructorEditor | null, content: InstructorContent, code: string) => {
  if (code && !isSixDigitCode(code)) return Promise.reject(new Error('El código debe tener exactamente 6 dígitos.'));
  return rpc<InstructorEditor>('atlas_save_instructor_test', {
    p_id: test?.id ?? null, p_revision: test?.revision ?? null, p_content: expandInstructorVersus(content), p_code: code || null,
  }).then(saved => ({ ...saved, content: collapseInstructorVersus(saved.content) }));
};
export const publishInstructorTest = (test: Pick<InstructorSummary, 'id' | 'revision'>, publish: boolean) => rpc<InstructorEditor>(
  'atlas_publish_instructor_test', { p_id: test.id, p_revision: test.revision, p_publish: publish },
).then(saved => ({ ...saved, content: collapseInstructorVersus(saved.content) }));
export const deleteInstructorDraft = (test: Pick<InstructorSummary, 'id' | 'revision'>) => rpc<{ ok: true }>(
  'atlas_delete_instructor_draft', { p_id: test.id, p_revision: test.revision },
);
export const publicInstructorTests = () => rpc<PublicInstructorSummary[]>('atlas_public_instructor_tests');
export const unlockInstructorTest = (id: string, code: string) => {
  if (!isSixDigitCode(code)) return Promise.reject(new Error('Escribe los 6 dígitos del código.'));
  return rpc<InstructorUnlock>('atlas_unlock_instructor_test', { p_id: id, p_code: code });
};
export const gradeInstructorTest = (id: string, token: string, answers: InstructorAnswers) => rpc<InstructorGrade>(
  'atlas_grade_instructor_test', { p_id: id, p_token: token, p_answers: answers },
);
export const isInstructorAccount = (account: string) => /^[0-9]{10,13}$/.test(account);
export type InstructorProgress = { ok: true; participant_name: string; account_number: string; answers: InstructorAnswers; current_question_id: string | null; progress_revision: number; questions?: PublicInstructorQuestion[] };
export type InstructorRecovery = InstructorProgress | { ok: false; status: 'not_found' | 'locked' | 'submitted' | 'version_changed' };
export const startInstructorTest = (id: string, token: string, name: string, account: string) => rpc<InstructorProgress>('atlas_begin_instructor_test', { p_id: id, p_token: token, p_name: name, p_account: account });
export const resumeInstructorTest = (id: string, token: string, account: string) => rpc<InstructorRecovery>('atlas_resume_instructor_test', { p_id: id, p_token: token, p_account: account });
export const saveInstructorProgress = (id: string, token: string, revision: number, answers: InstructorAnswers, questionId: string | null) => rpc<{ ok: true; progress_revision: number }>('atlas_save_instructor_progress', { p_id: id, p_token: token, p_revision: revision, p_answers: answers, p_current_question_id: questionId });

export type InstructorSubmissionSummary = { id: string; participant_name: string | null; account_number?: string | null; created_at: string; test_revision: number; total: number; pending_review: number; revision: number; correct: number; percentage: number | null };
export type InstructorSubmission = {
  id: string; participant_name: string | null; account_number?: string | null; test_id: string; test_revision: number; snapshot: InstructorSubmissionSnapshot;
  answers: InstructorAnswers; reviews: Record<string, boolean>; auto_results?: Record<string, boolean>; revision: number; created_at: string; auto_correct: number; total: number
};
export const listInstructorSubmissions = (testId: string, offset = 0) => rpc<InstructorSubmissionSummary[]>('atlas_list_instructor_submissions', { p_test_id: testId, p_offset: offset });
export const getInstructorSubmission = (id: string) => rpc<InstructorSubmission>('atlas_get_instructor_submission', { p_id: id });
export const reviewInstructorSubmission = (submission: InstructorSubmission, reviews: Record<string, boolean>) => rpc<InstructorSubmission>('atlas_review_instructor_submission', { p_id: submission.id, p_revision: submission.revision, p_reviews: reviews });
export const deleteInstructorSubmission = (testId: string, submission: Pick<InstructorSubmissionSummary, 'id' | 'revision'>) => rpc<{ ok: true }>('atlas_delete_instructor_submission', { p_test_id: testId, p_id: submission.id, p_revision: submission.revision });
export type InstructorParticipantResult = { ok: true; participant_name: string; account_number: string; created_at: string; snapshot: InstructorSubmissionSnapshot; answers: InstructorAnswers; auto_results: Record<string, boolean>; reviews: Record<string, boolean>; result: InstructorResult };
export const getInstructorParticipantResult = (id: string, code: string, account: string) => rpc<InstructorParticipantResult | { ok: false; status: 'unavailable' | 'locked' | 'pending' }>('atlas_instructor_participant_result', { p_id: id, p_code: code, p_account: account });

export const listInstructorBank = () => rpc<InstructorBankSummary[]>('atlas_list_instructor_bank');
export const getInstructorBankTopic = (temaId: number) => rpc<InstructorBankTopic>('atlas_get_instructor_bank_topic', { p_tema_id: temaId })
  .then(topic => ({ ...topic, content: collapseInstructorVersus(topic.content) }));
export const saveInstructorBankTopic = (temaId: number, revision: number | null, content: InstructorBankContent) => rpc<InstructorBankTopic>('atlas_save_instructor_bank_topic', { p_tema_id: temaId, p_revision: revision, p_content: expandInstructorVersus(content) })
  .then(topic => ({ ...topic, content: collapseInstructorVersus(topic.content) }));
export const migrateInstructorQuestionToBank = (testId: string, testRevision: number, groupId: string, temaId: number) => rpc<{ test: InstructorEditor; bank: InstructorBankTopic }>('atlas_migrate_instructor_question_to_bank', { p_test_id: testId, p_test_revision: testRevision, p_group_id: groupId, p_tema_id: temaId })
  .then(({ test, bank }) => ({ test: { ...test, content: collapseInstructorVersus(test.content) }, bank: { ...bank, content: collapseInstructorVersus(bank.content) } }));
