import React from 'react';
import {
  Microscope,
  FlaskConical,
  ShieldCheck,
  ShieldAlert,
  Shield,
  ArrowRightLeft,
  Filter,
  Sparkles,
  Droplets,
  Droplet,
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
  Download,
  Sun,
  Target,
  Crosshair,
  Grid,
  Network,
  Cpu,
  Fingerprint,
  Lightbulb,
  Search,
  Share2,
  Atom,
  Heart,
  Eye,
  BicepsFlexed,
} from 'lucide-react';
import {
  FaLungs,
  FaLungsVirus,
  FaBrain,
  FaBone,
  FaBacteria,
  FaVirus,
  FaVirusCovid,
  FaSyringe,
  FaStethoscope,
  FaHeartPulse,
  FaHeart,
  FaHospital,
  FaEye,
  FaEarListen,
  FaTooth,
  FaWeightScale,
  FaDroplet,
  FaVial,
  FaShieldHeart,
  FaHandHoldingMedical,
  FaNotesMedical,
  FaStaffSnake,
  FaVenus,
  FaMars,
  FaVenusMars,
  FaPersonPregnant,
  FaPersonBreastfeeding,
  FaBaby,
  FaDumbbell,
  FaShieldVirus,
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
  GiInternalOrgan,
  GiRibcage,
  GiSkullCrossedBones,
  GiSkeleton,
  GiJoint,
  GiArmBandage,
  GiEyeball,
  GiNoseFront,
  GiMouthWatering,
  GiMicroscopeLens,
  GiMicroscope,
  GiTestTubes,
  GiDrippingTube,
  GiDna2,
  GiDna1,
  GiProtectionGlasses,
  GiBrickWall,
  GiLayeredArmor,
  GiHexagonalNut,
  GiWaterFlask,
  GiSpray,
  GiMucousPillar,
  GiFat,
  GiOilySpiral,
  GiMeat,
  GiBoneKnife,
  GiBrain,
  GiHeartDrop,
  GiBiceps,
  GiMuscleFat,
  GiFingerPrint,
  GiLungs,
  GiBubblingFlask,
  GiCellarBarrels,
  GiTooth,
  GiTongue,
  GiFetus,
  GiEggPod,
  GiRawEgg,
  GiBabyBottle,
  GiShinyIris,
  GiStarPupil,
  GiMazeCornea,
} from 'react-icons/gi';
import {
  TbGridPattern,
  TbBorderAll,
  TbDropletFilled,
  TbDropletHalf2,
  TbBone,
  TbBoneOff,
  TbBrain,
  TbNetwork,
  TbTestPipe,
  TbDeviceHeartMonitor,
  TbFingerprint,
  TbLungs,
  TbDental,
  TbGenderMale,
  TbGenderFemale,
  TbBabyBottle,
  TbMilk,
  TbMicroscope,
  TbZoomIn,
  TbApple,
} from 'react-icons/tb';

export type HistologyTopicCategory =
  | 'all'
  | 'epitelios'
  | 'glandulas'
  | 'microscopios'
  | 'adiposo'
  | 'hueso'
  | 'cartilago'
  | 'nervioso'
  | 'sangre'
  | 'linfoide'
  | 'musculo'
  | 'cardiovascular'
  | 'tegumentario'
  | 'respiratorio'
  | 'digestivo'
  | 'oral'
  | 'anexas'
  | 'urinario'
  | 'reproductor'
  | 'mamaria'
  | 'ojo';

export const HISTOLOGY_TOPIC_LABELS: Record<HistologyTopicCategory, { label: string; icon: string }> = {
  all: { label: 'Todos los Íconos', icon: '🌟' },
  epitelios: { label: 'Epitelios', icon: '🧱' },
  glandulas: { label: 'Glándulas Endocrinas y Exocrinas', icon: '🧪' },
  microscopios: { label: 'Microscopios', icon: '🔬' },
  adiposo: { label: 'Tejido Adiposo', icon: '🧈' },
  hueso: { label: 'Hueso', icon: '🦴' },
  cartilago: { label: 'Cartílago', icon: '🦻' },
  nervioso: { label: 'Sistema Nervioso', icon: '🧠' },
  sangre: { label: 'Sangre', icon: '🩸' },
  linfoide: { label: 'Sistema Linfoide e Inmunidad', icon: '🛡️' },
  musculo: { label: 'Músculo', icon: '💪' },
  cardiovascular: { label: 'Sistema Cardiovascular', icon: '🫀' },
  tegumentario: { label: 'Sistema Tegumentario (Piel)', icon: '👆' },
  respiratorio: { label: 'Sistema Respiratorio', icon: '🫁' },
  digestivo: { label: 'Sistema Digestivo', icon: '🥣' },
  oral: { label: 'Cavidad Oral', icon: '👄' },
  anexas: { label: 'Glándulas Anexas Digestivas', icon: '🧫' },
  urinario: { label: 'Sistema Urinario', icon: '💧' },
  reproductor: { label: 'Sistema Reproductor (M / F)', icon: '🧬' },
  mamaria: { label: 'Glándula Mamaria', icon: '🍼' },
  ojo: { label: 'Ojo y Sentidos Especiales', icon: '👁️' },
};

export interface MedicalIconDefinition {
  id: string;
  name: string;
  category: 'anatomy' | 'physiology' | 'lab' | 'clinical';
  topic: HistologyTopicCategory;
  keywords: string[];
  render: (props: { size?: number; className?: string; style?: React.CSSProperties; color?: string }) => React.ReactElement;
}

