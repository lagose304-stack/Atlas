import React, { useState } from 'react';
import {
  HistologyGeneralitiesBlock,
  HistologyFunctionBlock,
  HistologyMorphologyBlock,
  HistologyLocationsBlock,
  HistologyStainsBlock,
} from './histology-blocks';
import { BookOpen, Zap, Microscope, MapPin, Palette, Images, Layers, type LucideIcon } from 'lucide-react';
import '../styles/histologyGuide.css';

export type PillarTab = 'generalidades' | 'funcion' | 'morfologia' | 'ubicaciones' | 'tinciones' | 'placas';

interface HistologyStudyGuideProps {
  subtemaId?: number | string;
  subtemaNombre?: string;
  temaNombre?: string;
  placasCount?: number;
  referenceImageUrl?: string;
  children?: React.ReactNode;
}

export const HistologyStudyGuide: React.FC<HistologyStudyGuideProps> = ({
  subtemaNombre = 'Epitelio Plano Simple',
  temaNombre = 'Epitelios',
  placasCount = 0,
  referenceImageUrl,
  children,
}) => {
  const [activeTab, setActiveTab] = useState<PillarTab>('generalidades');

  const tabs: Array<{ id: PillarTab; label: string; icon: LucideIcon; count: number }> = [
    { id: 'generalidades', label: 'Generalidades', icon: BookOpen, count: 4 },
    { id: 'funcion', label: 'Función', icon: Zap, count: 1 },
    { id: 'morfologia', label: 'Morfología', icon: Microscope, count: 5 },
    { id: 'ubicaciones', label: 'Ubicaciones', icon: MapPin, count: 5 },
    { id: 'tinciones', label: 'Tinciones', icon: Palette, count: 5 },
    { id: 'placas', label: 'Placas', icon: Images, count: placasCount },
  ];

  return (
    <section aria-label="Suite interactiva de fundamentos histológicos" className="atlas-guide-wrapper">
      {/* Barra de Navegación Estética de Pestañas */}
      <nav aria-label="Secciones del subtema" className="atlas-interactive-navbar">
        <div className="atlas-nav-tabs-row">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`atlas-nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                <span className="atlas-btn-badge">{tab.count}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 0. Pestaña: Generalidades del Tejido */}
      {activeTab === 'generalidades' && (
        <HistologyGeneralitiesBlock
          title={`Generalidades del ${subtemaNombre}`}
          badgeText={`Introducción & Fundamento Teórico · ${temaNombre}`}
          introText={`El **${subtemaNombre}** (o pavimentoso simple) es la variedad más delgada y especializada en permeabilidad de los epitelios de revestimiento. Se caracteriza por una **única capa continua de células aplanadas** en forma de baldosa, con escasísima sustancia intercelular y una fuerte adhesión lateral mediada por complejos de unión.`}
          keyPoints={[
            {
              label: 'Origen Embriológico Tridérmico',
              content: 'Deriva de las **tres hojas germinativas**: *Mesodermo* (origina el endotelio vascular y mesotelio seroso), *Endodermo* (alvéolos pulmonares) y *Ectodermo* (revestimiento posterior de la córnea).',
              icon: 'dna',
            },
            {
              label: 'Avascularidad & Difusión',
              content: 'Como todo epitelio, **carece de vasos sanguíneos propios**. Su metabolismo y nutrición dependen enteramente de la difusión pasiva desde los capilares del tejido conectivo subepitelial a través de la lámina basal.',
              icon: 'shield',
            },
            {
              label: 'Polaridad Celular Marcada',
              content: 'Presenta tres dominios morfológicos y funcionales definidos: **apical** (libre en contacto con la luz o cavidad), **lateral** (con zónulas ocluyentes y desmosomas) y **basal** (anclado por hemidesmosomas a la lámina basal).',
              icon: 'compass',
            },
            {
              label: 'Nomenclatura Médica Específica',
              content: 'Recibe denominaciones anatómicas clásicas: **Endotelio** cuando recubre la luz de vasos sanguíneos y linfáticos, y **Mesotelio** cuando tapiza las cavidades corporales cerradas (pleura, pericardio, peritoneo).',
              icon: 'sparkles',
            },
          ]}
          labTip="Regla de Oro en el Microscopio: Debido a su mínimo espesor, en cortes teñidos con H&E a menudo solo es evidente la hilera de núcleos basófilos aplanados que sobresalen hacia la luz, asemejando un fino collar de cuentas."
          imageUrl={referenceImageUrl}
        />
      )}

      {/* 1. Pestaña: Función Principal & Mecanismos */}
      {activeTab === 'funcion' && (
        <HistologyFunctionBlock
          title={`Intercambio Rápido y Difusión de Sustancias en ${subtemaNombre}`}
          badgeText={`Función Principal · ${temaNombre}`}
          description="La arquitectura de **monocapa celular ultrafina** (< 0.2 µm de grosor) minimiza la barrera de resistencia física, permitiendo una difusión pasiva inmediata de gases respiratorios (**O₂ y CO₂**) y el filtrado libre de agua y solutos plasmáticos. En los capilares sanguíneos, se complementa con **transporte transcelular activo** por vesículas de pinocitosis."
          features={[
            {
              title: 'Difusión de Gases Respiratorios (Hematosis)',
              detail: 'Intercambio pasivo ultrarrápido a favor de gradiente de concentración en alvéolos y capilares sin gasto energético.',
              icon: 'wind',
            },
            {
              title: 'Ultrafiltración Renal Glomerular',
              detail: 'Paso libre de agua y metabolitos hacia el espacio de Bowman reteniendo células sanguíneas y macromoléculas.',
              icon: 'droplets',
            },
            {
              title: 'Transporte Transcelular por Pinocitosis',
              detail: 'Transcitosis de solutos y lipoproteínas a través del citoplasma endotelial mediante vesículas de membrana.',
              icon: 'transcellular',
            },
            {
              title: 'Mínima Resistencia y Fricción Visceral',
              detail: 'Secreción serosa que lubrica y reduce el rozamiento en órganos en constante movimiento (corazón, pulmones, intestinos).',
              icon: 'shield',
            },
          ]}
          clinicalNote="Relevancia Fisiológica: El epitelio plano simple es el tejido más eficiente del organismo humano para el transporte pasivo. Cualquier alteración de su espesor basal o edema tisular compromete directamente el intercambio de oxígeno y la filtración renal."
          imageUrl={referenceImageUrl}
        />
      )}

      {/* 2. Pestaña: Criterios Morfológicos de Identificación */}
      {activeTab === 'morfologia' && (
        <HistologyMorphologyBlock
          title={`Criterios Morfológicos de ${subtemaNombre}`}
          badgeText={`Diagnóstico Microscópico · ${temaNombre}`}
          introText={`Para el reconocimiento preciso del **${subtemaNombre}** en cortes histológicos de laboratorio, se deben verificar sistemáticamente los siguientes **5 criterios morfológicos esenciales**:`}
          items={[
            {
              number: '01',
              title: 'Monocapa de Células Pavimentosas',
              description: 'Una única hilera celular continua de células aplanadas como escamas o baldosas. Su **diámetro y longitud lateral** superan ampliamente su altura.',
            },
            {
              number: '02',
              title: 'Núcleos Ovales Aplanados y Centrales',
              description: 'Núcleos de **cromatina condensada** orientados horizontalmente en paralelo a la base, produciendo una **protuberancia apical visible a x40**.',
            },
            {
              number: '03',
              title: 'Citoplasma Atenuado y Delgado',
              description: 'El citoplasma lateral es sumamente escaso y delgado, resultando **casi imperceptible** al microscopio de luz con tinciones rutinarias.',
            },
            {
              number: '04',
              title: 'Complejos de Unión Ocluyentes Estrechos',
              description: 'Células selladas en sus caras laterales por **zónulas ocluyentes** (*tight junctions*) que regulan estrictamente el flujo paracelular.',
            },
            {
              number: '05',
              title: 'Adhesión a Lámina Basal Continua',
              description: 'Se ancla con hemidesmosomas sobre una **membrana basal delgada** que le brinda soporte y permite su nutrición por difusión subepitelial.',
            },
          ]}
          examTip="Regla de Diagnóstico en Examen Práctico: Para identificar rápidamente un epitelio plano simple a x40, busca una hilera continua de núcleos aplanados que sobresalen hacia una luz o espacio vacío como si fueran pequeños huevos fritos o cuentas de un collar."
          imageUrl={referenceImageUrl}
        />
      )}

      {/* 3. Pestaña: Ubicaciones Anatómicas */}
      {activeTab === 'ubicaciones' && (
        <HistologyLocationsBlock
          title={`Distribución y Ubicaciones Anatómicas de ${subtemaNombre}`}
          badgeText={`Atlas Anatómico · ${temaNombre}`}
          introText={`El **${subtemaNombre}** se distribuye estratégicamente en órganos y regiones donde se requiere una **barrera de difusión mínima** o una **superficie lisa de baja fricción** para el desplazamiento de fluidos o vísceras:`}
          items={[
            {
              number: '01',
              organ: 'Endotelio Vascular (Capilares, Arterias y Venas)',
              system: 'Sistema Cardiovascular y Linfático',
              detail: 'Recubre la superficie interna de **todos los vasos sanguíneos** y las cavidades cardíacas (endocardio), regulando el intercambio metabólico, la permeabilidad capilar y previniendo la trombosis intravascular.',
            },
            {
              number: '02',
              organ: 'Mesotelio de Cavidades Serosas',
              system: 'Pleura, Pericardio y Peritoneo',
              detail: 'Tapiza las grandes cavidades celómicas cerradas y reviste los órganos viscerales, secretando una fina película de **líquido seroso lubricante** que reduce al mínimo la fricción durante la motilidad cardíaca, pulmonar e intestinal.',
            },
            {
              number: '03',
              organ: 'Alvéolos Pulmonares (Neumocitos Tipo I)',
              system: 'Aparato Respiratorio',
              detail: 'Cubre más del **95% de la superficie de los alvéolos**, integrando junto al endotelio capilar la delgadísima **barrera hematogaseosa** indispensable para la hematosis rápida sin gasto energético.',
            },
            {
              number: '04',
              organ: 'Cápsula de Bowman (Hoja Parietal)',
              system: 'Aparato Urinario (Corteza Renal)',
              detail: 'Constituye la pared externa del corpúsculo renal en la corteza, delimitando el **espacio capsular urinario** donde se recoge y canaliza el ultrafiltrado de plasma hacia el túbulo contorneado proximal.',
            },
            {
              number: '05',
              organ: 'Rama Delgada del Asa de Henle',
              system: 'Aparato Urinario (Médula Renal)',
              detail: 'Segmento tubular en horquilla localizado en la médula renal profunda, cuya pared ultrafina permite el **transporte pasivo de agua y solutos** esencial para el mecanismo multiplicador de contracorriente y concentración urinaria.',
            },
          ]}
          mnemoticTip="Regla Mnemotécnica: Recuerda los 4 grandes territorios del Plano Simple con la regla de las 4 cavidades críticas: Vasos (Endotelio), Serosas (Mesotelio), Pulmón (Alvéolo) y Riñón (Bowman y Asa de Henle)."
          imageUrl={referenceImageUrl}
        />
      )}

      {/* 4. Pestaña: Tinciones Histológicas */}
      {activeTab === 'tinciones' && (
        <HistologyStainsBlock
          title={`Tinciones Histológicas y Colorimetría para ${subtemaNombre}`}
          badgeText={`Colorimetría & Laboratorio · ${temaNombre}`}
          introText={`Para el análisis morfológico e histoquímico del **${subtemaNombre}**, se emplean diversas técnicas de coloración según el elemento tisular que se desee contrastar:`}
          items={[
            {
              number: '01',
              name: 'Hematoxilina y Eosina (H&E)',
              category: 'Tinción Topográfica Rutinaria',
              result: 'Tiñe los **núcleos aplanados de color morado/azul basófilo intenso** y el escaso citoplasma laminar de color rosa acidófilo claro, permitiendo reconocer la monocapa celular de inmediato.',
            },
            {
              number: '02',
              name: 'Impregnación Argéntica (Plata de Gomori)',
              category: 'Tinción Metálica Especial',
              result: 'Precipita sales de plata en el cemento intercelular y las fibras reticulares, delineando nítidamente los **límites celulares en forma de mosaico o panal de abejas** en montajes en bloque de mesotelio.',
            },
            {
              number: '03',
              name: 'Tricrómico de Masson',
              category: 'Tinción Tricrómica Diferencial',
              result: 'Diferencia con gran nitidez el **epitelio celular (rojo-rosado)** de las fibras colágenas de la lámina propia subyacente (**azul brillante o verde**), ideal para evaluar fibrosis basal.',
            },
            {
              number: '04',
              name: 'Ácido Periódico de Schiff (PAS)',
              category: 'Histoquímica de Carbohidratos',
              result: 'Oxida los grupos glicol tiñendo fuertemente de **color fucsia-magenta brillante la lámina basal continua** y el glucocáliz celular, verificando la integridad del anclaje epitelial.',
            },
            {
              number: '05',
              name: 'Azul de Toluidina (Cortes Semifinos)',
              category: 'Tinción Metacromática de Alta Resolución',
              result: 'Proporciona **máxima nitidez óptica en aumentos de 100x**, permitiendo delimitar con precisión las vesículas pinocíticas endoteliales y los complejos de unión laterales.',
            },
          ]}
          colorKeyTip="Clave de Laboratorio: En la tinción rutinaria H&E, la clave diagnóstica es contrastar el morado basófilo nuclear con la luz luminal adyacente. Para evaluar la membrana basal se prefiere siempre PAS o Masson."
          imageUrl={referenceImageUrl}
        />
      )}

      {/* 5. Pestaña: Galería de Placas */}
      {activeTab === 'placas' && (
        <div
          style={{
            position: 'relative',
            borderRadius: '24px',
            background: 'linear-gradient(180deg, #ffffff 0%, #f6faff 100%)',
            border: '1.5px solid rgba(186, 230, 253, 0.95)',
            borderLeft: '6px solid #0284c7',
            padding: 'clamp(20px, 3vw, 32px)',
            boxShadow: '0 12px 34px rgba(2, 132, 199, 0.06), inset 0 1px 0 #ffffff',
            fontFamily: '"Montserrat", "Segoe UI", sans-serif',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Cabecera de la Pestaña Placas */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              paddingBottom: '16px',
              borderBottom: '1px solid #e0f2fe',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#0284c7',
                  background: '#e0f2fe',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                }}
              >
                <Layers size={13} />
                <span>Microscopía Óptica & Preparaciones</span>
              </span>
            </div>

            <h3
              style={{
                margin: 0,
                fontSize: 'clamp(1.2rem, 2.2vw, 1.55rem)',
                fontWeight: 850,
                color: '#0f2a43',
                letterSpacing: '-0.025em',
              }}
            >
              Galería de Placas Histológicas de {subtemaNombre}
            </h3>

            <div style={{ fontSize: '0.92rem', color: '#475569', lineHeight: 1.6 }}>
              Explora los cortes histológicos reales disponibles en diferentes aumentos ópticos (x10, x40, x100) y tinciones especiales para este subtema.
            </div>
          </div>

          {/* Galería de Placas */}
          {children ? (
            children
          ) : (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#64748b',
                background: '#f8fafc',
                borderRadius: '16px',
                border: '1px dashed #cbd5e1',
                fontSize: '0.9rem',
              }}
            >
              No hay placas registradas para este subtema aún.
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default HistologyStudyGuide;
