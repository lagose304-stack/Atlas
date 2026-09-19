import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Check,
  Flame,
  Heart,
  Lock,
  Maximize2,
  Music,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchSiteMaintenanceStatus,
  subscribeSiteMaintenanceStatus,
  isParcialDisabled,
  isTemaDisabled,
  canBypassMaintenance,
  type SiteMaintenanceStatus,
} from '../services/siteMaintenance';
import arcadeMusicUrl from '../assets/musica/mondamusic-retro-arcade-game-music-512837.mp3';
import '../styles/desafioIdentificacion.css';

interface PlacaGameItem {
  id: number;
  photo_url: string;
  aumento?: string | null;
  tincion?: string | null;
  comentario?: string | null;
  subtema_id: number;
  subtema_nombre: string;
  tema_id: number;
  tema_nombre: string;
  parcial: string;
}

interface GameOption {
  id: string;
  name: string;
  isCorrect: boolean;
}

type ParcialKey = 'todos' | 'primer' | 'segundo' | 'tercer';

const MAX_QUESTIONS_PER_MATCH = 30;
const TOTAL_ROUND_SECONDS = 15.0;
const MAX_LIVES = 4.0;
const ARCADE_SESSION_HISTORY_KEY = 'atlas_arcade_used_plate_ids';

const PARCIALES_INFO: { key: ParcialKey; num: string; name: string; desc: string }[] = [
  { key: 'todos', num: '★', name: 'Todos los Parciales', desc: 'Desafío global de 30 placas con todo el atlas' },
  { key: 'primer', num: '1', name: 'Primer Parcial', desc: 'Epitelial, conectivo, adiposo y generalidades' },
  { key: 'segundo', num: '2', name: 'Segundo Parcial', desc: 'Cartílago, hueso, sangre, músculo y anexos' },
  { key: 'tercer', num: '3', name: 'Tercer Parcial', desc: 'Nervioso, cardiovascular, linfoide y sistemas' },
];

/**
 * Algoritmo de barajado estratificado e intercalado (Interleaved Diversity).
 * Evita repeticiones consecutivas de un mismo tema o subtema para que la experiencia sea variada.
 */
function generateDiverseMatchPlates(pool: PlacaGameItem[], count: number = MAX_QUESTIONS_PER_MATCH): PlacaGameItem[] {
  if (pool.length === 0) return [];
  const targetCount = Math.min(count, pool.length);

  // 1. Agrupar por subtema_id
  const subtemasMap = new Map<number, { tema_id: number; plates: PlacaGameItem[] }>();
  for (const plate of pool) {
    if (!subtemasMap.has(plate.subtema_id)) {
      subtemasMap.set(plate.subtema_id, { tema_id: plate.tema_id, plates: [] });
    }
    subtemasMap.get(plate.subtema_id)!.plates.push(plate);
  }

  // Barajar aleatoriamente las placas internas de cada subtema
  for (const sub of subtemasMap.values()) {
    sub.plates.sort(() => Math.random() - 0.5);
  }

  // 2. Agrupar subtema_ids por tema_id
  const temaToSubtemas = new Map<number, number[]>();
  for (const [subtemaId, info] of subtemasMap) {
    if (!temaToSubtemas.has(info.tema_id)) {
      temaToSubtemas.set(info.tema_id, []);
    }
    temaToSubtemas.get(info.tema_id)!.push(subtemaId);
  }

  // Barajar los temas y los subtemas dentro de cada tema
  const temaIds = Array.from(temaToSubtemas.keys()).sort(() => Math.random() - 0.5);
  for (const subIds of temaToSubtemas.values()) {
    subIds.sort(() => Math.random() - 0.5);
  }

  const result: PlacaGameItem[] = [];
  const recentSubtemaIds: number[] = [];
  const recentTemaIds: number[] = [];

  // Punteros rotativos por tema
  const subtemaIndexPerTema = new Map<number, number>();
  for (const tId of temaIds) {
    subtemaIndexPerTema.set(tId, 0);
  }

  let safetyCycles = 0;
  while (result.length < targetCount && safetyCycles < 120) {
    safetyCycles++;
    let addedInCycle = 0;

    // Recorrer temas de forma intercalada
    for (const tId of temaIds) {
      if (result.length >= targetCount) break;

      const subIds = temaToSubtemas.get(tId) || [];
      if (subIds.length === 0) continue;

      const currentSubIdx = subtemaIndexPerTema.get(tId) || 0;
      let foundPlateForThisTema = false;

      // Buscar un subtema de este tema que aún tenga placas disponibles
      for (let attempt = 0; attempt < subIds.length; attempt++) {
        const sId = subIds[(currentSubIdx + attempt) % subIds.length];
        const subInfo = subtemasMap.get(sId);

        if (subInfo && subInfo.plates.length > 0) {
          // Si este subtema ya salió en las últimas 3 preguntas y hay otras alternativas, priorizar variedad
          const isRecentSubtema = recentSubtemaIds.slice(-3).includes(sId);
          if (isRecentSubtema && pool.length > 10 && subInfo.plates.length > 0 && attempt < subIds.length - 1) {
            continue;
          }

          const picked = subInfo.plates.pop()!;
          result.push(picked);
          recentSubtemaIds.push(picked.subtema_id);
          recentTemaIds.push(picked.tema_id);
          subtemaIndexPerTema.set(tId, (currentSubIdx + attempt + 1) % subIds.length);
          foundPlateForThisTema = true;
          addedInCycle++;
          break;
        }
      }

      // Si no encontramos con la restricción de recent, tomar la primera disponible
      if (!foundPlateForThisTema) {
        for (const sId of subIds) {
          const subInfo = subtemasMap.get(sId);
          if (subInfo && subInfo.plates.length > 0) {
            const picked = subInfo.plates.pop()!;
            result.push(picked);
            recentSubtemaIds.push(picked.subtema_id);
            recentTemaIds.push(picked.tema_id);
            addedInCycle++;
            break;
          }
        }
      }
    }

    if (addedInCycle === 0) break;
  }

  // Si aún faltaran para llegar a 30 por casos de borde, rellenar con lo que quede del pool
  if (result.length < targetCount) {
    const remaining = pool.filter((p) => !result.some((r) => r.id === p.id));
    remaining.sort(() => Math.random() - 0.5);
    for (const p of remaining) {
      if (result.length >= targetCount) break;
      result.push(p);
    }
  }

  return result;
}

function getSessionPlateHistory(): number[] {
  try {
    const saved = window.sessionStorage.getItem(ARCADE_SESSION_HISTORY_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map(Number).filter(Number.isFinite))];
  } catch {
    return [];
  }
}

