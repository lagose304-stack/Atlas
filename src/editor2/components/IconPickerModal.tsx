import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Atom,
  Award,
  Bone,
  BookOpen,
  Bookmark,
  Brain,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Compass,
  Dna,
  Droplet,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  Flame,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Image as ImageIcon,
  Info,
  Layers,
  LayoutGrid,
  Lightbulb,
  Link2,
  MapPin,
  Microscope,
  Pin,
  Pipette,
  Play,
  ScanEye,
  Search,
  ShieldPlus,
  Sparkles,
  Star,
  Stethoscope,
  Syringe,
  Target,
  TestTube2,
  Trophy,
  X,
  XCircle,
  Zap,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react';

export type AtlasIconCategory = 'histologia' | 'educacion' | 'avisos' | 'acciones';

export type AtlasIconEntry = {
  id: string;
  label: string;
  category: AtlasIconCategory;
  keywords: string;
  Icon: LucideIcon;
};

export const ATLAS_ICONS: readonly AtlasIconEntry[] = [
  // Histología y Laboratorio
  { id: 'microscope', label: 'Microscopio', category: 'histologia', keywords: 'microscopio placa lente histologia laboratorio', Icon: Microscope },
  { id: 'dna', label: 'ADN / Genética', category: 'histologia', keywords: 'adn celula nucleo genetica cromatina', Icon: Dna },
  { id: 'flask-conical', label: 'Matraz / Tinción', category: 'histologia', keywords: 'tincion reactivo laboratorio quimica he pas', Icon: FlaskConical },
  { id: 'test-tube', label: 'Tubo de ensayo', category: 'histologia', keywords: 'muestra tubo laboratorio analisis', Icon: TestTube2 },
  { id: 'pipette', label: 'Pipeta / Colorante', category: 'histologia', keywords: 'pipeta gotero tincion colorante colorimetria', Icon: Pipette },
  { id: 'droplet', label: 'Gota / Tinción', category: 'histologia', keywords: 'gota tinta color tincion liquido sangre', Icon: Droplet },
  { id: 'stethoscope', label: 'Correlación clínica', category: 'histologia', keywords: 'clinica medicina doctor estetoscopio patologia', Icon: Stethoscope },
  { id: 'heart-pulse', label: 'Cardiovascular', category: 'histologia', keywords: 'corazon pulso sangre arteria vena musculo', Icon: HeartPulse },
  { id: 'brain', label: 'Tejido nervioso', category: 'histologia', keywords: 'cerebro neurona nervioso sistema', Icon: Brain },
  { id: 'bone', label: 'Tejido óseo', category: 'histologia', keywords: 'hueso oseo cartilago esqueleto', Icon: Bone },
  { id: 'eye', label: 'Ojo / Observación', category: 'histologia', keywords: 'ojo vision retina observar enfoque', Icon: Eye },
  { id: 'scan-eye', label: 'Enfoque / Detalle', category: 'histologia', keywords: 'enfoque aumento detalle microscopio lupa', Icon: ScanEye },
  { id: 'activity', label: 'Función fisiológica', category: 'histologia', keywords: 'funcion fisiologia pulso señal', Icon: Activity },
  { id: 'shield-plus', label: 'Inmunidad / Defensa', category: 'histologia', keywords: 'defensa inmune linfoide proteccion', Icon: ShieldPlus },
  { id: 'syringe', label: 'Aplicación biomédica', category: 'histologia', keywords: 'biomedica inyeccion clinica', Icon: Syringe },
  { id: 'atom', label: 'Molécula / Matriz', category: 'histologia', keywords: 'atomo molecula celula matriz', Icon: Atom },
  // Educación y Estudio
  { id: 'book-open', label: 'Libro / Temario', category: 'educacion', keywords: 'libro temario lectura guia estudio', Icon: BookOpen },
  { id: 'graduation-cap', label: 'Académico / Examen', category: 'educacion', keywords: 'examen parcial curso universidad grado', Icon: GraduationCap },
  { id: 'clipboard-list', label: 'Criterios / Lista', category: 'educacion', keywords: 'criterios checklist evaluacion prueba', Icon: ClipboardList },
  { id: 'file-text', label: 'Ficha / Documento', category: 'educacion', keywords: 'ficha resumen apunte texto', Icon: FileText },
  { id: 'bookmark', label: 'Marcador', category: 'educacion', keywords: 'guardar favorito marcador tema', Icon: Bookmark },
  { id: 'lightbulb', label: 'Dato clave / Pista', category: 'educacion', keywords: 'idea pista consejo tip clave', Icon: Lightbulb },
  { id: 'target', label: 'Objetivo', category: 'educacion', keywords: 'objetivo meta enfoque clave', Icon: Target },
  { id: 'award', label: 'Destacado', category: 'educacion', keywords: 'premio medalla logro destacado', Icon: Award },
  { id: 'trophy', label: 'Desafío / Reto', category: 'educacion', keywords: 'trofeo reto prueba competencia', Icon: Trophy },
  { id: 'calendar', label: 'Semana / Fecha', category: 'educacion', keywords: 'calendario fecha semana parcial horario', Icon: Calendar },
  { id: 'clock', label: 'Tiempo / Duración', category: 'educacion', keywords: 'reloj tiempo duracion temporizador', Icon: Clock },
  { id: 'layers', label: 'Capas / Estratos', category: 'educacion', keywords: 'capas epitelio estratos niveles', Icon: Layers },
  // Avisos y Estado
  { id: 'info', label: 'Información', category: 'avisos', keywords: 'info nota detalle aviso', Icon: Info },
  { id: 'alert-triangle', label: 'Advertencia', category: 'avisos', keywords: 'alerta cuidado advertencia importante', Icon: AlertTriangle },
  { id: 'check-circle', label: 'Verificado / Correcto', category: 'avisos', keywords: 'check correcto si valido criterio', Icon: CheckCircle2 },
  { id: 'x-circle', label: 'Diferencial / Descartar', category: 'avisos', keywords: 'error no descartar falso', Icon: XCircle },
  { id: 'sparkles', label: 'Nuevo / Especial', category: 'avisos', keywords: 'nuevo destacado brillo especial', Icon: Sparkles },
  { id: 'star', label: 'Estrella', category: 'avisos', keywords: 'estrella favorito relevante', Icon: Star },
  { id: 'flame', label: 'Alta frecuencia', category: 'avisos', keywords: 'fuego frecuente examen importante', Icon: Flame },
  { id: 'zap', label: 'Rápido / Repaso', category: 'avisos', keywords: 'rayo rapido repaso flash', Icon: Zap },
  { id: 'flag', label: 'Hito / Parcial', category: 'avisos', keywords: 'bandera hito parcial meta', Icon: Flag },
  { id: 'pin', label: 'Fijado / Ubicación', category: 'avisos', keywords: 'pin fijar ubicacion nota', Icon: Pin },
  // Navegación y Acciones
  { id: 'arrow-right', label: 'Flecha / Ir', category: 'acciones', keywords: 'flecha ir siguiente explorar', Icon: ArrowRight },
  { id: 'external-link', label: 'Enlace externo', category: 'acciones', keywords: 'enlace abrir ventana externa', Icon: ExternalLink },
  { id: 'search', label: 'Buscar / Lupa', category: 'acciones', keywords: 'buscar lupa explorar identificar', Icon: Search },
  { id: 'zoom-in', label: 'Aumento / Zoom', category: 'acciones', keywords: 'zoom ampliar lente aumento', Icon: ZoomIn },
  { id: 'compass', label: 'Explorar', category: 'acciones', keywords: 'brujula explorar guia ruta', Icon: Compass },
  { id: 'map-pin', label: 'Ubicación anatómica', category: 'acciones', keywords: 'mapa ubicacion organo anatomia', Icon: MapPin },
  { id: 'link', label: 'Vínculo', category: 'acciones', keywords: 'link enlace conexion', Icon: Link2 },
  { id: 'play', label: 'Reproducir / Video', category: 'acciones', keywords: 'play video animacion iniciar', Icon: Play },
  { id: 'image', label: 'Imagen / Placa', category: 'acciones', keywords: 'imagen foto placa galeria', Icon: ImageIcon },
  { id: 'grid', label: 'Cuadrícula / Catálogo', category: 'acciones', keywords: 'grid catalogo mosaico placas', Icon: LayoutGrid },
];

