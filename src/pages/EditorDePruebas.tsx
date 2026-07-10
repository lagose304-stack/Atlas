import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import Footer from '../components/Footer';
import Header from '../components/Header';
import SenaladoLocationPicker from '../components/SenaladoLocationPicker';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { uploadToCloudinary, deleteFromCloudinary } from '../services/cloudinary';
import { acquireAtlasScrollLock, releaseAtlasScrollLock } from '../constants/scrollLock';
import { supabase } from '../services/supabase';

type TestScope = 'parcial' | 'tema' | 'subtema';

type ParcialKey = 'primer' | 'segundo' | 'tercer';

interface PruebaRow {
  id: string;
  nombre: string;
  instrucciones: string;
  scope: TestScope;
  parcial_key: ParcialKey;
  tema_id: number | null;
  subtema_id: number | null;
  estado: string;
  created_at: string;
  updated_at: string;
  image_url?: string | null;
}

interface TemaRow {
  id: number;
  nombre: string;
  parcial: string;
  sort_order: number | null;
}

interface SubtemaRow {
  id: number;
  nombre: string;
  tema_id: number;
  sort_order: number | null;
}

interface PlacaRow {
  id: number;
  photo_url: string;
  tema_id: number;
  subtema_id: number;
}

interface MarkerLocation {
  x: number;
  y: number;
  startX?: number | null;
  startY?: number | null;
}

interface PreguntaRow {
  id: string;
  prueba_id: string;
  sort_order: number;
  tipo: string;
  titulo: string;
  retroalimentacion: string | null;
  required: boolean;
  reference_placa_id: number | null;
  reference_photo_url: string | null;
  reference_tema_name: string | null;
  reference_subtema_name: string | null;
  reference_senalado_x: number | null;
  reference_senalado_y: number | null;
  reference_senalado_start_x: number | null;
  reference_senalado_start_y: number | null;
}

interface OpcionRow {
  id: string;
  pregunta_id: string;
  sort_order: number;
  texto: string;
  is_correct: boolean;
}

const PARCIALES: Array<{ key: ParcialKey; label: string }> = [
  { key: 'primer', label: 'Primer parcial' },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer', label: 'Tercer parcial' },
];

interface QuestionOptionDraft {
  id: string;
  text: string;
  isCorrect: boolean;
  sortOrder: number;
}

interface QuestionDraft {
  id: string;
  sortOrder: number;
  title: string;
  retroalimentacion: string;
  required: boolean;
  options: QuestionOptionDraft[];
  referencePlacaId: number | null;
  referencePhotoUrl: string | null;
  referenceTemaName: string;
  referenceSubtemaName: string;
  referenceSenaladoLocation: MarkerLocation | null;
}

const createOption = (text: string, sortOrder: number, isCorrect = false): QuestionOptionDraft => ({
  id: `option-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  text,
  isCorrect,
  sortOrder,
});

const createBlankQuestion = (index = 0): QuestionDraft => ({
  id: `question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  sortOrder: index,
  title: '',
  retroalimentacion: '',
  required: true,
  options: [
    createOption('Opción 1', 0, true),
    createOption('Opción 2', 1),
    createOption('Opción 3', 2),
    createOption('Opción 4', 3),
  ],
  referencePlacaId: null,
  referencePhotoUrl: null,
  referenceTemaName: '',
  referenceSubtemaName: '',
  referenceSenaladoLocation: null,
});

const normalizeQuestionSortOrder = (questions: QuestionDraft[]): QuestionDraft[] =>
  questions.map((question, questionIndex) => ({
    ...question,
    sortOrder: questionIndex,
    options: question.options.map((option, optionIndex) => ({
      ...option,
      sortOrder: optionIndex,
    })),
  }));