function rememberSessionPlates(previousIds: number[], playedIds: number[]) {
  try {
    const justPlayed = new Set(playedIds);
    const updated = [...previousIds.filter((id) => !justPlayed.has(id)), ...playedIds].slice(-1000);
    window.sessionStorage.setItem(ARCADE_SESSION_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // La partida continúa aunque el navegador bloquee el almacenamiento de sesión.
  }
}

/** Componente para renderizar un corazón (lleno, mitad o vacío) */
const HeartIcon: React.FC<{ status: 'full' | 'half' | 'empty'; isPopping?: boolean }> = ({ status, isPopping }) => {
  if (status === 'full') {
    return (
      <svg
        className={`desafio-heart-icon desafio-heart-full ${isPopping ? 'desafio-heart-pop' : ''}`}
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="none"
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }

  if (status === 'half') {
    return (
      <svg
        className={`desafio-heart-icon desafio-heart-half ${isPopping ? 'desafio-heart-pop' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <defs>
          <linearGradient id="halfHeartGradientLight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="50%" stopColor="#f43f5e" />
            <stop offset="50%" stopColor="rgba(203, 213, 225, 0.4)" />
          </linearGradient>
        </defs>
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill="url(#halfHeartGradientLight)"
          stroke="#f43f5e"
          strokeWidth="1.2"
        />
      </svg>
    );
  }

  return (
    <svg
      className="desafio-heart-icon desafio-heart-empty"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
};

/** Función para calcular el rango arcade */
function getArcadeRank(correct: number, total: number, remainingLives: number) {
  const ratio = total > 0 ? correct / total : 0;
  if (ratio >= 0.95 && remainingLives >= 4.0) return { rank: 'SSS', label: 'Maestro Histológico Supremo', className: 'rank-sss' };
  if (ratio >= 0.90) return { rank: 'SS', label: 'Especialista Élite', className: 'rank-ss' };
  if (ratio >= 0.80) return { rank: 'S', label: 'Identificador Experto', className: 'rank-s' };
  if (ratio >= 0.70) return { rank: 'A', label: 'Gran Diagnóstico', className: 'rank-a' };
  if (ratio >= 0.50) return { rank: 'B', label: 'Buen Desempeño', className: 'rank-b' };
  return { rank: 'C', label: 'En Entrenamiento', className: 'rank-c' };
}

const DesafioIdentificacion: React.FC = () => {
  const goBack = useSmartBackNavigation('/herramientas');
  const { user, isAuthenticated } = useAuth();
  const canBypass = canBypassMaintenance(user, isAuthenticated);

  // Estado de mantenimiento
  const [maintenanceStatus, setMaintenanceStatus] = useState<SiteMaintenanceStatus | null>(null);

  // Estado de sonido FX y Música de fondo BGM
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('atlas_desafio_sound');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const [musicEnabled, setMusicEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('atlas_desafio_music');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  // Estado general
  const [gameState, setGameState] = useState<'lobby' | 'preparing' | 'countdown' | 'playing' | 'gameover'>('lobby');
  const [countdownVal, setCountdownVal] = useState<number>(5);
  const [isVictory, setIsVictory] = useState<boolean>(false);
  const [selectedParcial, setSelectedParcial] = useState<ParcialKey>('todos');
  const [loading, setLoading] = useState(true);
  const [allPlates, setAllPlates] = useState<PlacaGameItem[]>([]);

  // Estado de la partida activa
  const [gamePlates, setGamePlates] = useState<PlacaGameItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lives, setLives] = useState<number>(MAX_LIVES);
  const [unidentifiedCount, setUnidentifiedCount] = useState<number>(0); // Contador de placas no identificadas (máx 2 oportunidades)
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [maxStreak, setMaxStreak] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [correctAnswersCount, setCorrectAnswersCount] = useState<number>(0);
  const [totalAttempted, setTotalAttempted] = useState<number>(0);

  // Ronda actual
  const [options, setOptions] = useState<GameOption[]>([]);
  const [selectedIncorrectOptions, setSelectedIncorrectOptions] = useState<Set<string>>(new Set());
  const [roundStatus, setRoundStatus] = useState<'active' | 'correct' | 'timeout'>('active');
  const [timeLeft, setTimeLeft] = useState<number>(TOTAL_ROUND_SECONDS);
  const [isImageLoaded, setIsImageLoaded] = useState<boolean>(false);

  // Banners y efectos arcade
  const [healNotification, setHealNotification] = useState<string | null>(null);
  const [floatingFeedback, setFloatingFeedback] = useState<{ id: number; text: string } | null>(null);
  const [isHeartPopping, setIsHeartPopping] = useState<boolean>(false);
  const [isScreenShaking, setIsScreenShaking] = useState<boolean>(false);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);

  // Referencias para evitar condiciones de carrera entre timeout y click
  const roundResolvedRef = useRef<boolean>(false);
  // Evita que eventos cercanos usen un contador de oportunidades obsoleto.
  const unidentifiedCountRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const nextRoundTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const healTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const floatingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Web Audio Context para SFX y Reproductor de Audio para BGM (MP3 de assets/musica)
  const audioContextRef = useRef<AudioContext | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);

  // Inicializar o reanudar AudioContext para SFX
  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    }
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx;
  }, []);

  // Sintetizador Web Audio API para Efectos de Sonido (SFX)
  const playAudioFx = useCallback(
    (type: 'correct' | 'incorrect' | 'timeout' | 'heal' | 'tick' | 'victory' | 'countdown_tick' | 'countdown_go', countNum?: number) => {
      if (!soundEnabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      try {
        const now = ctx.currentTime;

        if (type === 'correct') {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.type = 'triangle';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(523.25, now);
          osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.1);
          osc2.frequency.setValueAtTime(659.25, now);
          osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.1);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.32);
          osc2.stop(now + 0.32);
        } else if (type === 'incorrect') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(160, now);
          osc.frequency.linearRampToValueAtTime(110, now + 0.16);
          gain.gain.setValueAtTime(0.16, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.18);
        } else if (type === 'timeout') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.38);
        } else if (type === 'heal') {
          const freqs = [523.25, 659.25, 783.99, 1046.5];
          freqs.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now + i * 0.06);
            gain.gain.setValueAtTime(0.14, now + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.22);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.22);
          });
        } else if (type === 'tick') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(750, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.04);
        } else if (type === 'countdown_tick') {
          const currentCount = countNum ?? 5;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          const pitch = 460 + (5 - currentCount) * 75;
          osc.frequency.setValueAtTime(pitch, now);
          gain.gain.setValueAtTime(0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.09);
        } else if (type === 'countdown_go') {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.type = 'triangle';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(523.25, now);
          osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.14);
          osc2.frequency.setValueAtTime(659.25, now);
          osc2.frequency.exponentialRampToValueAtTime(1318.5, now + 0.14);
          gain.gain.setValueAtTime(0.24, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.45);
          osc2.stop(now + 0.45);
        } else if (type === 'victory') {
          const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.5];
          fanfare.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, now + i * 0.09);
            gain.gain.setValueAtTime(0.18, now + i * 0.09);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.09);
            osc.stop(now + i * 0.09 + 0.35);
          });
        }
      } catch (e) {
        // Fallback silencioso
      }
    },
    [soundEnabled, getAudioContext]
  );

  // Reproductor de Música de Fondo Arcade (MP3 de assets/musica)
  const playBgm = useCallback(() => {
    if (!musicEnabled || typeof window === 'undefined') return;
    try {
      if (!bgmAudioRef.current) {
        const audio = new Audio(arcadeMusicUrl);
        audio.loop = true;
        audio.volume = 0.25;
        bgmAudioRef.current = audio;
      }
      const audio = bgmAudioRef.current;
      if (audio && audio.paused) {
        audio.play().catch(() => {
          // Si el navegador bloquea autoplay antes de interactuar, esperará al primer clic
        });
      }
    } catch {}
  }, [musicEnabled]);

  const pauseBgm = useCallback(() => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
    }
  }, []);

  // Efecto para sincronizar reproducción de música con el estado musicEnabled
  useEffect(() => {
    if (musicEnabled) {
      playBgm();
    } else {
      pauseBgm();
    }
  }, [musicEnabled, playBgm, pauseBgm]);

  // Alternar Música
  const toggleMusic = () => {
    setMusicEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('atlas_desafio_music', String(next));
      } catch {}
      if (next) {
        setTimeout(() => playBgm(), 10);
      } else {
        pauseBgm();
      }
      return next;
    });
  };

  // Alternar Efectos FX
  const toggleSound = () => {
    getAudioContext();
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('atlas_desafio_sound', String(next));
      } catch {}
      return next;
    });
  };

  const triggerScreenShake = () => {
    setIsScreenShaking(true);
    setTimeout(() => setIsScreenShaking(false), 360);
  };

  // Pre-cargar imágenes en segundo plano para fluidez instantánea
  const preloadedUrls = useRef<Set<string>>(new Set());
  const preloadImage = useCallback((url: string) => {
    if (!url || preloadedUrls.current.has(url)) return;
    preloadedUrls.current.add(url);
    const img = new Image();
    img.src = getCloudinaryImageUrl(url);
  }, []);

  const preloadImageAsync = useCallback((url: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!url) return resolve();
      if (preloadedUrls.current.has(url)) return resolve();
      const img = new Image();
      img.onload = () => {
        preloadedUrls.current.add(url);
        resolve();
      };
      img.onerror = () => {
        resolve();
      };
      img.src = getCloudinaryImageUrl(url);
    });
  }, []);

  // 1. Cargar estado de mantenimiento y suscripción en tiempo real
  useEffect(() => {
    void fetchSiteMaintenanceStatus().then(setMaintenanceStatus);
    const unsubscribe = subscribeSiteMaintenanceStatus(setMaintenanceStatus);
    return () => unsubscribe();
  }, []);

  // 2. Cargar todas las placas del catálogo con sus relaciones
  useEffect(() => {
    let isMounted = true;
    const loadCatalog = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('placas')
          .select(`
            id,
            photo_url,
            aumento,
            tincion,
            comentario,
            subtema_id,
            subtemas!inner (
              id,
              nombre,
              tema_id,
              temas!inner (
                id,
                nombre,
                parcial
              )
            )
          `);

        if (!error && data && isMounted) {
          const formatted: PlacaGameItem[] = [];
          for (const row of data as any[]) {
            const subtema = Array.isArray(row.subtemas) ? row.subtemas[0] : row.subtemas;
            const tema = subtema ? (Array.isArray(subtema.temas) ? subtema.temas[0] : subtema.temas) : null;
            if (subtema && tema && row.photo_url && subtema.nombre) {
              formatted.push({
                id: Number(row.id),
                photo_url: String(row.photo_url),
                aumento: row.aumento ?? null,
                tincion: row.tincion ?? null,
                comentario: row.comentario ?? null,
                subtema_id: Number(subtema.id),
                subtema_nombre: String(subtema.nombre).trim(),
                tema_id: Number(tema.id),
                tema_nombre: String(tema.nombre).trim(),
                parcial: String(tema.parcial || 'primer').toLowerCase(),
              });
            }
          }

          setAllPlates(formatted);
          // Pre-calentar primeras 8 imágenes en segundo plano
          formatted.slice(0, 8).forEach((p) => preloadImage(p.photo_url));
        }
      } catch (err) {
        console.warn('Error al cargar placas para el desafío:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadCatalog();
    return () => {
      isMounted = false;
    };
  }, [preloadImage]);

  // Placas activas respetando el estado de mantenimiento y reglas específicas (exclusión de Introducción a la Microscopía en 1er parcial)
  const activeCatalogPlates = useMemo(() => {
    if (!allPlates) return [];

    const disabledFeatures = maintenanceStatus?.disabledFeatures || [];

    return allPlates.filter((plate) => {
      // Regla específica: Para el primer parcial, excluir el tema "Introducción a la Microscopía"
      if (plate.parcial === 'primer') {
        const normalizedTema = (plate.tema_nombre || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();
        if (
          normalizedTema.includes('microscopia') ||
          normalizedTema.includes('microscopio') ||
          normalizedTema.includes('introduccion a la microscopia')
        ) {
          return false;
        }
      }

      if (canBypass || !maintenanceStatus) return true;

      // Excluir si el parcial completo está deshabilitado
      if (isParcialDisabled(plate.parcial, disabledFeatures)) {
        return false;
      }
      // Excluir si el tema específico está deshabilitado
      if (isTemaDisabled(plate.tema_id, plate.parcial, disabledFeatures)) {
        return false;
      }
      return true;
    });
  }, [allPlates, canBypass, maintenanceStatus]);

  // Placas filtradas por parcial seleccionado (después de aplicar filtro de mantenimiento)
  const availablePlatesForParcial = useMemo(() => {
    if (selectedParcial === 'todos') return activeCatalogPlates;
    return activeCatalogPlates.filter((p) => p.parcial === selectedParcial);
  }, [activeCatalogPlates, selectedParcial]);

  // Total de preguntas de la partida (máximo 30)
  const totalQuestionsInGame = useMemo(() => {
    return Math.min(MAX_QUESTIONS_PER_MATCH, availablePlatesForParcial.length);
  }, [availablePlatesForParcial]);

  // Conteo de placas por parcial
  const countsByParcial = useMemo(() => {
    const counts: Record<ParcialKey, number> = {
      todos: activeCatalogPlates.length,
      primer: activeCatalogPlates.filter((p) => p.parcial === 'primer').length,
      segundo: activeCatalogPlates.filter((p) => p.parcial === 'segundo').length,
      tercer: activeCatalogPlates.filter((p) => p.parcial === 'tercer').length,
    };
    return counts;
  }, [activeCatalogPlates]);

  // Verificar si un parcial está deshabilitado por mantenimiento
  const checkParcialDisabled = useCallback(
    (key: ParcialKey): boolean => {
      if (canBypass || !maintenanceStatus) return false;
      const disabledFeatures = maintenanceStatus.disabledFeatures || [];
      if (key === 'todos') {
        // 'todos' solo está deshabilitado si todos los parciales individuales están deshabilitados
        return (
          isParcialDisabled('primer', disabledFeatures) &&
          isParcialDisabled('segundo', disabledFeatures) &&
          isParcialDisabled('tercer', disabledFeatures)
        );
      }
      return isParcialDisabled(key, disabledFeatures);
    },
    [canBypass, maintenanceStatus]
  );

  // Si el parcial seleccionado actualmente queda deshabilitado, cambiar automáticamente
  useEffect(() => {
    if (checkParcialDisabled(selectedParcial)) {
      const firstAvailable: ParcialKey | undefined = (['todos', 'primer', 'segundo', 'tercer'] as ParcialKey[]).find(
        (key) => !checkParcialDisabled(key)
      );
      if (firstAvailable) {
        setSelectedParcial(firstAvailable);
      }
    }
  }, [selectedParcial, checkParcialDisabled]);

  // Función para generar 4 opciones inteligentes
  const generateOptionsForPlate = useCallback(
    (currentPlate: PlacaGameItem, allPool: PlacaGameItem[]): GameOption[] => {
      const correctName = currentPlate.subtema_nombre;
      const distractors: string[] = [];

      // 1. Distractores del mismo tema
      const sameTemaPool = allPool.filter(
        (p) => p.tema_id === currentPlate.tema_id && p.subtema_nombre !== correctName
      );
      const uniqueSameTemaNames = Array.from(new Set(sameTemaPool.map((p) => p.subtema_nombre)));
      uniqueSameTemaNames.sort(() => Math.random() - 0.5);

      for (const name of uniqueSameTemaNames) {
        if (distractors.length < 3 && !distractors.includes(name)) {
          distractors.push(name);
        }
      }

      // 2. Si faltan, buscar en el mismo parcial
      if (distractors.length < 3) {
        const sameParcialPool = allPool.filter(
          (p) => p.parcial === currentPlate.parcial && p.subtema_nombre !== correctName && !distractors.includes(p.subtema_nombre)
        );
        const uniqueSameParcialNames = Array.from(new Set(sameParcialPool.map((p) => p.subtema_nombre)));
        uniqueSameParcialNames.sort(() => Math.random() - 0.5);

        for (const name of uniqueSameParcialNames) {
          if (distractors.length < 3 && !distractors.includes(name)) {
            distractors.push(name);
          }
        }
      }

      // 3. Si aún faltan, buscar en todo el catálogo activo
      if (distractors.length < 3) {
        const globalPool = activeCatalogPlates.filter(
          (p) => p.subtema_nombre !== correctName && !distractors.includes(p.subtema_nombre)
        );
        const uniqueGlobalNames = Array.from(new Set(globalPool.map((p) => p.subtema_nombre)));
        uniqueGlobalNames.sort(() => Math.random() - 0.5);

        for (const name of uniqueGlobalNames) {
          if (distractors.length < 3 && !distractors.includes(name)) {
            distractors.push(name);
          }
        }
      }

      // Combinar correcta + distractores y mezclar
      const rawOptions: GameOption[] = [
        { id: `opt-correct-${Date.now()}`, name: correctName, isCorrect: true },
        ...distractors.slice(0, 3).map((name, i) => ({
          id: `opt-dist-${i}-${Date.now()}`,
          name,
          isCorrect: false,
        })),
      ];

      rawOptions.sort(() => Math.random() - 0.5);
      return rawOptions;
    },
    [activeCatalogPlates]
  );

  // Iniciar partida con preparación previa y cuenta regresiva 5-4-3-2-1-¡YA! (máx 30 placas)
  const handleStartGame = async () => {
    if (availablePlatesForParcial.length === 0) return;

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 1. Mostrar estado de preparación de placas
    setGameState('preparing');

    // Generar 30 placas con distribución diversa (evitando aglomeraciones de un mismo subtema/tema)
    // Priorizar placas no vistas en esta sesión; cuando el catálogo se agota, reutilizar las menos recientes.
    const sessionHistory = getSessionPlateHistory();
    const seenInSession = new Set(sessionHistory);
    const unseenPlates = availablePlatesForParcial.filter((plate) => !seenInSession.has(plate.id));
    const matchSize = Math.min(MAX_QUESTIONS_PER_MATCH, availablePlatesForParcial.length);
    const candidatePlates = unseenPlates.length >= matchSize
      ? unseenPlates
      : [
          ...unseenPlates,
          ...sessionHistory
            .map((id) => availablePlatesForParcial.find((plate) => plate.id === id))
            .filter((plate): plate is PlacaGameItem => Boolean(plate)),
        ];
    const diversePlates = generateDiverseMatchPlates(candidatePlates, matchSize);

    setGamePlates(diversePlates);
    setCurrentIndex(0);
    setLives(MAX_LIVES);
    setUnidentifiedCount(0);
    unidentifiedCountRef.current = 0;
    setCurrentStreak(0);
    setMaxStreak(0);
    setScore(0);
    setCorrectAnswersCount(0);
    setTotalAttempted(0);
    setIsVictory(false);

    if (musicEnabled) {
      playBgm();
    }

    // 2. Pre-cargar de forma estricta las primeras imágenes antes de la cuenta regresiva
    const firstPlatesToLoad = diversePlates.slice(0, 3).map((p) => preloadImageAsync(p.photo_url));
    await Promise.race([
      Promise.all(firstPlatesToLoad),
      new Promise<void>((resolve) => setTimeout(resolve, 1000)),
    ]);

    // Pre-cargar en segundo plano las siguientes
    diversePlates.slice(3, 10).forEach((p) => preloadImage(p.photo_url));

    // 3. Con las imágenes ya cargadas, arrancar la cuenta regresiva 5..4..3..2..1..¡YA!
    setGameState('countdown');
    setCountdownVal(5);
    playAudioFx('countdown_tick', 5);

    let currentCount = 5;
    countdownIntervalRef.current = setInterval(() => {
      currentCount -= 1;
      if (currentCount > 0) {
        setCountdownVal(currentCount);
        playAudioFx('countdown_tick', currentCount);
      } else if (currentCount === 0) {
        setCountdownVal(0);
        playAudioFx('countdown_go');
      } else {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setGameState('playing');
        setupRound(0, diversePlates);
      }
    }, 1000);
  };

  // Configurar una nueva ronda
  const setupRound = (index: number, platesList: PlacaGameItem[]) => {
    if (index >= platesList.length) {
      finishGameWithVictory();
      return;
    }

    const currentPlate = platesList[index];
    // Solo cuenta como usada cuando realmente se muestra al jugador, no al preparar la partida.
    rememberSessionPlates(getSessionPlateHistory(), [currentPlate.id]);
    const generated = generateOptionsForPlate(currentPlate, availablePlatesForParcial);
    setOptions(generated);
    setSelectedIncorrectOptions(new Set());
    setRoundStatus('active');
    roundResolvedRef.current = false;
    setIsImageLoaded(false);
    setTimeLeft(TOTAL_ROUND_SECONDS);

    // Pre-cargar en segundo plano las siguientes 3 placas
    for (let i = index + 1; i <= index + 3 && i < platesList.length; i++) {
      preloadImage(platesList[i].photo_url);
    }

    // Limpiar timers previos
    if (timerRef.current) clearInterval(timerRef.current);
    if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
  };

  // Iniciar cronómetro de 15s cuando la imagen esté cargada y lista
  const startTimerOnImageReady = () => {
    setIsImageLoaded(true);

    if (timerRef.current) clearInterval(timerRef.current);
    const startTime = Date.now();
    const durationMs = TOTAL_ROUND_SECONDS * 1000;
    let lastTickSecond = Math.ceil(TOTAL_ROUND_SECONDS);

    timerRef.current = setInterval(() => {
      if (roundResolvedRef.current) {
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, (durationMs - elapsed) / 1000);
      setTimeLeft(remaining);

      // Reproducir tick en los últimos 3 segundos
      const currentIntSec = Math.ceil(remaining);
      if (remaining <= 3.2 && remaining > 0.1 && currentIntSec !== lastTickSecond) {
        lastTickSecond = currentIntSec;
        playAudioFx('tick');
      }

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        // Pequeño margen de gracia para registrar clics en el último milisegundo
        setTimeout(() => {
          if (!roundResolvedRef.current) {
            handleTimeOut();
          }
        }, 120);
      }
    }, 100);
  };

  // Manejar placa no identificada (por tiempo agotado o 3 fallos en la misma placa)
  // Regla: 2 oportunidades antes de Game Over
  const handlePlateNotIdentified = (_cause?: 'timeout' | 'three_mistakes') => {
    if (roundResolvedRef.current) return;
    roundResolvedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);

    playAudioFx('timeout');
    triggerScreenShake();
    setRoundStatus('timeout');
    setCurrentStreak(0);
    setTotalAttempted((prev) => prev + 1);

    const newUnidentifiedCount = unidentifiedCountRef.current + 1;
    unidentifiedCountRef.current = newUnidentifiedCount;
    setUnidentifiedCount(newUnidentifiedCount);

    if (newUnidentifiedCount >= 2) {
      // ❌ Segunda placa no identificada en la partida -> Game Over definitivo
      setLives((prevLives) => Math.max(0, prevLives - 1.0));
      setHealNotification('❌ 2ª Oportunidad agotada: No lograste identificar la placa.');
      if (healTimeoutRef.current) clearTimeout(healTimeoutRef.current);
      healTimeoutRef.current = setTimeout(() => setHealNotification(null), 2200);

      nextRoundTimeoutRef.current = setTimeout(() => {
        setIsVictory(false);
        setGameState('gameover');
      }, 1800);
    } else {
      // ⚠️ Primera placa no identificada -> Se gasta la 1ª oportunidad y pasa a la siguiente placa
      setLives((prevLives) => Math.max(0.5, prevLives - 1.0));
      setHealNotification('⚠️ ¡1ª Oportunidad usada! Placa no identificada. Te queda 1 oportunidad antes de Game Over.');
      if (healTimeoutRef.current) clearTimeout(healTimeoutRef.current);
      healTimeoutRef.current = setTimeout(() => setHealNotification(null), 2500);

      // Si era la última placa del desafío
      if (currentIndex + 1 >= gamePlates.length) {
        nextRoundTimeoutRef.current = setTimeout(() => {
          finishGameWithVictory();
        }, 1800);
      } else {
        nextRoundTimeoutRef.current = setTimeout(() => {
          goToNextRound();
        }, 1800);
      }
    }
  };

  // Manejar tiempo agotado (15s)
  const handleTimeOut = () => {
    handlePlateNotIdentified('timeout');
  };

  // Manejar selección de opción
  const handleSelectOption = (option: GameOption) => {
    // Si la ronda ya se resolvió (por acierto o timeout confirmado), ignorar
    if (roundResolvedRef.current || !isImageLoaded || selectedIncorrectOptions.has(option.name)) return;

    if (option.isCorrect) {
      // ✅ RESPUESTA CORRECTA
      roundResolvedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      setRoundStatus('correct');
      playAudioFx('correct');

      const newCorrectCount = correctAnswersCount + 1;
      setCorrectAnswersCount(newCorrectCount);
      setTotalAttempted((prev) => prev + 1);

      // Calcular racha
      const nextStreak = currentStreak + 1;
      setCurrentStreak(nextStreak);
      setMaxStreak((prev) => Math.max(prev, nextStreak));

      // Puntuación: Base + Velocidad + Racha
      const speedBonus = Math.round(timeLeft * 15);
      const streakBonus = nextStreak * 30;
      const pointsGained = 100 + speedBonus + streakBonus;
      setScore((prev) => prev + pointsGained);

      // Feedback flotante arcade
      const feedbackMsg = nextStreak >= 3 ? `+${pointsGained} pts 🔥 COMBO x${nextStreak}!` : `+${pointsGained} pts!`;
      setFloatingFeedback({ id: Date.now(), text: feedbackMsg });
      if (floatingTimeoutRef.current) clearTimeout(floatingTimeoutRef.current);
      floatingTimeoutRef.current = setTimeout(() => setFloatingFeedback(null), 800);

      // Curación: Racha de 3 o más recupera +0.5 corazón si le falta vida
      if (nextStreak >= 3 && lives < MAX_LIVES) {
        setLives((prevLives) => Math.min(MAX_LIVES, prevLives + 0.5));
        setIsHeartPopping(true);
        setTimeout(() => setIsHeartPopping(false), 500);
        playAudioFx('heal');

        setHealNotification('+0.5 ❤️ ¡Curación por Racha!');
        if (healTimeoutRef.current) clearTimeout(healTimeoutRef.current);
        healTimeoutRef.current = setTimeout(() => setHealNotification(null), 1800);
      }

      // Si era la última placa del desafío (30 preguntas)
      if (currentIndex + 1 >= gamePlates.length) {
        nextRoundTimeoutRef.current = setTimeout(() => {
          finishGameWithVictory();
        }, 850);
        return;
      }

      // Avanzar a la siguiente ronda
      nextRoundTimeoutRef.current = setTimeout(() => {
        goToNextRound();
      }, 850);
    } else {
      // ❌ RESPUESTA INCORRECTA
      const nextIncorrect = new Set(selectedIncorrectOptions).add(option.name);
      setSelectedIncorrectOptions(nextIncorrect);
      setCurrentStreak(0); // Pierde la racha
      playAudioFx('incorrect');
      triggerScreenShake();

      // Restar medio corazón (-0.5)
      setLives((prevLives) => {
        const newLives = Math.max(0, prevLives - 0.5);
        if (newLives <= 0) {
          roundResolvedRef.current = true;
          if (timerRef.current) clearInterval(timerRef.current);
          setRoundStatus('timeout');
          nextRoundTimeoutRef.current = setTimeout(() => {
            setIsVictory(false);
            setGameState('gameover');
          }, 1600);
          return newLives;
        }

        // Si ya seleccionó 3 respuestas incorrectas, solo queda la correcta -> Placa no identificada
        if (nextIncorrect.size >= 3) {
          handlePlateNotIdentified('three_mistakes');
        }

        return newLives;
      });
    }
  };

  // Pasar a la siguiente placa
  const goToNextRound = () => {
    const nextIdx = currentIndex + 1;
    setCurrentIndex(nextIdx);
    setupRound(nextIdx, gamePlates);
  };

  // Finalizar con Victoria (30 preguntas completadas)
  const finishGameWithVictory = () => {
    roundResolvedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    // Bonificación de vidas restantes
    const livesBonus = Math.round(lives * 150);
    setScore((prev) => prev + livesBonus + 500);
    setIsVictory(true);
    playAudioFx('victory');
    setGameState('gameover');
  };

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
      if (healTimeoutRef.current) clearTimeout(healTimeoutRef.current);
      if (floatingTimeoutRef.current) clearTimeout(floatingTimeoutRef.current);
      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause();
        bgmAudioRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          void audioContextRef.current.close();
        } catch {}
      }
    };
  }, []);

  const currentPlate = gamePlates[currentIndex];
  const arcadeRank = getArcadeRank(correctAnswersCount, gamePlates.length, lives);
  const timerState = timeLeft <= 3.5 ? 'critical' : timeLeft <= 6 ? 'warning' : 'safe';
  const timerStatusLabel = timerState === 'critical' ? '¡Últimos segundos!' : timerState === 'warning' ? 'Acelera' : 'En curso';
  const timerProgress = Math.max(0, Math.min(100, (timeLeft / TOTAL_ROUND_SECONDS) * 100));

  return (
    <div className={`desafio-container ${isScreenShaking ? 'desafio-shake' : ''}`}>
      <div className="desafio-bg-grid" />
      <div className="desafio-glow-orb-1" />
      <div className="desafio-glow-orb-2" />

      <div className="desafio-content-wrapper">
        {/* Barra superior de navegación y HUD */}
        <header className="desafio-top-bar">
          <button onClick={goBack} className="desafio-back-btn" title="Volver a Herramientas">
            <ArrowLeft size={18} />
            <span>Herramientas</span>
          </button>

          {gameState === 'playing' ? (
            <div className="desafio-hud">
              {/* Progreso Placa X / 30 */}
              <div className="desafio-progress-pill">
                <span>Placa</span>
                <strong>
                  {currentIndex + 1}/{gamePlates.length}
                </strong>
              </div>

              {/* Vidas / Corazones */}
              <div className="desafio-hearts-container" title={`Vidas restantes: ${lives} de ${MAX_LIVES}`}>
                {[0, 1, 2, 3].map((i) => {
                  let status: 'full' | 'half' | 'empty' = 'empty';
                  if (lives >= i + 1) {
                    status = 'full';
                  } else if (lives >= i + 0.5) {
                    status = 'half';
                  }
                  return <HeartIcon key={i} status={status} isPopping={isHeartPopping} />;
                })}
              </div>

              {/* Oportunidades de Placas (máximo 2 no identificadas) */}
              <div
                className={`desafio-chances-pill ${unidentifiedCount >= 1 ? 'warning' : ''}`}
                title="Oportunidades para placas no identificadas: A la 2ª placa no identificada se termina la partida"
              >
                <ShieldAlert size={14} />
                <span>Oportunidades:</span>
                <strong>{Math.max(0, 2 - unidentifiedCount)}/2</strong>
              </div>

              {/* Racha */}
              <div
                className={`desafio-streak-badge ${currentStreak >= 3 ? 'desafio-streak-active' : ''}`}
                title="Racha de aciertos consecutivos"
              >
                <span className="desafio-streak-flame">{currentStreak >= 3 ? '🔥' : '⚡'}</span>
                <span>{currentStreak}</span>
              </div>

              {/* Puntuación */}
              <div className="desafio-score-badge" title="Puntos acumulados">
                <Sparkles size={14} />
                <span>{score} pts</span>
              </div>

              {/* Controles de Audio: Música BGM y Efectos FX */}
              <div className="desafio-audio-controls">
                <button
                  type="button"
                  onClick={toggleMusic}
                  className={`desafio-sound-btn ${musicEnabled ? 'active' : 'muted'}`}
                  title={musicEnabled ? 'Desactivar música arcade' : 'Activar música arcade permanente'}
                >
                  <Music size={15} className={musicEnabled ? 'desafio-music-note-icon' : ''} />
                  <span>Música</span>
                </button>

                <button
                  type="button"
                  onClick={toggleSound}
                  className={`desafio-sound-btn ${soundEnabled ? '' : 'muted'}`}
                  title={soundEnabled ? 'Silenciar efectos FX' : 'Activar efectos FX'}
                >
                  {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              </div>
            </div>
          ) : (
            <div className="desafio-audio-controls">
              <button
                type="button"
                onClick={toggleMusic}
                className={`desafio-sound-btn ${musicEnabled ? 'active' : 'muted'}`}
                title={musicEnabled ? 'Desactivar música arcade' : 'Activar música arcade permanente'}
              >
                <Music size={15} className={musicEnabled ? 'desafio-music-note-icon' : ''} />
                <span>Música</span>
              </button>

              <button
                type="button"
                onClick={toggleSound}
                className={`desafio-sound-btn ${soundEnabled ? '' : 'muted'}`}
                title={soundEnabled ? 'Silenciar efectos FX' : 'Activar efectos FX'}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
            </div>
          )}
        </header>

        {/* PANTALLA 1: LOBBY / SELECTOR DE PARCIAL */}
        {gameState === 'lobby' && (
          <main className="desafio-lobby-card">
            <div className="desafio-lobby-hero-icon">
              <Zap size={36} />
            </div>
            <h1 className="desafio-lobby-title">Desafío de Identificación</h1>
            <p className="desafio-lobby-desc">
              Pon a prueba tus reflejos histológicos en un sprint de <strong>30 placas variadas</strong>. El tiempo de 15 segundos
              comienza cuando la placa está lista en pantalla. ¡Encadena rachas para curarte!
            </p>

            {/* Resumen de Reglas */}
            <div className="desafio-rules-row">
              <div className="desafio-rule-pill">
                <Trophy size={14} color="#0284c7" />
                <span>
                  <strong>Límite:</strong> 30 Placas
                </span>
              </div>
              <div className="desafio-rule-pill">
                <Heart size={14} color="#f43f5e" />
                <span>
                  <strong>4 Vidas:</strong> -0.5 ❤️ fallo
                </span>
              </div>
              <div className="desafio-rule-pill">
                <ShieldAlert size={14} color="#15803d" />
                <span>
                  <strong>2 Oportunidades:</strong> Tiempo agotado / 3 fallos
                </span>
              </div>
              <div className="desafio-rule-pill">
                <Timer size={14} color="#0284c7" />
                <span>
                  <strong>15s:</strong> por placa
                </span>
              </div>
              <div className="desafio-rule-pill">
                <Flame size={14} color="#f59e0b" />
                <span>
                  <strong>Racha x3:</strong> +0.5 ❤️ curación
                </span>
              </div>
            </div>

            {/* Grid Selector de Parciales */}
            <div className="desafio-parciales-grid">
              {PARCIALES_INFO.map((parcial) => {
                const count = countsByParcial[parcial.key];
                const isSelected = selectedParcial === parcial.key;
                const isDisabled = checkParcialDisabled(parcial.key);

                return (
                  <button
                    key={parcial.key}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (!isDisabled) setSelectedParcial(parcial.key);
                    }}
                    className={`desafio-parcial-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                  >
                    <div className="desafio-parcial-badge-row">
                      <span className="desafio-parcial-number">{parcial.num}</span>
                      {isDisabled ? (
                        <span className="desafio-parcial-disabled-tag">
                          <Lock size={11} />
                          <span>Desactivado</span>
                        </span>
                      ) : (
                        <span className="desafio-parcial-count">{count} placas</span>
                      )}
                    </div>
                    <div className="desafio-parcial-name">{parcial.name}</div>
                    <p className="desafio-parcial-desc">
                      {isDisabled ? 'Este parcial está temporalmente deshabilitado.' : parcial.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Botón de Inicio */}
            <button
              onClick={handleStartGame}
              disabled={loading || availablePlatesForParcial.length === 0}
              className="desafio-start-btn"
            >
              <Play size={20} fill="currentColor" />
              <span>
                {loading
                  ? 'Cargando placas...'
                  : availablePlatesForParcial.length === 0
                  ? 'Sin placas disponibles'
                  : `¡Comenzar Desafío (${totalQuestionsInGame} Placas)!`}
              </span>
            </button>
          </main>
        )}

        {/* PANTALLA DE PREPARACIÓN DE PLACAS */}
        {gameState === 'preparing' && (
          <main className="desafio-preparing-card">
            <div className="desafio-preparing-radar" />
            <h2 className="desafio-countdown-title">Preparando las Placas</h2>
            <p className="desafio-countdown-subtitle">
              Cargando imágenes en alta definición para garantizar máxima velocidad y cero esperas...
            </p>
          </main>
        )}

        {/* PANTALLA DE CUENTA REGRESIVA 5-4-3-2-1-¡YA! */}
        {gameState === 'countdown' && (
          <main className="desafio-countdown-container">
            <div className="desafio-countdown-card">
              <div className="desafio-countdown-ring" />
              <div className="desafio-countdown-number-box">
                <span
                  key={countdownVal}
                  className={`desafio-countdown-number ${countdownVal === 0 ? 'go' : ''}`}
                >
                  {countdownVal === 0 ? '¡YA!' : countdownVal}
                </span>
              </div>
              <h2 className="desafio-countdown-title">
                {countdownVal === 0 ? '¡Comienza la Prueba!' : '¡Prepárate!'}
              </h2>
              <p className="desafio-countdown-subtitle">
                {countdownVal === 0
                  ? '¡Identifica con rapidez y precisión!'
                  : 'Identifica la placa antes de que se agote el tiempo'}
              </p>
            </div>
          </main>
        )}

        {/* PANTALLA 2: JUEGO ACTIVO (ARCADE VIEW) */}
        {gameState === 'playing' && currentPlate && (
          <main className="desafio-game-layout">
            {/* Formas arcade giratorias en los bordes */}
            <div className="desafio-arcade-reticle desafio-arcade-reticle-left" />
            <div className="desafio-arcade-reticle desafio-arcade-reticle-right" />

            {/* Formas arcade palpitantes (latido rítmico brusco y elástico) */}
            <div className="desafio-arcade-pulse-cluster desafio-pulse-cluster-left desafio-pulse-cluster-footer" aria-hidden="true">
              <span className="arcade-shape-diamond diamond-snap-strong" />
              <span className="arcade-shape-ring ring-snap-main" />
              <span className="arcade-shape-star star-snap-fast">✦</span>
              <span className="arcade-shape-dot dot-snap-beat" />
            </div>
            <div className="desafio-arcade-pulse-cluster desafio-pulse-cluster-right desafio-pulse-cluster-footer" aria-hidden="true">
              <span className="arcade-shape-star star-snap-slow">✦</span>
              <span className="arcade-shape-ring ring-snap-delayed" />
              <span className="arcade-shape-diamond diamond-snap-soft" />
              <span className="arcade-shape-dot dot-snap-beat-alt" />
            </div>

            {/* Banner de Curación por Racha */}
            {healNotification && (
              <div className="desafio-heal-banner">
                <Sparkles size={16} />
                <span>{healNotification}</span>
              </div>
            )}

            {/* Feedback flotante arcade */}
            {floatingFeedback && (
              <div className="desafio-floating-points" key={floatingFeedback.id}>
                <Sparkles size={18} />
                <span>{floatingFeedback.text}</span>
              </div>
            )}

            {/* HUD de tiempo: la referencia visual principal durante la ronda */}
            <section className={`desafio-timer-container ${timerState}`} aria-label={`Tiempo restante: ${timeLeft.toFixed(1)} segundos`}>
              <span className="desafio-timer-corner desafio-timer-corner-tl" aria-hidden="true" />
              <span className="desafio-timer-corner desafio-timer-corner-br" aria-hidden="true" />
              <div className="desafio-timer-header">
                <div className="desafio-timer-label-wrap">
                  <span className="desafio-beat-pulse-badge" aria-hidden="true">
                    <span className="desafio-beat-pulse-indicator" />
                  </span>
                  <span>{isImageLoaded ? 'Tiempo restante' : 'Cargando placa...'}</span>
                </div>
                <span className="desafio-timer-status">{timerStatusLabel}</span>
              </div>
              <div className="desafio-timer-main">
                <span className="desafio-timer-icon" aria-hidden="true"><Timer size={24} strokeWidth={2.5} /></span>
                <div className="desafio-timer-readout" aria-live="off">
                  <span className="desafio-timer-seconds">{timeLeft.toFixed(1)}</span>
                  <span className="desafio-timer-unit">SEG</span>
                </div>
                <div className="desafio-timer-scanline" aria-hidden="true" />
              </div>
              <div
                className="desafio-timer-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={TOTAL_ROUND_SECONDS}
                aria-valuenow={Number(timeLeft.toFixed(1))}
                aria-label="Progreso del tiempo restante"
              >
                <div className="desafio-timer-ticks" aria-hidden="true" />
                <div
                  className="desafio-timer-fill"
                  style={{ width: `${timerProgress}%` }}
                />
              </div>
              <div className="desafio-timer-scale" aria-hidden="true"><span>15</span><span>10</span><span>5</span><span>0</span></div>
            </section>

            {/* Visor de Placa Histológica (Completamente despejado, sin superposiciones sobre la imagen) */}
            <div className="desafio-plate-box">
              {/* Spinner de carga si la imagen aún se está descargando */}
              {!isImageLoaded && (
                <div className="desafio-plate-loading-overlay">
                  <div className="desafio-plate-spinner" />
                  <span>Preparando placa histológica...</span>
                </div>
              )}

              <img
                src={getCloudinaryImageUrl(currentPlate.photo_url)}
                alt="Placa histológica a identificar"
                className="desafio-plate-img"
                style={{ opacity: isImageLoaded ? 1 : 0 }}
                onLoad={startTimerOnImageReady}
              />

              {/* Tags flotantes de metadatos y zoom */}
              {isImageLoaded && (
                <div className="desafio-plate-meta-overlay">
                  <div className="desafio-plate-tags">
                    {currentPlate.tincion && (
                      <span className="desafio-plate-tag" title="Tinción utilizada">
                        🧪 {currentPlate.tincion}
                      </span>
                    )}
                    {currentPlate.aumento && (
                      <span className="desafio-plate-tag" title="Aumento">
                        🔍 {currentPlate.aumento}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="desafio-plate-zoom-btn"
                    title="Ver imagen en grande"
                  >
                    <Maximize2 size={16} />
                  </button>
                </div>
              )}

              {/* Banner de Tiempo Agotado */}
              {roundStatus === 'timeout' && (
                <div className="desafio-timeout-banner">
                  <Timer size={16} />
                  <span>¡Placa no identificada!</span>
                </div>
              )}
            </div>

            {/* Grid de 4 Opciones de Respuesta */}
            <div className="desafio-options-grid">
              {!isImageLoaded ? (
                /* Skeletons limpios mientras carga la placa: NO se muestran nombres para no romper la estética */
                <>
                  {[0, 1, 2, 3].map((skeletonIdx) => (
                    <div key={`skel-${skeletonIdx}`} className="desafio-option-card desafio-option-skeleton">
                      <span className="desafio-option-letter skeleton-letter">
                        <span className="skeleton-pulse-dot" />
                      </span>
                      <div className="desafio-skeleton-text-bar" />
                    </div>
                  ))}
                </>
              ) : (
                /* Opciones reales reveladas una vez que la placa está cargada y lista */
                options.map((option, idx) => {
                  const letter = String.fromCharCode(65 + idx); // A, B, C, D
                  const isIncorrectSelected = selectedIncorrectOptions.has(option.name);
                  const showAsCorrect = (roundStatus === 'correct' || roundStatus === 'timeout') && option.isCorrect;

                  let cardClass = 'desafio-option-card';
                  if (showAsCorrect) cardClass += ' correct';
                  else if (isIncorrectSelected) cardClass += ' incorrect';

                  return (
                    <button
                      key={option.id}
                      type="button"
                      style={{ animationDelay: `${idx * 0.04}s` }}
                      onClick={() => handleSelectOption(option)}
                      disabled={roundStatus !== 'active' || isIncorrectSelected}
                      className={cardClass}
                    >
                      <span className="desafio-option-letter">
                        {showAsCorrect ? <Check size={16} /> : isIncorrectSelected ? <X size={16} /> : letter}
                      </span>
                      <span className="desafio-option-text">{option.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </main>
        )}

        {/* PANTALLA 3: GAME OVER / VICTORIA (30 PREGUNTAS) */}
        {gameState === 'gameover' && (() => {
          const reachedQuestions = Math.min(gamePlates.length, Math.max(currentIndex + 1, totalAttempted));
          return (
            <main className="desafio-results-card">
              <div className="desafio-results-badge">{isVictory ? '🏆' : correctAnswersCount >= 15 ? '🎖️' : '🔬'}</div>
              <h2 className="desafio-results-title">
                {isVictory ? '¡Felicitaciones, Desafío Completado!' : '¡Fin de la Partida!'}
              </h2>

              {/* Rango Arcade obtenido */}
              <div className="desafio-rank-container">
                <div className={`desafio-rank-stamp ${arcadeRank.className}`}>{arcadeRank.rank}</div>
                <span className="desafio-rank-label">{arcadeRank.label}</span>
              </div>

              <p className="desafio-results-subtitle">
                {isVictory
                  ? `¡Excelente dominio! Has completado con éxito el bloque de ${gamePlates.length} placas con ${lives.toFixed(1)} vidas intactas.`
                  : `Llegaste hasta la placa ${reachedQuestions} de ${gamePlates.length}, acertando ${correctAnswersCount} ${correctAnswersCount === 1 ? 'placa' : 'placas'}. ¡Sigue practicando para superar las ${gamePlates.length}!`}
              </p>

              {/* Estadísticas de la partida */}
              <div className="desafio-stats-grid">
                <div className="desafio-stat-box">
                  <span className="desafio-stat-value">{score}</span>
                  <span className="desafio-stat-label">Puntos Totales</span>
                </div>
                <div className="desafio-stat-box">
                  <span className="desafio-stat-value">
                    {correctAnswersCount}/{isVictory ? gamePlates.length : reachedQuestions}
                  </span>
                  <span className="desafio-stat-label">Placas Acertadas</span>
                </div>
                <div className="desafio-stat-box">
                  <span className="desafio-stat-value">
                    {reachedQuestions}/{gamePlates.length}
                  </span>
                  <span className="desafio-stat-label">Placas Alcanzadas</span>
                </div>
                <div className="desafio-stat-box">
                  <span className="desafio-stat-value">{maxStreak}</span>
                  <span className="desafio-stat-label">Racha Máxima 🔥</span>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="desafio-results-actions">
                <button onClick={handleStartGame} className="desafio-btn-primary">
                  <RotateCcw size={18} />
                  <span>Jugar de Nuevo</span>
                </button>
                <button onClick={() => setGameState('lobby')} className="desafio-btn-secondary">
                  <span>Cambiar Parcial</span>
                </button>
                <button onClick={goBack} className="desafio-btn-secondary">
                  <span>Volver a Herramientas</span>
                </button>
              </div>
            </main>
          );
        })()}
      </div>

      {/* MODAL LIGHTBOX PARA ZOOM DE PLACA */}
      {lightboxOpen && currentPlate && (
        <div className="desafio-lightbox-backdrop" onClick={() => setLightboxOpen(false)}>
          <div className="desafio-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={getCloudinaryImageUrl(currentPlate.photo_url)}
              alt="Placa histológica ampliada"
              className="desafio-lightbox-img"
            />
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="desafio-lightbox-close"
              title="Cerrar vista previa"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesafioIdentificacion;
