import React from 'react';
import {
  Microscope,
  FlaskConical,
  TestTube,
  ShieldCheck,
  ArrowRightLeft,
  Filter,
  Sparkles,
  Droplets,
  Layers,
  Wind,
  Waves,
  Zap,
  Activity,
  Scan,
  Palette,
  Pipette,
  MapPin,
  BadgeCheck,
  Star,
  Info,
  Download,
} from 'lucide-react';
import {
  FaLungs,
  FaBrain,
  FaBone,
  FaDna,
  FaBacteria,
  FaVirus,
  FaSyringe,
  FaCapsules,
  FaStethoscope,
  FaHeartPulse,
  FaHospital,
  FaEye,
  FaEarListen,
  FaTooth,
  FaTemperatureHalf,
} from 'react-icons/fa6';
import {
  GiKidneys,
  GiStomach,
  GiLiver,
  GiHeartOrgan,
  GiMuscleUp,
  GiSpineArrow,
  GiBlood,
  GiChemicalDrop,
  GiFunnel,
  GiMolecule,
} from 'react-icons/gi';

export interface MedicalIconDefinition {
  id: string;
  name: string;
  category: 'anatomy' | 'physiology' | 'lab' | 'clinical';
  keywords: string[];
  render: (props: { size?: number; className?: string; style?: React.CSSProperties; color?: string }) => React.ReactElement;
}