const refreshNativeSpellcheck = (element: HTMLInputElement | HTMLTextAreaElement) => {
  const previousSpellcheck = element.getAttribute('spellcheck');
  element.setAttribute('spellcheck', 'false');

  window.requestAnimationFrame(() => {
    element.setAttribute('spellcheck', previousSpellcheck ?? 'true');
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

interface ReferencePickerState {
  questionId: string;
  scope: TestScope;
  partialKey: ParcialKey | null;
  temaId: number | null;
  subtemaId: number | null;
  step: 'parcial' | 'tema' | 'subtema' | 'placa';
  placas: PlacaRow[];
  loading: boolean;
  error: string;
}

interface ReferenceMarkerState {
  questionId: string;
  placaId: number;
  photoUrl: string;
  temaName: string;
  subtemaName: string;
  location: MarkerLocation | null;
}

const EditorDePruebas: React.FC = () => {
  const location = useLocation();
  const { pruebaId } = useParams();
  const [prueba, setPrueba] = useState<PruebaRow | null>(null);
  const [temaNombre, setTemaNombre] = useState('');
  const [subtemaNombre, setSubtemaNombre] = useState('');
  const [nombre, setNombre] = useState('');
  const [instrucciones, setInstrucciones] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([createBlankQuestion()]);
  const [pruebaImageFile, setPruebaImageFile] = useState<File | null>(null);
  const [pruebaImagePreview, setPruebaImagePreview] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [referencePicker, setReferencePicker] = useState<ReferencePickerState | null>(null);
  const [pickerTemas, setPickerTemas] = useState<TemaRow[]>([]);
  const [pickerSubtemas, setPickerSubtemas] = useState<SubtemaRow[]>([]);
  const [referenceMarkerPicker, setReferenceMarkerPicker] = useState<ReferenceMarkerState | null>(null);

  useEffect(() => {
    if (!referencePicker && !referenceMarkerPicker) return;

    acquireAtlasScrollLock();
    return () => {
      releaseAtlasScrollLock();
    };
  }, [referencePicker, referenceMarkerPicker]);

  const loadQuestionsFromDatabase = async (pruebaIdValue: string) => {
    const { data: preguntasData, error: preguntasError } = await supabase
      .from('prueba_preguntas')
      .select('id, prueba_id, sort_order, tipo, titulo, retroalimentacion, required, reference_placa_id, reference_photo_url, reference_tema_name, reference_subtema_name, reference_senalado_x, reference_senalado_y, reference_senalado_start_x, reference_senalado_start_y')
      .eq('prueba_id', pruebaIdValue)
      .order('sort_order', { ascending: true });

    if (preguntasError) {
      return;
    }

    const preguntas = (preguntasData ?? []) as PreguntaRow[];
    if (preguntas.length === 0) {
      setQuestions([createBlankQuestion()]);
      return;
    }

    const preguntaIds = preguntas.map(pregunta => pregunta.id);
    const { data: opcionesData, error: opcionesError } = await supabase
      .from('prueba_pregunta_opciones')
      .select('id, pregunta_id, sort_order, texto, is_correct')
      .in('pregunta_id', preguntaIds)
      .order('sort_order', { ascending: true });

    if (opcionesError) {
      return;
    }

    const opcionesPorPregunta = new Map<string, OpcionRow[]>();
    (opcionesData ?? []).forEach((opcion) => {
      const row = opcion as OpcionRow;
      const current = opcionesPorPregunta.get(row.pregunta_id) ?? [];
      current.push(row);
      opcionesPorPregunta.set(row.pregunta_id, current);
    });

    setQuestions(preguntas.map((pregunta) => {
      const opciones = opcionesPorPregunta.get(pregunta.id) ?? [];

      return {
        id: pregunta.id,
        sortOrder: pregunta.sort_order,
        title: pregunta.titulo,
        retroalimentacion: pregunta.retroalimentacion ?? '',
        required: pregunta.required,
        options: opciones.length > 0
          ? opciones.map((opcion) => ({
              id: opcion.id,
              text: opcion.texto,
              isCorrect: opcion.is_correct,
              sortOrder: opcion.sort_order,
            }))
          : [
              createOption('Opción 1', 0, true),
            ],
        referencePlacaId: pregunta.reference_placa_id,
        referencePhotoUrl: pregunta.reference_photo_url,
        referenceTemaName: pregunta.reference_tema_name ?? '',
        referenceSubtemaName: pregunta.reference_subtema_name ?? '',
        referenceSenaladoLocation:
          pregunta.reference_senalado_x != null &&
          pregunta.reference_senalado_y != null
            ? {
                x: pregunta.reference_senalado_x,
                y: pregunta.reference_senalado_y,
                startX: pregunta.reference_senalado_start_x,
                startY: pregunta.reference_senalado_start_y,
              }
            : null,
      };
    }));
  };

  useEffect(() => {
    const fetchPrueba = async () => {
      if (!pruebaId) {
        setError('No se encontró el identificador de la prueba.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');
      setMessage('');

      const { data, error: pruebaError } = await supabase
        .from('pruebas')
        .select('id, nombre, instrucciones, scope, parcial_key, tema_id, subtema_id, estado, created_at, updated_at, image_url')
        .eq('id', pruebaId)
        .single();

      if (pruebaError || !data) {
        setError('No se pudo cargar la prueba.');
        setIsLoading(false);
        return;
      }

      const nextPrueba = data as PruebaRow;
      setPrueba(nextPrueba);
      setNombre(nextPrueba.nombre);
      setInstrucciones(nextPrueba.instrucciones ?? '');
      setPruebaImagePreview(nextPrueba.image_url ?? null);

      if (nextPrueba.tema_id) {
        const { data: temaData } = await supabase
          .from('temas')
          .select('id, nombre')
          .eq('id', nextPrueba.tema_id)
          .single();

        const tema = temaData as TemaRow | null;
        setTemaNombre(tema?.nombre ?? `Tema ${nextPrueba.tema_id}`);
      } else {
        setTemaNombre('No aplica');
      }

      if (nextPrueba.subtema_id) {
        const { data: subtemaData } = await supabase
          .from('subtemas')
          .select('id, nombre')
          .eq('id', nextPrueba.subtema_id)
          .single();

        const subtema = subtemaData as SubtemaRow | null;
        setSubtemaNombre(subtema?.nombre ?? `Subtema ${nextPrueba.subtema_id}`);
      } else {
        setSubtemaNombre('No aplica');
      }

      await loadQuestionsFromDatabase(nextPrueba.id);

      setIsLoading(false);
    };

    void fetchPrueba();
  }, [pruebaId]);

  const canSave = useMemo(() => {
    return Boolean(prueba) && nombre.trim().length > 0;
  }, [nombre, prueba]);

  const handleSave = async () => {
    if (!prueba || !canSave || isSaving) {
      return;
    }

    setIsSaving(true);
    setError('');
    setMessage('');

    const orderedQuestions = normalizeQuestionSortOrder(questions);
    const preguntasPayload = orderedQuestions.map(question => ({
      sortOrder: question.sortOrder,
      title: question.title.trim(),
      retroalimentacion: question.retroalimentacion.trim(),
      required: question.required,
      referencePlacaId: question.referencePlacaId,
      referencePhotoUrl: question.referencePhotoUrl,
      referenceTemaName: question.referenceTemaName,
      referenceSubtemaName: question.referenceSubtemaName,
      referenceSenaladoLocation: question.referenceSenaladoLocation
        ? {
            x: question.referenceSenaladoLocation.x,
            y: question.referenceSenaladoLocation.y,
            startX: question.referenceSenaladoLocation.startX ?? null,
            startY: question.referenceSenaladoLocation.startY ?? null,
          }
        : null,
      options: question.options.map(option => ({
        sortOrder: option.sortOrder,
        text: option.text.trim(),
        isCorrect: option.isCorrect,
      })),
    }));

    // If a new image file was selected, upload it first to Cloudinary under folder 'pruebas'
    const prevImageUrl = prueba?.image_url || '';
    let uploadedImageUrl: string | null = null;
    if (pruebaImageFile) {
      try {
        const uploadResult = await uploadToCloudinary(pruebaImageFile, { folder: 'pruebas', optimizeImage: true });
        uploadedImageUrl = uploadResult.secure_url || uploadResult.url || null;
      } catch (uploadErr: unknown) {
        setError((uploadErr as Error).message || 'No se pudo subir la imagen.');
        setIsSaving(false);
        return;
      }
    }

    const { error: updateError } = await supabase.rpc('guardar_prueba_completa', {
      p_prueba_id: prueba.id,
      p_nombre: nombre.trim(),
      p_instrucciones: instrucciones.trim(),
      p_preguntas: preguntasPayload,
    });

    if (updateError) {
      setError(updateError.message || 'No se pudieron guardar los cambios.');
      setIsSaving(false);
      return;
    }

    // If uploadedImageUrl is available, persist it on the pruebas row
    if (uploadedImageUrl) {
      try {
        await supabase.from('pruebas').update({ image_url: uploadedImageUrl }).eq('id', prueba.id);
        setPrueba(prev => (prev ? { ...prev, image_url: uploadedImageUrl } : prev));
        setPruebaImagePreview(uploadedImageUrl);
        setPruebaImageFile(null);

        // If there was a previous image, attempt to delete it from Cloudinary
        if (prevImageUrl) {
          try {
            await deleteFromCloudinary(prevImageUrl);
          } catch (delErr) {
            console.warn('No se pudo borrar la imagen previa en Cloudinary', delErr);
          }
        }
      } catch (e) {
        console.warn('No se pudo actualizar image_url en la prueba', e);
      }
    }

    // If user requested to remove existing image without uploading a new one
    if (!uploadedImageUrl && removeExistingImage) {
      try {
        await supabase.from('pruebas').update({ image_url: '' }).eq('id', prueba.id);
        setPrueba(prev => (prev ? { ...prev, image_url: '' } : prev));
        // delete previous image from Cloudinary if present
        if (prevImageUrl) {
          try {
            await deleteFromCloudinary(prevImageUrl);
          } catch (delErr) {
            console.warn('No se pudo borrar la imagen previa en Cloudinary', delErr);
          }
        }
        setRemoveExistingImage(false);
      } catch (e) {
        console.warn('No se pudo limpiar image_url en la prueba', e);
      }
    }

    setQuestions(orderedQuestions);
    setPrueba(prev => (prev ? { ...prev, nombre: nombre.trim(), instrucciones: instrucciones.trim() } : prev));
    setMessage('Cambios guardados correctamente.');
    setIsSaving(false);
  };

  const addQuestion = () => {
    setQuestions(prev => normalizeQuestionSortOrder([...prev, createBlankQuestion(prev.length)]));
  };

  const duplicateQuestion = (questionId: string) => {
    setQuestions(prev => {
      const index = prev.findIndex(question => question.id === questionId);
      if (index < 0) return prev;

      const question = prev[index];
      const duplicated: QuestionDraft = {
        ...question,
        id: `question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sortOrder: index + 1,
        title: question.title ? `${question.title} (copia)` : '',
        options: question.options.map(option => ({
          ...option,
          id: `option-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          sortOrder: option.sortOrder,
        })),
      };

      const next = [...prev];
      next.splice(index + 1, 0, duplicated);
      return normalizeQuestionSortOrder(next);
    });
  };

  const removeQuestion = (questionId: string) => {
    setQuestions(prev => {
      const next = prev.filter(question => question.id !== questionId);
      return normalizeQuestionSortOrder(next.length > 0 ? next : [createBlankQuestion()]);
    });
  };

  const updateQuestionField = (questionId: string, field: 'title' | 'retroalimentacion' | 'required', value: string | boolean) => {
    setQuestions(prev => prev.map(question => {
      if (question.id !== questionId) return question;
      return {
        ...question,
        [field]: value,
      } as QuestionDraft;
    }));
  };

  const updateQuestionOption = (questionId: string, optionId: string, text: string) => {
    setQuestions(prev => prev.map(question => {
      if (question.id !== questionId) return question;
      return {
        ...question,
        options: question.options.map(option => (
          option.id === optionId ? { ...option, text } : option
        )),
      };
    }));
  };

  const setCorrectOption = (questionId: string, optionId: string) => {
    setQuestions(prev => prev.map(question => {
      if (question.id !== questionId) return question;
      return {
        ...question,
        options: question.options.map(option => ({
          ...option,
          isCorrect: option.id === optionId,
        })),
      };
    }));
  };

  const addQuestionOption = (questionId: string) => {
    setQuestions(prev => prev.map(question => {
      if (question.id !== questionId) return question;

      return {
        ...question,
        options: [...question.options, createOption(`Opción ${question.options.length + 1}`, question.options.length)],
      };
    }));
  };

  const removeQuestionOption = (questionId: string, optionId: string) => {
    setQuestions(prev => prev.map(question => {
      if (question.id !== questionId) return question;

      const nextOptions = question.options.filter(option => option.id !== optionId);
      if (nextOptions.length === 0) {
        return question;
      }

      if (!nextOptions.some(option => option.isCorrect)) {
        nextOptions[0] = { ...nextOptions[0], isCorrect: true };
      }

      return {
        ...question,
        options: nextOptions.map((option, optionIndex) => ({
          ...option,
          sortOrder: optionIndex,
        })),
      };
    }));
  };

  const scopeLabel = prueba
    ? prueba.scope === 'parcial'
      ? 'Prueba parcial'
      : prueba.scope === 'tema'
        ? 'Prueba de tema'
        : 'Prueba de subtema'
    : '';

  const parcialLabel = prueba
    ? prueba.parcial_key === 'primer'
      ? 'Primer parcial'
      : prueba.parcial_key === 'segundo'
        ? 'Segundo parcial'
        : 'Tercer parcial'
    : '';

  const backTarget = (location.state as { from?: string } | null)?.from ?? '/pruebas';

  const selectedReferenceTema = referencePicker
    ? pickerTemas.find(tema => tema.id === referencePicker.temaId) ?? null
    : null;

  const selectedReferenceSubtema = referencePicker
    ? pickerSubtemas.find(subtema => subtema.id === referencePicker.subtemaId) ?? null
    : null;

  const temasDisponibles = referencePicker
    ? (referencePicker.partialKey
        ? pickerTemas.filter(tema => tema.parcial === referencePicker.partialKey)
        : pickerTemas)
    : [];

  useEffect(() => {
    const fetchPickerTemas = async () => {
      const { data, error: fetchError } = await supabase
        .from('temas')
        .select('id, nombre, parcial, sort_order')
        .order('parcial', { ascending: true })
        .order('sort_order', { ascending: true });

      if (!fetchError) {
        setPickerTemas((data ?? []) as TemaRow[]);
      }
    };

    void fetchPickerTemas();
  }, []);

  const openReferencePicker = async (questionId: string) => {
    if (!prueba) return;

    setReferencePicker({
      questionId,
      scope: prueba.scope,
      partialKey: prueba.parcial_key,
      temaId: prueba.tema_id,
      subtemaId: prueba.subtema_id,
      step: prueba.scope === 'parcial' ? 'parcial' : prueba.scope === 'tema' ? 'subtema' : 'placa',
      placas: [],
      loading: false,
      error: '',
    });

    setPickerSubtemas([]);

    if (prueba.scope === 'tema' && prueba.tema_id) {
      await loadSubtemasForTema(prueba.tema_id);
      setReferencePicker(prev => (prev ? { ...prev, step: 'subtema' } : prev));
      return;
    }

    if (prueba.scope === 'subtema' && prueba.subtema_id) {
      await loadPlacasForSubtema(prueba.subtema_id);
    }
  };

  const loadSubtemasForTema = async (temaId: number) => {
    setReferencePicker(prev => (prev ? { ...prev, loading: true, error: '' } : prev));
    const { data, error: fetchError } = await supabase
      .from('subtemas')
      .select('id, nombre, tema_id, sort_order')
      .eq('tema_id', temaId)
      .order('sort_order', { ascending: true });

    if (fetchError) {
      setReferencePicker(prev => (prev ? { ...prev, loading: false, error: 'No se pudieron cargar los subtemas.' } : prev));
      return;
    }

    setPickerSubtemas((data ?? []) as SubtemaRow[]);
    setReferencePicker(prev => (prev ? { ...prev, loading: false, error: '', step: 'subtema' } : prev));
  };

  const loadPlacasForSubtema = async (subtemaId: number) => {
    setReferencePicker(prev => (prev ? { ...prev, loading: true, error: '' } : prev));
    const { data, error: fetchError } = await supabase
      .from('placas')
      .select('id, photo_url, tema_id, subtema_id')
      .eq('subtema_id', subtemaId)
      .order('sort_order', { ascending: true });

    if (fetchError) {
      setReferencePicker(prev => (prev ? { ...prev, loading: false, error: 'No se pudieron cargar las placas.' } : prev));
      return;
    }

    setReferencePicker(prev => (prev ? { ...prev, loading: false, error: '', step: 'placa', placas: (data ?? []) as PlacaRow[] } : prev));
  };

  const handleSelectPartial = (partialKey: ParcialKey) => {
    setReferencePicker(prev => (prev ? {
      ...prev,
      partialKey,
      temaId: null,
      subtemaId: null,
      placas: [],
      error: '',
      step: 'tema',
    } : prev));
    setPickerSubtemas([]);
  };

  const handleSelectTema = (tema: TemaRow) => {
    setReferencePicker(prev => (prev ? {
      ...prev,
      temaId: tema.id,
      subtemaId: null,
      placas: [],
      error: '',
      step: 'subtema',
    } : prev));
    void loadSubtemasForTema(tema.id);
  };

  const handleSelectSubtema = (subtema: SubtemaRow) => {
    setReferencePicker(prev => (prev ? {
      ...prev,
      subtemaId: subtema.id,
      placas: [],
      error: '',
      step: 'placa',
    } : prev));
    void loadPlacasForSubtema(subtema.id);
  };

  const setQuestionReference = (questionId: string, placa: PlacaRow) => {
    const temaName = pickerTemas.find(tema => tema.id === placa.tema_id)?.nombre ?? '';
    const subtemaName = pickerSubtemas.find(subtema => subtema.id === placa.subtema_id)?.nombre ?? '';

    setReferenceMarkerPicker({
      questionId,
      placaId: placa.id,
      photoUrl: placa.photo_url,
      temaName,
      subtemaName,
      location: null,
    });
    setReferencePicker(null);
  };

  const handleEditReferenceMarker = (question: QuestionDraft) => {
    if (!question.referencePlacaId || !question.referencePhotoUrl) return;

    setReferenceMarkerPicker({
      questionId: question.id,
      placaId: question.referencePlacaId,
      photoUrl: question.referencePhotoUrl,
      temaName: question.referenceTemaName,
      subtemaName: question.referenceSubtemaName,
      location: question.referenceSenaladoLocation,
    });
  };

  const handleSaveReferenceMarker = (location: MarkerLocation | null) => {
    if (!referenceMarkerPicker) return;

    setQuestions(prev => prev.map(question => {
      if (question.id !== referenceMarkerPicker.questionId) return question;
      return {
        ...question,
        referencePlacaId: referenceMarkerPicker.placaId,
        referencePhotoUrl: referenceMarkerPicker.photoUrl,
        referenceTemaName: referenceMarkerPicker.temaName,
        referenceSubtemaName: referenceMarkerPicker.subtemaName,
        referenceSenaladoLocation: location,
      };
    }));

    setReferenceMarkerPicker(null);
  };

  return (
    <div style={s.page}>
      <Header disableInteractions />

      <main style={s.main} className="edicion-main">
        <section style={s.hero} className="edicion-card">
          <div style={s.heroText}>
            <p style={s.kicker}>Pruebas</p>
            <h1 style={s.title}>Editor de pruebas</h1>
            <p style={s.subtitle}>
              Aquí puedes editar el nombre y las instrucciones de la prueba.
            </p>
          </div>
        </section>

        <section style={s.card} className="edicion-card">
          <div style={s.sectionHeader}>
            <span style={s.sectionDot} />
            <h2 style={s.sectionTitle}>Datos de la prueba</h2>
          </div>

          {isLoading ? (
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>Cargando prueba...</p>
            </div>
          ) : error ? (
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>{error}</p>
              <Link to={backTarget} style={s.secondaryButton}>
                Volver
              </Link>
            </div>
          ) : (
            <div style={s.editorGrid}>
              <div style={s.formColumn}>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Nombre de la prueba</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={event => setNombre(event.target.value)}
                    spellCheck
                    lang="es"
                    onFocus={event => refreshNativeSpellcheck(event.currentTarget)}
                    style={s.input}
                  />
                </div>

                <div style={s.fieldGroup}>
                  <label style={s.label}>Instrucciones</label>
                  <textarea
                    value={instrucciones}
                    onChange={event => setInstrucciones(event.target.value)}
                    rows={8}
                    spellCheck
                    lang="es"
                    onFocus={event => refreshNativeSpellcheck(event.currentTarget)}
                    style={s.textarea}
                  />
                </div>

                <div style={s.fieldGroup}>
                  <label style={s.label}>Imagen de la prueba (opcional)</label>
                  <div style={s.pruebaImageField}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const f = e.currentTarget.files && e.currentTarget.files[0];
                        if (!f) {
                          setPruebaImageFile(null);
                          setPruebaImagePreview(null);
                          return;
                        }
                        setPruebaImageFile(f);
                        setRemoveExistingImage(false);
                        const reader = new FileReader();
                        reader.onload = () => setPruebaImagePreview(String(reader.result || ''));
                        reader.readAsDataURL(f);
                      }}
                      style={{ display: 'none' }}
                    />

                    <div style={s.pruebaImageControls}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={s.fileButton}
                      >
                        {pruebaImagePreview || (prueba?.image_url && !removeExistingImage) ? 'Reemplazar imagen' : 'Subir imagen'}
                      </button>

                      {(prueba?.image_url || pruebaImagePreview) && (
                        <button
                          type="button"
                          onClick={() => {
                            setPruebaImageFile(null);
                            setPruebaImagePreview(null);
                            setRemoveExistingImage(true);
                          }}
                          style={s.removeImageButton}
                        >
                          Quitar
                        </button>
                      )}
                    </div>

                    {(pruebaImagePreview || (prueba?.image_url && !removeExistingImage)) && (
                      <div style={s.imagePreviewBox}>
                        <img
                          src={pruebaImagePreview || getCloudinaryImageUrl(prueba?.image_url ?? '', 'thumbSmall')}
                          alt="Previsualización"
                          style={s.imagePreviewImg}
                        />
                      </div>
                    )}
                  </div>
                  <small style={{ color: '#64748b' }}>La imagen se subirá cuando guardes los cambios y se asociará a la prueba.</small>
                </div>

                <div style={s.buttonRow}>
                  <Link to={backTarget} style={s.secondaryButton}>
                    Volver
                  </Link>
                  <button
                    type="button"
                    disabled={!canSave || isSaving}
                    onClick={() => { void handleSave(); }}
                    style={canSave && !isSaving ? s.primaryButton : s.primaryButtonDisabled}
                  >
                    {isSaving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>

                <div style={s.warningBox}>
                  Si vuelves ahora, los cambios no guardados se perderán.
                </div>

                {message && <div style={s.successBox}>{message}</div>}
                {error && <div style={s.errorBox}>{error}</div>}
              </div>

              <div style={s.infoColumn}>
                <div style={s.infoCard}>
                  <span style={s.infoLabel}>ID</span>
                  <span style={s.infoValue}>{prueba?.id ?? pruebaId ?? 'sin identificar'}</span>
                </div>
                <div style={s.infoCard}>
                  <span style={s.infoLabel}>Estado</span>
                  <span style={s.infoValue}>{prueba?.estado ?? 'borrador'}</span>
                </div>
                <div style={s.infoCard}>
                  <span style={s.infoLabel}>Tipo</span>
                  <span style={s.infoValue}>{scopeLabel}</span>
                </div>
                <div style={s.infoCard}>
                  <span style={s.infoLabel}>Parcial</span>
                  <span style={s.infoValue}>{parcialLabel}</span>
                </div>
                <div style={s.infoCard}>
                  <span style={s.infoLabel}>Tema</span>
                  <span style={s.infoValue}>{temaNombre || 'No aplica'}</span>
                </div>
                <div style={s.infoCard}>
                  <span style={s.infoLabel}>Subtema</span>
                  <span style={s.infoValue}>{subtemaNombre || 'No aplica'}</span>
                </div>
                <div style={s.infoCard}>
                  <span style={s.infoLabel}>Creada</span>
                  <span style={s.infoValue}>{prueba?.created_at ? new Date(prueba.created_at).toLocaleString('es-MX') : 'Sin fecha'}</span>
                </div>
                <div style={s.infoCard}>
                  <span style={s.infoLabel}>Actualizada</span>
                  <span style={s.infoValue}>{prueba?.updated_at ? new Date(prueba.updated_at).toLocaleString('es-MX') : 'Sin fecha'}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        <section style={s.builderSection} className="edicion-card">
          <div style={s.sectionHeader}>
            <span style={s.sectionDot} />
            <h2 style={s.sectionTitle}>Constructor de preguntas</h2>
          </div>

          <div style={s.builderLayout}>
            <div style={s.builderCanvas}>
              {questions.map((question, questionIndex) => (
                <article key={question.id} style={s.questionCard}>
                  <div style={s.questionHeader}>
                    <div style={s.questionHeaderLeft}>
                      <span style={s.questionIndex}>{questionIndex + 1}</span>
                      <div style={s.questionTypePill}>Varias opciones</div>
                    </div>

                    <div style={s.questionHeaderActions}>
                      <label style={s.requiredToggleLabel}>
                        <input
                          type="checkbox"
                          checked={question.required}
                          onChange={event => updateQuestionField(question.id, 'required', event.target.checked)}
                          style={s.requiredToggleInput}
                        />
                        <span>Obligatoria</span>
                      </label>
                      <button type="button" style={s.iconActionButton} onClick={() => duplicateQuestion(question.id)}>
                        Duplicar
                      </button>
                      <button type="button" style={s.iconActionButtonDanger} onClick={() => removeQuestion(question.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div style={s.questionBody}>
                    <div style={s.questionMainColumn}>
                      <div style={s.fieldGroup}>
                        <label style={s.label}>Pregunta</label>
                        <input
                          type="text"
                          value={question.title}
                          onChange={event => updateQuestionField(question.id, 'title', event.target.value)}
                          placeholder="Escribe la pregunta"
                          spellCheck
                          lang="es"
                          onFocus={event => refreshNativeSpellcheck(event.currentTarget)}
                          style={s.input}
                        />
                      </div>

                      <div style={s.optionsBlock}>
                        {question.options.map((option, optionIndex) => (
                          <div key={option.id} style={s.optionRow}>
                            <label style={s.optionRadioWrap}>
                              <input
                                type="radio"
                                name={`correct-${question.id}`}
                                checked={option.isCorrect}
                                onChange={() => setCorrectOption(question.id, option.id)}
                                style={s.optionRadio}
                              />
                              <span style={s.optionRadioText}>{String.fromCharCode(65 + optionIndex)}</span>
                            </label>

                            <input
                              type="text"
                              value={option.text}
                              onChange={event => updateQuestionOption(question.id, option.id, event.target.value)}
                              spellCheck
                              lang="es"
                              onFocus={event => refreshNativeSpellcheck(event.currentTarget)}
                              style={s.optionInput}
                            />

                            <button
                              type="button"
                              style={s.optionDeleteButton}
                              onClick={() => removeQuestionOption(question.id, option.id)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      <div style={s.questionFooterActions}>
                        <button type="button" style={s.addOptionButton} onClick={() => addQuestionOption(question.id)}>
                          ＋ Añadir opción
                        </button>
                      </div>

                      <div style={s.fieldGroup}>
                        <label style={s.label}>Retroalimentación</label>
                        <textarea
                          value={question.retroalimentacion}
                          onChange={event => updateQuestionField(question.id, 'retroalimentacion', event.target.value)}
                          placeholder="Explica por qué la respuesta correcta es correcta o por qué la incorrecta no lo es"
                          rows={4}
                          spellCheck
                          lang="es"
                          onFocus={event => refreshNativeSpellcheck(event.currentTarget)}
                          style={s.questionFeedback}
                        />
                      </div>
                    </div>

                    <div style={s.questionMetaColumn}>
                      <div style={s.referenceCard}>
                        <div style={s.referenceCardHeader}>
                          <span style={s.metaLabel}>Referencia visual</span>
                        </div>

                        {question.referencePhotoUrl ? (
                          <div style={s.referencePreviewWrap}>
                            <img
                              src={getCloudinaryImageUrl(question.referencePhotoUrl, 'thumb')}
                              alt="Placa seleccionada como referencia"
                              style={s.referencePreviewImg}
                            />
                            <div style={s.referencePreviewText}>
                              <strong style={s.referencePreviewTitle}>Placa seleccionada</strong>
                              <span style={s.referencePreviewMeta}>{question.referenceTemaName || 'Sin tema'} · {question.referenceSubtemaName || 'Sin subtema'}</span>
                              <span style={s.referencePreviewMeta}>
                                {question.referenceSenaladoLocation ? 'Señalado configurado' : 'Sin señalado todavía'}
                              </span>
                            </div>
                            <div style={s.referenceActionRow}>
                              <button
                                type="button"
                                style={s.referenceInlineActionButton}
                                onClick={() => { void openReferencePicker(question.id); }}
                              >
                                Reemplazar placa
                              </button>
                              <button
                                type="button"
                                style={s.referenceInlineActionButton}
                                onClick={() => handleEditReferenceMarker(question)}
                              >
                                Editar señalado
                              </button>
                              <button
                                type="button"
                                style={s.referenceClearButton}
                                onClick={() => {
                                  setQuestions(prev => prev.map(item => (
                                    item.id === question.id
                                      ? {
                                          ...item,
                                          referencePlacaId: null,
                                          referencePhotoUrl: null,
                                          referenceTemaName: '',
                                          referenceSubtemaName: '',
                                          referenceSenaladoLocation: null,
                                        }
                                      : item
                                  )));
                                }}
                              >
                                Quitar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={s.referenceEmptyState}>
                            <p style={s.referenceHint}>
                              La imagen seleccionada aparecerá a un lado de esta pregunta.
                            </p>
                            <button
                              type="button"
                              style={s.referenceActionButton}
                              onClick={() => { void openReferencePicker(question.id); }}
                            >
                              Añadir referencia
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={s.metaCard}>
                        <span style={s.metaLabel}>Tipo</span>
                        <span style={s.metaValue}>Selección única</span>
                      </div>
                      <div style={s.metaCard}>
                        <span style={s.metaLabel}>Respuesta correcta</span>
                        <span style={s.metaValue}>Marca solo una opción</span>
                      </div>
                      <div style={s.metaCard}>
                        <span style={s.metaLabel}>Estado</span>
                        <span style={s.metaValue}>{question.required ? 'Obligatoria' : 'Opcional'}</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}

              <div style={s.builderFooterBar}>
                <button type="button" style={s.builderFooterButton} onClick={addQuestion}>
                  ＋ Añadir pregunta
                </button>
                <p style={s.builderFooterHint}>
                  Las preguntas aún no se guardan en base de datos. Esta es la estructura visual para replicar Google Forms.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {referencePicker && (
        <div style={s.referenceModalOverlay} onClick={() => setReferencePicker(null)}>
          <div style={s.referenceModal} onClick={event => event.stopPropagation()}>
            <div style={s.referenceModalHeader}>
              <div>
                <p style={s.referenceModalKicker}>Referencia por pregunta</p>
                <h3 style={s.referenceModalTitle}>Selecciona una placa</h3>
              </div>
              <button type="button" style={s.referenceCloseButton} onClick={() => setReferencePicker(null)}>
                Cerrar
              </button>
            </div>

            <div style={s.referenceModalBody}>
              <aside style={s.referenceModalSidebar}>
                <div style={s.referenceModalCard}>
                  <span style={s.metaLabel}>Flujo</span>
                  <strong style={s.referenceModalFlowTitle}>
                    {referencePicker.scope === 'parcial'
                      ? 'Parcial → tema → subtema → placa'
                      : referencePicker.scope === 'tema'
                        ? 'Tema → subtema → placa'
                        : 'Subtema → placa'}
                  </strong>
                  <p style={s.referenceModalFlowText}>
                    Solo eliges la imagen que acompañará a la pregunta.
                  </p>
                </div>

                <div style={s.referenceAccordionCard}>
                  <button
                    type="button"
                    style={s.referenceAccordionHeader}
                    onClick={() => {
                      if (referencePicker.scope === 'parcial') {
                        setReferencePicker(prev => (prev ? { ...prev, step: 'parcial' } : prev));
                      }
                    }}
                  >
                    <span>
                      <span style={s.referenceAccordionLabel}>Parcial</span>
                      <strong style={s.referenceAccordionValue}>
                        {referencePicker.partialKey
                          ? PARCIALES.find(item => item.key === referencePicker.partialKey)?.label ?? 'Seleccionado'
                          : 'Elige un parcial'}
                      </strong>
                    </span>
                    <span style={s.referenceAccordionState}>
                      {referencePicker.step === 'parcial' ? 'Abierto' : 'Cerrado'}
                    </span>
                  </button>

                  {referencePicker.step === 'parcial' && referencePicker.scope === 'parcial' && (
                    <div style={s.referenceAccordionBody}>
                      <div style={s.referencePillRow}>
                        {PARCIALES.map(item => (
                          <button
                            key={item.key}
                            type="button"
                            style={referencePicker.partialKey === item.key ? s.referencePillActive : s.referencePill}
                            onClick={() => handleSelectPartial(item.key)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {referencePicker.scope !== 'subtema' && (
                  <div style={s.referenceAccordionCard}>
                    <button
                      type="button"
                      style={s.referenceAccordionHeader}
                      onClick={() => {
                        if (referencePicker.partialKey && referencePicker.step !== 'parcial') {
                          setReferencePicker(prev => (prev ? { ...prev, step: 'tema', subtemaId: null, placas: [], error: '' } : prev));
                        }
                      }}
                    >
                      <span>
                        <span style={s.referenceAccordionLabel}>Tema</span>
                        <strong style={s.referenceAccordionValue}>
                          {selectedReferenceTema?.nombre ?? 'Selecciona un tema'}
                        </strong>
                      </span>
                      <span style={s.referenceAccordionState}>
                        {referencePicker.step === 'tema' ? 'Abierto' : 'Cerrado'}
                      </span>
                    </button>

                    {referencePicker.step === 'tema' && (
                      <div style={s.referenceAccordionBody}>
                        <div style={s.referenceList}>
                          {temasDisponibles.map(tema => (
                            <button
                              key={tema.id}
                              type="button"
                              style={selectedReferenceTema?.id === tema.id ? s.referenceListItemActive : s.referenceListItem}
                              onClick={() => handleSelectTema(tema)}
                            >
                              {tema.nombre}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(referencePicker.scope === 'tema' || referencePicker.scope === 'parcial') && referencePicker.temaId && (
                  <div style={s.referenceAccordionCard}>
                    <button
                      type="button"
                      style={s.referenceAccordionHeader}
                      onClick={() => {
                        if (referencePicker.temaId) {
                          setReferencePicker(prev => (prev ? { ...prev, step: 'subtema', placas: [], error: '' } : prev));
                        }
                      }}
                    >
                      <span>
                        <span style={s.referenceAccordionLabel}>Subtema</span>
                        <strong style={s.referenceAccordionValue}>
                          {selectedReferenceSubtema?.nombre ?? 'Selecciona un subtema'}
                        </strong>
                      </span>
                      <span style={s.referenceAccordionState}>
                        {referencePicker.step === 'subtema' ? 'Abierto' : 'Cerrado'}
                      </span>
                    </button>

                    {referencePicker.step === 'subtema' && (
                      <div style={s.referenceAccordionBody}>
                        {referencePicker.loading ? (
                          <div style={s.referenceStateBox}>Cargando subtemas...</div>
                        ) : (
                          <div style={s.referenceList}>
                            {pickerSubtemas.map(subtema => (
                              <button
                                key={subtema.id}
                                type="button"
                                style={selectedReferenceSubtema?.id === subtema.id ? s.referenceListItemActive : s.referenceListItem}
                                onClick={() => handleSelectSubtema(subtema)}
                              >
                                {subtema.nombre}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </aside>

              <section style={s.referenceModalContent}>
                {referencePicker.loading ? (
                  <div style={s.referenceStateBox}>Cargando placas...</div>
                ) : referencePicker.error ? (
                  <div style={s.referenceStateBox}>{referencePicker.error}</div>
                ) : referencePicker.step === 'placa' && referencePicker.placas.length > 0 ? (
                  <div style={s.referenceGrid}>
                    {referencePicker.placas.map(placa => (
                      <button
                        key={placa.id}
                        type="button"
                        style={s.referencePlateCard}
                        onClick={() => setQuestionReference(referencePicker.questionId, placa)}
                      >
                        <img
                          src={getCloudinaryImageUrl(placa.photo_url, 'thumb')}
                          alt="Placa disponible"
                          style={s.referencePlateImg}
                        />
                        <span style={s.referencePlateLabel}>Seleccionar placa</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={s.referenceStateBox}>
                    Selecciona un parcial, tema y subtema para ver las placas disponibles.
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {referenceMarkerPicker && (
        <SenaladoLocationPicker
          imageSrc={getCloudinaryImageUrl(referenceMarkerPicker.photoUrl, 'view')}
          senaladoLabel="Señalado exclusivo de esta prueba"
          initialLocation={referenceMarkerPicker.location}
          required
          onCancel={() => setReferenceMarkerPicker(null)}
          onSave={handleSaveReferenceMarker}
        />
      )}

      <Footer />
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    color: '#0f172a',
    background: 'radial-gradient(circle at top left, rgba(224,231,255,0.85), transparent 28%), radial-gradient(circle at top right, rgba(224,242,254,0.8), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 42%, #ffffff 100%)',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    boxSizing: 'border-box',
    padding: '0 20px 44px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  hero: {
    display: 'block',
    padding: '0',
  },
  heroText: {
    borderRadius: '28px',
    padding: '28px 30px',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(239,246,255,0.96) 45%, rgba(255,255,255,0.98) 100%)',
    border: '1px solid rgba(191,219,254,0.9)',
    boxShadow: '0 20px 50px rgba(15,23,42,0.10)',
  },
  kicker: {
    margin: 0,
    color: '#7c3aed',
    fontWeight: 900,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    fontSize: '0.74em',
  },
  title: {
    margin: '10px 0 8px',
    fontSize: 'clamp(1.8rem, 4vw, 3rem)',
    lineHeight: 1.05,
    letterSpacing: '-0.04em',
  },
  subtitle: {
    margin: 0,
    maxWidth: '62ch',
    color: '#475569',
    lineHeight: 1.65,
    fontSize: '0.98rem',
  },
  card: {
    borderRadius: '28px',
    border: '1px solid rgba(226,232,240,0.95)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.96) 100%)',
    boxShadow: '0 22px 60px rgba(15,23,42,0.10)',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    width: '100%',
  },
  editorGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.7fr)',
    gap: '18px',
  },
  formColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  infoColumn: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
  },
  infoCard: {
    borderRadius: '18px',
    padding: '14px 16px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  infoLabel: {
    fontSize: '0.74rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#64748b',
    fontWeight: 900,
  },
  infoValue: {
    color: '#0f172a',
    fontWeight: 700,
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: 800,
    color: '#334155',
  },
  input: {
    width: '100%',
    borderRadius: '16px',
    border: '1.5px solid #cbd5e1',
    padding: '15px 16px',
    fontFamily: 'inherit',
    fontSize: '0.98rem',
    color: '#0f172a',
    outline: 'none',
    background: '#fff',
    boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.03)',
  },
  textarea: {
    width: '100%',
    borderRadius: '16px',
    border: '1.5px solid #cbd5e1',
    padding: '15px 16px',
    fontFamily: 'inherit',
    fontSize: '0.98rem',
    color: '#0f172a',
    outline: 'none',
    background: '#fff',
    resize: 'vertical',
    minHeight: '160px',
    boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.03)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(248,250,252,0.9), rgba(255,255,255,0.95))',
    border: '1px solid rgba(226,232,240,0.8)',
  },
  sectionDot: {
    width: '12px',
    height: '12px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #8b5cf6, #38bdf8)',
    flexShrink: 0,
  },
  sectionTitle: {
    margin: 0,
    fontSize: '1.1rem',
    color: '#0f172a',
    fontWeight: 900,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    borderRadius: '20px',
    padding: '24px',
    border: '1px dashed #cbd5e1',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    alignItems: 'flex-start',
  },
  emptyTitle: {
    margin: 0,
    fontWeight: 900,
    color: '#0f172a',
    fontSize: '1.05rem',
  },
  emptyText: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.6,
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 16px',
    borderRadius: '14px',
    border: '1.5px solid #cbd5e1',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    color: '#334155',
    textDecoration: 'none',
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  primaryButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
    color: '#fff',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 14px 30px rgba(109,40,217,0.18)',
  },
  primaryButtonDisabled: {
    border: 'none',
    borderRadius: '14px',
    padding: '12px 16px',
    background: 'linear-gradient(180deg, #e2e8f0, #cbd5e1)',
    color: '#64748b',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'not-allowed',
  },
  builderSection: {
    borderRadius: '28px',
    border: '1px solid rgba(226,232,240,0.95)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.96) 100%)',
    boxShadow: '0 22px 60px rgba(15,23,42,0.10)',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    width: '100%',
  },
  builderLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '18px',
    alignItems: 'start',
  },
  builderCanvas: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  questionCard: {
    borderRadius: '24px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    boxShadow: '0 14px 30px rgba(15,23,42,0.08)',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  questionHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  questionHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  questionIndex: {
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    fontWeight: 900,
    boxShadow: '0 10px 22px rgba(99,102,241,0.18)',
  },
  questionTypePill: {
    borderRadius: '999px',
    padding: '6px 10px',
    background: '#eef2ff',
    color: '#4338ca',
    fontWeight: 800,
    fontSize: '0.78rem',
  },
  questionHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  requiredToggleLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 800,
    color: '#334155',
    fontSize: '0.88rem',
  },
  requiredToggleInput: {
    width: '16px',
    height: '16px',
    accentColor: '#2563eb',
  },
  iconActionButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    background: '#fff',
    color: '#334155',
    padding: '8px 12px',
    fontFamily: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
  },
  iconActionButtonDanger: {
    border: '1px solid #fecaca',
    borderRadius: '12px',
    background: '#fff1f2',
    color: '#be123c',
    padding: '8px 12px',
    fontFamily: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
  },
  questionBody: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 250px)',
    gap: '16px',
  },
  questionMainColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  questionMetaColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  referenceCard: {
    borderRadius: '18px',
    padding: '14px 16px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  referenceCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  referenceActionButton: {
    border: 'none',
    borderRadius: '999px',
    padding: '8px 12px',
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    color: '#fff',
    fontWeight: 900,
    fontFamily: 'inherit',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  referencePreviewWrap: {
    display: 'grid',
    gridTemplateColumns: '80px minmax(0, 1fr)',
    gap: '12px',
    alignItems: 'center',
  },
  referencePreviewImg: {
    width: '80px',
    height: '100px',
    objectFit: 'cover',
    borderRadius: '14px',
    border: '1px solid #cbd5e1',
    background: '#fff',
  },
  referencePreviewText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  referencePreviewTitle: {
    color: '#0f172a',
    fontSize: '0.92rem',
  },
  referencePreviewMeta: {
    color: '#475569',
    lineHeight: 1.45,
    fontSize: '0.84rem',
  },
  referenceClearButton: {
    gridColumn: '1 / -1',
    border: '1px solid #fca5a5',
    borderRadius: '12px',
    background: '#fff1f2',
    color: '#be123c',
    padding: '8px 10px',
    fontFamily: 'inherit',
    fontWeight: 900,
    cursor: 'pointer',
    justifySelf: 'start',
  },
  referenceActionRow: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  referenceInlineActionButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    background: '#fff',
    color: '#334155',
    padding: '8px 10px',
    fontFamily: 'inherit',
    fontWeight: 900,
    cursor: 'pointer',
  },
  referenceHint: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.55,
    fontSize: '0.9rem',
  },
  optionsBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  optionRow: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    gap: '10px',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    background: '#fff',
  },
  optionRadioWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#475569',
    fontWeight: 800,
  },
  optionRadio: {
    width: '16px',
    height: '16px',
    accentColor: '#2563eb',
  },
  optionRadioText: {
    width: '20px',
    textAlign: 'center',
    fontSize: '0.85rem',
  },
  optionInput: {
    minWidth: 0,
    borderRadius: '12px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    padding: '10px 12px',
    fontFamily: 'inherit',
    fontWeight: 600,
    color: '#0f172a',
  },
  optionDeleteButton: {
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '4px 6px',
  },
  questionFooterActions: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  addOptionButton: {
    border: '1px dashed #93c5fd',
    borderRadius: '14px',
    background: '#eff6ff',
    color: '#1d4ed8',
    padding: '10px 14px',
    fontFamily: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
  },
  questionFeedback: {
    width: '100%',
    borderRadius: '18px',
    border: '1px solid #cbd5e1',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    padding: '14px 16px',
    fontFamily: 'inherit',
    fontSize: '0.96rem',
    lineHeight: 1.65,
    color: '#0f172a',
    outline: 'none',
    resize: 'vertical',
    minHeight: '120px',
    boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.04), 0 10px 22px rgba(15,23,42,0.04)',
  },
  metaCard: {
    borderRadius: '18px',
    padding: '14px 16px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  metaLabel: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#64748b',
    fontWeight: 900,
  },
  metaValue: {
    color: '#0f172a',
    fontWeight: 700,
    lineHeight: 1.5,
  },
  referenceModalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.62)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 200,
  },
  referenceModal: {
    width: 'min(1180px, 100%)',
    maxHeight: 'min(88vh, 920px)',
    overflow: 'hidden',
    borderRadius: '28px',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    border: '1px solid #dbeafe',
    boxShadow: '0 30px 80px rgba(15,23,42,0.28)',
    display: 'flex',
    flexDirection: 'column',
  },
  referenceModalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '18px 22px',
    borderBottom: '1px solid #e2e8f0',
  },
  referenceModalKicker: {
    margin: 0,
    color: '#7c3aed',
    fontWeight: 900,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontSize: '0.72rem',
  },
  referenceModalTitle: {
    margin: '6px 0 0',
    color: '#0f172a',
    fontSize: '1.35rem',
    lineHeight: 1.15,
  },
  referenceCloseButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    background: '#fff',
    color: '#334155',
    padding: '10px 14px',
    fontFamily: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
    flexShrink: 0,
  },
  referenceModalBody: {
    display: 'grid',
    gridTemplateColumns: '320px minmax(0, 1fr)',
    gap: '18px',
    padding: '18px',
    minHeight: 0,
    overflow: 'hidden',
  },
  referenceModalSidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflow: 'auto',
    paddingRight: '4px',
  },
  referenceModalCard: {
    borderRadius: '22px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    boxShadow: '0 12px 24px rgba(15,23,42,0.06)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  referenceAccordionCard: {
    borderRadius: '22px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    boxShadow: '0 12px 24px rgba(15,23,42,0.06)',
    overflow: 'hidden',
  },
  referenceAccordionHeader: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  referenceAccordionLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 900,
    marginBottom: '4px',
  },
  referenceAccordionValue: {
    display: 'block',
    color: '#0f172a',
    fontSize: '0.95rem',
    lineHeight: 1.4,
  },
  referenceAccordionState: {
    flexShrink: 0,
    borderRadius: '999px',
    padding: '6px 10px',
    background: '#e2e8f0',
    color: '#334155',
    fontWeight: 900,
    fontSize: '0.72rem',
  },
  referenceAccordionBody: {
    borderTop: '1px solid #e2e8f0',
    padding: '14px 16px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  referenceModalFlowTitle: {
    color: '#0f172a',
    lineHeight: 1.45,
  },
  referenceModalFlowText: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.55,
    fontSize: '0.92rem',
  },
  referencePillRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  referencePill: {
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    background: '#fff',
    color: '#334155',
    padding: '8px 12px',
    fontFamily: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
  },
  referenceEmptyState: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'flex-start',
  },
  referencePillActive: {
    border: '1px solid #93c5fd',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #dbeafe, #eef2ff)',
    color: '#1d4ed8',
    padding: '8px 12px',
    fontFamily: 'inherit',
    fontWeight: 900,
    cursor: 'pointer',
  },
  pruebaImageField: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginTop: '6px',
  },
  pruebaImageControls: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  fileButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '10px 12px',
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    color: '#fff',
    fontWeight: 900,
    cursor: 'pointer',
  },
  removeImageButton: {
    border: '1px solid #fecaca',
    borderRadius: '12px',
    padding: '8px 10px',
    background: '#fff1f2',
    color: '#be123c',
    fontWeight: 800,
    cursor: 'pointer',
  },
  imagePreviewBox: {
    width: 104,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    boxShadow: '0 8px 18px rgba(15,23,42,0.06)',
  },
  imagePreviewImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  referenceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '220px',
    overflow: 'auto',
    paddingRight: '4px',
  },
  referenceListItem: {
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    background: '#fff',
    color: '#334155',
    padding: '10px 12px',
    textAlign: 'left',
    fontFamily: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
  },
  referenceListItemActive: {
    border: '1px solid #93c5fd',
    borderRadius: '14px',
    background: '#eff6ff',
    color: '#1d4ed8',
    padding: '10px 12px',
    textAlign: 'left',
    fontFamily: 'inherit',
    fontWeight: 900,
    cursor: 'pointer',
  },
  referenceModalContent: {
    minHeight: 0,
    overflow: 'auto',
    paddingRight: '4px',
  },
  referenceStateBox: {
    borderRadius: '22px',
    border: '1px dashed #cbd5e1',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    color: '#475569',
    padding: '20px',
    lineHeight: 1.6,
    minHeight: '240px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  referenceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '14px',
  },
  referencePlateCard: {
    border: '1px solid #dbeafe',
    borderRadius: '20px',
    background: '#fff',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    boxShadow: '0 12px 24px rgba(15,23,42,0.08)',
  },
  referencePlateImg: {
    width: '100%',
    aspectRatio: '3 / 4',
    objectFit: 'cover',
    borderRadius: '14px',
    background: '#0f172a',
    border: '1px solid rgba(148,163,184,0.3)',
  },
  referencePlateLabel: {
    color: '#1d4ed8',
    fontWeight: 900,
    fontSize: '0.88rem',
    textAlign: 'center',
  },
  builderFooterBar: {
    borderRadius: '22px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(135deg, #eff6ff, #ffffff)',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  builderFooterButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    color: '#fff',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 14px 30px rgba(37,99,235,0.18)',
  },
  builderFooterHint: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.55,
    fontSize: '0.92rem',
    maxWidth: '72ch',
  },
  successBox: {
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)',
    border: '1px solid #a7f3d0',
    color: '#047857',
    padding: '14px 16px',
    lineHeight: 1.6,
    fontSize: '0.92rem',
  },
  warningBox: {
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #fffbeb, #fefce8)',
    border: '1px solid #fcd34d',
    color: '#92400e',
    padding: '14px 16px',
    lineHeight: 1.6,
    fontSize: '0.92rem',
  },
  errorBox: {
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    padding: '14px 16px',
    lineHeight: 1.6,
    fontSize: '0.92rem',
  },
};

export default EditorDePruebas;
