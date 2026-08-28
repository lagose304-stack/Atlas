import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Eye,
  Focus,
  Images,
  Lightbulb,
  Microscope,
  MousePointerClick,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Target,
  Wrench,
  XCircle,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BackButton from '../components/BackButton';
import ImageViewerModal from '../components/ImageViewerModal';
import InteractiveMapViewerModal, {
  type InteractiveMapViewerSection,
} from '../components/InteractiveMapViewerModal';
import { supabase } from '../services/supabase';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { logTemaView } from '../services/analytics';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import { useAuth } from '../contexts/AuthContext';
import {
  canBypassMaintenance,
  fetchSiteMaintenanceStatus,
  isFeatureDisabled,
  isTemaDisabled,
} from '../services/siteMaintenance';
import '../styles/microscopy-topic.css';

interface MicroscopyTopicExperienceProps {
  temaId: number;
}

interface Tema {
  id: number;
  nombre: string;
  logo_url: string | null;
  parcial: string | null;
}

interface Subtema {
  id: number;
  nombre: string;
  tema_id: number;
  logo_url: string | null;
  sort_order: number | null;
}

interface SenaladoMetaItem {
  label: string;
  x: number | null;
  y: number | null;
  startX?: number | null;
  startY?: number | null;
  regionPoints?: number[] | null;
  regionColor?: string | null;
  regionOpacity?: number | null;
}

interface Placa {
  id: number;
  photo_url: string;
  tema_id: number;
  subtema_id: number;
  sort_order: number | null;
  aumento: string | null;
  senalados: string[] | null;
  senalados_meta: SenaladoMetaItem[] | null;
  comentario: string | null;
  tincion: string | null;
}

interface RawMapSection {
  title?: string | null;
  description?: string | null;
  color?: string | null;
  points?: unknown;
  sort_order?: number | null;
  coordinate_space?: string | null;
}

interface InteractiveMap {
  id: number;
  tema_id: number;
  subtema_id: number | null;
  placa_id: number;
  map_number: number;
  sections: RawMapSection[] | null;
}

interface RelatedName {
  nombre?: string | null;
}

interface ObjectiveSampleRow {
  id: number;
  photo_url: string;
  tema_id: number;
  subtema_id: number;
  aumento: string | null;
  comentario: string | null;
  tincion: string | null;
  temas?: RelatedName | RelatedName[] | null;
  subtemas?: RelatedName | RelatedName[] | null;
}

interface ObjectiveSample {
  id: number;
  photoUrl: string;
  temaId: number;
  subtemaId: number;
  aumento: string;
  magnification: number;
  comentario: string | null;
  tincion: string | null;
  temaNombre: string;
  subtemaNombre: string;
}

interface StationMeta {
  kicker: string;
  shortDescription: string;
  accent: string;
  icon: React.ReactNode;
}

interface QuizItem {
  title: string;
  description: string;
  options: string[];
}

const OBJECTIVES = [
  {
    value: 4,
    label: '4×',
    name: 'Panorámico',
    color: '#ef4444',
    description: 'Ubica la preparación y ofrece el campo visual más amplio.',
  },
  {
    value: 10,
    label: '10×',
    name: 'Bajo aumento',
    color: '#eab308',
    description: 'Permite reconocer la organización general de la muestra.',
  },
  {
    value: 40,
    label: '40×',
    name: 'Alto aumento',
    color: '#38bdf8',
    description: 'Muestra detalles celulares con un campo visual más reducido.',
  },
  {
    value: 100,
    label: '100×',
    name: 'Inmersión',
    color: '#f8fafc',
    description: 'Ofrece el mayor detalle y requiere aceite de inmersión.',
  },
] as const;

const MICROSCOPY_POWERS = [
  {
    id: 'amplification',
    number: '01',
    title: 'Amplificación',
    summary: 'Aumenta el tamaño aparente, no la información.',
    explanation: 'La misma muestra ocupa más espacio en el campo visual. Cuando la resolución ya alcanzó su límite, seguir ampliando produce magnificación vacía: una imagen mayor, pero sin detalle nuevo.',
    controlLabel: 'Nivel de amplificación',
    lowLabel: 'Imagen pequeña',
    highLabel: 'Magnificación vacía',
    visualLabel: 'La misma muestra',
    changes: 'Tamaño aparente',
    stays: 'Detalle disponible',
    takeaway: 'Si la resolución no cambia, ampliar más solo agranda el mismo detalle.',
  },
  {
    id: 'resolution',
    number: '02',
    title: 'Resolución',
    summary: 'Permite distinguir puntos muy próximos.',
    explanation: 'Los dos puntos permanecen exactamente en el mismo lugar. Al mejorar la resolución óptica, sus manchas de luz dejan de superponerse y aparece una separación visible entre ellas.',
    controlLabel: 'Capacidad de resolución',
    lowLabel: 'Parecen un punto',
    highLabel: 'Se distinguen dos',
    visualLabel: 'Dos puntos fijos',
    changes: 'Separación perceptible',
    stays: 'Distancia real',
    takeaway: 'Resolver es reconocer dos estructuras como independientes; no moverlas ni solo agrandarlas.',
  },
  {
    id: 'definition',
    number: '03',
    title: 'Definición',
    summary: 'Hace visibles los contornos ya resueltos.',
    explanation: 'Las células conservan el mismo tamaño y la misma separación. Al aumentar el contraste con el fondo, sus bordes y núcleos dejan de confundirse y se reconocen con claridad.',
    controlLabel: 'Contraste de contornos',
    lowLabel: 'Poco contraste',
    highLabel: 'Contornos visibles',
    visualLabel: 'Tejido teñido',
    changes: 'Visibilidad de bordes',
    stays: 'Tamaño y posición',
    takeaway: 'Una estructura puede estar resuelta y aun ser difícil de reconocer si no contrasta con el fondo.',
  },
] as const;

type MicroscopyPowerId = (typeof MICROSCOPY_POWERS)[number]['id'];

