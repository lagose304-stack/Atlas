import React, { useEffect, useMemo, useState } from 'react';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TestBuilder, { type QuestionBlock } from '../components/TestBuilder';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import { describeSupabaseError, supabase } from '../services/supabase';

type PruebasView = 'crear' | 'editar' | 'eliminar';
type ParcialKey = 'primer' | 'segundo' | 'tercer';
type TestKind = 'tema' | 'parcial';
type Difficulty = 'baja' | 'media' | 'alta';
type TimingChoice = 'sin_tiempo' | 'con_tiempo';
type TimedScope = 'total' | 'por_pregunta';
type DurationMode = 'sin_tiempo' | 'tiempo_total' | 'tiempo_por_pregunta';

interface Tema {
  id: number;
  nombre: string;
  parcial: ParcialKey;
  sort_order?: number | null;
}

interface TemaRelationRow {
  id: number;
  nombre: string;
  parcial: string;
}

interface TestRow {
  id: string;
  titulo: string;
  descripcion: string;
  dificultad: string;
  duracion_min: number;
  created_at: string;
  tema_id: number | null;
  tema: TemaRelationRow | TemaRelationRow[] | null;
}

interface DisplayTest {
  id: string;
  titulo: string;
  dificultad: string;
  createdAt: string;
  kind: TestKind;
  parcialKey: ParcialKey | null;
  parcialLabel: string;
  temaNombre: string | null;
  durationLabel: string;
}

interface StoredTestMeta {
  version: 1;
  tipo_prueba: TestKind;
  parcial_clave: ParcialKey | null;
  modo_duracion: DurationMode;
  duracion_total_min: number | null;
  duracion_por_pregunta_min: number | null;
}

interface CreateFormState {
  kind: TestKind | '';
  temaId: number | '';
  parcialKey: ParcialKey | '';
  difficulty: Difficulty | '';
  timingChoice: TimingChoice | '';
  timedScope: TimedScope | '';
  totalDurationMin: number;
  perQuestionDurationMin: number;
}

interface ActiveBuilderTest {
  id: string;
  title: string;
  kind: TestKind;
  parcialLabel: string;
  durationLabel: string;
  temaNombre: string | null;
  difficulty: Difficulty;
}

interface TestQuestionBlockInsertRow {
  test_id: string;
  block_type: QuestionBlock['type'];
  sort_order: number;
  title: string;
  prompt: string;
  config: Record<string, unknown>;
  answer_key: Record<string, unknown>;
  points: number;
}

interface TestQuestionBlockRow {
  id: string;
  block_type: string;
  sort_order: number;
  title: string;
  prompt: string;
  config: Record<string, unknown> | null;
  answer_key: Record<string, unknown> | null;
}

const DISCARD_CREATE_DRAFT_CONFIRM_MESSAGE =
  'Tienes cambios sin guardar en Crear nueva. Si continúas, se perderán. ¿Quieres salir de todos modos?';

const DISCARD_TEST_BUILDER_CONFIRM_MESSAGE =
  'Tienes cambios sin guardar en el Test Builder. Si sales, se perderán. ¿Quieres salir de todos modos?';

const TEST_META_PREFIX = '__atlas_test_meta__:';

const PARCIALES: Array<{ key: ParcialKey; label: string }> = [
  { key: 'primer', label: 'Primer parcial' },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer', label: 'Tercer parcial' },
];

const DEFAULT_CREATE_FORM: CreateFormState = {
  kind: '',
  temaId: '',
  parcialKey: '',
  difficulty: '',
  timingChoice: '',
  timedScope: '',
  totalDurationMin: 20,
  perQuestionDurationMin: 2,
};

const isParcialKey = (value: string): value is ParcialKey => {
  return value === 'primer' || value === 'segundo' || value === 'tercer';
};

const getParcialLabel = (parcialKey: ParcialKey | null | ''): string => {
  const match = PARCIALES.find((item) => item.key === parcialKey);
  return match ? match.label : 'Parcial no definido';
};

const getParcialRank = (parcialKey: ParcialKey | null): number => {
  if (parcialKey === 'primer') return 0;
  if (parcialKey === 'segundo') return 1;
  if (parcialKey === 'tercer') return 2;
  return 3;
};

const getDifficultyLabel = (difficulty: string): string => {
  if (difficulty === 'baja') return 'Fácil';
  if (difficulty === 'media') return 'Media';
  if (difficulty === 'alta') return 'Difícil';
  return difficulty || 'Sin definir';
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Fecha desconocida';
  }
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const parseStoredTestMeta = (description: string | null | undefined): StoredTestMeta | null => {
  if (!description || !description.startsWith(TEST_META_PREFIX)) {
    return null;
  }

  const rawPayload = description.slice(TEST_META_PREFIX.length).trim();
  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as StoredTestMeta;
    if (parsed && (parsed.tipo_prueba === 'tema' || parsed.tipo_prueba === 'parcial')) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const encodeStoredTestMeta = (meta: StoredTestMeta): string => {
  return `${TEST_META_PREFIX}${JSON.stringify(meta)}`;
};

const resolveDurationMode = (form: CreateFormState): DurationMode => {
  if (form.timingChoice !== 'con_tiempo') {
    return 'sin_tiempo';
  }
  if (form.timedScope === 'por_pregunta') {
    return 'tiempo_por_pregunta';
  }
  return 'tiempo_total';
};

const buildDurationLabel = (
  mode: DurationMode,
  rowDurationMin: number,
  meta: StoredTestMeta | null
): string => {
  if (mode === 'sin_tiempo') {
    return 'Sin tiempo';
  }
  if (mode === 'tiempo_por_pregunta') {
    const perQuestion = meta?.duracion_por_pregunta_min ?? rowDurationMin;
    return `${perQuestion} min por pregunta`;
  }
  const total = meta?.duracion_total_min ?? rowDurationMin;
  return `${total} min en toda la prueba`;
};

const getCreateValidationError = (form: CreateFormState): string | null => {
  if (!form.kind) {
    return 'Selecciona primero el tipo de prueba.';
  }
  if (form.kind === 'tema' && form.temaId === '') {
    return 'Selecciona un tema para continuar.';
  }
  if (form.kind === 'parcial' && !form.parcialKey) {
    return 'Selecciona un parcial para continuar.';
  }
  if (!form.difficulty) {
    return 'Selecciona la dificultad.';
  }
  if (!form.timingChoice) {
    return 'Selecciona si la prueba tendrá tiempo o no.';
  }
  if (form.timingChoice === 'con_tiempo' && !form.timedScope) {
    return 'Selecciona si el tiempo será para toda la prueba o por pregunta.';
  }
  if (form.timingChoice === 'con_tiempo' && form.timedScope === 'total' && form.totalDurationMin <= 0) {
    return 'Define minutos válidos para toda la prueba.';
  }
  if (
    form.timingChoice === 'con_tiempo' &&
    form.timedScope === 'por_pregunta' &&
    form.perQuestionDurationMin <= 0
  ) {
    return 'Define minutos válidos por pregunta.';
  }
  return null;
};

const hasDraftChanges = (form: CreateFormState): boolean => {
  return (
    form.kind !== DEFAULT_CREATE_FORM.kind ||
    form.temaId !== DEFAULT_CREATE_FORM.temaId ||
    form.parcialKey !== DEFAULT_CREATE_FORM.parcialKey ||
    form.difficulty !== DEFAULT_CREATE_FORM.difficulty ||
    form.timingChoice !== DEFAULT_CREATE_FORM.timingChoice ||
    form.timedScope !== DEFAULT_CREATE_FORM.timedScope ||
    form.totalDurationMin !== DEFAULT_CREATE_FORM.totalDurationMin ||
    form.perQuestionDurationMin !== DEFAULT_CREATE_FORM.perQuestionDurationMin
  );
};

const makeClientId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter((item) => item.length > 0);
};

const toNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0)
    .map((item) => Math.floor(item));
};

const ensureAtLeastTwo = (items: string[], fallbackPrefix: string): string[] => {
  const normalized = items.length > 0 ? items : [`${fallbackPrefix} 1`, `${fallbackPrefix} 2`];
  if (normalized.length === 1) {
    return [normalized[0], `${fallbackPrefix} 2`];
  }
  return normalized;
};

const mapRowToQuestionBlock = (row: TestQuestionBlockRow): QuestionBlock | null => {
  const config = asRecord(row.config);
  const answerKey = asRecord(row.answer_key);
  const baseTitle = row.title?.trim() || 'Bloque sin título';
  const prompt = row.prompt ?? '';

  if (row.block_type === 'single_choice') {
    const optionsText = ensureAtLeastTwo(toStringArray(config.options), 'Opción');
    const options = optionsText.map((text) => ({ id: makeClientId(), text }));
    const correctIndex = Number(answerKey.correct_option_index);

    return {
      id: makeClientId(),
      type: 'single_choice',
      title: baseTitle,
      questions: [
        {
          id: makeClientId(),
          prompt,
          options,
          correctOptionId:
            Number.isFinite(correctIndex) && correctIndex >= 0 && correctIndex < options.length
              ? options[correctIndex].id
              : null,
        },
      ],
    };
  }

  if (row.block_type === 'multiple_choice') {
    const optionsText = ensureAtLeastTwo(toStringArray(config.options), 'Opción');
    const options = optionsText.map((text) => ({ id: makeClientId(), text }));
    const correctIndexes = toNumberArray(answerKey.correct_option_indexes);

    return {
      id: makeClientId(),
      type: 'multiple_choice',
      title: baseTitle,
      questions: [
        {
          id: makeClientId(),
          prompt,
          options,
          correctOptionIds: correctIndexes
            .filter((index) => index >= 0 && index < options.length)
            .map((index) => options[index].id),
        },
      ],
    };
  }

  if (row.block_type === 'true_false') {
    const rawAnswer = answerKey.correct_answer;
    const correctAnswer = rawAnswer === 'true' || rawAnswer === 'false' ? rawAnswer : null;

    return {
      id: makeClientId(),
      type: 'true_false',
      title: baseTitle,
      questions: [
        {
          id: makeClientId(),
          prompt,
          correctAnswer,
        },
      ],
    };
  }

  if (row.block_type === 'matching') {
    const configPairs = Array.isArray(config.pairs) ? config.pairs : [];
    const answerPairs = Array.isArray(answerKey.pairs) ? answerKey.pairs : [];
    const sourcePairs = configPairs.length > 0 ? configPairs : answerPairs;

    const pairs = sourcePairs
      .map((pair) => {
        const record = asRecord(pair);
        return {
          id: makeClientId(),
          left: String(record.left ?? '').trim(),
          right: String(record.right ?? '').trim(),
        };
      })
      .filter((pair) => pair.left.length > 0 || pair.right.length > 0);

    const normalizedPairs =
      pairs.length >= 2
        ? pairs
        : [
            { id: makeClientId(), left: '', right: '' },
            { id: makeClientId(), left: '', right: '' },
          ];

    return {
      id: makeClientId(),
      type: 'matching',
      title: baseTitle,
      questions: [
        {
          id: makeClientId(),
          prompt,
          pairs: normalizedPairs,
        },
      ],
    };
  }

  if (row.block_type === 'ordering') {
    const configItems = toStringArray(config.items);
    const answerItems = toStringArray(answerKey.correct_order);
    const itemsText = ensureAtLeastTwo(configItems.length > 0 ? configItems : answerItems, 'Paso');

    return {
      id: makeClientId(),
      type: 'ordering',
      title: baseTitle,
      questions: [
        {
          id: makeClientId(),
          prompt,
          items: itemsText.map((text) => ({ id: makeClientId(), text })),
        },
      ],
    };
  }

  if (row.block_type === 'dropdown_single') {
    const optionsText = ensureAtLeastTwo(toStringArray(config.options), 'Opción');
    const options = optionsText.map((text) => ({ id: makeClientId(), text }));
    const correctIndex = Number(answerKey.correct_option_index);

    return {
      id: makeClientId(),
      type: 'dropdown_single',
      title: baseTitle,
      questions: [
        {
          id: makeClientId(),
          prompt,
          options,
          correctOptionId:
            Number.isFinite(correctIndex) && correctIndex >= 0 && correctIndex < options.length
              ? options[correctIndex].id
              : null,
        },
      ],
    };
  }

  return null;
};

const buildQuestionRowsForInsert = (
  testId: string,
  blocks: QuestionBlock[]
): TestQuestionBlockInsertRow[] => {
  const rows: TestQuestionBlockInsertRow[] = [];
  let sortOrder = 0;

  blocks.forEach((block) => {
    if (block.type === 'single_choice') {
      block.questions.forEach((question) => {
        const correctOptionIndex = question.options.findIndex(
          (option) => option.id === question.correctOptionId
        );

        rows.push({
          test_id: testId,
          block_type: block.type,
          sort_order: sortOrder,
          title: block.title,
          prompt: question.prompt,
          config: {
            options: question.options.map((option) => option.text),
          },
          answer_key: {
            correct_option_index: correctOptionIndex >= 0 ? correctOptionIndex : null,
          },
          points: 1,
        });
        sortOrder += 1;
      });
      return;
    }

    if (block.type === 'multiple_choice') {
      block.questions.forEach((question) => {
        const correctOptionIndexes = question.options
          .map((option, index) => (question.correctOptionIds.includes(option.id) ? index : null))
          .filter((index): index is number => index !== null);

        rows.push({
          test_id: testId,
          block_type: block.type,
          sort_order: sortOrder,
          title: block.title,
          prompt: question.prompt,
          config: {
            options: question.options.map((option) => option.text),
          },
          answer_key: {
            correct_option_indexes: correctOptionIndexes,
          },
          points: 1,
        });
        sortOrder += 1;
      });
      return;
    }

    if (block.type === 'true_false') {
      block.questions.forEach((question) => {
        rows.push({
          test_id: testId,
          block_type: block.type,
          sort_order: sortOrder,
          title: block.title,
          prompt: question.prompt,
          config: {},
          answer_key: {
            correct_answer: question.correctAnswer,
          },
          points: 1,
        });
        sortOrder += 1;
      });
      return;
    }

    if (block.type === 'matching') {
      block.questions.forEach((question) => {
        const normalizedPairs = question.pairs.map((pair) => ({
          left: pair.left,
          right: pair.right,
        }));

        rows.push({
          test_id: testId,
          block_type: block.type,
          sort_order: sortOrder,
          title: block.title,
          prompt: question.prompt,
          config: {
            pairs: normalizedPairs,
          },
          answer_key: {
            pairs: normalizedPairs,
          },
          points: 1,
        });
        sortOrder += 1;
      });
      return;
    }

    if (block.type === 'ordering') {
      block.questions.forEach((question) => {
        const orderedItems = question.items.map((item) => item.text);

        rows.push({
          test_id: testId,
          block_type: block.type,
          sort_order: sortOrder,
          title: block.title,
          prompt: question.prompt,
          config: {
            items: orderedItems,
          },
          answer_key: {
            correct_order: orderedItems,
          },
          points: 1,
        });
        sortOrder += 1;
      });
      return;
    }

    block.questions.forEach((question) => {
      const correctOptionIndex = question.options.findIndex(
        (option) => option.id === question.correctOptionId
      );

      rows.push({
        test_id: testId,
        block_type: block.type,
        sort_order: sortOrder,
        title: block.title,
        prompt: question.prompt,
        config: {
          options: question.options.map((option) => option.text),
        },
        answer_key: {
          correct_option_index: correctOptionIndex >= 0 ? correctOptionIndex : null,
        },
        points: 1,
      });
      sortOrder += 1;
    });
  });

  return rows;
};