export const MEDICAL_ICONS_CATALOG: MedicalIconDefinition[] = [
  // ── Órganos & Anatomía ─────────────────────────────────────────────
  {
    id: 'kidneys',
    name: 'Riñón / Renal',
    category: 'anatomy',
    keywords: ['riñon', 'riñones', 'renal', 'nefrona', 'bowman', 'tubulo', 'kidney', 'kidneys'],
    render: props => <GiKidneys size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'lungs',
    name: 'Pulmón / Respiratorio',
    category: 'anatomy',
    keywords: ['pulmon', 'pulmones', 'respiratorio', 'alveolo', 'bronquio', 'aire', 'lung', 'lungs'],
    render: props => <FaLungs size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'heart_organ',
    name: 'Corazón (Órgano)',
    category: 'anatomy',
    keywords: ['corazon', 'cardiaco', 'miocardio', 'endocardio', 'vasos', 'heart', 'organ'],
    render: props => <GiHeartOrgan size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'stomach',
    name: 'Estómago / Digestivo',
    category: 'anatomy',
    keywords: ['estomago', 'gastrico', 'digestivo', 'mucosa', 'acida', 'stomach'],
    render: props => <GiStomach size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'liver',
    name: 'Hígado / Hepático',
    category: 'anatomy',
    keywords: ['higado', 'hepatico', 'hepatocito', 'biliar', 'sinusoide', 'liver'],
    render: props => <GiLiver size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'brain',
    name: 'Cerebro / Nervioso',
    category: 'anatomy',
    keywords: ['cerebro', 'neurona', 'nervioso', 'encefalo', 'corteza', 'sinapsis', 'brain'],
    render: props => <FaBrain size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'bone',
    name: 'Hueso / Óseo',
    category: 'anatomy',
    keywords: ['hueso', 'oseo', 'osteocito', 'esqueleto', 'cartilago', 'havers', 'bone'],
    render: props => <FaBone size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'muscle',
    name: 'Músculo / Miocito',
    category: 'anatomy',
    keywords: ['musculo', 'muscular', 'miocito', 'fibra', 'sarcomero', 'estriado', 'liso', 'muscle'],
    render: props => <GiMuscleUp size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'eye',
    name: 'Ojo / Ocular',
    category: 'anatomy',
    keywords: ['ojo', 'retina', 'cornea', 'vision', 'ocular', 'cristalino', 'eye', 'eyeball'],
    render: props => <FaEye size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'ear',
    name: 'Oído / Auditivo',
    category: 'anatomy',
    keywords: ['oido', 'auditivo', 'coclea', 'timpano', 'oreja', 'ear'],
    render: props => <FaEarListen size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'tooth',
    name: 'Diente / Dental',
    category: 'anatomy',
    keywords: ['diente', 'dental', 'esmalte', 'dentina', 'pulpa', 'odontoblasto', 'tooth'],
    render: props => <FaTooth size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'spine',
    name: 'Columna / Médula',
    category: 'anatomy',
    keywords: ['columna', 'medula', 'vertebra', 'espinal', 'eje', 'spine'],
    render: props => <GiSpineArrow size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'cell',
    name: 'Célula / Molécula',
    category: 'anatomy',
    keywords: ['celula', 'celular', 'membrana', 'nucleo', 'citoplasma', 'organelo', 'cell', 'molecula'],
    render: props => <GiMolecule size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'blood',
    name: 'Sangre / Eritrocitos',
    category: 'anatomy',
    keywords: ['sangre', 'eritrocito', 'hematologia', 'leucocito', 'suero', 'vaso', 'blood'],
    render: props => <GiBlood size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ── Fisiología & Procesos ──────────────────────────────────────────
  {
    id: 'exchange',
    name: 'Intercambio / Difusión',
    category: 'physiology',
    keywords: ['intercambio', 'difusion', 'paso', 'gases', 'permeabilidad', 'transporte', 'exchange', 'transfer'],
    render: props => <ArrowRightLeft size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'filter',
    name: 'Filtración',
    category: 'physiology',
    keywords: ['filtracion', 'filtro', 'filtrado', 'glomerulo', 'tamiz', 'selectivo', 'filter'],
    render: props => <Filter size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'funnel',
    name: 'Embudo / Conducción',
    category: 'physiology',
    keywords: ['embudo', 'conduccion', 'flujo', 'paso', 'funnel'],
    render: props => <GiFunnel size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'shield',
    name: 'Barrera / Protección',
    category: 'physiology',
    keywords: ['barrera', 'proteccion', 'escudo', 'resistencia', 'estratificado', 'shield'],
    render: props => <ShieldCheck size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'droplets',
    name: 'Secreción / Líquidos',
    category: 'physiology',
    keywords: ['secrecion', 'liquido', 'seroso', 'mucoso', 'lagrimas', 'saliva', 'glandula', 'droplets'],
    render: props => <Droplets size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'absorption',
    name: 'Absorción',
    category: 'physiology',
    keywords: ['absorcion', 'microvellosidad', 'captacion', 'nutrientes', 'entrada', 'absorption', 'download'],
    render: props => <Download size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'zap',
    name: 'Impulso / Excitabilidad',
    category: 'physiology',
    keywords: ['impulso', 'excitabilidad', 'electrico', 'potencial', 'accion', 'nervio', 'zap', 'energy'],
    render: props => <Zap size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'activity',
    name: 'Actividad Fisiológica',
    category: 'physiology',
    keywords: ['actividad', 'ritmo', 'fisiologia', 'pulso', 'registro', 'activity'],
    render: props => <Activity size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'layers',
    name: 'Estratificación / Capas',
    category: 'physiology',
    keywords: ['estrato', 'capas', 'laminas', 'basal', 'membrana', 'estratificado', 'layers'],
    render: props => <Layers size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'cilia',
    name: 'Cilios / Movimiento',
    category: 'physiology',
    keywords: ['cilios', 'movimiento', 'viento', 'barrido', 'flujo', 'mucociliar', 'wind'],
    render: props => <Wind size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'waves',
    name: 'Ondas / Peristalsis',
    category: 'physiology',
    keywords: ['ondas', 'peristalsis', 'contraccion', 'ondulante', 'fluido', 'waves'],
    render: props => <Waves size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'sparkles',
    name: 'Especialización / Destacado',
    category: 'physiology',
    keywords: ['especializacion', 'destacado', 'brillo', 'estrella', 'sparkles'],
    render: props => <Sparkles size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ── Laboratorio & Microscopía ──────────────────────────────────────
  {
    id: 'microscope',
    name: 'Microscopio',
    category: 'lab',
    keywords: ['microscopio', 'optico', 'campo claro', 'lupa', 'aumento', 'objetivo', 'microscope'],
    render: props => <Microscope size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'flask',
    name: 'Matraz / Reactivo',
    category: 'lab',
    keywords: ['matraz', 'reactivo', 'solucion', 'quimica', 'tincion', 'preparacion', 'flask'],
    render: props => <FlaskConical size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'test_tube',
    name: 'Tubo de Ensayo',
    category: 'lab',
    keywords: ['tubo', 'ensayo', 'muestra', 'analisis', 'laboratorio', 'vial', 'test tube'],
    render: props => <TestTube size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'chemical_drop',
    name: 'Gota de Colorante / Tinción',
    category: 'lab',
    keywords: ['colorante', 'tincion', 'gota', 'pigmento', 'eosina', 'hematoxilina', 'drop'],
    render: props => <GiChemicalDrop size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'dna',
    name: 'ADN / Cromatina',
    category: 'lab',
    keywords: ['adn', 'cromatina', 'genetica', 'nucleo', 'acido nucleico', 'dna'],
    render: props => <FaDna size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'bacteria',
    name: 'Bacteria / Microorganismo',
    category: 'lab',
    keywords: ['bacteria', 'coco', 'bacilo', 'microbio', 'tincion gram', 'bacteria'],
    render: props => <FaBacteria size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'virus',
    name: 'Virus / Patógeno',
    category: 'lab',
    keywords: ['virus', 'capside', 'infeccion', 'patogeno', 'virus'],
    render: props => <FaVirus size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'palette',
    name: 'Paleta Colorimétrica',
    category: 'lab',
    keywords: ['paleta', 'color', 'tincion', 'colorimetria', 'tricromico', 'palette'],
    render: props => <Palette size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'pipette',
    name: 'Pipeta / Dispensador',
    category: 'lab',
    keywords: ['pipeta', 'dispensador', 'gota', 'alicuota', 'pipette'],
    render: props => <Pipette size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'scan',
    name: 'Corte / Preparación Histológica',
    category: 'lab',
    keywords: ['corte', 'placa', 'laminilla', 'enfoque', 'scan', 'preparacion'],
    render: props => <Scan size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ── Clínica & Símbolos ─────────────────────────────────────────────
  {
    id: 'stethoscope',
    name: 'Estetoscopio',
    category: 'clinical',
    keywords: ['estetoscopio', 'medico', 'clinica', 'auscultacion', 'doctor', 'stethoscope'],
    render: props => <FaStethoscope size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'syringe',
    name: 'Jeringa',
    category: 'clinical',
    keywords: ['jeringa', 'inyeccion', 'puncion', 'biopsia', 'syringe'],
    render: props => <FaSyringe size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'pill',
    name: 'Fármaco / Píldora',
    category: 'clinical',
    keywords: ['farmaco', 'medicamento', 'pastilla', 'capsula', 'terapia', 'pill'],
    render: props => <FaCapsules size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'thermometer',
    name: 'Termómetro / Temperatura',
    category: 'clinical',
    keywords: ['temperatura', 'termometro', 'fiebre', 'calor', 'thermometer'],
    render: props => <FaTemperatureHalf size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'heart_pulse',
    name: 'Pulso Cardíaco',
    category: 'clinical',
    keywords: ['pulso', 'cardiaco', 'electro', 'ecg', 'latido', 'heart pulse'],
    render: props => <FaHeartPulse size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'hospital',
    name: 'Hospital / Centro Médico',
    category: 'clinical',
    keywords: ['hospital', 'clinica', 'centro', 'sanatorio', 'salud', 'hospital'],
    render: props => <FaHospital size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'map_pin',
    name: 'Ubicación / Pin Anatómico',
    category: 'clinical',
    keywords: ['pin', 'ubicacion', 'sitio', 'localizacion', 'anatomia', 'map pin'],
    render: props => <MapPin size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'badge_check',
    name: 'Criterio Verificado / Check',
    category: 'clinical',
    keywords: ['check', 'verificado', 'correcto', 'diagnostico', 'aprobado', 'badge'],
    render: props => <BadgeCheck size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'star',
    name: 'Tip de Examen / Importante',
    category: 'clinical',
    keywords: ['estrella', 'examen', 'importante', 'clave', 'enarm', 'evaluacion', 'star'],
    render: props => <Star size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'info',
    name: 'Información / Nota',
    category: 'clinical',
    keywords: ['info', 'informacion', 'nota', 'aclaracion', 'detalle'],
    render: props => <Info size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
];

// Mapa para búsqueda O(1) por id
const ICONS_BY_ID = new Map<string, MedicalIconDefinition>(
  MEDICAL_ICONS_CATALOG.map(icon => [icon.id, icon])
);

interface MedicalIconProps {
  name?: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

/**
 * Componente universal que renderiza cualquier ícono médico por ID
 */
export const MedicalIcon: React.FC<MedicalIconProps> = ({
  name,
  size = 18,
  color,
  className,
  style,
  fallback,
}) => {
  if (!name) {
    return fallback ? <>{fallback}</> : <Sparkles size={size} color={color} className={className} style={style} />;
  }

  const cleanName = name.toLowerCase().trim();
  const icon = ICONS_BY_ID.get(cleanName);

  if (icon) {
    return icon.render({ size, color, className, style });
  }

  // Alias comunes de compatibilidad
  if (cleanName.includes('kidney') || cleanName.includes('riñon')) return <GiKidneys size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('lung') || cleanName.includes('pulmon')) return <FaLungs size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('heart') || cleanName.includes('corazon')) return <GiHeartOrgan size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('stomach') || cleanName.includes('estomago')) return <GiStomach size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('liver') || cleanName.includes('higado')) return <GiLiver size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('brain') || cleanName.includes('cerebro')) return <FaBrain size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('bone') || cleanName.includes('hueso')) return <FaBone size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('muscle') || cleanName.includes('musculo')) return <GiMuscleUp size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('filter') || cleanName.includes('filtro')) return <Filter size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('droplet') || cleanName.includes('gota') || cleanName.includes('secrecion')) return <Droplets size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('shield') || cleanName.includes('barrera') || cleanName.includes('proteccion')) return <ShieldCheck size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('zap') || cleanName.includes('rayo') || cleanName.includes('impulso')) return <Zap size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('microscope') || cleanName.includes('microscopio')) return <Microscope size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('flask') || cleanName.includes('matraz')) return <FlaskConical size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('pin') || cleanName.includes('ubicacion')) return <MapPin size={size} color={color} className={className} style={style} />;
  if (cleanName.includes('arrow') || cleanName.includes('intercambio')) return <ArrowRightLeft size={size} color={color} className={className} style={style} />;

  return fallback ? <>{fallback}</> : <Sparkles size={size} color={color} className={className} style={style} />;
};

export default MedicalIcon;
