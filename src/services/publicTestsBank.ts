import { supabase } from './supabase';
import type {
  AutoMigrationResult,
  LegacyMigrationTest,
  PublicBankConfig,
  PublicBankGradeResult,
  PublicBankQuestion,
  PublicBankTestRow,
  PublicBankTopicSummary,
  StartedPublicBankTestPayload,
} from '../types/publicQuestionBank';

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('El banco de preguntas públicas todavía no está habilitado en la base de datos.');
    }
    if (error.code === '42501') {
      throw new Error('Tu sesión ya no tiene permiso para administrar el banco de preguntas.');
    }
    if (error.code === '40001') {
      throw new Error('Otra persona modificó este registro. Vuelve a abrirlo antes de guardar.');
    }
    if (error.code === 'P0001') {
      throw new Error(error.message);
    }
    throw new Error('No se pudo completar la operación. Comprueba tu conexión e inténtalo de nuevo.');
  }
  return data as T;
}

export const listPublicBankSummary = () =>
  rpc<PublicBankTopicSummary[]>('atlas_list_public_bank_summary');

export const getPublicBankQuestions = (temaId: number, subtemaId: number | null) =>
  rpc<PublicBankQuestion[]>('atlas_get_public_bank_questions', {
    p_tema_id: temaId,
    p_subtema_id: subtemaId,
  });

export const savePublicBankSection = (
  temaId: number,
  subtemaId: number | null,
  questions: PublicBankQuestion[],
) =>
  rpc<PublicBankQuestion[]>('atlas_save_public_bank_section', {
    p_tema_id: temaId,
    p_subtema_id: subtemaId,
    p_questions: questions.map((q, index) => ({
      id: q.id,
      sort_order: index,
      titulo: q.titulo,
      retroalimentacion: q.retroalimentacion,
      options: q.options.map((opt, optIdx) => ({
        id: opt.id,
        texto: opt.texto,
        is_correct: Boolean(opt.is_correct),
        sort_order: optIdx,
      })),
      reference_placa_id: q.reference_placa_id,
      reference_photo_url: q.reference_photo_url,
      reference_tema_name: q.reference_tema_name,
      reference_subtema_name: q.reference_subtema_name,
      reference_senalado: q.reference_senalado,
    })),
  });

export const movePublicBankQuestion = (questionId: string, targetSubtemaId: number | null) =>
  rpc<{ ok: boolean; id: string; tema_id: number; subtema_id: number | null }>(
    'atlas_move_public_bank_question',
    {
      p_question_id: questionId,
      p_target_subtema_id: targetSubtemaId,
    },
  );

export const checkPublicBankImageRefs = async (urls: string[]): Promise<string[]> => {
  if (!urls.length) return [];
  try {
    const result = await rpc<string[] | null>('atlas_check_public_bank_image_refs', { p_urls: urls });
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
};

export const countPendingSubtemaMigration = async (): Promise<{ pending_questions: number; pending_tests: number } | null> => {
  const { data, error } = await supabase.rpc('atlas_count_pending_subtema_migration');
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') return null;
    throw new Error(error.message);
  }
  return (data as { pending_questions: number; pending_tests: number } | null) ?? null;
};

export const migrateSubtemaTestsToBank = () =>
  rpc<AutoMigrationResult>('atlas_migrate_subtema_tests_to_bank');

export const listLegacyPublicTestsForMigration = () =>
  rpc<LegacyMigrationTest[]>('atlas_list_legacy_public_tests_for_migration');

export const migrateLegacyPublicQuestion = (
  pruebaId: string,
  preguntaId: string,
  temaId: number,
  subtemaId: number | null,
) =>
  rpc<{ ok: boolean; question_id: string; tema_id: number; subtema_id: number | null; remaining_count: number }>(
    'atlas_migrate_legacy_public_question',
    {
      p_prueba_id: pruebaId,
      p_pregunta_id: preguntaId,
      p_tema_id: temaId,
      p_subtema_id: subtemaId,
    },
  );

export const savePublicBankTest = (params: {
  id: string | null;
  temaId: number;
  nombre: string;
  instrucciones: string;
  imageUrl: string | null;
  bankConfig: PublicBankConfig;
  revision?: number | null;
}) =>
  rpc<PublicBankTestRow>('atlas_save_public_bank_test', {
    p_id: params.id,
    p_tema_id: params.temaId,
    p_nombre: params.nombre,
    p_instrucciones: params.instrucciones,
    p_image_url: params.imageUrl,
    p_bank_config: params.bankConfig,
    p_revision: params.revision ?? null,
  });

export const publishPublicBankTest = (
  id: string,
  publish: boolean,
  archiveMigratedLegacy = true,
) =>
  rpc<{ test: PublicBankTestRow; archived_legacy_count: number }>(
    'atlas_publish_public_bank_test',
    {
      p_id: id,
      p_publish: publish,
      p_archive_migrated_legacy: archiveMigratedLegacy,
    },
  );

export const getPublicBankPool = async (pruebaId: string) => {
  const { data, error } = await supabase.rpc('atlas_get_public_bank_pool', { p_prueba_id: pruebaId });
  if (error) {
    // Las instalaciones anteriores aún pueden ejecutar evaluaciones clásicas.
    if (error.code === 'PGRST202' || error.code === '42883') return undefined;
    throw error;
  }
  return data as (StartedPublicBankTestPayload & { config: PublicBankConfig }) | null;
};

export const startPublicBankTest = async (pruebaId: string, preview = false) => {
  const { data, error } = await supabase.rpc('atlas_start_public_bank_test', {
    p_prueba_id: pruebaId,
    p_preview: preview,
  });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') return null;
    throw error;
  }
  return data as StartedPublicBankTestPayload | null;
};

export const gradePublicBankQuestion = async (
  pruebaId: string,
  questionId: string,
  optionId: string,
  preview = false,
): Promise<PublicBankGradeResult | null> => {
  const { data, error } = await supabase.rpc('atlas_grade_public_bank_question', {
    p_prueba_id: pruebaId,
    p_question_id: questionId,
    p_option_id: optionId,
    p_preview: preview,
  });
  if (error) throw error;
  return (data as PublicBankGradeResult | null) ?? null;
};