const Pruebas: React.FC = () => {
  const handleGoBack = useSmartBackNavigation('/edicion');

  const [selectedView, setSelectedView] = useState<PruebasView | null>(null);

  const [temas, setTemas] = useState<Tema[]>([]);
  const [isLoadingTemas, setIsLoadingTemas] = useState(false);

  const [tests, setTests] = useState<DisplayTest[]>([]);
  const [isLoadingTests, setIsLoadingTests] = useState(false);
  const [testsError, setTestsError] = useState('');

  const [createForm, setCreateForm] = useState<CreateFormState>(DEFAULT_CREATE_FORM);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [activeBuilderTest, setActiveBuilderTest] = useState<ActiveBuilderTest | null>(null);
  const [isCreateBuilderDirty, setIsCreateBuilderDirty] = useState(false);
  const [builderError, setBuilderError] = useState('');
  const [builderSuccess, setBuilderSuccess] = useState('');
  const [editBuilderTest, setEditBuilderTest] = useState<DisplayTest | null>(null);
  const [isEditBuilderDirty, setIsEditBuilderDirty] = useState(false);
  const [editBuilderInitialBlocks, setEditBuilderInitialBlocks] = useState<QuestionBlock[]>([]);
  const [isLoadingEditBuilder, setIsLoadingEditBuilder] = useState(false);
  const [editBuilderError, setEditBuilderError] = useState('');
  const [editBuilderSuccess, setEditBuilderSuccess] = useState('');
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);

  const viewOptions: Array<{
    id: PruebasView;
    title: string;
    description: string;
    icon: string;
    gradient: string;
    borderColor: string;
    panelColor: string;
    iconBg: string;
    iconColor: string;
    shadow: string;
  }> = [
    {
      id: 'crear',
      title: 'Crear nueva',
      description: 'Definir parámetros obligatorios y registrar la prueba.',
      icon: '+',
      gradient: 'linear-gradient(135deg, #0ea5e9, #22d3ee)',
      borderColor: '#38bdf8',
      panelColor: '#f0f9ff',
      iconBg: '#dbeafe',
      iconColor: '#0c4a6e',
      shadow: 'rgba(14,165,233,0.22)',
    },
    {
      id: 'editar',
      title: 'Editar',
      description: 'Ver y gestionar pruebas existentes.',
      icon: '~',
      gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
      borderColor: '#f59e0b',
      panelColor: '#fffbeb',
      iconBg: '#fef3c7',
      iconColor: '#92400e',
      shadow: 'rgba(245,158,11,0.22)',
    },
    {
      id: 'eliminar',
      title: 'Borrar',
      description: 'Eliminar pruebas registradas.',
      icon: 'x',
      gradient: 'linear-gradient(135deg, #ef4444, #f87171)',
      borderColor: '#ef4444',
      panelColor: '#fff1f2',
      iconBg: '#ffe4e6',
      iconColor: '#9f1239',
      shadow: 'rgba(239,68,68,0.2)',
    },
  ];

  const selectedMode = selectedView
    ? viewOptions.find((option) => option.id === selectedView) ?? null
    : null;

  const temasByParcial = useMemo(() => {
    const groups: Record<ParcialKey, Tema[]> = {
      primer: [],
      segundo: [],
      tercer: [],
    };

    temas.forEach((tema) => {
      groups[tema.parcial].push(tema);
    });

    Object.values(groups).forEach((group) => {
      group.sort((a, b) => {
        const orderA = typeof a.sort_order === 'number' ? a.sort_order : Number.MAX_SAFE_INTEGER;
        const orderB = typeof b.sort_order === 'number' ? b.sort_order : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
      });
    });

    return groups;
  }, [temas]);

  const selectedTema = useMemo(() => {
    if (createForm.temaId === '') {
      return null;
    }
    return temas.find((tema) => tema.id === createForm.temaId) ?? null;
  }, [createForm.temaId, temas]);

  const previewTitle = useMemo(() => {
    if (createForm.kind === 'tema' && selectedTema) {
      return `Prueba de ${selectedTema.nombre}`;
    }
    if (createForm.kind === 'parcial' && createForm.parcialKey) {
      return `Prueba ${getParcialLabel(createForm.parcialKey)}`;
    }
    return 'Título automático';
  }, [createForm.kind, createForm.parcialKey, selectedTema]);

  const createValidationError = useMemo(() => getCreateValidationError(createForm), [createForm]);

  const hasUnsavedCreateChanges = useMemo(() => hasDraftChanges(createForm), [createForm]);

  const testsByType = useMemo(() => {
    return {
      parciales: tests.filter((test) => test.kind === 'parcial'),
      temas: tests.filter((test) => test.kind === 'tema'),
    };
  }, [tests]);

  const fetchTemas = async () => {
    setIsLoadingTemas(true);
    try {
      const { data, error } = await supabase
        .from('temas')
        .select('id, nombre, parcial, sort_order')
        .order('parcial', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      const normalized: Tema[] = (data ?? [])
        .map((row) => {
          const parcialValue = String(row.parcial ?? '').toLowerCase();
          if (!isParcialKey(parcialValue)) {
            return null;
          }
          return {
            id: Number(row.id),
            nombre: String(row.nombre ?? ''),
            parcial: parcialValue,
            sort_order: typeof row.sort_order === 'number' ? row.sort_order : null,
          } as Tema;
        })
        .filter((item): item is Tema => item !== null);

      setTemas(normalized);
    } catch (error) {
      setCreateError(`No se pudieron cargar los temas: ${describeSupabaseError(error)}`);
    } finally {
      setIsLoadingTemas(false);
    }
  };

  const fetchTests = async () => {
    setIsLoadingTests(true);
    setTestsError('');

    try {
      const { data, error } = await supabase
        .from('tests')
        .select('id, titulo, descripcion, dificultad, duracion_min, created_at, tema_id, tema:temas(id, nombre, parcial)');

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as unknown as TestRow[];
      const normalized = rows
        .map((row): DisplayTest => {
          const parsedMeta = parseStoredTestMeta(row.descripcion);
          const temaRelation = Array.isArray(row.tema) ? row.tema[0] ?? null : row.tema ?? null;

          const fallbackKind: TestKind = row.titulo.toLowerCase().startsWith('prueba de ')
            ? 'tema'
            : 'parcial';
          const kind = parsedMeta?.tipo_prueba ?? fallbackKind;

          const temaParcial =
            temaRelation && isParcialKey(String(temaRelation.parcial ?? '').toLowerCase())
              ? (String(temaRelation.parcial).toLowerCase() as ParcialKey)
              : null;

          const parcialKey = parsedMeta?.parcial_clave ?? temaParcial;
          const durationMode = parsedMeta?.modo_duracion ?? 'tiempo_total';

          return {
            id: row.id,
            titulo: row.titulo,
            dificultad: row.dificultad,
            createdAt: row.created_at,
            kind,
            parcialKey,
            parcialLabel: getParcialLabel(parcialKey),
            temaNombre: temaRelation?.nombre ?? null,
            durationLabel: buildDurationLabel(durationMode, row.duracion_min, parsedMeta),
          };
        })
        .sort((a, b) => {
          if (a.kind !== b.kind) {
            return a.kind === 'parcial' ? -1 : 1;
          }
          const parcialDiff = getParcialRank(a.parcialKey) - getParcialRank(b.parcialKey);
          if (parcialDiff !== 0) {
            return parcialDiff;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

      setTests(normalized);
    } catch (error) {
      setTestsError(`No se pudieron cargar las pruebas: ${describeSupabaseError(error)}`);
    } finally {
      setIsLoadingTests(false);
    }
  };

  useEffect(() => {
    fetchTemas();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isCreateBuilderDirty || isEditBuilderDirty || hasUnsavedCreateChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isCreateBuilderDirty, isEditBuilderDirty, hasUnsavedCreateChanges]);

  useEffect(() => {
    if (selectedView === 'editar' || selectedView === 'eliminar') {
      fetchTests();
    }
  }, [selectedView]);

  const resetCreateDraft = () => {
    setCreateForm(DEFAULT_CREATE_FORM);
    setCreateError('');
    setCreateSuccess('');
  };

  const handleSelectView = (nextView: PruebasView) => {
    if (selectedView === nextView) return;

    const isLeavingCreateWithUnsavedChanges =
      selectedView === 'crear' && nextView !== 'crear' && hasUnsavedCreateChanges;

    if (isLeavingCreateWithUnsavedChanges) {
      const shouldDiscard = window.confirm(DISCARD_CREATE_DRAFT_CONFIRM_MESSAGE);
      if (!shouldDiscard) return;
      resetCreateDraft();
    }

    if (nextView !== 'crear') {
      setActiveBuilderTest(null);
      setBuilderError('');
      setBuilderSuccess('');
    }

    if (nextView !== 'editar') {
      setEditBuilderTest(null);
      setEditBuilderInitialBlocks([]);
      setIsLoadingEditBuilder(false);
      setEditBuilderError('');
      setEditBuilderSuccess('');
    }

    setSelectedView(nextView);
  };

  const handleCreateTest = async () => {
    setCreateError('');
    setCreateSuccess('');
    setBuilderError('');
    setBuilderSuccess('');

    if (createValidationError) {
      setCreateError(createValidationError);
      return;
    }

    const kind = createForm.kind as TestKind;
    const difficulty = createForm.difficulty as Difficulty;
    const durationMode = resolveDurationMode(createForm);

    if (kind === 'tema' && !selectedTema) {
      setCreateError('No se encontró el tema seleccionado.');
      return;
    }

    const parcialKey: ParcialKey | null =
      kind === 'parcial'
        ? (createForm.parcialKey as ParcialKey)
        : selectedTema
          ? selectedTema.parcial
          : null;

    const representativeTema =
      kind === 'tema'
        ? selectedTema
        : parcialKey
          ? temas.find((tema) => tema.parcial === parcialKey) ?? null
          : null;

    const testTitleToSave =
      kind === 'tema' && selectedTema
        ? `Prueba de ${selectedTema.nombre}`
        : `Prueba ${getParcialLabel(parcialKey)}`;

    const durationMin =
      durationMode === 'tiempo_total'
        ? createForm.totalDurationMin
        : durationMode === 'tiempo_por_pregunta'
          ? createForm.perQuestionDurationMin
          : 15;

    const metadata: StoredTestMeta = {
      version: 1,
      tipo_prueba: kind,
      parcial_clave: parcialKey,
      modo_duracion: durationMode,
      duracion_total_min: durationMode === 'tiempo_total' ? createForm.totalDurationMin : null,
      duracion_por_pregunta_min:
        durationMode === 'tiempo_por_pregunta' ? createForm.perQuestionDurationMin : null,
    };

    setIsCreating(true);
    try {
      const payload = {
        titulo: testTitleToSave,
        descripcion: encodeStoredTestMeta(metadata),
        tema_id: kind === 'tema' ? selectedTema?.id ?? null : representativeTema?.id ?? null,
        subtema_id: null,
        estado: 'draft',
        dificultad: difficulty,
        duracion_min: durationMin,
      };

      const { data: createdTest, error } = await supabase
        .from('tests')
        .insert(payload)
        .select('id')
        .single();

      if (error) {
        const hasNoRepresentativeTema = kind === 'parcial' && !representativeTema;
        if (hasNoRepresentativeTema) {
          setCreateError(
            'No se pudo registrar la prueba parcial porque ese parcial no tiene temas disponibles en este momento.'
          );
        } else {
          setCreateError(`No se pudo crear la prueba: ${describeSupabaseError(error)}`);
        }
        return;
      }

      if (!createdTest?.id) {
        setCreateError('La prueba se creó, pero no se pudo abrir el visualizador de preguntas.');
        await fetchTests();
        return;
      }

      setCreateSuccess('');
      setCreateForm(DEFAULT_CREATE_FORM);
      setActiveBuilderTest({
        id: String(createdTest.id),
        title: testTitleToSave,
        kind,
        parcialLabel: getParcialLabel(parcialKey),
        durationLabel: buildDurationLabel(durationMode, durationMin, metadata),
        temaNombre: kind === 'tema' ? selectedTema?.nombre ?? null : null,
        difficulty,
      });
      await fetchTests();
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTest = async (testId: string) => {
    const shouldDelete = window.confirm('Esta acción eliminará la prueba seleccionada. ¿Deseas continuar?');
    if (!shouldDelete) {
      return;
    }

    setDeletingTestId(testId);
    setTestsError('');
    try {
      const { error } = await supabase.from('tests').delete().eq('id', testId);
      if (error) {
        setTestsError(`No se pudo eliminar la prueba: ${describeSupabaseError(error)}`);
        return;
      }
      await fetchTests();
    } finally {
      setDeletingTestId(null);
    }
  };

  const updateFormField = <K extends keyof CreateFormState>(field: K, value: CreateFormState[K]) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveQuestionBlocks = async (blocks: QuestionBlock[]) => {
    if (!activeBuilderTest) {
      const noActiveTestError = new Error('No hay una prueba activa para guardar preguntas.');
      setBuilderError(noActiveTestError.message);
      throw noActiveTestError;
    }

    setBuilderError('');
    setBuilderSuccess('');

    try {
      const selectionBlocks = blocks.filter((block) => block.type === 'multiple_choice');
      const rows = buildQuestionRowsForInsert(activeBuilderTest.id, selectionBlocks);

      const { error: deleteError } = await supabase
        .from('test_question_blocks')
        .delete()
        .eq('test_id', activeBuilderTest.id);

      if (deleteError) {
        throw deleteError;
      }

      if (rows.length > 0) {
        const { error: insertError } = await supabase.from('test_question_blocks').insert(rows);
        if (insertError) {
          throw insertError;
        }
      }

      setBuilderSuccess(`Preguntas guardadas para ${activeBuilderTest.title}.`);
      setIsCreateBuilderDirty(false);
      await fetchTests();
    } catch (error) {
      const message = `No se pudieron guardar las preguntas: ${describeSupabaseError(error)}`;
      setBuilderError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  };

  const handleBackFromCreateBuilder = () => {
    if (isCreateBuilderDirty) {
      const shouldDiscard = window.confirm(DISCARD_TEST_BUILDER_CONFIRM_MESSAGE);
      if (!shouldDiscard) return;
    }

    setActiveBuilderTest(null);
    setIsCreateBuilderDirty(false);
    setBuilderError('');
    setBuilderSuccess('');
    setSelectedView('crear');
  };

  const handleBackFromEditBuilder = () => {
    if (isEditBuilderDirty) {
      const shouldDiscard = window.confirm(DISCARD_TEST_BUILDER_CONFIRM_MESSAGE);
      if (!shouldDiscard) return;
    }

    setEditBuilderTest(null);
    setIsEditBuilderDirty(false);
    setEditBuilderError('');
    setEditBuilderSuccess('');
  };

  const handleOpenEditBuilder = async (test: DisplayTest) => {
    setEditBuilderTest(test);
    setEditBuilderInitialBlocks([]);
    setEditBuilderError('');
    setEditBuilderSuccess('');
    setIsLoadingEditBuilder(true);

    try {
      const { data, error } = await supabase
        .from('test_question_blocks')
        .select('id, block_type, sort_order, title, prompt, config, answer_key')
        .eq('test_id', test.id)
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as TestQuestionBlockRow[];
      const selectionRows = rows.filter((row) => row.block_type === 'multiple_choice');
      const blocks = selectionRows
        .map((row) => mapRowToQuestionBlock(row))
        .filter((block): block is QuestionBlock => block !== null);

      setEditBuilderInitialBlocks(blocks);

      if (rows.length > selectionRows.length) {
        setEditBuilderError(
          'Se ocultaron preguntas de tipos no soportados. Por ahora solo se editan preguntas de seleccion multiple.'
        );
      }
    } catch (error) {
      setEditBuilderError(`No se pudieron cargar las preguntas: ${describeSupabaseError(error)}`);
    } finally {
      setIsLoadingEditBuilder(false);
    }
  };

  const handleSaveEditQuestionBlocks = async (blocks: QuestionBlock[]) => {
    if (!editBuilderTest) {
      const noTestSelectedError = new Error('No hay una prueba seleccionada para editar preguntas.');
      setEditBuilderError(noTestSelectedError.message);
      throw noTestSelectedError;
    }

    setEditBuilderError('');
    setEditBuilderSuccess('');

    try {
      const selectionBlocks = blocks.filter((block) => block.type === 'multiple_choice');
      const rows = buildQuestionRowsForInsert(editBuilderTest.id, selectionBlocks);

      const { error: deleteError } = await supabase
        .from('test_question_blocks')
        .delete()
        .eq('test_id', editBuilderTest.id);

      if (deleteError) {
        throw deleteError;
      }

      if (rows.length > 0) {
        const { error: insertError } = await supabase.from('test_question_blocks').insert(rows);
        if (insertError) {
          throw insertError;
        }
      }

      setEditBuilderSuccess(`Preguntas actualizadas para ${editBuilderTest.titulo}.`);
      await fetchTests();
    } catch (error) {
      const message = `No se pudieron guardar las preguntas: ${describeSupabaseError(error)}`;
      setEditBuilderError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  };

  const renderTestsGroup = (
    title: string,
    group: DisplayTest[],
    emptyLabel: string,
    allowDelete: boolean,
    allowEdit: boolean,
    onEditTest: ((test: DisplayTest) => void) | null
  ) => {
    return (
      <div style={s.testGroupCard}>
        <h3 style={s.testGroupTitle}>{title}</h3>
        {group.length === 0 ? (
          <p style={s.testGroupEmpty}>{emptyLabel}</p>
        ) : (
          group.map((test) => (
            <article key={test.id} style={s.testCard}>
              <div style={s.testCardTop}>
                <h4 style={s.testTitle}>{test.titulo}</h4>
                <span
                  style={{
                    ...s.kindBadge,
                    ...(test.kind === 'parcial' ? s.kindBadgeParcial : {}),
                  }}
                >
                  {test.kind === 'parcial' ? 'Parcial' : 'Tema'}
                </span>
              </div>

              <div style={s.metaRow}>
                <span style={s.metaPill}>{test.parcialLabel}</span>
                <span style={s.metaPill}>Dificultad: {getDifficultyLabel(test.dificultad)}</span>
                <span style={s.metaPill}>{test.durationLabel}</span>
                {test.kind === 'tema' && test.temaNombre && (
                  <span style={s.metaPill}>Tema: {test.temaNombre}</span>
                )}
                <span style={s.metaPill}>Creada: {formatDate(test.createdAt)}</span>
              </div>

              {(allowEdit || allowDelete) && (
                <div style={s.testActionsRow}>
                  {allowEdit && onEditTest && (
                    <button
                      type="button"
                      style={s.editBtn}
                      onClick={() => onEditTest(test)}
                    >
                      Editar preguntas
                    </button>
                  )}

                  {allowDelete && (
                    <button
                      type="button"
                      style={s.deleteBtn}
                      onClick={() => handleDeleteTest(test.id)}
                      disabled={deletingTestId === test.id}
                    >
                      {deletingTestId === test.id ? 'Eliminando...' : 'Eliminar prueba'}
                    </button>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    );
  };

  if (activeBuilderTest || editBuilderTest) {
    const isCreate = Boolean(activeBuilderTest);
    const builderTitle = isCreate ? activeBuilderTest!.title : editBuilderTest!.titulo;
    const kind = isCreate ? activeBuilderTest!.kind : editBuilderTest!.kind;
    const temaNombre = isCreate ? activeBuilderTest!.temaNombre : editBuilderTest!.temaNombre;
    const parcialLabel = isCreate ? activeBuilderTest!.parcialLabel : editBuilderTest!.parcialLabel;
    const difficulty = isCreate ? activeBuilderTest!.difficulty : editBuilderTest!.dificultad;
    const durationLabel = isCreate ? activeBuilderTest!.durationLabel : editBuilderTest!.durationLabel;
    const currentError = isCreate ? builderError : editBuilderError;
    const currentSuccess = isCreate ? builderSuccess : editBuilderSuccess;

    return (
      <div style={s.page}>
        <Header />

        <main style={s.main}>
          <section style={s.builderLockedShell}>
            <div style={s.builderLockedTopRow}>
              <button
                type="button"
                style={s.editBtn}
                onClick={isCreate ? handleBackFromCreateBuilder : handleBackFromEditBuilder}
              >
                Regresar a Pruebas
              </button>
            </div>

            <div style={s.builderHeader}>
              <p style={s.builderEyebrow}>Visualizador de prueba</p>
              <h3 style={s.builderTitle}>{builderTitle}</h3>
              <p style={s.builderMeta}>
                {kind === 'tema'
                  ? `Tema: ${temaNombre ?? 'Sin tema asociado'}`
                  : parcialLabel}{' '}
                | Dificultad: {getDifficultyLabel(difficulty)} | {durationLabel}
              </p>
              <p style={s.builderMeta}>Modo activo: preguntas de seleccion multiple.</p>
            </div>

            {isLoadingEditBuilder && !isCreate ? (
              <p style={s.modePlaceholderText}>Cargando preguntas de la prueba...</p>
            ) : (
              <>
                {currentError && <p style={s.errorBanner}>{currentError}</p>}
                {currentSuccess && <p style={s.successBanner}>{currentSuccess}</p>}

                {isCreate ? (
                  <TestBuilder
                    onSave={handleSaveQuestionBlocks}
                    saveLabel="Guardar preguntas de esta prueba"
                    clearOnSave={false}
                    onDirtyChange={setIsCreateBuilderDirty}
                  />
                ) : (
                  <TestBuilder
                    initialBlocks={editBuilderInitialBlocks}
                    onSave={handleSaveEditQuestionBlocks}
                    saveLabel="Guardar cambios de preguntas"
                    clearOnSave={false}
                    onDirtyChange={setIsEditBuilderDirty}
                  />
                )}
              </>
            )}
          </section>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div style={s.page}>
      <Header />

      <main style={s.main}>
        <BackButton onClick={handleGoBack} />

        <section style={s.modeSelectorCard}>
          <span style={s.modeSelectorOrbA} aria-hidden="true" />
          <span style={s.modeSelectorOrbB} aria-hidden="true" />

          <div style={s.modeSelectorTopRow}>
            <div style={s.modeSelectorHeadingWrap}>
              <p style={s.modeSelectorEyebrow}>Laboratorio de evaluación</p>
              <h1 style={s.modeSelectorTitle}>Pruebas</h1>
              <p style={s.modeSelectorSubtitle}>Elige el modo con el que quieres trabajar hoy.</p>
            </div>
            <div style={s.modeSelectorCounter}>
              <span style={s.modeSelectorCounterValue}>3</span>
              <span style={s.modeSelectorCounterLabel}>modos disponibles</span>
            </div>
          </div>

          {selectedView === 'crear' && hasUnsavedCreateChanges && (
            <p style={s.unsavedHint}>Borrador con cambios sin guardar.</p>
          )}

          <div style={s.modeSelectorGrid}>
            {viewOptions.map((option) => {
              const isSelected = selectedView === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  style={{
                    ...s.modeOptionBtn,
                    border: `2px solid ${isSelected ? option.borderColor : 'transparent'}`,
                    background: isSelected ? option.panelColor : '#ffffff',
                    boxShadow: isSelected
                      ? `0 16px 36px ${option.shadow}`
                      : '0 4px 12px rgba(15,23,42,0.03)',
                    transform: isSelected ? 'translateY(-4px) scale(1.02)' : 'none',
                  }}
                  onClick={() => handleSelectView(option.id)}
                >
                  <span style={{ ...s.modeOptionAccent, background: option.gradient }} />

                  <div style={s.modeOptionHead}>
                    <span
                      style={{
                        ...s.modeOptionIcon,
                        background: option.iconBg,
                        color: option.iconColor,
                      }}
                    >
                      {option.icon}
                    </span>
                    <span
                      style={{
                        ...s.modeOptionBadge,
                        border: `1px solid ${isSelected ? option.borderColor : '#e2e8f0'}`,
                        color: isSelected ? option.iconColor : '#64748b',
                        background: isSelected ? '#ffffff' : '#f8fafc',
                      }}
                    >
                      {isSelected ? 'Activo' : 'Listo'}
                    </span>
                  </div>

                  <span style={s.modeOptionTitle}>{option.title}</span>
                  <span style={s.modeOptionDesc}>{option.description}</span>
                  <span style={{
                    ...s.modeOptionState,
                    color: isSelected ? option.iconColor : '#94a3b8'
                  }}>
                    {isSelected ? 'MODO ACTUAL' : 'ENTRAR AL MODO >'}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedMode && (
            <div style={s.modeSelectionSummary}>
              <span style={s.modeSelectionSummaryLabel}>Modo seleccionado</span>
              <strong style={s.modeSelectionSummaryTitle}>{selectedMode.title}</strong>
              <span style={s.modeSelectionSummaryText}>{selectedMode.description}</span>
            </div>
          )}
        </section>

        {selectedView === null && (
          <section style={s.modePlaceholderCard}>
            <p style={s.modePlaceholderText}>Elige "Crear nueva", "Editar" o "Borrar" para empezar.</p>
          </section>
        )}

        {selectedView === 'crear' && (
          <section style={s.createFormCard}>
            <h2 style={s.createTitle}>Configuración obligatoria de la prueba</h2>
            <p style={s.createSubtitle}>
              Completa estos pasos. Al pulsar Crear se registra la prueba en la base de datos.
            </p>

            {isLoadingTemas && <p style={s.createStatusInfo}>Cargando temas...</p>}

            <details open style={s.accordionStep}>
              <summary style={s.accordionSummary}>1) Tipo de prueba (obligatorio)</summary>
              <div style={s.accordionBody}>
                <div style={s.optionsRow}>
                  <button
                    type="button"
                    style={{
                      ...s.optionChip,
                      ...(createForm.kind === 'tema' ? s.optionChipActive : {}),
                    }}
                    onClick={() => {
                      setCreateSuccess('');
                      setCreateError('');
                      setCreateForm((prev) => ({
                        ...prev,
                        kind: 'tema',
                        parcialKey: '',
                      }));
                    }}
                  >
                    Prueba de tema
                  </button>

                  <button
                    type="button"
                    style={{
                      ...s.optionChip,
                      ...(createForm.kind === 'parcial' ? s.optionChipActive : {}),
                    }}
                    onClick={() => {
                      setCreateSuccess('');
                      setCreateError('');
                      setCreateForm((prev) => ({
                        ...prev,
                        kind: 'parcial',
                        temaId: '',
                      }));
                    }}
                  >
                    Prueba parcial
                  </button>
                </div>
              </div>
            </details>

            {createForm.kind === 'tema' && (
              <details open style={s.accordionStep}>
                <summary style={s.accordionSummary}>2) Seleccionar tema (obligatorio)</summary>
                <div style={s.accordionBody}>
                  <select
                    value={createForm.temaId === '' ? '' : String(createForm.temaId)}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      updateFormField('temaId', nextValue ? Number(nextValue) : '');
                    }}
                    style={s.selectControl}
                  >
                    <option value="">Selecciona tema</option>
                    {PARCIALES.map((parcial) =>
                      temasByParcial[parcial.key].length > 0 ? (
                        <optgroup key={parcial.key} label={parcial.label}>
                          {temasByParcial[parcial.key].map((tema) => (
                            <option key={tema.id} value={tema.id}>
                              {tema.nombre}
                            </option>
                          ))}
                        </optgroup>
                      ) : null
                    )}
                  </select>
                  <p style={s.helperText}>El título se generará automáticamente como: "{previewTitle}".</p>
                </div>
              </details>
            )}

            {createForm.kind === 'parcial' && (
              <details open style={s.accordionStep}>
                <summary style={s.accordionSummary}>2) Seleccionar parcial (obligatorio)</summary>
                <div style={s.accordionBody}>
                  <div style={s.optionsRow}>
                    {PARCIALES.map((parcial) => (
                      <button
                        key={parcial.key}
                        type="button"
                        style={{
                          ...s.optionChip,
                          ...(createForm.parcialKey === parcial.key ? s.optionChipActive : {}),
                        }}
                        onClick={() => updateFormField('parcialKey', parcial.key)}
                      >
                        {parcial.label}
                      </button>
                    ))}
                  </div>
                  <p style={s.helperText}>El título se generará automáticamente como: "{previewTitle}".</p>
                </div>
              </details>
            )}

            <details open style={s.accordionStep}>
              <summary style={s.accordionSummary}>3) Dificultad (obligatorio)</summary>
              <div style={s.accordionBody}>
                <div style={s.optionsRow}>
                  <button
                    type="button"
                    style={{
                      ...s.optionChip,
                      ...(createForm.difficulty === 'baja' ? s.optionChipActive : {}),
                    }}
                    onClick={() => updateFormField('difficulty', 'baja')}
                  >
                    Fácil
                  </button>
                  <button
                    type="button"
                    style={{
                      ...s.optionChip,
                      ...(createForm.difficulty === 'media' ? s.optionChipActive : {}),
                    }}
                    onClick={() => updateFormField('difficulty', 'media')}
                  >
                    Media
                  </button>
                  <button
                    type="button"
                    style={{
                      ...s.optionChip,
                      ...(createForm.difficulty === 'alta' ? s.optionChipActive : {}),
                    }}
                    onClick={() => updateFormField('difficulty', 'alta')}
                  >
                    Difícil
                  </button>
                </div>
              </div>
            </details>

            <details open style={s.accordionStep}>
              <summary style={s.accordionSummary}>4) Duración (obligatorio)</summary>
              <div style={s.accordionBody}>
                <div style={s.optionsRow}>
                  <button
                    type="button"
                    style={{
                      ...s.optionChip,
                      ...(createForm.timingChoice === 'sin_tiempo' ? s.optionChipActive : {}),
                    }}
                    onClick={() =>
                      setCreateForm((prev) => ({
                        ...prev,
                        timingChoice: 'sin_tiempo',
                        timedScope: '',
                      }))
                    }
                  >
                    Sin tiempo
                  </button>

                  <button
                    type="button"
                    style={{
                      ...s.optionChip,
                      ...(createForm.timingChoice === 'con_tiempo' ? s.optionChipActive : {}),
                    }}
                    onClick={() =>
                      setCreateForm((prev) => ({
                        ...prev,
                        timingChoice: 'con_tiempo',
                      }))
                    }
                  >
                    Con tiempo
                  </button>
                </div>

                {createForm.timingChoice === 'con_tiempo' && (
                  <div style={s.optionTextWrap}>
                    <div style={s.optionsRow}>
                      <button
                        type="button"
                        style={{
                          ...s.optionChip,
                          ...(createForm.timedScope === 'total' ? s.optionChipActive : {}),
                        }}
                        onClick={() => updateFormField('timedScope', 'total')}
                      >
                        Tiempo para toda la prueba
                      </button>
                      <button
                        type="button"
                        style={{
                          ...s.optionChip,
                          ...(createForm.timedScope === 'por_pregunta' ? s.optionChipActive : {}),
                        }}
                        onClick={() => updateFormField('timedScope', 'por_pregunta')}
                      >
                        Tiempo por pregunta
                      </button>
                    </div>

                    {createForm.timedScope === 'total' && (
                      <label style={s.helperText}>
                        Minutos para toda la prueba:
                        <input
                          type="number"
                          min={1}
                          value={createForm.totalDurationMin}
                          onChange={(event) => {
                            const nextValue = Math.max(1, Number(event.target.value) || 1);
                            updateFormField('totalDurationMin', nextValue);
                          }}
                          style={s.selectControl}
                        />
                      </label>
                    )}

                    {createForm.timedScope === 'por_pregunta' && (
                      <label style={s.helperText}>
                        Minutos por pregunta:
                        <input
                          type="number"
                          min={1}
                          value={createForm.perQuestionDurationMin}
                          onChange={(event) => {
                            const nextValue = Math.max(1, Number(event.target.value) || 1);
                            updateFormField('perQuestionDurationMin', nextValue);
                          }}
                          style={s.selectControl}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            </details>

            <div style={s.previewCard}>
              <h3 style={s.previewTitleText}>Resumen automático</h3>
              <p style={s.previewText}>Título: {previewTitle}</p>
              <p style={s.previewText}>
                Tipo: {createForm.kind === 'tema' ? 'Prueba de tema' : createForm.kind === 'parcial' ? 'Prueba parcial' : 'Sin seleccionar'}
              </p>
              <p style={s.previewText}>Dificultad: {createForm.difficulty ? getDifficultyLabel(createForm.difficulty) : 'Sin seleccionar'}</p>
            </div>

            {createValidationError && <p style={s.validationHint}>{createValidationError}</p>}
            {createError && <p style={s.errorBanner}>{createError}</p>}
            {createSuccess && <p style={s.successBanner}>{createSuccess}</p>}

            <div style={s.createActionRow}>
              <button
                type="button"
                style={{
                  ...s.primaryBtn,
                  ...(createValidationError || isCreating ? s.primaryBtnDisabled : {}),
                }}
                onClick={handleCreateTest}
                disabled={Boolean(createValidationError) || isCreating || isLoadingTemas}
              >
                {isCreating ? 'Creando...' : 'Crear prueba'}
              </button>
              <button type="button" style={s.deleteBtn} onClick={resetCreateDraft}>
                Limpiar formulario
              </button>
            </div>
          </section>
        )}

        {selectedView === 'editar' && (
          <section style={s.testListShell}>
            <h2 style={s.modePlaceholderTitle}>Editar pruebas</h2>
            <p style={s.testListIntro}>Listado ordenado: primero pruebas parciales, después pruebas por tema.</p>

            {isLoadingTests ? (
              <p style={s.modePlaceholderText}>Cargando pruebas...</p>
            ) : testsError ? (
              <p style={s.errorBanner}>{testsError}</p>
            ) : (
              <>
                {renderTestsGroup(
                  'Pruebas parciales',
                  testsByType.parciales,
                  'No hay pruebas parciales registradas.',
                  false,
                  true,
                  handleOpenEditBuilder
                )}
                {renderTestsGroup(
                  'Pruebas por tema',
                  testsByType.temas,
                  'No hay pruebas por tema registradas.',
                  false,
                  true,
                  handleOpenEditBuilder
                )}
              </>
            )}
          </section>
        )}

        {selectedView === 'eliminar' && (
          <section style={s.testListShell}>
            <h2 style={s.modePlaceholderTitle}>Borrar pruebas</h2>
            <p style={s.testListIntro}>Listado ordenado: primero pruebas parciales, después pruebas por tema.</p>

            {isLoadingTests ? (
              <p style={s.modePlaceholderText}>Cargando pruebas...</p>
            ) : testsError ? (
              <p style={s.errorBanner}>{testsError}</p>
            ) : (
              <>
                {renderTestsGroup(
                  'Pruebas parciales',
                  testsByType.parciales,
                  'No hay pruebas parciales registradas.',
                  true,
                  false,
                  null
                )}
                {renderTestsGroup(
                  'Pruebas por tema',
                  testsByType.temas,
                  'No hay pruebas por tema registradas.',
                  true,
                  false,
                  null
                )}
              </>
            )}
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    color: '#0f172a',
    background: 'transparent',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1240px',
    margin: '0 auto',
    padding: 'clamp(16px, 4vw, 40px) clamp(12px, 3vw, 24px) clamp(24px, 5vw, 56px)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  modeSelectorCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '24px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    boxShadow: '0 12px 36px rgba(15,23,42,0.05)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  modeSelectorOrbA: {
    position: 'absolute',
    width: '300px',
    height: '300px',
    borderRadius: '999px',
    background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, rgba(14,165,233,0) 70%)',
    right: '-150px',
    top: '-100px',
    pointerEvents: 'none',
  },
  modeSelectorOrbB: {
    position: 'absolute',
    width: '250px',
    height: '250px',
    borderRadius: '999px',
    background: 'radial-gradient(circle, rgba(56,189,248,0.06) 0%, rgba(56,189,248,0) 70%)',
    left: '-80px',
    bottom: '-120px',
    pointerEvents: 'none',
  },
  modeSelectorTopRow: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
  },
  modeSelectorHeadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },
  modeSelectorEyebrow: {
    margin: 0,
    fontSize: '0.8em',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#0284c7',
  },
  modeSelectorTitle: {
    margin: 0,
    fontSize: 'clamp(1.6em, 2.8vw, 2.2em)',
    fontWeight: 900,
    letterSpacing: '-0.02em',
    color: '#0f172a',
  },
  modeSelectorSubtitle: {
    margin: 0,
    fontSize: '0.95em',
    color: '#64748b',
  },
  modeSelectorCounter: {
    position: 'relative',
    zIndex: 1,
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '150px',
    alignItems: 'flex-start',
    gap: '2px',
  },
  modeSelectorCounterValue: {
    fontSize: '1.6em',
    fontWeight: 900,
    color: '#0369a1',
    lineHeight: 1,
  },
  modeSelectorCounterLabel: {
    fontSize: '0.78em',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#0284c7',
  },
  unsavedHint: {
    position: 'relative',
    zIndex: 1,
    margin: 0,
    fontSize: '0.85em',
    color: '#9f1239',
    fontWeight: 700,
    borderRadius: '10px',
    border: '1px solid #fecdd3',
    background: '#fff1f2',
    padding: '8px 14px',
    alignSelf: 'flex-start',
  },
  modeSelectorGrid: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
  },
  modeOptionBtn: {
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    background: '#ffffff',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '12px',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    minHeight: '170px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  modeOptionAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '6px',
  },
  modeOptionHead: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  modeOptionIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1em',
    fontWeight: 900,
    lineHeight: 1,
    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
  },
  modeOptionBadge: {
    borderRadius: '999px',
    fontSize: '0.7em',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '4px 10px',
  },
  modeOptionTitle: {
    fontSize: '1.05em',
    fontWeight: 800,
    color: '#0f172a',
    marginTop: '4px',
  },
  modeOptionDesc: {
    fontSize: '0.88em',
    color: '#64748b',
    lineHeight: 1.5,
  },
  modeOptionState: {
    marginTop: 'auto',
    fontSize: '0.78em',
    color: '#0284c7',
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    opacity: 0.9,
    paddingTop: '8px',
  },
  modeSelectionSummary: {
    position: 'relative',
    zIndex: 1,
    display: 'none',
  },
  modeSelectionSummaryLabel: {
    display: 'none',
  },
  modeSelectionSummaryTitle: {
    display: 'none',
    fontWeight: 900,
  },
  modeSelectionSummaryText: {
    display: 'none',
  },
  modePlaceholderCard: {
    borderRadius: '14px',
    border: '1px dashed #cbd5e1',
    background: '#f8fafc',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  modePlaceholderTitle: {
    margin: 0,
    fontSize: '1em',
    fontWeight: 800,
    color: '#0f172a',
  },
  modePlaceholderText: {
    margin: 0,
    fontSize: '0.9em',
    color: '#475569',
    lineHeight: 1.55,
  },
  createFormCard: {
    borderRadius: '24px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    boxShadow: '0 12px 36px rgba(15,23,42,0.05)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  createTitle: {
    margin: 0,
    fontSize: '1.4em',
    fontWeight: 900,
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  createSubtitle: {
    margin: 0,
    fontSize: '0.95em',
    color: '#64748b',
    lineHeight: 1.6,
  },
  createStatusInfo: {
    margin: 0,
    fontSize: '0.85em',
    color: '#0284c7',
    fontWeight: 700,
    background: '#e0f2fe',
    padding: '8px 12px',
    borderRadius: '8px',
    display: 'inline-block',
    alignSelf: 'flex-start',
  },
  accordionStep: {
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    background: '#ffffff',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(15,23,42,0.02)',
    transition: 'all 0.3s ease',
  },
  accordionSummary: {
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '0.95em',
    padding: '16px 20px',
    color: '#0f172a',
    background: '#f8fafc',
    userSelect: 'none',
    outline: 'none',
    borderBottom: '1px solid transparent',
  },
  accordionBody: {
    borderTop: '1px solid #f1f5f9',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    background: '#ffffff',
  },
  optionsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  optionChip: {
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#475569',
    borderRadius: '12px',
    padding: '10px 16px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.88em',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  },
  optionChipActive: {
    border: '1px solid transparent',
    background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
    color: '#ffffff',
    boxShadow: '0 6px 14px rgba(14,165,233,0.3)',
    transform: 'translateY(-1px)',
  },
  optionTextWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginTop: '4px',
  },
  selectControl: {
    width: '100%',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px 14px',
    fontSize: '0.9em',
    fontWeight: 600,
    color: '#0f172a',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: '#f8fafc',
    marginTop: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  helperText: {
    margin: 0,
    fontSize: '0.85em',
    color: '#64748b',
    lineHeight: 1.5,
    fontWeight: 500,
  },
  previewCard: {
    borderRadius: '16px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(145deg, #f0f9ff, #f8fafc)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    boxShadow: '0 4px 15px rgba(14,165,233,0.08)',
    marginTop: '8px',
  },
  previewTitleText: {
    margin: '0 0 4px 0',
    fontSize: '0.85em',
    fontWeight: 800,
    color: '#0369a1',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  previewText: {
    margin: 0,
    fontSize: '0.95em',
    color: '#0f172a',
    fontWeight: 600,
  },
  validationHint: {
    margin: '8px 0 0 0',
    fontSize: '0.88em',
    color: '#92400e',
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: '12px',
    padding: '12px 16px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  createActionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },
  builderShell: {
    borderRadius: '16px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '8px',
  },
  builderLockedShell: {
    borderRadius: '20px',
    border: '1px solid #dbeafe',
    background: '#ffffff',
    boxShadow: '0 12px 36px rgba(15,23,42,0.05)',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  builderLockedTopRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  builderHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  builderEyebrow: {
    margin: 0,
    fontSize: '0.74em',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#0369a1',
  },
  builderTitle: {
    margin: 0,
    fontSize: '1.04em',
    fontWeight: 900,
    color: '#0f172a',
  },
  builderMeta: {
    margin: 0,
    fontSize: '0.86em',
    color: '#475569',
    lineHeight: 1.5,
  },
  primaryBtn: {
    border: 'none',
    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
    color: '#ffffff',
    borderRadius: '12px',
    padding: '12px 24px',
    fontSize: '0.95em',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 6px 16px rgba(14,165,233,0.25)',
    transition: 'all 0.2s ease',
  },
  primaryBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
    background: '#94a3b8',
    boxShadow: 'none',
    transform: 'none',
  },
  errorBanner: {
    margin: '8px 0 0 0',
    fontSize: '0.88em',
    color: '#9f1239',
    border: '1px solid #fda4af',
    background: '#fff1f2',
    borderRadius: '12px',
    padding: '12px 16px',
    fontWeight: 600,
  },
  successBanner: {
    margin: '8px 0 0 0',
    fontSize: '0.88em',
    color: '#166534',
    border: '1px solid #86efac',
    background: '#f0fdf4',
    borderRadius: '12px',
    padding: '12px 16px',
    fontWeight: 600,
  },
  testListShell: {
    borderRadius: '24px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    boxShadow: '0 12px 36px rgba(15,23,42,0.05)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  testListIntro: {
    margin: 0,
    fontSize: '0.95em',
    color: '#64748b',
    lineHeight: 1.6,
  },
  testGroupCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    background: '#f8fafc',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  testGroupTitle: {
    margin: 0,
    fontSize: '1.05em',
    fontWeight: 900,
    color: '#0f172a',
    letterSpacing: '-0.01em',
  },
  testGroupEmpty: {
    margin: 0,
    fontSize: '0.9em',
    color: '#64748b',
    fontStyle: 'italic',
  },
  testCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: '0 4px 12px rgba(15,23,42,0.03)',
    transition: 'all 0.2s',
  },
  testCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '12px',
    flexWrap: 'wrap',
  },
  testTitle: {
    margin: 0,
    fontSize: '1.05em',
    fontWeight: 800,
    color: '#0f172a',
    lineHeight: 1.3,
  },
  kindBadge: {
    fontSize: '0.7em',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '4px 10px',
    borderRadius: '999px',
    background: '#f0fdf4',
    color: '#166534',
    border: '1px solid #bbf7d0',
    whiteSpace: 'nowrap',
  },
  kindBadgeParcial: {
    background: '#fffbeb',
    color: '#92400e',
    border: '1px solid #fde68a',
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  metaPill: {
    fontSize: '0.75em',
    fontWeight: 600,
    color: '#475569',
    background: '#f1f5f9',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
  },
  testActionsRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '6px',
  },
  editBtn: {
    alignSelf: 'flex-start',
    border: '1px solid #bae6fd',
    background: '#f0f9ff',
    color: '#0369a1',
    borderRadius: '10px',
    padding: '10px 18px',
    fontSize: '0.88em',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.2s',
  },
  deleteBtn: {
    alignSelf: 'flex-start',
    border: 'none',
    background: '#fef2f2',
    color: '#e11d48',
    borderRadius: '10px',
    padding: '10px 18px',
    fontSize: '0.88em',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.2s',
    marginTop: '6px',
  },
};

export default Pruebas;
