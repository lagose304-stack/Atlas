import { supabase } from './supabase';
import type { InstructorQuestion, PublicInstructorQuestion, InstructorAnswers, InstructorQuestionGroup, InstructorSubmissionSnapshot, InstructorSection, InstructorSectionResult } from '../types/instructorQuestions';
export { newInstructorQuestion } from '../types/instructorQuestions';
export type { InstructorQuestion, InstructorOption } from '../types/instructorQuestions';

export type InstructorContent = { nombre: string; instrucciones: string; questions: InstructorQuestion[]; groups?: InstructorQuestionGroup[]; sections?: InstructorSection[] };
export type InstructorSummary = { id: string; nombre: string; estado: 'borrador' | 'publicada'; revision: number; published_revision: number | null };
export type InstructorEditor = Omit<InstructorSummary, 'nombre'> & { content: InstructorContent; has_code: boolean };
export type PublicInstructorSummary = { id: string; nombre: string; instrucciones: string; question_count: number; inciso_count?: number | null };
export type PublicInstructorContent = Omit<InstructorContent, 'questions'> & {
  questions: PublicInstructorQuestion[];
};
export type InstructorResult = { ok: true; correct: number; total: number; percentage: number | null; pending_review?: number; submission_id?: string; sections?: InstructorSectionResult[] };
export type InstructorUnlock = { ok: true; token: string; test: PublicInstructorContent } |
  { ok: false; status: 'invalid_code' | 'locked' | 'unavailable' };
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
export const getInstructorTest = (id: string) => rpc<InstructorEditor>('atlas_get_instructor_test', { p_id: id });
export const saveInstructorTest = (test: InstructorEditor | null, content: InstructorContent, code: string) => {
  if (code && !isSixDigitCode(code)) return Promise.reject(new Error('El código debe tener exactamente 6 dígitos.'));
  return rpc<InstructorEditor>('atlas_save_instructor_test', {
    p_id: test?.id ?? null, p_revision: test?.revision ?? null, p_content: content, p_code: code || null,
  });
};
export const publishInstructorTest = (test: Pick<InstructorSummary, 'id' | 'revision'>, publish: boolean) => rpc<InstructorEditor>(
  'atlas_publish_instructor_test', { p_id: test.id, p_revision: test.revision, p_publish: publish },
);
export const publicInstructorTests = () => rpc<PublicInstructorSummary[]>('atlas_public_instructor_tests');
export const unlockInstructorTest = (id: string, code: string) => {
  if (!isSixDigitCode(code)) return Promise.reject(new Error('Escribe los 6 dígitos del código.'));
  return rpc<InstructorUnlock>('atlas_unlock_instructor_test', { p_id: id, p_code: code });
};
export const gradeInstructorTest = (id: string, token: string, answers: InstructorAnswers) => rpc<InstructorGrade>(
  'atlas_grade_instructor_test', { p_id: id, p_token: token, p_answers: answers },
);
export const startInstructorTest = (id: string, token: string, name: string) => rpc<{ ok: boolean; status?: 'expired' | 'unavailable'; participant_name?: string }>('atlas_start_instructor_test', { p_id: id, p_token: token, p_name: name });

export type InstructorSubmissionSummary = { id: string; participant_name: string | null; created_at: string; test_revision: number; total: number; pending_review: number; revision: number; correct: number; percentage: number | null };
export type InstructorSubmission = { id: string; participant_name: string | null; test_id: string; test_revision: number; snapshot: InstructorSubmissionSnapshot;
  answers: InstructorAnswers; reviews: Record<string, boolean>; auto_results?: Record<string, boolean>; revision: number; created_at: string; auto_correct: number; total: number };
export const listInstructorSubmissions = (testId: string, offset = 0) => rpc<InstructorSubmissionSummary[]>('atlas_list_instructor_submissions', { p_test_id: testId, p_offset: offset });
export const getInstructorSubmission = (id: string) => rpc<InstructorSubmission>('atlas_get_instructor_submission', { p_id: id });
export const reviewInstructorSubmission = (submission: InstructorSubmission, reviews: Record<string, boolean>) => rpc<InstructorSubmission>('atlas_review_instructor_submission', { p_id: submission.id, p_revision: submission.revision, p_reviews: reviews });
