import type { MarkerLocation } from '../components/PlateAnnotationViewerEditor';

export interface PublicBankOption {
  id: string;
  texto: string;
  is_correct: boolean;
  sort_order: number;
}

export interface PublicBankQuestion {
  id: string;
  tema_id: number;
  subtema_id: number | null;
  sort_order: number;
  titulo: string;
  retroalimentacion: string;
  options: PublicBankOption[];
  reference_placa_id: number | null;
  reference_photo_url: string | null;
  reference_tema_name: string | null;
  reference_subtema_name: string | null;
  reference_senalado: MarkerLocation | null;
  revision?: number;
  updated_at?: string | null;
}

export interface PublicBankSubtemaCount {
  subtema_id: number;
  count: number;
}

export interface PublicBankTopicSummary {
  tema_id: number;
  general_count: number;
  subtema_total_count: number;
  total_count: number;
  subtemas: PublicBankSubtemaCount[];
}

export interface PublicBankConfig {
  general_count: number;
  subtema_counts: Record<string, number>;
  shuffle_options: boolean;
  shuffle_questions: boolean;
}

export interface PublicBankTestRow {
  id: string;
  nombre: string;
  instrucciones: string;
  scope: 'parcial' | 'tema' | 'subtema';
  parcial_key: 'primer' | 'segundo' | 'tercer';
  tema_id: number | null;
  subtema_id: number | null;
  estado: string;
  image_url?: string | null;
  mode?: 'legacy' | 'bank' | null;
  bank_config?: PublicBankConfig | null;
  revision?: number | null;
  created_at: string;
  updated_at?: string | null;
  created_by_id?: number | null;
  created_by_name?: string | null;
  updated_by_id?: number | null;
  updated_by_name?: string | null;
}

export interface LegacyMigrationQuestion {
  id: string;
  sort_order: number;
  titulo: string;
  retroalimentacion: string;
  reference_placa_id: number | null;
  reference_photo_url: string | null;
  reference_tema_name: string | null;
  reference_subtema_name: string | null;
  reference_senalado: MarkerLocation | null;
  options: PublicBankOption[];
}

export interface LegacyMigrationTest {
  id: string;
  nombre: string;
  scope: 'parcial' | 'tema' | 'subtema';
  parcial_key: 'primer' | 'segundo' | 'tercer';
  tema_id: number | null;
  subtema_id: number | null;
  estado: string;
  created_at: string;
  questions: LegacyMigrationQuestion[];
}

export interface AutoMigrationResult {
  ok: boolean;
  migrated_questions: number;
  skipped_questions: number;
  affected_tests: number;
  affected_temas: number;
}

export interface StartedPublicBankOption {
  id: string;
  pregunta_id: string;
  sort_order: number;
  texto: string;
}

export interface StartedPublicBankQuestion {
  id: string;
  sort_order: number;
  titulo: string;
  required: boolean;
  subtema_id: number | null;
  reference_photo_url: string | null;
  reference_tema_name: string | null;
  reference_subtema_name: string | null;
  reference_senalado: MarkerLocation | null;
  reference_senalado_x: number | null;
  reference_senalado_y: number | null;
  reference_senalado_start_x: number | null;
  reference_senalado_start_y: number | null;
  options: StartedPublicBankOption[];
}

export interface StartedPublicBankTestPayload {
  test: {
    id: string;
    nombre: string;
    instrucciones: string;
    scope: 'parcial' | 'tema' | 'subtema';
    parcial_key: 'primer' | 'segundo' | 'tercer';
    tema_id: number | null;
    created_at: string;
    estado: string;
    mode: 'bank';
  };
  questions: StartedPublicBankQuestion[];
}

export interface PublicBankGradeResult {
  question_id: string;
  is_correct: boolean;
  correct_option_id: string;
  correct_option_text: string;
  feedback: string | null;
}

export function createBlankPublicBankOption(sortOrder: number, isCorrect = false): PublicBankOption {
  return {
    id: crypto.randomUUID(),
    texto: '',
    is_correct: isCorrect,
    sort_order: sortOrder,
  };
}

export function createBlankPublicBankQuestion(
  temaId: number,
  subtemaId: number | null,
  sortOrder = 0,
): PublicBankQuestion {
  return {
    id: crypto.randomUUID(),
    tema_id: temaId,
    subtema_id: subtemaId,
    sort_order: sortOrder,
    titulo: '',
    retroalimentacion: '',
    options: [
      createBlankPublicBankOption(0, true),
      createBlankPublicBankOption(1, false),
      createBlankPublicBankOption(2, false),
      createBlankPublicBankOption(3, false),
    ],
    reference_placa_id: null,
    reference_photo_url: null,
    reference_tema_name: null,
    reference_subtema_name: null,
    reference_senalado: null,
  };
}

export function stripHtmlText(value: string): string {
  return (value || '').replace(/<[^>]+>/g, '').trim();
}

export function isPublicBankQuestionComplete(question: PublicBankQuestion): boolean {
  if (!stripHtmlText(question.titulo)) return false;
  if (!Array.isArray(question.options) || question.options.length < 2) return false;
  const hasCorrect = question.options.filter(o => o.is_correct).length === 1;
  const allFilled = question.options.every(o => stripHtmlText(o.texto).length > 0);
  return hasCorrect && allFilled;
}

export function calculateExpectedBankTestCount(
  config: PublicBankConfig | null | undefined,
  summary: PublicBankTopicSummary | undefined,
): { configured: number; available: number } {
  if (!config) return { configured: 0, available: 0 };
  const generalCfg = Math.max(0, Math.floor(config.general_count ?? 0));
  const generalAvail = summary?.general_count ?? 0;
  let configured = generalCfg;
  let available = Math.min(generalCfg, generalAvail);

  const subtemaMap = new Map((summary?.subtemas ?? []).map(s => [String(s.subtema_id), s.count]));
  const subCounts = config.subtema_counts ?? {};
  for (const [subtemaId, rawCount] of Object.entries(subCounts)) {
    const count = Math.max(0, Math.floor(Number(rawCount) || 0));
    if (count > 0) {
      configured += count;
      available += Math.min(count, subtemaMap.get(subtemaId) ?? 0);
    }
  }
  return { configured, available };
}