const ICON_BY_ID = new Map<string, AtlasIconEntry>(ATLAS_ICONS.map((entry) => [entry.id, entry]));

const CATEGORY_LABELS: Record<AtlasIconCategory | 'all', string> = {
  all: 'Todos',
  histologia: 'Histología',
  educacion: 'Educación',
  avisos: 'Avisos',
  acciones: 'Acciones',
};

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function renderAtlasIcon(
  name: string | undefined,
  size = 20,
  className?: string,
): React.ReactNode {
  if (!name) return null;
  const entry = ICON_BY_ID.get(name);
  if (!entry) return null;
  const IconComp = entry.Icon;
  return <IconComp size={size} className={className} aria-hidden="true" />;
}

export type IconPickerModalProps = {
  open: boolean;
  value?: string;
  allowClear?: boolean;
  onSelect: (iconId: string | undefined) => void;
  onClose: () => void;
};

const IconPickerModal: React.FC<IconPickerModalProps> = ({
  open,
  value,
  allowClear = false,
  onSelect,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AtlasIconCategory | 'all'>('all');

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    return ATLAS_ICONS.filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false;
      if (!q) return true;
      return (
        normalizeSearch(entry.label).includes(q) ||
        normalizeSearch(entry.keywords).includes(q) ||
        entry.id.includes(q)
      );
    });
  }, [category, query]);

  if (!open) return null;

  return (
    <div
      className="e2-drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Selector de iconos de Atlas"
      onClick={onClose}
    >
      <div className="e2-icon-modal" onClick={(e) => e.stopPropagation()}>
        <header className="e2-version-drawer__head">
          <div className="e2-version-drawer__title">
            <Microscope size={16} aria-hidden="true" />
            <h2>Elegir icono</h2>
          </div>
          <button type="button" className="e2-icon-button" aria-label="Cerrar selector" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="e2-icon-modal__controls">
          <input
            type="search"
            aria-label="Buscar icono"
            placeholder="Buscar (ej. microscopio, tinción, corazón, pista…)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="e2-angle-chips" role="group" aria-label="Categorías de iconos">
            {(['all', 'histologia', 'educacion', 'avisos', 'acciones'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                className={`e2-chip-btn${category === cat ? ' is-active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
            {allowClear && value && (
              <button
                type="button"
                className="e2-chip-btn"
                onClick={() => {
                  onSelect(undefined);
                  onClose();
                }}
              >
                Sin icono
              </button>
            )}
          </div>
        </div>

        <div className="e2-icon-grid">
          {filtered.map((entry) => {
            const IconComp = entry.Icon;
            const active = value === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                className={`e2-icon-cell${active ? ' is-active' : ''}`}
                aria-pressed={active}
                title={entry.label}
                onClick={() => {
                  onSelect(entry.id);
                  onClose();
                }}
              >
                <IconComp size={20} aria-hidden="true" />
                <span>{entry.label}</span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="e2-version-drawer__empty">No se encontraron iconos para «{query}».</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default IconPickerModal;