const getMicroscopyPowerStatus = (power: MicroscopyPowerId, level: number): string => {
  if (power === 'amplification') {
    if (level < 34) return 'Imagen pequeña';
    if (level < 78) return 'Magnificación útil';
    return 'Magnificación vacía';
  }

  if (power === 'resolution') {
    if (level < 38) return 'No resueltos: parecen uno';
    if (level < 72) return 'Separación incipiente';
    return 'Resueltos: se ven dos';
  }

  if (level < 40) return 'Contornos poco visibles';
  if (level < 72) return 'Contraste intermedio';
  return 'Contornos bien definidos';
};

const OBJECTIVE_SAMPLE_SESSION_KEY = 'atlas_microscopy_objective_samples_v1';
const OBJECTIVE_MAGNIFICATIONS = OBJECTIVES.map((objective) => objective.value);

const normalizeName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const capitalizeInitial = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return `${trimmed.charAt(0).toLocaleUpperCase('es-HN')}${trimmed.slice(1)}`;
};

const formatSentence = (value: string, fallback: string): string => {
  const sentence = capitalizeInitial(value || fallback);
  return /[.!?…]$/.test(sentence) ? sentence : `${sentence}.`;
};

const getStationMeta = (name: string): StationMeta => {
  const normalized = normalizeName(name);

  if (normalized.includes('mecan')) {
    return {
      kicker: 'Anatomía y movimiento',
      shortDescription: 'Reconoce las piezas que sostienen, desplazan y permiten enfocar el equipo.',
      accent: '#0ea5e9',
      icon: <Wrench size={20} aria-hidden="true" />,
    };
  }

  if (normalized.includes('opt')) {
    return {
      kicker: 'Ruta de la luz',
      shortDescription: 'Sigue el recorrido de la luz para comprender cómo se forma y amplifica la imagen observada.',
      accent: '#8b5cf6',
      icon: <Eye size={20} aria-hidden="true" />,
    };
  }

  if (normalized.includes('condens')) {
    return {
      kicker: 'Iluminación y contraste',
      shortDescription: 'Comprende cómo se concentra y regula la luz que atraviesa la muestra.',
      accent: '#14b8a6',
      icon: <Lightbulb size={20} aria-hidden="true" />,
    };
  }

  return {
    kicker: 'Aumento y resolución',
    shortDescription: 'Compara los objetivos y aprende cuándo utilizar cada nivel de aumento.',
    accent: '#f59e0b',
    icon: <Focus size={20} aria-hidden="true" />,
  };
};

const parseMapSections = (sections: RawMapSection[] | null): InteractiveMapViewerSection[] => {
  if (!Array.isArray(sections)) return [];

  return sections
    .map((section, index) => ({
      title: capitalizeInitial(section.title?.trim() || `Componente ${index + 1}`),
      description: formatSentence(section.description?.trim() || '', 'Explora esta región en el mapa interactivo.'),
      color: section.color || '#0ea5e9',
      points: Array.isArray(section.points)
        ? section.points.filter((point): point is number => typeof point === 'number')
        : [],
      sortOrder: typeof section.sort_order === 'number' ? section.sort_order : index,
      coordinateSpace: section.coordinate_space || undefined,
    }))
    .filter((section) => section.points.length >= 6)
    .sort((a, b) => a.sortOrder - b.sortOrder);
};

const getRelatedName = (relation: RelatedName | RelatedName[] | null | undefined, fallback: string): string => {
  if (Array.isArray(relation)) return relation[0]?.nombre?.trim() || fallback;
  return relation?.nombre?.trim() || fallback;
};

const parseObjectiveMagnification = (value: string | null | undefined): number | null => {
  const match = value?.replace(',', '.').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  return OBJECTIVE_MAGNIFICATIONS.includes(parsed as (typeof OBJECTIVE_MAGNIFICATIONS)[number]) ? parsed : null;
};

const randomItem = <T,>(items: T[]): T | null => {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
};

const selectObjectiveSamples = (rows: ObjectiveSampleRow[]): Record<number, ObjectiveSample> => {
  const samples = rows.reduce<ObjectiveSample[]>((acc, row) => {
    const magnification = parseObjectiveMagnification(row.aumento);
    if (!magnification || !row.photo_url) return acc;
    acc.push({
      id: row.id,
      photoUrl: row.photo_url,
      temaId: row.tema_id,
      subtemaId: row.subtema_id,
      aumento: row.aumento || `${magnification}×`,
      magnification,
      comentario: row.comentario,
      tincion: row.tincion,
      temaNombre: getRelatedName(row.temas, `Tema ${row.tema_id}`),
      subtemaNombre: getRelatedName(row.subtemas, `Subtema ${row.subtema_id}`),
    });
    return acc;
  }, []);

  if (samples.length === 0) return {};

  try {
    const stored = window.sessionStorage.getItem(OBJECTIVE_SAMPLE_SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, number>;
      const restored: Record<number, ObjectiveSample> = {};
      let isValid = true;

      OBJECTIVE_MAGNIFICATIONS.forEach((magnification) => {
        const available = samples.filter((sample) => sample.magnification === magnification);
        if (available.length === 0) return;
        const storedId = parsed[String(magnification)];
        const storedSample = available.find((sample) => sample.id === storedId);
        if (!storedSample) {
          isValid = false;
          return;
        }
        restored[magnification] = storedSample;
      });

      if (isValid) return restored;
    }
  } catch (error) {
    console.warn('No se pudo restaurar la selección de placas de la sesión:', error);
  }

  const coverageByTema = new Map<number, Set<number>>();
  samples.forEach((sample) => {
    const coverage = coverageByTema.get(sample.temaId) ?? new Set<number>();
    coverage.add(sample.magnification);
    coverageByTema.set(sample.temaId, coverage);
  });

  const highestCoverage = Math.max(...Array.from(coverageByTema.values()).map((coverage) => coverage.size));
  const bestTemaIds = Array.from(coverageByTema.entries())
    .filter(([, coverage]) => coverage.size === highestCoverage)
    .map(([temaId]) => temaId);
  const preferredTemaId = randomItem(bestTemaIds);
  const selected: Record<number, ObjectiveSample> = {};

  OBJECTIVE_MAGNIFICATIONS.forEach((magnification) => {
    const matching = samples.filter((sample) => sample.magnification === magnification);
    const preferred = preferredTemaId === null
      ? []
      : matching.filter((sample) => sample.temaId === preferredTemaId);
    const sample = randomItem(preferred.length > 0 ? preferred : matching);
    if (sample) selected[magnification] = sample;
  });

  try {
    const ids = Object.fromEntries(Object.entries(selected).map(([magnification, sample]) => [magnification, sample.id]));
    window.sessionStorage.setItem(OBJECTIVE_SAMPLE_SESSION_KEY, JSON.stringify(ids));
  } catch (error) {
    console.warn('No se pudo guardar la selección de placas de la sesión:', error);
  }

  return selected;
};