export const MEDICAL_ICONS_CATALOG: MedicalIconDefinition[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // 1. 🧱 EPITELIOS
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'layers',
    name: 'Estratificación / Láminas Basales',
    category: 'physiology',
    topic: 'epitelios',
    keywords: ['epitelio', 'estrato', 'capas', 'laminas', 'basal', 'membrana basal', 'estratificado', 'queratina', 'layers'],
    render: props => <Layers size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'grid_epithelium',
    name: 'Células Epiteliales Poliédricas',
    category: 'anatomy',
    topic: 'epitelios',
    keywords: ['epitelio', 'celulas', 'poliedrico', 'mosaico', 'revestimiento', 'simple', 'cubico', 'cilindrico', 'pavimentoso'],
    render: props => <Grid size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'shield',
    name: 'Barrera Epitelial / Uniones Ocluyentes',
    category: 'physiology',
    topic: 'epitelios',
    keywords: ['epitelio', 'barrera', 'proteccion', 'escudo', 'zonula occludens', 'desmosoma', 'hemidesmosoma', 'oclusion'],
    render: props => <ShieldCheck size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'epitelio_brick',
    name: 'Epitelio Plano Estratificado',
    category: 'anatomy',
    topic: 'epitelios',
    keywords: ['epitelio', 'estratificado', 'pared', 'ladrillos', 'epidermis', 'esofago', 'proteccion mecanica', 'brick'],
    render: props => <GiBrickWall size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'epitelio_corneo',
    name: 'Estrato Córneo / Queratinizado',
    category: 'anatomy',
    topic: 'epitelios',
    keywords: ['epitelio', 'queratina', 'corneo', 'estrato corneo', 'armadura', 'escamas', 'piel gruesa'],
    render: props => <GiLayeredArmor size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'epitelio_hex',
    name: 'Malla Epitelial Hexagonal',
    category: 'anatomy',
    topic: 'epitelios',
    keywords: ['epitelio', 'hexagono', 'celulas cubicas', 'endotelio', 'mesotelio', 'hexagonal'],
    render: props => <GiHexagonalNut size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'epitelio_reticular',
    name: 'Citoesqueleto y Red Epitelial',
    category: 'physiology',
    topic: 'epitelios',
    keywords: ['epitelio', 'red', 'tonofilamentos', 'queratina', 'complejo de union', 'reticulo'],
    render: props => <TbGridPattern size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'epitelio_border',
    name: 'Membrana Basal y Dominios Celulares',
    category: 'physiology',
    topic: 'epitelios',
    keywords: ['epitelio', 'membrana basal', 'polaridad', 'dominio apical', 'dominio basolateral', 'lamina lucida', 'lamina densa'],
    render: props => <TbBorderAll size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'cilia',
    name: 'Cilios / Aclaramiento Mucociliar',
    category: 'physiology',
    topic: 'epitelios',
    keywords: ['epitelio', 'cilios', 'movimiento', 'barrido', 'flujo', 'mucociliar', 'axonema', 'microtubulos', 'pseudoestratificado'],
    render: props => <Wind size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'absorption',
    name: 'Microvellosidades / Ribete en Cepillo',
    category: 'physiology',
    topic: 'epitelios',
    keywords: ['epitelio', 'microvellosidad', 'ribete en cepillo', 'absorcion', 'enterocito', 'filamentos de actina', 'chapa estriada'],
    render: props => <Download size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 2. 🧪 GLÁNDULAS ENDOCRINAS Y EXOCRINAS
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'droplets',
    name: 'Secreción Exocrina / Acinos',
    category: 'physiology',
    topic: 'glandulas',
    keywords: ['glandula', 'secrecion', 'exocrina', 'seroso', 'mucoso', 'merocrino', 'acino', 'adenomero'],
    render: props => <Droplets size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'glandula_tubular',
    name: 'Glándula Tubular y Acinar',
    category: 'anatomy',
    topic: 'glandulas',
    keywords: ['glandula', 'tubular', 'acinar', 'alveolar', 'ramificada', 'compuesta', 'exocrina', 'conducto'],
    render: props => <GiWaterFlask size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'glandula_endocrina',
    name: 'Glándula Endocrina / Hormonas',
    category: 'physiology',
    topic: 'glandulas',
    keywords: ['glandula', 'endocrina', 'hormona', 'tiroides', 'paratiroides', 'suprarrenal', 'hipofisis', 'islote', 'sangre'],
    render: props => <GiTestTubes size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'glandula_spray',
    name: 'Secreción Holocrina y Apocrina',
    category: 'physiology',
    topic: 'glandulas',
    keywords: ['glandula', 'holocrino', 'apocrino', 'sebacea', 'sudoripara', 'secrecion', 'desprender', 'spray'],
    render: props => <GiSpray size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'glandula_drip',
    name: 'Conducto Excretor Interlobulillar',
    category: 'anatomy',
    topic: 'glandulas',
    keywords: ['glandula', 'conducto', 'interlobulillar', 'estriado', 'intercalar', 'excretor', 'drenaje'],
    render: props => <GiDrippingTube size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'chemical_drop',
    name: 'Vesícula Hormonal / Gránulo Secretor',
    category: 'physiology',
    topic: 'glandulas',
    keywords: ['glandula', 'granulo', 'zimogeno', 'vesicula', 'hormona', 'exocitosis', 'coloides', 'tiroglobulina'],
    render: props => <GiChemicalDrop size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'glandula_caliciforme',
    name: 'Célula Caliciforme / Mucígeno',
    category: 'anatomy',
    topic: 'glandulas',
    keywords: ['glandula', 'caliciforme', 'unicelular', 'mucus', 'mucina', 'goblet', 'traquea', 'intestino'],
    render: props => <GiMucousPillar size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'pipette',
    name: 'Eje Hipotálamo-Hipofisario',
    category: 'lab',
    topic: 'glandulas',
    keywords: ['glandula', 'adenohipofisis', 'neurohipofisis', 'retroalimentacion', 'pipette', 'dosificacion'],
    render: props => <Pipette size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'flask',
    name: 'Folículo Tiroideo / Coloide',
    category: 'anatomy',
    topic: 'glandulas',
    keywords: ['glandula', 'tiroides', 'foliculo', 'coloide', 't3', 't4', 'celulas c', 'calcitonina'],
    render: props => <FlaskConical size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'glandula_vesicle',
    name: 'Secreción Merocrina Regulada',
    category: 'physiology',
    topic: 'glandulas',
    keywords: ['glandula', 'merocrino', 'vesicula', 'exocitosis', 'liberacion', 'salivar', 'pancreatica'],
    render: props => <TbDropletFilled size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 3. 🔬 MICROSCOPIOS
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'microscope',
    name: 'Microscopio Óptico Compuesto',
    category: 'lab',
    topic: 'microscopios',
    keywords: ['microscopio', 'optico', 'campo claro', 'luz', 'laboratorio', 'laminilla', 'placa', 'microscopy'],
    render: props => <Microscope size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'microscope_lens',
    name: 'Revólver & Objetivos (4x - 100x)',
    category: 'lab',
    topic: 'microscopios',
    keywords: ['microscopio', 'lentes', 'objetivo', 'revolver', 'aumento', '40x', '100x', 'inmersion', 'apertura'],
    render: props => <GiMicroscopeLens size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'microscope_lab',
    name: 'Microscopio Electrónico / Contraste',
    category: 'lab',
    topic: 'microscopios',
    keywords: ['microscopio', 'electronico', 'transmision', 'barrido', 'ultraestructura', 'resolucion', 'nanometros'],
    render: props => <GiMicroscope size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'microscope_tb',
    name: 'Microscopio de Investigación Médica',
    category: 'lab',
    topic: 'microscopios',
    keywords: ['microscopio', 'investigacion', 'histopatologia', 'diagnostico', 'platina', 'condensador'],
    render: props => <TbMicroscope size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'scan',
    name: 'Escaneo de Placa / Fotomicrografía',
    category: 'lab',
    topic: 'microscopios',
    keywords: ['microscopio', 'digital', 'escaneo', 'sensor', 'resolucion', 'captura', 'foto', 'scan'],
    render: props => <Scan size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'crosshair_target',
    name: 'Retícula Óptica y Micrométrica',
    category: 'lab',
    topic: 'microscopios',
    keywords: ['microscopio', 'reticula', 'micrometro', 'escala', 'calibracion', 'enfoque', 'crosshair'],
    render: props => <Crosshair size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'search',
    name: 'Exploración de la Muestra (Scanning)',
    category: 'lab',
    topic: 'microscopios',
    keywords: ['microscopio', 'rastreo', 'campo panoramico', 'buscar', 'localizacion', 'aumento menor', '4x'],
    render: props => <Search size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'zoom_in',
    name: 'Inmersión en Aceite (100x)',
    category: 'lab',
    topic: 'microscopios',
    keywords: ['microscopio', 'inmersion', 'aceite de cedro', '100x', 'gran aumento', 'detalle subcelular', 'zoom'],
    render: props => <TbZoomIn size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 4. 🧈 TEJIDO ADIPOSO
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'adiposo_paniculo',
    name: 'Tejido Adiposo / Panículo Adiposo',
    category: 'anatomy',
    topic: 'adiposo',
    keywords: ['adiposo', 'tejido adiposo', 'grasa', 'grasa blanca', 'adipocito', 'hipodermis', 'aislante', 'fat'],
    render: props => <GiFat size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'adiposo_spiral',
    name: 'Gota Lipídica Coalescente',
    category: 'physiology',
    topic: 'adiposo',
    keywords: ['adiposo', 'lipido', 'trigliceridos', 'gota lipidica', 'inclusion', 'sudan', 'reserva energetica'],
    render: props => <GiOilySpiral size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'adiposo_meat',
    name: 'Tejido Conectivo y Grasa Interlobulillar',
    category: 'anatomy',
    topic: 'adiposo',
    keywords: ['adiposo', 'grasa', 'lobulillo', 'estroma', 'adiposa', 'intersticial', 'marmoleado'],
    render: props => <GiMeat size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'droplet_single',
    name: 'Adipocito Unilocular / Anillo de Sello',
    category: 'anatomy',
    topic: 'adiposo',
    keywords: ['adiposo', 'adipocito', 'unilocular', 'anillo de sello', 'nucleo aplanado', 'vacuola', 'grasa blanca'],
    render: props => <Droplet size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'droplet_fa',
    name: 'Gotícula Lipídica / Esterificación',
    category: 'physiology',
    topic: 'adiposo',
    keywords: ['adiposo', 'acido graso', 'lipolisis', 'lipogenesis', 'triglicerido', 'adipocinas', 'leptina'],
    render: props => <FaDroplet size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'adiposo_ring',
    name: 'Morfología en Anillo de Sello',
    category: 'anatomy',
    topic: 'adiposo',
    keywords: ['adiposo', 'anillo de sello', 'vacuola lipidica', 'croma', 'preparacion histologica', 'espacio opticamente vacio'],
    render: props => <TbDropletHalf2 size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'adiposo_brown',
    name: 'Grasa Parda / Termogénesis (UCP-1)',
    category: 'physiology',
    topic: 'adiposo',
    keywords: ['adiposo', 'grasa parda', 'multilocular', 'termogenesis', 'mitocondrias', 'termogenina', 'calor', 'ucp1'],
    render: props => <Sun size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'weight_scale',
    name: 'Metabolismo Energético Adiposo',
    category: 'clinical',
    topic: 'adiposo',
    keywords: ['adiposo', 'metabolismo', 'peso', 'insulina', 'obesidad', 'grasa visceral', 'almacen'],
    render: props => <FaWeightScale size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 5. 🦴 HUESO
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'bone',
    name: 'Hueso Cortical / Matriz Ósea',
    category: 'anatomy',
    topic: 'hueso',
    keywords: ['hueso', 'oseo', 'osteocito', 'osteoblasto', 'osteoclasto', 'havers', 'compacto', 'matriz calcificada', 'bone'],
    render: props => <FaBone size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'skeleton',
    name: 'Sistema Óseo / Esqueleto Trabecular',
    category: 'anatomy',
    topic: 'hueso',
    keywords: ['hueso', 'esqueleto', 'huesos', 'locomotor', 'trabeculas', 'esponjoso', 'skeleton'],
    render: props => <GiSkeleton size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'hueso_compacto',
    name: 'Osteonas y Laminillas Óseas',
    category: 'anatomy',
    topic: 'hueso',
    keywords: ['hueso', 'osteona', 'laminillas', 'conducto de havers', 'conducto de volkmann', 'canaliculos', 'osteocito'],
    render: props => <GiBoneKnife size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'skull_bone',
    name: 'Osificación Intramembranosa',
    category: 'anatomy',
    topic: 'hueso',
    keywords: ['hueso', 'craneo', 'intramembranosa', 'hueso plano', 'fontanela', 'sutura', 'periostio', 'osteoblastos'],
    render: props => <GiSkullCrossedBones size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'ribcage',
    name: 'Hueso Esponjoso & Médula Ósea',
    category: 'anatomy',
    topic: 'hueso',
    keywords: ['hueso', 'medula osea', 'hematopoyesis', 'trabecular', 'costillas', 'esternon', 'endostio'],
    render: props => <GiRibcage size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'spine',
    name: 'Vértebra / Conducto Raquídeo',
    category: 'anatomy',
    topic: 'hueso',
    keywords: ['hueso', 'vertebra', 'columna', 'medula', 'hueso esponjoso', 'eje axial', 'spine'],
    render: props => <GiSpineArrow size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'hueso_tb',
    name: 'Matriz Osteoide y Mineralización',
    category: 'physiology',
    topic: 'hueso',
    keywords: ['hueso', 'hidroxiapatita', 'calcio', 'fosfato', 'colageno tipo i', 'remodelado', 'osteona'],
    render: props => <TbBone size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 6. 🦻 CARTÍLAGO
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'joint',
    name: 'Articulación / Cartílago Hialino Articular',
    category: 'anatomy',
    topic: 'cartilago',
    keywords: ['cartilago', 'articulacion', 'hialino', 'sinovial', 'condrocito', 'condroplasto', 'grupos isogenos', 'joint'],
    render: props => <GiJoint size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'cartilago_nasal',
    name: 'Cartílago Hialino Nasal',
    category: 'anatomy',
    topic: 'cartilago',
    keywords: ['cartilago', 'nasal', 'tabique', 'hialino', 'aleteo', 'pericondrio', 'matriz territorial'],
    render: props => <GiNoseFront size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'ear',
    name: 'Cartílago Elástico / Pabellón Auricular',
    category: 'anatomy',
    topic: 'cartilago',
    keywords: ['cartilago', 'elastico', 'oreja', 'pabellon', 'epiglotis', 'fibras elasticas', 'resorcina', 'orceina'],
    render: props => <FaEarListen size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'cartilago_fibro',
    name: 'Fibrocartílago / Meniscos y Discos',
    category: 'anatomy',
    topic: 'cartilago',
    keywords: ['cartilago', 'fibrocartilago', 'disco intervertebral', 'menisco', 'sinfisis pubica', 'colageno tipo i', 'resistencia'],
    render: props => <GiArmBandage size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'cartilago_matrix',
    name: 'Matriz Cartilaginosa Avascular',
    category: 'physiology',
    topic: 'cartilago',
    keywords: ['cartilago', 'matriz', 'condroitin sulfato', 'agrecan', 'avascular', 'difusion', 'pericondrio', 'condroblasto'],
    render: props => <TbBoneOff size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'shield_outline',
    name: 'Pericondrio / Capa Condrogénica',
    category: 'physiology',
    topic: 'cartilago',
    keywords: ['cartilago', 'pericondrio', 'capa fibrosa', 'capa celular', 'crecimiento por aposicion', 'crecimiento intersticial'],
    render: props => <Shield size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 7. 🧠 SISTEMA NERVIOSO
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'brain',
    name: 'Cerebro / Encéfalo y Sustancia Gris',
    category: 'anatomy',
    topic: 'nervioso',
    keywords: ['nervioso', 'cerebro', 'neurona', 'corteza', 'sinapsis', 'astrocito', 'glia', 'pericarion', 'brain'],
    render: props => <FaBrain size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'nervioso_cortex',
    name: 'Corteza Cerebral y Neuronas Piramidales',
    category: 'anatomy',
    topic: 'nervioso',
    keywords: ['nervioso', 'corteza', 'piramidal', 'betz', 'molecular', 'granular', 'capas corticales', 'cerebelo', 'purkinje'],
    render: props => <GiBrain size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'zap',
    name: 'Potencial de Acción / Impulso Nervioso',
    category: 'physiology',
    topic: 'nervioso',
    keywords: ['nervioso', 'potencial de accion', 'despolarizacion', 'impulso', 'axon', 'conduccion saltatoria', 'nodo de ranvier'],
    render: props => <Zap size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'network',
    name: 'Red Neuronal / Neuropilo Tisular',
    category: 'physiology',
    topic: 'nervioso',
    keywords: ['nervioso', 'red', 'neuropilo', 'dendritas', 'sinapsis', 'astrocitos protoplasmaticos', 'oligodendrocitos'],
    render: props => <Network size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'cpu_metabolism',
    name: 'Soma Neuronal / Corpúsculos de Nissl',
    category: 'physiology',
    topic: 'nervioso',
    keywords: ['nervioso', 'soma', 'pericarion', 'sustancia de nissl', 'reticulo endoplasmico', 'cono axonico', 'nucleolo prominente'],
    render: props => <Cpu size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'share_synapse',
    name: 'Sinapsis Química / Neurotransmisores',
    category: 'physiology',
    topic: 'nervioso',
    keywords: ['nervioso', 'sinapsis', 'hendidura sinaptica', 'vesiculas sinapticas', 'neurotransmisor', 'acetilcolina', 'recetores'],
    render: props => <Share2 size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'nervioso_tb_brain',
    name: 'Médula Espinal / Astas Anteriores y Posteriores',
    category: 'anatomy',
    topic: 'nervioso',
    keywords: ['nervioso', 'medula espinal', 'astas', 'motoneurona', 'conducto ependimario', 'ependimocitos', 'mielina'],
    render: props => <TbBrain size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'nervioso_tb_network',
    name: 'Células Gliales / Microglía y Schwann',
    category: 'anatomy',
    topic: 'nervioso',
    keywords: ['nervioso', 'glia', 'microglia', 'fagocitosis', 'celulas de schwann', 'vaina de mielina', 'nervio periferico'],
    render: props => <TbNetwork size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 8. 🩸 SANGRE
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'blood',
    name: 'Frotis Sanguíneo / Eritrocitos & Leucocitos',
    category: 'anatomy',
    topic: 'sangre',
    keywords: ['sangre', 'eritrocito', 'globulo rojo', 'leucocito', 'plaqueta', 'frotis', 'hematologia', 'wright', 'blood'],
    render: props => <GiBlood size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'sangre_heart_drop',
    name: 'Vaso Sanguíneo y Perfusión',
    category: 'physiology',
    topic: 'sangre',
    keywords: ['sangre', 'lecho vascular', 'perfusion', 'flujo sanguineo', 'plasma', 'hematocrito'],
    render: props => <GiHeartDrop size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'sangre_drop',
    name: 'Gota de Sangre / Tinción Hematológica',
    category: 'lab',
    topic: 'sangre',
    keywords: ['sangre', 'gota', 'frotis', 'giemsa', 'leishman', 'plaquetas', 'trombocito'],
    render: props => <FaDroplet size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'vial_single',
    name: 'Tubo de Extracción / Plasma y Suero',
    category: 'lab',
    topic: 'sangre',
    keywords: ['sangre', 'vial', 'tubo', 'anticoagulante', 'edta', 'centrifugacion', 'plasma', 'suero'],
    render: props => <FaVial size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'syringe',
    name: 'Extracción / Punción Capilar y Venosa',
    category: 'clinical',
    topic: 'sangre',
    keywords: ['sangre', 'jeringa', 'puncion', 'flebotomia', 'muestra', 'hematologia'],
    render: props => <FaSyringe size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'sangre_rbc',
    name: 'Eritrocito Disco Bicóncavo',
    category: 'anatomy',
    topic: 'sangre',
    keywords: ['sangre', 'eritrocito', 'biconcavo', 'hemoglobina', 'espectrina', 'anucleado', 'reticulocito'],
    render: props => <TbDropletFilled size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'sangre_capilar',
    name: 'Microhematocrito y Elementos Formes',
    category: 'lab',
    topic: 'sangre',
    keywords: ['sangre', 'hematocrito', 'neutrofilo', 'eosinofilo', 'basofilo', 'linfocito', 'monocito'],
    render: props => <TbTestPipe size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'heart_pulse',
    name: 'Circulación Sanguínea / Diapedesis',
    category: 'physiology',
    topic: 'sangre',
    keywords: ['sangre', 'diapedesis', 'migracion leucocitaria', 'vasodilatacion', 'endotelio', 'hemostasia'],
    render: props => <FaHeartPulse size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 9. 🛡️ SISTEMA LINFOIDE
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'shield_check_lymph',
    name: 'Sistema Inmune / Linfocitos T y B',
    category: 'physiology',
    topic: 'linfoide',
    keywords: ['linfoide', 'inmune', 'inmunidad', 'linfocito t', 'linfocito b', 'anticuerpos', 'ganglio linfatico'],
    render: props => <ShieldCheck size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'shield_alert',
    name: 'Respuesta Inmune e Inflamación',
    category: 'physiology',
    topic: 'linfoide',
    keywords: ['linfoide', 'antigeno', 'inflamacion', 'infiltrado linfoide', 'citoquinas', 'alerta'],
    render: props => <ShieldAlert size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'shield_heart',
    name: 'Inmunocompetencia / Timo y Bazo',
    category: 'physiology',
    topic: 'linfoide',
    keywords: ['linfoide', 'timo', 'bazo', 'corpusculo de hassall', 'seleccion positiva', 'seleccion negativa', 'linfocitos'],
    render: props => <FaShieldHeart size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'linfoide_barrier',
    name: 'Barrera Inmune / MALT & Placas de Peyer',
    category: 'anatomy',
    topic: 'linfoide',
    keywords: ['linfoide', 'malt', 'placas de peyer', 'amigdala', 'foliculo linfoide', 'centro germinativo', 'iga'],
    render: props => <FaShieldVirus size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'virus',
    name: 'Antígeno Patógeno / Opsonización',
    category: 'lab',
    topic: 'linfoide',
    keywords: ['linfoide', 'virus', 'patogeno', 'antigeno', 'inmunidad celular', 'citoquinas', 'interferon'],
    render: props => <FaVirus size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'bacteria',
    name: 'Macrófagos / Células Presentadoras (APC)',
    category: 'lab',
    topic: 'linfoide',
    keywords: ['linfoide', 'macrofago', 'apc', 'fagocitosis', 'complejo mayor histocompatibilidad', 'mhc', 'celula dendritica'],
    render: props => <FaBacteria size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'internal_organ',
    name: 'Bazo / Pulpa Blanca y Pulpa Roja',
    category: 'anatomy',
    topic: 'linfoide',
    keywords: ['linfoide', 'bazo', 'pulpa blanca', 'pulpa roja', 'vainas periarteriolares', 'cordones de billroth', 'sinusoides'],
    render: props => <GiInternalOrgan size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'linfoide_crosshair',
    name: 'Plasmocitos e Inmunoglobulinas',
    category: 'physiology',
    topic: 'linfoide',
    keywords: ['linfoide', 'plasmocito', 'celula plasmatica', 'anticuerpo', 'inmunoglobulina', 'rueda de carreta', 'especificidad'],
    render: props => <Crosshair size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 10. 💪 MÚSCULO
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'muscle',
    name: 'Músculo Esquelético / Estriado',
    category: 'anatomy',
    topic: 'musculo',
    keywords: ['musculo', 'muscular', 'miocito', 'fibra muscular', 'sarcomero', 'estriado', 'esqueletico', 'nucleos perifericos', 'muscle'],
    render: props => <GiMuscleUp size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'musculo_biceps',
    name: 'Vientre Muscular y Envolturas (Epimisio)',
    category: 'anatomy',
    topic: 'musculo',
    keywords: ['musculo', 'epimisio', 'perimisio', 'endomisio', 'fasciculo', 'biceps', 'union miotendinosa'],
    render: props => <GiBiceps size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'musculo_fiber',
    name: 'Miofibrillas y Bandas Sarcoméricas',
    category: 'anatomy',
    topic: 'musculo',
    keywords: ['musculo', 'sarcomero', 'banda a', 'banda i', 'linea z', 'actina', 'miosina', 'triada muscular', 'reticulo sarcoplasmico'],
    render: props => <GiMuscleFat size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'musculo_lucide_biceps',
    name: 'Contracción Muscular Activa',
    category: 'physiology',
    topic: 'musculo',
    keywords: ['musculo', 'contraccion', 'fuerza', 'puentes cruzados', 'calcio', 'troponina', 'tropomiosina', 'atp'],
    render: props => <BicepsFlexed size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'activity',
    name: 'Músculo Cardíaco / Discos Intercalares',
    category: 'anatomy',
    topic: 'musculo',
    keywords: ['musculo', 'miocardio', 'cardiomiocito', 'discos intercalares', 'desmosomas', 'gap junctions', 'fibras de purkinje'],
    render: props => <Activity size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'waves',
    name: 'Músculo Liso / Células Fusiformes',
    category: 'anatomy',
    topic: 'musculo',
    keywords: ['musculo', 'musculo liso', 'fusiforme', 'nucleo central', 'involuntario', 'peristaltismo', 'caveolas', 'calmodulina'],
    render: props => <Waves size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'musculo_dumbbell',
    name: 'Tono Muscular y Fibras Tipo I/II',
    category: 'clinical',
    topic: 'musculo',
    keywords: ['musculo', 'fibras lentas', 'fibras rapidas', 'mioglobina', 'hipertrofia', 'ejercicio'],
    render: props => <FaDumbbell size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 11. 🫀 SISTEMA CARDIOVASCULAR
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'heart_organ',
    name: 'Corazón / Endocardio, Miocardio y Epicardio',
    category: 'anatomy',
    topic: 'cardiovascular',
    keywords: ['cardiovascular', 'corazon', 'endocardio', 'miocardio', 'epicardio', 'pericardio', 'valvulas', 'auricula', 'ventriculo'],
    render: props => <GiHeartOrgan size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'heart_simple',
    name: 'Arterias y Venas / Túnica Íntima y Media',
    category: 'anatomy',
    topic: 'cardiovascular',
    keywords: ['cardiovascular', 'arteria', 'vena', 'tunica intima', 'tunica media', 'tunica adventicia', 'vasa vasorum', 'endotelio'],
    render: props => <FaHeart size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'heart_lucide',
    name: 'Bomba Cardíaca / Fibras de Purkinje',
    category: 'anatomy',
    topic: 'cardiovascular',
    keywords: ['cardiovascular', 'sistema de conduccion', 'nodo sinusal', 'purkinje', 'cardiomiocitos', 'contraccion'],
    render: props => <Heart size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'cardio_pulse',
    name: 'Pulso Arterial / Fibras Elásticas',
    category: 'physiology',
    topic: 'cardiovascular',
    keywords: ['cardiovascular', 'arteria elastica', 'aorta', 'laminas elasticas', 'pulso', 'presion arterial', 'compliance'],
    render: props => <FaHeartPulse size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'stethoscope',
    name: 'Hemodinámica y Ruidos Cardíacos',
    category: 'clinical',
    topic: 'cardiovascular',
    keywords: ['cardiovascular', 'estetoscopio', 'valvulas cardiacas', 'flujo laminar', 'sistole', 'diastole'],
    render: props => <FaStethoscope size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'cardio_monitor',
    name: 'Endotelio Vascular / Óxido Nítrico',
    category: 'physiology',
    topic: 'cardiovascular',
    keywords: ['cardiovascular', 'endotelio', 'permeabilidad vascular', 'cuerpos de weibel-palade', 'vasodilatacion'],
    render: props => <TbDeviceHeartMonitor size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'exchange',
    name: 'Capilares Continuos, Fenestrados y Sinusoides',
    category: 'physiology',
    topic: 'cardiovascular',
    keywords: ['cardiovascular', 'capilar', 'fenestrado', 'sinusoide', 'pericito', 'intercambio de gases', 'difusion capilar'],
    render: props => <ArrowRightLeft size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 12. 👆 SISTEMA TEGUMENTARIO (PIEL)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'fingerprint',
    name: 'Crestas Epidérmicas / Dermatoglifos',
    category: 'anatomy',
    topic: 'tegumentario',
    keywords: ['tegumentario', 'piel', 'huella dactilar', 'crestas epidermicas', 'papilas dermicas', 'piel gruesa', 'estrato lucido'],
    render: props => <Fingerprint size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'tegumentario_dermis',
    name: 'Dermis Papilar y Reticular',
    category: 'anatomy',
    topic: 'tegumentario',
    keywords: ['tegumentario', 'dermis', 'dermis papilar', 'dermis reticular', 'colageno', 'elastina', 'fibroblastos', 'matriz'],
    render: props => <GiFingerPrint size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'tegumentario_layers',
    name: 'Estratos Epidérmicos (Basal a Córneo)',
    category: 'anatomy',
    topic: 'tegumentario',
    keywords: ['tegumentario', 'epidermis', 'estrato basal', 'estrato espinoso', 'estrato granuloso', 'estrato lucido', 'estrato corneo'],
    render: props => <Layers size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'tegumentario_melanocyte',
    name: 'Melanocitos / Síntesis de Melanina',
    category: 'physiology',
    topic: 'tegumentario',
    keywords: ['tegumentario', 'melanocito', 'melanina', 'melanosomas', 'fotoproteccion', 'rayos uv', 'pigmentacion'],
    render: props => <Sun size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'hand_holding_medical',
    name: 'Sensibilidad Cutánea y Receptores',
    category: 'clinical',
    topic: 'tegumentario',
    keywords: ['tegumentario', 'tacto', 'corpúsculo de meissner', 'corpusculo de pacini', 'merkel', 'ruzzini', 'terminaciones libres'],
    render: props => <FaHandHoldingMedical size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'tegumentario_receptor',
    name: 'Corpúsculos de Meissner y Pacini',
    category: 'physiology',
    topic: 'tegumentario',
    keywords: ['tegumentario', 'meissner', 'pacini', 'presion', 'vibracion', 'tacto fino', 'dermis'],
    render: props => <TbFingerprint size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'tegumentario_keratin',
    name: 'Queratinocitos y Gránulos de Queratohialina',
    category: 'physiology',
    topic: 'tegumentario',
    keywords: ['tegumentario', 'queratinocito', 'queratohialina', 'cuerpos laminares', 'filagrina', 'barrera cutanea'],
    render: props => <Sparkles size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 13. 🫁 SISTEMA RESPIRATORIO
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'lungs',
    name: 'Pulmones / Árbol Traqueobronquial',
    category: 'anatomy',
    topic: 'respiratorio',
    keywords: ['respiratorio', 'pulmon', 'traquea', 'bronquio', 'bronquiolo', 'alveolo', 'cartilago hialino', 'musculo de reisseisen'],
    render: props => <FaLungs size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'lungs_virus',
    name: 'Parénquima Pulmonar y Tabiques Alveolares',
    category: 'anatomy',
    topic: 'respiratorio',
    keywords: ['respiratorio', 'tabique alveolar', 'poros de kohn', 'macrofagos alveolares', 'celulas del polvo', 'surfactante'],
    render: props => <FaLungsVirus size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'respiratorio_sacs',
    name: 'Alvéolos y Neumocitos I y II',
    category: 'anatomy',
    topic: 'respiratorio',
    keywords: ['respiratorio', 'neumocito tipo i', 'neumocito tipo ii', 'cuerpos laminares', 'surfactante', 'tension superficial'],
    render: props => <GiLungs size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'respiratorio_wind',
    name: 'Epitelio Respiratorio Ciliado',
    category: 'physiology',
    topic: 'respiratorio',
    keywords: ['respiratorio', 'pseudoestratificado', 'cilios', 'celulas caliciformes', 'aclaramiento mucociliar', 'traquea'],
    render: props => <Wind size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'nose',
    name: 'Cavidad Nasal y Mucosa Olfatoria',
    category: 'anatomy',
    topic: 'respiratorio',
    keywords: ['respiratorio', 'nariz', 'cornetes', 'mucosa olfatoria', 'neuronas bipolares', 'glandulas de bowman', 'senos paranasales'],
    render: props => <GiNoseFront size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'respiratorio_tb_lungs',
    name: 'Barrera Hematogaseosa / Hematosis',
    category: 'physiology',
    topic: 'respiratorio',
    keywords: ['respiratorio', 'hematosis', 'barrera alveolocapilar', 'oxigeno', 'co2', 'difusion de gases'],
    render: props => <TbLungs size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 14. 🥣 SISTEMA DIGESTIVO
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'stomach',
    name: 'Estómago / Células Parietales y Principales',
    category: 'anatomy',
    topic: 'digestivo',
    keywords: ['digestivo', 'estomago', 'mucosa gastrica', 'foveolas', 'celulas parietales', 'acido clorhidrico', 'factor intrinseco', 'pepsinogeno'],
    render: props => <GiStomach size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'digestivo_motility',
    name: 'Motilidad y Plexos Entéricos (Auerbach)',
    category: 'physiology',
    topic: 'digestivo',
    keywords: ['digestivo', 'peristalsis', 'plexo mienterico', 'auerbach', 'meissner', 'muscular externa', 'capas circulares y longitudinales'],
    render: props => <Waves size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'digestivo_absorb',
    name: 'Vellosidades Intestinales / Enterocitos',
    category: 'physiology',
    topic: 'digestivo',
    keywords: ['digestivo', 'intestino delgado', 'duodeno', 'yeyuno', 'ileon', 'vellosidades', 'quilifero central', 'absorcion de nutrientes'],
    render: props => <Download size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'digestivo_apple',
    name: 'Tubo Digestivo y Tránsito Quimo/Quilo',
    category: 'physiology',
    topic: 'digestivo',
    keywords: ['digestivo', 'digestion', 'quimo', 'quilo', 'esofago', 'colon', 'absorcion de agua'],
    render: props => <TbApple size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'digestivo_acid',
    name: 'Secreción Ácida y Enzimas Digestivas',
    category: 'physiology',
    topic: 'digestivo',
    keywords: ['digestivo', 'acido gastrico', 'bomba de protones', 'jugo gastrico', 'quimica digestiva'],
    render: props => <GiBubblingFlask size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'digestivo_crypts',
    name: 'Criptas de Lieberkühn & Células de Paneth',
    category: 'anatomy',
    topic: 'digestivo',
    keywords: ['digestivo', 'criptas de lieberkuhn', 'paneth', 'lisozima', 'colonocitos', 'tenias del colon'],
    render: props => <GiCellarBarrels size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 15. 👄 CAVIDAD ORAL
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'tooth',
    name: 'Diente / Odontoblastos, Dentina y Esmalte',
    category: 'anatomy',
    topic: 'oral',
    keywords: ['oral', 'diente', 'esmalte', 'ameloblastos', 'dentina', 'odontoblastos', 'pulpa', 'cemento', 'ligamento periodontal'],
    render: props => <FaTooth size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'oral_tooth_gi',
    name: 'Corona Dental y Periodonto',
    category: 'anatomy',
    topic: 'oral',
    keywords: ['oral', 'corona dental', 'raiz', 'alveolo dentario', 'periodonto', 'odontogenesis'],
    render: props => <GiTooth size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'oral_tongue',
    name: 'Lengua y Papilas Linguales',
    category: 'anatomy',
    topic: 'oral',
    keywords: ['oral', 'lengua', 'papila filiforme', 'papila fungiforme', 'papila caliciforme', 'papila foliada', 'musculo lingual'],
    render: props => <GiTongue size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'mouth',
    name: 'Mucosa Oral y Secreción Salival',
    category: 'anatomy',
    topic: 'oral',
    keywords: ['oral', 'boca', 'mucosa masticatoria', 'mucosa de revestimiento', 'paladar', 'encias', 'saliva', 'amilasa'],
    render: props => <GiMouthWatering size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'oral_dental_tb',
    name: 'Pulpa Dental y Plexo de Raschkow',
    category: 'anatomy',
    topic: 'oral',
    keywords: ['oral', 'pulpa', 'conducto radicular', 'inervacion dental', 'tejido conectivo laxo de la pulpa'],
    render: props => <TbDental size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'oral_taste',
    name: 'Botones Gustativos y Corpúsculos',
    category: 'physiology',
    topic: 'oral',
    keywords: ['oral', 'boton gustativo', 'poro gustativo', 'receptores del gusto', 'salado', 'dulce', 'amargo', 'acido', 'umami'],
    render: props => <Sparkles size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 16. 🧫 GLÁNDULAS ANEXAS DEL SISTEMA DIGESTIVO
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'liver',
    name: 'Hígado / Lobulillo Clásico y Hepatocitos',
    category: 'anatomy',
    topic: 'anexas',
    keywords: ['anexas', 'higado', 'lobulillo hepatico', 'triada portal', 'hepatocito', 'sinusoide', 'celulas de kupffer', 'espacio de disse'],
    render: props => <GiLiver size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'anexas_pancreas',
    name: 'Páncreas / Acinos e Islotes de Langerhans',
    category: 'anatomy',
    topic: 'anexas',
    keywords: ['anexas', 'pancreas', 'acinos serosos', 'celulas centroacinares', 'islotes de langerhans', 'insulina', 'glucagon', 'somatostatina'],
    render: props => <GiInternalOrgan size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'anexas_bile',
    name: 'Conductillos Biliares y Secreción de Bilis',
    category: 'physiology',
    topic: 'anexas',
    keywords: ['anexas', 'bilis', 'canaliculos biliares', 'sales biliares', 'bilirrubina', 'conducto hepatico', 'coledoco'],
    render: props => <GiChemicalDrop size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'anexas_vesicle',
    name: 'Vesícula Biliar / Concentración y Mucosa',
    category: 'anatomy',
    topic: 'anexas',
    keywords: ['anexas', 'vesicula biliar', 'mucosa plegada', 'senos de rokitansky-aschoff', 'colecistoquinina', 'concentracion biliar'],
    render: props => <GiWaterFlask size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'anexas_salivary',
    name: 'Glándulas Salivales Mayores (Parótida, etc.)',
    category: 'anatomy',
    topic: 'anexas',
    keywords: ['anexas', 'parotida', 'submandibular', 'sublingual', 'acinos serosos puros', 'semilunas de serous giannuzzi', 'salival'],
    render: props => <Droplets size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'anexas_target',
    name: 'Células Diana de Insulina y Glucagón',
    category: 'physiology',
    topic: 'anexas',
    keywords: ['anexas', 'receptores', 'insulina', 'glucogenogenesis', 'glucogenolisis', 'homeostasis glucosa'],
    render: props => <Target size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 17. 💧 SISTEMA URINARIO
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'kidneys',
    name: 'Riñones / Nefrona y Corpúsculo Renal',
    category: 'anatomy',
    topic: 'urinario',
    keywords: ['urinario', 'riñon', 'renal', 'nefrona', 'corteza renal', 'medula renal', 'piramides de malpighi', 'kidney'],
    render: props => <GiKidneys size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'filter',
    name: 'Filtración Glomerular / Podocitos y Pedicelos',
    category: 'physiology',
    topic: 'urinario',
    keywords: ['urinario', 'glomerulo', 'podocitos', 'ranura de filtracion', 'pedicelos', 'capsula de bowman', 'mesangio'],
    render: props => <Filter size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'funnel',
    name: 'Túbulos Contorneados y Colectores',
    category: 'anatomy',
    topic: 'urinario',
    keywords: ['urinario', 'tubulo contorneado proximal', 'asa de henle', 'tubulo distal', 'tubulo colector', 'caliz renal', 'pelvis renal'],
    render: props => <GiFunnel size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'urinario_urine',
    name: 'Ultrafiltrado Urinario / Excreción',
    category: 'physiology',
    topic: 'urinario',
    keywords: ['urinario', 'orina', 'ultrafiltrado', 'aclaramiento', 'reabsorcion de agua', 'aldosterona', 'adh'],
    render: props => <FaDroplet size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'urinario_urothelium',
    name: 'Urotelio / Epitelio de Transición',
    category: 'anatomy',
    topic: 'urinario',
    keywords: ['urinario', 'urotelio', 'epitelio de transicion', 'celulas en paraguas', 'placas uroplaquicas', 'vejiga', 'ureter'],
    render: props => <ShieldCheck size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'urinario_reabsorption',
    name: 'Reabsorción Tubular / Mecanismo Contracorriente',
    category: 'physiology',
    topic: 'urinario',
    keywords: ['urinario', 'mecanismo contracorriente', 'vasos rectos', 'intersticio medular hiperosmotico', 'transporte tubular'],
    render: props => <ArrowRightLeft size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 18. 🧬 SISTEMA REPRODUCTOR (MASCULINO Y FEMENINO)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'reproductor_male',
    name: 'Aparato Reproductor Masculino / Testículo',
    category: 'anatomy',
    topic: 'reproductor',
    keywords: ['reproductor', 'masculino', 'testiculo', 'espermatogenesis', 'tubulos seminiferos', 'sertoli', 'leydig', 'testosterona'],
    render: props => <FaMars size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'reproductor_female',
    name: 'Aparato Reproductor Femenino / Ovario',
    category: 'anatomy',
    topic: 'reproductor',
    keywords: ['reproductor', 'femenino', 'ovario', 'foliculos', 'trompas de falopio', 'utero', 'endometrio', 'cuerpo luteo'],
    render: props => <FaVenus size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'reproductor_venus_mars',
    name: 'Fecundación y Gametogénesis',
    category: 'physiology',
    topic: 'reproductor',
    keywords: ['reproductor', 'gametogenesis', 'meiosis', 'fecundacion', 'espermatozoide', 'ovocito', 'cigoto'],
    render: props => <FaVenusMars size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'reproductor_testis',
    name: 'Túbulos Seminíferos y Espermiogénesis',
    category: 'anatomy',
    topic: 'reproductor',
    keywords: ['reproductor', 'epididimo', 'estereocilios', 'conducto deferente', 'prostata', 'vesiculas seminales', 'esperma'],
    render: props => <TbGenderMale size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'reproductor_ovary',
    name: 'Folículos Ováricos (Primordial a Graaf)',
    category: 'anatomy',
    topic: 'reproductor',
    keywords: ['reproductor', 'foliculo de graaf', 'antro folicular', 'zona pelucida', 'corona radiata', 'teca interna', 'estrogenos'],
    render: props => <TbGenderFemale size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'reproductor_fetus',
    name: 'Desarrollo Embrionario e Implantación',
    category: 'anatomy',
    topic: 'reproductor',
    keywords: ['reproductor', 'embrion', 'feto', 'blastocisto', 'trofoblasto', 'placenta', 'vellosidades corionicas', 'implantacion'],
    render: props => <GiFetus size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'reproductor_uterus',
    name: 'Endometrio Uterino / Fase Proliferativa y Secretora',
    category: 'anatomy',
    topic: 'reproductor',
    keywords: ['reproductor', 'utero', 'endometrio', 'miometrio', 'glandulas endometriales', 'decidua', 'embarazo', 'ciclo menstrual'],
    render: props => <FaPersonPregnant size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'reproductor_egg_pod',
    name: 'Folículo Maduro y Ovulación',
    category: 'physiology',
    topic: 'reproductor',
    keywords: ['reproductor', 'ovulacion', 'cuerpo albicans', 'cuerpo luteo', 'progesterona', 'foliculo roto'],
    render: props => <GiEggPod size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'reproductor_oocyte',
    name: 'Ovocito Secundario y Zona Pelúcida',
    category: 'anatomy',
    topic: 'reproductor',
    keywords: ['reproductor', 'ovocito', 'ovulo', 'zona pelucida', 'reaccion acrosomica', 'polocito'],
    render: props => <GiRawEgg size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'dna',
    name: 'Genética Reproductiva y Meiosis',
    category: 'lab',
    topic: 'reproductor',
    keywords: ['reproductor', 'adn', 'cromosomas', 'recombinacion genetica', 'meiosis i', 'meiosis ii', 'haploide'],
    render: props => <GiDna1 size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 19. 🍼 GLÁNDULA MAMARIA
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'mamaria_lactating',
    name: 'Glándula Mamaria Activa / Lactancia',
    category: 'anatomy',
    topic: 'mamaria',
    keywords: ['mamaria', 'glandula mamaria', 'lactancia', 'alveolos mamarios', 'conductos galactoforos', 'oxitocina', 'prolactina'],
    render: props => <FaPersonBreastfeeding size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'mamaria_bottle',
    name: 'Conductos Galactóforos y Seno Lactífero',
    category: 'anatomy',
    topic: 'mamaria',
    keywords: ['mamaria', 'seno lactifero', 'conducto galactoforo', 'pezon', 'areola', 'secrecion lactea', 'leche materna'],
    render: props => <GiBabyBottle size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'mamaria_alveoli',
    name: 'Alvéolos Mamarios y Células Mioepiteliales',
    category: 'physiology',
    topic: 'mamaria',
    keywords: ['mamaria', 'alveolo mamario', 'celulas mioepiteliales', 'contraccion', 'eyeccion lactea', 'lobulillo mamario'],
    render: props => <TbBabyBottle size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'mamaria_milk',
    name: 'Secreción Apocrina (Lípidos) y Merocrina (Caseína)',
    category: 'physiology',
    topic: 'mamaria',
    keywords: ['mamaria', 'leche', 'caseina', 'globulo de grasa de la leche', 'secrecion apocrina', 'secrecion merocrina', 'colostro'],
    render: props => <TbMilk size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'child',
    name: 'Reflejo de Succión y Síntesis Láctea',
    category: 'clinical',
    topic: 'mamaria',
    keywords: ['mamaria', 'lactante', 'succion', 'arco reflejo neuroendocrino', 'hipotalamo', 'pecho'],
    render: props => <FaBaby size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'mamaria_secretion',
    name: 'Estroma Intralobulillar e Interlobulillar',
    category: 'anatomy',
    topic: 'mamaria',
    keywords: ['mamaria', 'estroma intralobulillar', 'estroma interlobulillar', 'tejido adiposo mamario', 'suspensorios de cooper'],
    render: props => <Droplets size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 20. 👁️ OJO Y SENTIDOS ESPECIALES
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'eye',
    name: 'Globo Ocular / Túnica Fibrosa, Vascular y Nerviosa',
    category: 'anatomy',
    topic: 'ojo',
    keywords: ['ojo', 'globo ocular', 'esclera', 'coroides', 'retina', 'cornea', 'vision', 'tunica fibrosa', 'eye'],
    render: props => <FaEye size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'eye_lucide',
    name: 'Medios Refringentes / Cristalino y Humor Vítreo',
    category: 'anatomy',
    topic: 'ojo',
    keywords: ['ojo', 'cristalino', 'humor vitreo', 'humor acuoso', 'camara anterior', 'camara posterior', 'refraccion'],
    render: props => <Eye size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'eyeball',
    name: 'Retina / 10 Capas y Fotorreceptores',
    category: 'anatomy',
    topic: 'ojo',
    keywords: ['ojo', 'retina', 'conos', 'bastones', 'celulas ganglionares', 'epitelio pigmentario de la retina', 'rodopsina', 'capas de la retina'],
    render: props => <GiEyeball size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'ojo_iris',
    name: 'Iris / Estroma Pigmentado y Cuerpo Ciliar',
    category: 'anatomy',
    topic: 'ojo',
    keywords: ['ojo', 'iris', 'cuerpo ciliar', 'procesos ciliares', 'humor acuoso', 'melanocitos', 'color de ojos'],
    render: props => <GiShinyIris size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'ojo_pupil',
    name: 'Pupila / Esfínter y Dilatador Pupilar',
    category: 'physiology',
    topic: 'ojo',
    keywords: ['ojo', 'pupila', 'esfinter pupilar', 'dilatador pupilar', 'reflejo fotomotor', 'miosis', 'midriasis'],
    render: props => <GiStarPupil size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'ojo_cornea',
    name: 'Córnea / Epitelio Anterior y Endotelio',
    category: 'anatomy',
    topic: 'ojo',
    keywords: ['ojo', 'cornea', 'membrana de bowman', 'estroma corneal', 'membrana de descemet', 'endotelio corneal', 'transparencia'],
    render: props => <GiMazeCornea size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'ojo_fovea',
    name: 'Fóvea Central y Agudeza Visual',
    category: 'physiology',
    topic: 'ojo',
    keywords: ['ojo', 'fovea', 'macula lutea', 'conos foveales', 'vision cromatica', 'agudeza visual', 'disco optico'],
    render: props => <Target size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'ojo_focus',
    name: 'Acomodación Cristaliniana / Zónula de Zinn',
    category: 'physiology',
    topic: 'ojo',
    keywords: ['ojo', 'acomodacion', 'zonula de zinn', 'musculo ciliar', 'enfoque', 'curvatura cristaliniana'],
    render: props => <Crosshair size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ÍCONOS DE LABORATORIO, TÉCNICA HISTOLÓGICA Y CLÍNICA
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'palette',
    name: 'Coloración y Tinciones Histológicas',
    category: 'lab',
    topic: 'all',
    keywords: ['tincion', 'colorante', 'hematoxilina', 'eosina', 'pas', 'tricromico', 'metacromasia', 'basofilia', 'eosinofilia'],
    render: props => <Palette size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'atom',
    name: 'Biología Celular y Molecular',
    category: 'lab',
    topic: 'all',
    keywords: ['atomo', 'molecular', 'molecula', 'bioquimica', 'estructura', 'organelo'],
    render: props => <Atom size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'dna2',
    name: 'Ácido Desoxirribonucleico (ADN)',
    category: 'lab',
    topic: 'all',
    keywords: ['adn', 'nucleo', 'cromatina', 'eucromatina', 'heterocromatina', 'genes'],
    render: props => <GiDna2 size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'virus_covid',
    name: 'Microbiología e Infección',
    category: 'lab',
    topic: 'linfoide',
    keywords: ['microbiologia', 'virus', 'infeccion', 'diagnostico'],
    render: props => <FaVirusCovid size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'safety_glasses',
    name: 'Seguridad en el Laboratorio',
    category: 'lab',
    topic: 'microscopios',
    keywords: ['seguridad', 'proteccion ocular', 'lentes', 'laboratorio', 'bioseguridad'],
    render: props => <GiProtectionGlasses size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'hospital',
    name: 'Hospital / Servicio de Patología',
    category: 'clinical',
    topic: 'all',
    keywords: ['hospital', 'clinica', 'patologia', 'biopsia', 'diagnostico'],
    render: props => <FaHospital size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'caduceus',
    name: 'Símbolo Médico / Vara de Esculapio',
    category: 'clinical',
    topic: 'all',
    keywords: ['medicina', 'simbolo', 'salud', 'asclepio', 'caduceo'],
    render: props => <FaStaffSnake size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'notes_medical',
    name: 'Informe Histopatológico',
    category: 'clinical',
    topic: 'all',
    keywords: ['informe', 'historia clinica', 'biopsia', 'diagnostico histologico'],
    render: props => <FaNotesMedical size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'badge_check',
    name: 'Criterio Verificado / Control de Calidad',
    category: 'clinical',
    topic: 'all',
    keywords: ['verificado', 'aprobado', 'diagnostico certero', 'control de calidad', 'check'],
    render: props => <BadgeCheck size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'star',
    name: 'Elemento Clave / Diagnóstico Diferencial',
    category: 'clinical',
    topic: 'all',
    keywords: ['estrella', 'clave', 'importante', 'patognomonico', 'destacado'],
    render: props => <Star size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'lightbulb',
    name: 'Tip Histológico / Correlación Clínica',
    category: 'clinical',
    topic: 'all',
    keywords: ['idea', 'tip', 'clave', 'nemotecnia', 'recordar', 'foco'],
    render: props => <Lightbulb size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'map_pin',
    name: 'Localización Histológica / Marcador',
    category: 'clinical',
    topic: 'all',
    keywords: ['marcador', 'localizacion', 'puntero', 'senalamiento', 'ubicacion'],
    render: props => <MapPin size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
  {
    id: 'sparkles',
    name: 'Especialización Tisular / Diferenciación',
    category: 'physiology',
    topic: 'all',
    keywords: ['especializacion', 'destacado', 'diferenciacion', 'maduracion', 'brillo', 'sparkles'],
    render: props => <Sparkles size={props.size || 18} color={props.color} className={props.className} style={props.style} />,
  },
];

// Mapa indexado por ID para renderizado O(1) de alto rendimiento
const ICONS_BY_ID = new Map<string, MedicalIconDefinition>(
  MEDICAL_ICONS_CATALOG.map(item => [item.id, item])
);

interface MedicalIconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

export const MedicalIcon: React.FC<MedicalIconProps> = ({
  name,
  size = 18,
  color,
  className,
  style,
  fallback,
}) => {
  const iconDef = ICONS_BY_ID.get(name);

  if (iconDef) {
    return iconDef.render({ size, color, className, style });
  }

  // Fallback si el ID no existe en el catálogo
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Activity
      size={size}
      color={color || '#059669'}
      className={className}
      style={style}
    />
  );
};

export default MedicalIcon;