const MicroscopyTopicExperience: React.FC<MicroscopyTopicExperienceProps> = ({ temaId }) => {
  const [tema, setTema] = useState<Tema | null>(null);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [placas, setPlacas] = useState<Placa[]>([]);
  const [maps, setMaps] = useState<InteractiveMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [activeStationId, setActiveStationId] = useState<number | null>(null);
  const [selectedPlaca, setSelectedPlaca] = useState<Placa | null>(null);
  const [selectedMap, setSelectedMap] = useState<InteractiveMap | null>(null);
  const [objectiveSamples, setObjectiveSamples] = useState<Record<number, ObjectiveSample>>({});
  const [selectedObjectiveSample, setSelectedObjectiveSample] = useState<ObjectiveSample | null>(null);
  const [objectiveValue, setObjectiveValue] = useState(4);
  const [activePower, setActivePower] = useState<MicroscopyPowerId>('amplification');
  const [powerLevels, setPowerLevels] = useState<Record<MicroscopyPowerId, number>>({
    amplification: 38,
    resolution: 28,
    definition: 32,
  });
  const [diaphragm, setDiaphragm] = useState(62);
  const [illumination, setIllumination] = useState(72);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelected, setQuizSelected] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const handleGoBack = useSmartBackNavigation('/temario');

  useEffect(() => {
    let isMounted = true;

    const fetchExperience = async () => {
      setLoading(true);
      setLoadError(null);

      const canBypass = canBypassMaintenance(user, isAuthenticated);
      const maintenanceStatus = await fetchSiteMaintenanceStatus();

      if (!canBypass) {
        if (maintenanceStatus.enabled) {
          setLoadError('El sitio se encuentra temporalmente fuera de servicio por mantenimiento.');
          setLoading(false);
          return;
        }
        if (isFeatureDisabled('public_catalog', maintenanceStatus.disabledFeatures)) {
          setLoadError('El catálogo de temas y placas se encuentra temporalmente deshabilitado por mantenimiento.');
          setLoading(false);
          return;
        }
      }

      void logTemaView(temaId);

      const [temaResult, subtemasResult, placasResult, mapsResult, objectiveSamplesResult] = await Promise.all([
        supabase.from('temas').select('id, nombre, logo_url, parcial').eq('id', temaId).single(),
        supabase
          .from('subtemas')
          .select('id, nombre, tema_id, logo_url, sort_order')
          .eq('tema_id', temaId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('placas')
          .select('id, photo_url, tema_id, subtema_id, sort_order, aumento, senalados, senalados_meta, comentario, tincion')
          .eq('tema_id', temaId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('interactive_maps')
          .select('id, tema_id, subtema_id, placa_id, map_number, sections')
          .eq('tema_id', temaId)
          .order('map_number', { ascending: true }),
        supabase
          .from('placas')
          .select('id, photo_url, tema_id, subtema_id, aumento, comentario, tincion, temas(nombre), subtemas(nombre)')
          .not('aumento', 'is', null)
          .order('id', { ascending: true }),
      ]);

      if (!isMounted) return;

      if (temaResult.data && !canBypass && isTemaDisabled(temaId, temaResult.data.parcial, maintenanceStatus.disabledFeatures)) {
        setLoadError('Este tema se encuentra temporalmente fuera de servicio por mantenimiento o actualización.');
        setLoading(false);
        return;
      }

      const firstError = temaResult.error || subtemasResult.error || placasResult.error || mapsResult.error;
      if (firstError || !temaResult.data) {
        console.error('Error loading microscopy experience:', {
          tema: temaResult.error,
          subtemas: subtemasResult.error,
          placas: placasResult.error,
          maps: mapsResult.error,
        });
        setLoadError('No fue posible preparar el laboratorio interactivo en este momento.');
        setLoading(false);
        return;
      }

      const nextSubtemas = (subtemasResult.data ?? []) as Subtema[];
      setTema(temaResult.data as Tema);
      setSubtemas(nextSubtemas);
      setPlacas((placasResult.data ?? []) as Placa[]);
      setMaps((mapsResult.data ?? []) as InteractiveMap[]);
      if (objectiveSamplesResult.error) {
        console.warn('No se pudieron cargar placas de ejemplo por aumento:', objectiveSamplesResult.error);
        setObjectiveSamples({});
      } else {
        setObjectiveSamples(selectObjectiveSamples((objectiveSamplesResult.data ?? []) as unknown as ObjectiveSampleRow[]));
      }
      setActiveStationId((current) => current ?? nextSubtemas[0]?.id ?? null);
      setLoading(false);
    };

    void fetchExperience();
    return () => {
      isMounted = false;
    };
  }, [temaId, loadAttempt]);

  const mapsBySubtema = useMemo(() => {
    const grouped = new Map<number, InteractiveMap[]>();
    maps.forEach((map) => {
      if (typeof map.subtema_id !== 'number') return;
      const current = grouped.get(map.subtema_id) ?? [];
      current.push(map);
      grouped.set(map.subtema_id, current);
    });
    return grouped;
  }, [maps]);

  const placasBySubtema = useMemo(() => {
    const grouped = new Map<number, Placa[]>();
    placas.forEach((placa) => {
      const current = grouped.get(placa.subtema_id) ?? [];
      current.push(placa);
      grouped.set(placa.subtema_id, current);
    });
    return grouped;
  }, [placas]);

  const activeStation = useMemo(
    () => subtemas.find((subtema) => subtema.id === activeStationId) ?? subtemas[0] ?? null,
    [activeStationId, subtemas]
  );

  const activeStationMaps = activeStation ? mapsBySubtema.get(activeStation.id) ?? [] : [];
  const activeStationPlates = activeStation ? placasBySubtema.get(activeStation.id) ?? [] : [];
  const activeMap = activeStationMaps[0] ?? null;
  const activeMapPlate = activeMap
    ? placas.find((placa) => placa.id === activeMap.placa_id) ?? activeStationPlates[0] ?? null
    : activeStationPlates[0] ?? null;
  const activeSections = parseMapSections(activeMap?.sections ?? null);
  const activeMeta = activeStation ? getStationMeta(activeStation.nombre) : null;
  const activePowerMeta = MICROSCOPY_POWERS.find((power) => power.id === activePower) ?? MICROSCOPY_POWERS[0];
  const activePowerLevel = powerLevels[activePower];
  const powerVisualStyle = {
    '--microscopy-power-scale': 0.45 + activePowerLevel * 0.012,
    '--microscopy-amplification-blur': `${Math.max(0, activePowerLevel - 76) * 0.055}px`,
    '--microscopy-power-blur': `${Math.max(0.2, (100 - activePowerLevel) * 0.075)}px`,
    '--microscopy-resolution-separation': `${Math.max(0, (activePowerLevel - 18) / 82) * 17}px`,
    '--microscopy-definition-opacity': 0.2 + activePowerLevel * 0.0078,
    '--microscopy-definition-contrast': 0.62 + activePowerLevel * 0.0088,
    '--microscopy-definition-saturation': 0.45 + activePowerLevel * 0.0095,
  } as React.CSSProperties;

  const mapPlateIds = useMemo(() => new Set(maps.map((map) => map.placa_id)), [maps]);

  const objectiveSubtema = useMemo(
    () => subtemas.find((subtema) => normalizeName(subtema.nombre).includes('objetiv')) ?? null,
    [subtemas]
  );
  const objectivePlates = objectiveSubtema ? placasBySubtema.get(objectiveSubtema.id) ?? [] : [];
  const objectiveImage = objectivePlates[1] ?? objectivePlates[0] ?? null;

  const condenserSubtema = useMemo(
    () => subtemas.find((subtema) => normalizeName(subtema.nombre).includes('condens')) ?? null,
    [subtemas]
  );
  const condenserImage = condenserSubtema ? (placasBySubtema.get(condenserSubtema.id) ?? [])[0] ?? null : null;

  const selectedObjective = OBJECTIVES.find((objective) => objective.value === objectiveValue) ?? OBJECTIVES[0];
  const activeObjectiveSample = objectiveSamples[objectiveValue] ?? null;
  const totalMagnification = selectedObjective.value * 10;
  const simulatedBrightness = Math.max(24, illumination * (0.48 + diaphragm / 150));
  const simulatedContrast = 1 + ((100 - diaphragm) / 100) * 0.55;

  const quizItems = useMemo<QuizItem[]>(() => {
    const unique = new Map<string, { title: string; description: string }>();
    maps.forEach((map) => {
      parseMapSections(map.sections).forEach((section) => {
        const key = normalizeName(section.title);
        if (!unique.has(key) && section.description.trim()) {
          unique.set(key, { title: section.title, description: section.description });
        }
      });
    });

    const items = Array.from(unique.values());
    return items.slice(0, Math.min(5, items.length)).map((item, index) => {
      const distractors = items
        .filter((candidate) => candidate.title !== item.title)
        .filter((_, candidateIndex) => candidateIndex % 3 === index % 3)
        .slice(0, 3);
      const fallback = items.filter(
        (candidate) => candidate.title !== item.title && !distractors.some((entry) => entry.title === candidate.title)
      );
      while (distractors.length < 3 && fallback.length > 0) {
        const next = fallback.shift();
        if (next) distractors.push(next);
      }
      const options = distractors.map((entry) => entry.title);
      options.splice(index % Math.max(1, options.length + 1), 0, item.title);
      return { ...item, options };
    });
  }, [maps]);

  const selectedPlacaIndex = selectedPlaca ? placas.findIndex((placa) => placa.id === selectedPlaca.id) : -1;
  const selectedPlacaSubtema = selectedPlaca
    ? subtemas.find((subtema) => subtema.id === selectedPlaca.subtema_id) ?? null
    : null;

  const selectedMapPlate = selectedMap
    ? placas.find((placa) => placa.id === selectedMap.placa_id) ?? null
    : null;
  const selectedMapSubtema = selectedMap
    ? subtemas.find((subtema) => subtema.id === selectedMap.subtema_id) ?? null
    : null;

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const answerQuiz = (option: string) => {
    if (quizSelected || quizFinished) return;
    setQuizSelected(option);
    if (option === quizItems[quizIndex]?.title) setQuizScore((score) => score + 1);
  };

  const advanceQuiz = () => {
    if (quizIndex >= quizItems.length - 1) {
      setQuizFinished(true);
      return;
    }
    setQuizIndex((index) => index + 1);
    setQuizSelected(null);
  };

  const resetQuiz = () => {
    setQuizIndex(0);
    setQuizSelected(null);
    setQuizScore(0);
    setQuizFinished(false);
  };

  if (loading) {
    return (
      <div className="microscopy-page atlas-temario-typography">
        <Header />
        <main className="microscopy-shell microscopy-loading-state" aria-live="polite">
          <div className="microscopy-loader" />
          <p>Preparando el laboratorio interactivo…</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (loadError || !tema) {
    return (
      <div className="microscopy-page atlas-temario-typography">
        <Header />
        <main className="microscopy-shell microscopy-error-state">
          <BackButton onClick={handleGoBack} />
          <section>
            <XCircle size={38} aria-hidden="true" />
            <h1>No se pudo abrir el laboratorio</h1>
            <p>{loadError ?? 'El tema solicitado no se encuentra disponible.'}</p>
            <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
              Reintentar
            </button>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="microscopy-page atlas-temario-typography">
      <Header />

      <main className="microscopy-shell">
        <BackButton onClick={handleGoBack} label="Volver al temario" />

        <section className="microscopy-hero" aria-labelledby="microscopy-title">
          <div className="microscopy-hero-glow microscopy-hero-glow-one" />
          <div className="microscopy-hero-glow microscopy-hero-glow-two" />
          <div className="microscopy-hero-copy">
            <span className="microscopy-eyebrow"><Sparkles size={15} /> Laboratorio interactivo</span>
            <h1 id="microscopy-title">{tema.nombre}</h1>
            <p>
              Conoce el instrumento, sigue la ruta de la luz y domina los aumentos mediante una experiencia
              desarrollada con material real del laboratorio.
            </p>
          </div>
          <div className="microscopy-hero-visual" aria-hidden="true">
            <div className="microscopy-orbit microscopy-orbit-one" />
            <div className="microscopy-orbit microscopy-orbit-two" />
            {tema.logo_url ? (
              <img src={getCloudinaryImageUrl(tema.logo_url, 'cardWide')} alt="" />
            ) : (
              <Microscope size={120} />
            )}
            <span className="microscopy-hero-label"><MousePointerClick size={14} /> Explora cada componente</span>
          </div>
        </section>

        <nav className="microscopy-journey-nav" aria-label="Secciones del laboratorio">
          <button type="button" onClick={() => scrollToSection('fundamentos')}><BookOpen size={16} /> Fundamentos</button>
          <button type="button" onClick={() => scrollToSection('explorador')}><MousePointerClick size={16} /> Explorador</button>
          <button type="button" onClick={() => scrollToSection('aumentos')}><Focus size={16} /> Aumentos</button>
          <button type="button" onClick={() => scrollToSection('iluminacion')}><Lightbulb size={16} /> Iluminación</button>
          <button type="button" onClick={() => scrollToSection('practica')}><Target size={16} /> Práctica</button>
        </nav>

        <section id="fundamentos" className="microscopy-section microscopy-foundations">
          <div className="microscopy-section-heading">
            <span>01 · Antes de comenzar</span>
            <h2>De lo invisible a lo observable</h2>
            <p>El microscopio no solo agranda: permite distinguir detalles que el ojo humano no puede separar.</p>
          </div>

          <div className="microscopy-observation-journey">
            <article className="microscopy-observation-stage is-eye">
              <header>
                <span><Eye size={22} /></span>
                <div><small>Punto de partida</small><strong>Visión humana</strong></div>
              </header>
              <div className="microscopy-eye-sample" aria-hidden="true">
                <span />
                <span />
                <i>Dos puntos parecen uno</i>
              </div>
              <footer>
                <strong>0,2 mm</strong>
                <span>Límite aproximado para distinguir dos puntos separados.</span>
              </footer>
            </article>

            <div className="microscopy-zoom-bridge" aria-label="El microscopio permite observar aproximadamente mil veces más detalle">
              <div className="microscopy-zoom-rings" aria-hidden="true">
                <i /><i /><i />
                <Focus size={25} />
              </div>
              <strong>≈ 1.000×</strong>
              <span>Más detalle observable</span>
              <div className="microscopy-scale-arrow" aria-hidden="true"><i /></div>
              <small>mm → µm</small>
            </div>

            <article className="microscopy-observation-stage is-microscope">
              <header>
                <span><Microscope size={22} /></span>
                <div><small>Resultado</small><strong>Visión microscópica</strong></div>
              </header>
              <div className="microscopy-cell-sample" aria-hidden="true">
                <span /><span /><span /><span /><span /><span />
                <i>Los detalles se separan</i>
              </div>
              <footer>
                <strong>0,2 µm</strong>
                <span>Resolución aproximada para estudiar células y tejidos.</span>
              </footer>
            </article>
          </div>

          <div className="microscopy-power-lab" aria-labelledby="microscopy-power-lab-title">
            <div className="microscopy-power-lab-header">
              <div>
                <span><SlidersHorizontal size={14} /> Laboratorio de conceptos</span>
                <h3 id="microscopy-power-lab-title">Experimenta con los tres poderes del microscopio</h3>
              </div>
              <p>Selecciona un concepto y mueve el control para comprobar qué cambia realmente en la imagen.</p>
            </div>

            <div className="microscopy-power-selector" role="group" aria-label="Poderes del microscopio">
              {MICROSCOPY_POWERS.map((power) => (
                <button
                  type="button"
                  className={activePower === power.id ? 'is-active' : ''}
                  aria-pressed={activePower === power.id}
                  onClick={() => setActivePower(power.id)}
                  key={power.id}
                >
                  <span className="microscopy-power-selector-number">{power.number}</span>
                  <span className="microscopy-power-selector-icon" aria-hidden="true">
                    {power.id === 'amplification' && <Focus size={18} />}
                    {power.id === 'resolution' && <Eye size={18} />}
                    {power.id === 'definition' && <SlidersHorizontal size={18} />}
                  </span>
                  <span>
                    <strong>{power.title}</strong>
                    <small>{power.summary}</small>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              ))}
            </div>

            <div
              className={`microscopy-power-panel is-${activePower}${activePower === 'amplification' && activePowerLevel >= 78 ? ' is-empty-magnification' : ''}`}
              style={powerVisualStyle}
            >
              <div className="microscopy-power-stage">
                <div className="microscopy-power-stage-heading">
                  <span>Vista simulada</span>
                  <output aria-live="polite">{getMicroscopyPowerStatus(activePower, activePowerLevel)}</output>
                </div>

                <div className="microscopy-power-view" aria-hidden="true">
                  <span className="microscopy-power-view-caption">
                    {activePower === 'resolution'
                      ? activePowerLevel < 38
                        ? 'Parece uno'
                        : activePowerLevel < 72
                          ? 'Se está separando'
                          : 'Ahora se ven dos'
                      : activePowerMeta.visualLabel}
                  </span>

                  {activePower === 'amplification' && (
                    <>
                      <div className="microscopy-power-sample is-amplification">
                        <span /><span /><span /><span /><span /><span /><span /><span /><span />
                      </div>
                      {activePowerLevel >= 78 && (
                        <span className="microscopy-empty-magnification-note">Más grande · mismo detalle</span>
                      )}
                    </>
                  )}

                  {activePower === 'resolution' && (
                    <div className="microscopy-power-sample is-resolution">
                      <span /><span />
                      <i className="microscopy-resolution-distance" />
                    </div>
                  )}

                  {activePower === 'definition' && (
                    <div className="microscopy-power-sample is-definition">
                      <span /><span /><span /><span /><span /><span />
                      <i /><i /><i />
                    </div>
                  )}
                </div>

                <span className="microscopy-power-stage-hint"><MousePointerClick size={13} /> Observa mientras mueves el control</span>
              </div>

              <div className="microscopy-power-lesson">
                <span className="microscopy-power-lesson-kicker">
                  {activePowerMeta.number} · {activePowerMeta.title}
                </span>
                <h4>{activePowerMeta.summary}</h4>
                <p>{activePowerMeta.explanation}</p>

                <div className="microscopy-power-observation" aria-label="Comparación del ejemplo">
                  <span><small>Cambia</small><strong>{activePowerMeta.changes}</strong></span>
                  <span><small>No cambia</small><strong>{activePowerMeta.stays}</strong></span>
                </div>

                <div className="microscopy-power-control">
                  <label htmlFor="microscopy-power-range">
                    <span>{activePowerMeta.controlLabel}</span>
                    <output>{activePowerLevel}%</output>
                  </label>
                  <input
                    id="microscopy-power-range"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={activePowerLevel}
                    aria-label={`${activePowerMeta.controlLabel} para ${activePowerMeta.title}`}
                    onChange={(event) => {
                      const nextLevel = Number(event.target.value);
                      setPowerLevels((levels) => ({ ...levels, [activePower]: nextLevel }));
                    }}
                  />
                  <div><span>{activePowerMeta.lowLabel}</span><span>{activePowerMeta.highLabel}</span></div>
                </div>

                <p className="microscopy-power-takeaway">
                  <Check size={16} aria-hidden="true" />
                  <span><strong>Idea clave</strong>{activePowerMeta.takeaway}</span>
                </p>
              </div>
            </div>
          </div>
          <p className="microscopy-key-note">
            <Lightbulb size={18} /> El ocular aumenta la imagen formada por el objetivo, pero no añade nueva resolución.
          </p>
        </section>

        <aside className="microscopy-lab-fact" aria-labelledby="microscopy-lab-fact-title">
          <div className="microscopy-lab-fact-icon" aria-hidden="true">
            <Microscope size={25} />
          </div>

          <div className="microscopy-lab-fact-copy">
            <span><Sparkles size={14} /> Dato de microscopía</span>
            <p id="microscopy-lab-fact-title">
              <strong>
                ¿Sabías que en el laboratorio utilizamos microscopios ópticos compuestos,
                binoculares y de campo claro?
              </strong>{' '}
              Usan dos sistemas de lentes y luz transmitida para ampliar las preparaciones histológicas.
            </p>
          </div>

          <div className="microscopy-lab-fact-visual" aria-hidden="true">
            <span className="microscopy-lab-fact-visual-label">Campo claro</span>
            <div className="microscopy-lab-fact-binocular">
              <i className="microscopy-lab-fact-ocular microscopy-lab-fact-ocular-left" />
              <i className="microscopy-lab-fact-ocular microscopy-lab-fact-ocular-right" />
              <i className="microscopy-lab-fact-head" />
              <i className="microscopy-lab-fact-stage" />
              <i className="microscopy-lab-fact-light" />
              <b className="microscopy-lab-fact-ray microscopy-lab-fact-ray-left" />
              <b className="microscopy-lab-fact-ray microscopy-lab-fact-ray-right" />
            </div>
            <small>Luz transmitida</small>
          </div>
        </aside>

        <section id="explorador" className="microscopy-section microscopy-explorer-section">
          <div className="microscopy-section-heading is-light">
            <span>02 · Conoce el instrumento</span>
            <h2>Explorador del microscopio</h2>
            <p>Selecciona una estación y abre su mapa para recorrer las regiones señaladas sobre la fotografía.</p>
          </div>

          <div className="microscopy-station-tabs" role="tablist" aria-label="Estaciones de microscopía">
            {subtemas.map((subtema, index) => {
              const meta = getStationMeta(subtema.nombre);
              const isActive = activeStation?.id === subtema.id;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={isActive ? 'is-active' : ''}
                  style={{ '--station-accent': meta.accent } as React.CSSProperties}
                  key={subtema.id}
                  onClick={() => setActiveStationId(subtema.id)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <i>{meta.icon}</i>
                  <strong>{subtema.nombre}</strong>
                </button>
              );
            })}
          </div>

          {activeStation && activeMeta && (
            <div className="microscopy-explorer-panel" style={{ '--station-accent': activeMeta.accent } as React.CSSProperties}>
              <div className="microscopy-explorer-visual">
                {activeMapPlate ? (
                  <img
                    src={getCloudinaryImageUrl(activeMapPlate.photo_url, 'view')}
                    alt={`Exploración de ${activeStation.nombre}`}
                  />
                ) : activeStation.logo_url ? (
                  <img src={getCloudinaryImageUrl(activeStation.logo_url, 'cardWide')} alt={activeStation.nombre} />
                ) : (
                  <Microscope size={96} aria-hidden="true" />
                )}
                <div className="microscopy-explorer-overlay">
                  <span>{activeSections.length} {activeSections.length === 1 ? 'región interactiva' : 'regiones interactivas'}</span>
                  {activeMap && activeMapPlate && activeSections.length > 0 && (
                    <button type="button" onClick={() => setSelectedMap(activeMap)}>
                      Abrir mapa interactivo <MousePointerClick size={17} />
                    </button>
                  )}
                </div>
              </div>

              <div className="microscopy-explorer-info">
                <span className="microscopy-station-kicker">{activeMeta.kicker}</span>
                <h3>{activeStation.nombre}</h3>
                <p>{activeMeta.shortDescription}</p>
                <div className="microscopy-component-list">
                  {activeSections.map((section) => (
                    <button type="button" key={section.title} onClick={() => activeMap && setSelectedMap(activeMap)}>
                      <i style={{ background: section.color }} />
                      <span>{section.title}</span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
                {activeStationPlates.length > 0 && (
                  <div className="microscopy-station-photos">
                    <span>{activeStationPlates.length} {activeStationPlates.length === 1 ? 'fotografía disponible' : 'fotografías disponibles'}</span>
                    <div>
                      {activeStationPlates.map((placa) => (
                        <button type="button" key={placa.id} onClick={() => setSelectedPlaca(placa)} aria-label="Abrir fotografía">
                          <img src={getCloudinaryImageUrl(placa.photo_url, 'thumbSmall')} alt="" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section id="aumentos" className="microscopy-section microscopy-objectives-section">
          <div className="microscopy-section-heading">
            <span>03 · Elige el nivel de detalle</span>
            <h2>Objetivos y aumento total</h2>
            <p>Selecciona un objetivo para comparar su función y calcular el aumento total con un ocular de 10×.</p>
          </div>
          <div className="microscopy-objective-layout">
            <div className="microscopy-objective-selector">
              {OBJECTIVES.map((objective) => (
                <button
                  type="button"
                  key={objective.value}
                  className={objectiveValue === objective.value ? 'is-active' : ''}
                  style={{ '--objective-color': objective.color } as React.CSSProperties}
                  onClick={() => setObjectiveValue(objective.value)}
                >
                  <i />
                  <strong>{objective.label}</strong>
                  <span>{objective.name}</span>
                </button>
              ))}
            </div>
            <div className="microscopy-objective-result">
              <div className="microscopy-objective-photo">
                {objectiveImage ? (
                  <button type="button" onClick={() => setSelectedPlaca(objectiveImage)} aria-label="Ampliar fotografía de objetivos">
                    <img src={getCloudinaryImageUrl(objectiveImage.photo_url, 'view')} alt="Lentes objetivos del microscopio" />
                    <span><Images size={16} /> Ampliar fotografía</span>
                  </button>
                ) : (
                  <Microscope size={80} aria-hidden="true" />
                )}
              </div>
              <div className="microscopy-objective-copy">
                <span style={{ '--objective-color': selectedObjective.color } as React.CSSProperties}>
                  Objetivo {selectedObjective.label}
                </span>
                <h3>{selectedObjective.name}</h3>
                <p>{selectedObjective.description}</p>
                <div className="microscopy-magnification-equation" aria-label={`Aumento total ${totalMagnification} veces`}>
                  <div><small>Objetivo</small><strong>{selectedObjective.value}×</strong></div>
                  <b>×</b>
                  <div><small>Ocular</small><strong>10×</strong></div>
                  <b>=</b>
                  <div className="is-total"><small>Aumento total</small><strong>{totalMagnification}×</strong></div>
                </div>
                {activeObjectiveSample && (
                  <button
                    type="button"
                    className="microscopy-objective-sample"
                    onClick={() => setSelectedObjectiveSample(activeObjectiveSample)}
                  >
                    <span className="microscopy-objective-sample-image">
                      <img
                        src={getCloudinaryImageUrl(activeObjectiveSample.photoUrl, 'cardWideSmall')}
                        alt={`Placa de ejemplo a ${selectedObjective.label}`}
                      />
                      <i>Placa real · {selectedObjective.label}</i>
                    </span>
                    <span className="microscopy-objective-sample-copy">
                      <small>Ejemplo seleccionado para esta sesión</small>
                      <strong>{activeObjectiveSample.temaNombre}</strong>
                      <span>{activeObjectiveSample.subtemaNombre}</span>
                    </span>
                    <span className="microscopy-objective-sample-action">
                      <Images size={17} /> Ver placa
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="iluminacion" className="microscopy-section microscopy-light-section">
          <div className="microscopy-section-heading is-light">
            <span>04 · Controla la imagen</span>
            <h2>Laboratorio de iluminación</h2>
            <p>Ajusta el diafragma y la intensidad para observar sus efectos conceptuales en el brillo y el contraste.</p>
          </div>
          <div className="microscopy-light-lab">
            <div className="microscopy-light-preview">
              {condenserImage ? (
                <img
                  src={getCloudinaryImageUrl(condenserImage.photo_url, 'view')}
                  alt="Condensador y diafragma del microscopio"
                  style={{ filter: `brightness(${simulatedBrightness}%) contrast(${simulatedContrast})` }}
                />
              ) : (
                <Lightbulb size={90} aria-hidden="true" />
              )}
              <span>Demostración conceptual</span>
            </div>
            <div className="microscopy-light-controls">
              <div className="microscopy-control-heading">
                <SlidersHorizontal size={22} />
                <div><strong>Ajusta la iluminación</strong><span>Busca un equilibrio entre brillo, contraste y detalle.</span></div>
              </div>
              <label>
                <span><strong>Apertura del diafragma</strong><output>{diaphragm}%</output></span>
                <input type="range" min="15" max="100" value={diaphragm} onChange={(event) => setDiaphragm(Number(event.target.value))} />
              </label>
              <label>
                <span><strong>Intensidad luminosa</strong><output>{illumination}%</output></span>
                <input type="range" min="20" max="100" value={illumination} onChange={(event) => setIllumination(Number(event.target.value))} />
              </label>
              <div className="microscopy-light-readout">
                <span><small>Brillo</small><strong>{simulatedBrightness < 55 ? 'Bajo' : simulatedBrightness > 95 ? 'Alto' : 'Equilibrado'}</strong></span>
                <span><small>Contraste</small><strong>{diaphragm < 35 ? 'Alto' : diaphragm > 82 ? 'Bajo' : 'Equilibrado'}</strong></span>
              </div>
              <p><Lightbulb size={17} /> Cerrar el diafragma puede aumentar el contraste, pero reduce la cantidad de luz disponible.</p>
            </div>
          </div>
        </section>

        <section id="practica" className="microscopy-section microscopy-quiz-section">
          <div className="microscopy-section-heading">
            <span>05 · Comprueba lo aprendido</span>
            <h2>Práctica de identificación</h2>
            <p>Lee la función y selecciona el componente correcto con base en la información de los mapas existentes.</p>
          </div>

          {quizItems.length === 0 ? (
            <div className="microscopy-empty-practice">La práctica estará disponible cuando existan regiones en los mapas.</div>
          ) : quizFinished ? (
            <div className="microscopy-quiz-finished">
              <span><Target size={32} /></span>
              <small>Resultado final</small>
              <strong>{quizScore} / {quizItems.length}</strong>
              <p>{quizScore === quizItems.length ? '¡Excelente! Reconociste todos los componentes.' : 'Puedes repetir la práctica y explorar nuevamente los mapas.'}</p>
              <button type="button" onClick={resetQuiz}><RotateCcw size={17} /> Intentar de nuevo</button>
            </div>
          ) : (
            <div className="microscopy-quiz-card">
              <div className="microscopy-quiz-progress">
                <span>Pregunta {quizIndex + 1} de {quizItems.length}</span>
                <div><i style={{ width: `${((quizIndex + 1) / quizItems.length) * 100}%` }} /></div>
                <strong>{quizScore} {quizScore === 1 ? 'respuesta correcta' : 'respuestas correctas'}</strong>
              </div>
              <div className="microscopy-quiz-prompt">
                <span><Target size={22} /></span>
                <p>{quizItems[quizIndex].description}</p>
              </div>
              <div className="microscopy-quiz-options">
                {quizItems[quizIndex].options.map((option) => {
                  const isCorrect = option === quizItems[quizIndex].title;
                  const isSelected = option === quizSelected;
                  const revealCorrect = Boolean(quizSelected) && isCorrect;
                  return (
                    <button
                      type="button"
                      key={option}
                      disabled={Boolean(quizSelected)}
                      className={`${isSelected ? 'is-selected' : ''} ${revealCorrect ? 'is-correct' : ''} ${isSelected && !isCorrect ? 'is-wrong' : ''}`}
                      onClick={() => answerQuiz(option)}
                    >
                      <span>{isSelected || revealCorrect ? (isCorrect ? <Check size={17} /> : <XCircle size={17} />) : <i />}</span>
                      {option}
                    </button>
                  );
                })}
              </div>
              {quizSelected && (
                <div className={`microscopy-quiz-feedback ${quizSelected === quizItems[quizIndex].title ? 'is-correct' : 'is-wrong'}`}>
                  <span>{quizSelected === quizItems[quizIndex].title ? '¡Correcto!' : `Respuesta correcta: ${quizItems[quizIndex].title}`}</span>
                  <button type="button" onClick={advanceQuiz}>
                    {quizIndex === quizItems.length - 1 ? 'Ver resultado' : 'Siguiente'} <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="microscopy-section microscopy-library-section">
          <div className="microscopy-section-heading is-inline">
            <div>
              <span>Biblioteca visual</span>
              <h2>Todo el material del tema</h2>
            </div>
            <p>Las fotografías originales siguen disponibles junto con sus señalamientos y mapas interactivos.</p>
          </div>
          <div className="microscopy-photo-grid">
            {placas.map((placa) => {
              const subtema = subtemas.find((item) => item.id === placa.subtema_id);
              return (
                <button type="button" key={placa.id} onClick={() => setSelectedPlaca(placa)}>
                  <img src={getCloudinaryImageUrl(placa.photo_url, 'cardWideSmall')} alt={subtema?.nombre ?? 'Microscopía'} loading="lazy" />
                  <span>
                    <small>{subtema?.nombre ?? 'Microscopía'}</small>
                    <strong>{mapPlateIds.has(placa.id) ? 'Mapa interactivo disponible' : placa.aumento ? `Aumento ${placa.aumento}` : 'Abrir fotografía'}</strong>
                  </span>
                  <i><Images size={17} /></i>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />

      {selectedPlaca && (
        <ImageViewerModal
          src={getCloudinaryImageUrl(selectedPlaca.photo_url, 'view')}
          srcZoom={getCloudinaryImageUrl(selectedPlaca.photo_url, 'zoom')}
          onClose={() => setSelectedPlaca(null)}
          placaId={selectedPlaca.id}
          hasInteractiveMapHint={mapPlateIds.has(selectedPlaca.id)}
          temaNombre={tema.nombre}
          subtemaNombre={selectedPlacaSubtema?.nombre}
          aumento={selectedPlaca.aumento}
          senalados={selectedPlaca.senalados}
          senaladosMeta={selectedPlaca.senalados_meta}
          comentario={selectedPlaca.comentario}
          tincion={selectedPlaca.tincion}
          platePosition={selectedPlacaIndex + 1}
          plateCount={placas.length}
          onPreviousPlate={selectedPlacaIndex > 0 ? () => setSelectedPlaca(placas[selectedPlacaIndex - 1]) : undefined}
          onNextPlate={selectedPlacaIndex >= 0 && selectedPlacaIndex < placas.length - 1 ? () => setSelectedPlaca(placas[selectedPlacaIndex + 1]) : undefined}
        />
      )}

      {selectedObjectiveSample && (
        <ImageViewerModal
          src={getCloudinaryImageUrl(selectedObjectiveSample.photoUrl, 'view')}
          srcZoom={getCloudinaryImageUrl(selectedObjectiveSample.photoUrl, 'zoom')}
          onClose={() => setSelectedObjectiveSample(null)}
          placaId={selectedObjectiveSample.id}
          temaNombre={selectedObjectiveSample.temaNombre}
          subtemaNombre={selectedObjectiveSample.subtemaNombre}
          aumento={selectedObjectiveSample.aumento}
          comentario={selectedObjectiveSample.comentario}
          tincion={selectedObjectiveSample.tincion}
        />
      )}

      {selectedMap && selectedMapPlate && (
        <InteractiveMapViewerModal
          mapLabel={`Mapa interactivo ${selectedMap.map_number}`}
          imageUrl={getCloudinaryImageUrl(selectedMapPlate.photo_url, 'zoom')}
          temaNombre={tema.nombre}
          subtemaNombre={selectedMapSubtema?.nombre}
          sections={parseMapSections(selectedMap.sections)}
          onClose={() => setSelectedMap(null)}
        />
      )}
    </div>
  );
};

export default MicroscopyTopicExperience;
