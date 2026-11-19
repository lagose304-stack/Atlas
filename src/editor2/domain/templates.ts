import {
  createAccordionBlock,
  createBadgeBlock,
  createBoxBlock,
  createButtonBlock,
  createCalloutBlock,
  createHeadingBlock,
  createIconBlock,
  createImageBlock,
  createLeafPlacedBlock,
  createNestedCanvasNode,
  createPlacedBlock,
  createTableBlock,
  createTextBlock,
} from './defaults';
import type { NestedCanvasNode, PlacedBlock } from './schema';

export type AtlasSectionTemplate = {
  id: string;
  name: string;
  category: 'Portadas' | 'Fundamentos' | 'Laboratorio';
  description: string;
  build: () => PlacedBlock;
};

/**
 * Catálogo inicial de 8 plantillas de sección 100 % editables construidas con
 * bloques componibles de Editor 2.0 (equivalentes editables a las plantillas del editor v1).
 */
export const ATLAS_SECTION_TEMPLATES: readonly AtlasSectionTemplate[] = [
  {
    id: 'weekly-publication',
    name: 'Publicación semanal',
    category: 'Portadas',
    description: 'Portada editorial con degradado suave, insignia de semana, micrografía y accesos a temas.',
    build: () => {
      const badge = createBadgeBlock({
        text: 'Publicación de la semana',
        variant: 'soft',
        color: '#0284c7',
        icon: 'calendar',
      });
      const title = createHeadingBlock({ level: 1, text: 'Tejidos destacados de la semana' });
      const intro = createTextBlock({
        text: 'Explora las placas seleccionadas para el repaso de esta semana y practica con los señalados.',
      });
      const btn1 = createButtonBlock({ label: 'Ver Temario', href: '/temario', variant: 'gradient', color: '#0284c7' });
      btn1.props.icon = 'book-open';
      const btn2 = createButtonBlock({ label: 'Evaluaciones', href: '/evaluaciones', variant: 'outline', color: '#0284c7' });
      btn2.props.icon = 'graduation-cap';

      const img = createImageBlock({
        alt: 'Placa destacada de la semana',
        caption: 'Micrografía destacada — haz clic para ampliar.',
        fit: 'cover',
        zoom: true,
      });
      img.props.media = {
        aspect: '4/3',
        radius: 16,
        overlayBadge: 'H&E · 40×',
        overlayPosition: 'tl',
      };

      const leftCol = createBoxBlock({
        gap: 'sm',
        style: { background: { type: 'none' }, padding: { mode: 'uniform', value: 8 } },
        children: [
          createLeafPlacedBlock(badge, 24),
          createLeafPlacedBlock(title, 24),
          createLeafPlacedBlock(intro, 24),
          createLeafPlacedBlock(btn1, 12),
          createLeafPlacedBlock(btn2, 12),
        ],
      });

      const section = createNestedCanvasNode({ gap: 'lg' });
      section.props.style = {
        background: {
          type: 'gradient',
          gradient: { kind: 'linear', angle: 135, stops: ['#f0f9ff', '#e0f2fe'] },
        },
        border: { width: 1, style: 'solid', color: '#bae6fd', sides: 'all' },
        radius: { mode: 'uniform', value: 20 },
        padding: { mode: 'uniform', value: 24 },
        shadow: 'soft',
      };
      section.slots.children.push(
        { block: leftCol, layout: { base: { span: 13, verticalAlign: 'center' } } },
        { block: img, layout: { base: { span: 11, verticalAlign: 'center' } } },
      );
      return createPlacedBlock(section);
    },
  },
  {
    id: 'exam-week',
    name: 'Semana de exámenes',
    category: 'Portadas',
    description: 'Bloque destacado de parcial con icono académico, aviso y botones directos a pruebas.',
    build: () => {
      const icon = createIconBlock({ name: 'graduation-cap', size: 36, color: '#6d28d9', frame: 'circle', align: 'center' });
      const badge = createBadgeBlock({ text: 'Parcial en curso', variant: 'solid', color: '#6d28d9', align: 'center' });
      const title = createHeadingBlock({ level: 2, text: 'Semana de exámenes · Repaso intensivo' });
      title.props.appearance = { align: 'center' };
      const desc = createTextBlock({
        text: 'Repasa las placas clave, compara estructuras similares y pon a prueba tu identificación antes del examen.',
      });
      desc.props.appearance = { align: 'center' };
      const btn = createButtonBlock({
        label: 'Ir a Evaluaciones',
        href: '/evaluaciones',
        variant: 'pill',
        color: '#6d28d9',
      });
      btn.props.icon = 'clipboard-list';
      btn.props.align = 'center';

      const section = createNestedCanvasNode({ gap: 'md' });
      section.props.style = {
        background: {
          type: 'gradient',
          gradient: { kind: 'linear', angle: 135, stops: ['#faf5ff', '#f0f9ff'] },
        },
        border: { width: 4, style: 'solid', color: '#6d28d9', sides: 'top' },
        radius: { mode: 'uniform', value: 18 },
        padding: { mode: 'uniform', value: 28 },
        shadow: 'medium',
      };
      section.slots.children.push(
        createLeafPlacedBlock(icon, 24),
        createLeafPlacedBlock(badge, 24),
        createLeafPlacedBlock(title, 24),
        createLeafPlacedBlock(desc, 24),
        { block: btn, layout: { base: { span: 8, start: 9 } } },
      );
      return createPlacedBlock(section);
    },
  },
  {
    id: 'histology-generalities',
    name: 'Generalidades del tejido',
    category: 'Fundamentos',
    description: 'Introducción, micrografía con etiqueta superpuesta y consejo de laboratorio.',
    build: () => {
      const badge = createBadgeBlock({ text: 'Generalidades', variant: 'soft', color: '#0284c7', icon: 'microscope' });
      const title = createHeadingBlock({ level: 2, text: 'Generalidades del tejido' });
      const intro = createTextBlock({
        text: 'Describe aquí el origen embrionario, la organización celular general y la idea clave para reconocerlo al microscopio.',
      });
      const tip = createCalloutBlock({
        tone: 'tip',
        title: 'Consejo de laboratorio',
        text: 'Observa primero a bajo aumento (4×–10×) para orientar la arquitectura antes de buscar detalles celulares.',
      });

      const img = createImageBlock({
        alt: 'Micrografía de referencia',
        caption: 'Vista panorámica representativa',
        fit: 'cover',
        zoom: true,
      });
      img.props.media = {
        aspect: '4/3',
        radius: 14,
        overlayBadge: 'H&E · 10×',
        overlayPosition: 'tr',
      };

      const leftBox = createBoxBlock({
        gap: 'sm',
        style: { background: { type: 'none' }, padding: { mode: 'uniform', value: 4 } },
        children: [
          createLeafPlacedBlock(badge, 24),
          createLeafPlacedBlock(title, 24),
          createLeafPlacedBlock(intro, 24),
          createLeafPlacedBlock(tip, 24),
        ],
      });

      const section = createNestedCanvasNode({ gap: 'md' });
      section.props.style = {
        background: { type: 'solid', color: '#ffffff' },
        border: { width: 1, style: 'solid', color: '#dbe7f3', sides: 'all' },
        radius: { mode: 'uniform', value: 18 },
        padding: { mode: 'uniform', value: 22 },
        shadow: 'soft',
      };
      section.slots.children.push(
        { block: leftBox, layout: { base: { span: 13, verticalAlign: 'center' } } },
        { block: img, layout: { base: { span: 11, verticalAlign: 'center' } } },
      );
      return createPlacedBlock(section);
    },
  },
  {
    id: 'histology-pillars',
    name: 'Tríada histológica (3 tarjetas)',
    category: 'Fundamentos',
    description: 'Función, criterios morfológicos y ubicaciones anatómicas en 3 tarjetas con borde superior.',
    build: () => {
      const makeCard = (
        iconName: string,
        color: string,
        heading: string,
        bullets: string,
      ) => {
        const list = createTextBlock({ text: bullets });
        list.props.appearance = { bullets: true, bulletStyle: 'check', bulletColor: color };
        return createBoxBlock({
          gap: 'sm',
          style: {
            background: { type: 'solid', color: '#ffffff' },
            border: { width: 4, style: 'solid', color, sides: 'top' },
            radius: { mode: 'uniform', value: 16 },
            padding: { mode: 'uniform', value: 18 },
            shadow: 'soft',
            motion: { hover: 'lift' },
          },
          children: [
            createLeafPlacedBlock(createIconBlock({ name: iconName, size: 28, color, frame: 'rounded' }), 24),
            createLeafPlacedBlock(createHeadingBlock({ level: 3, text: heading }), 24),
            createLeafPlacedBlock(list, 24),
          ],
        });
      };

      const section = createNestedCanvasNode({ gap: 'md' });
      section.slots.children.push(
        {
          block: makeCard('activity', '#0284c7', 'Función principal', 'Protección y barrera selectiva\nIntercambio y absorción\nSecreción especializada'),
          layout: { base: { span: 8 } },
        },
        {
          block: makeCard('clipboard-list', '#0f766e', 'Criterios morfológicos', 'Células estrechamente unidas\nPolaridad apical y basal\nDescansa sobre lámina basal'),
          layout: { base: { span: 8 } },
        },
        {
          block: makeCard('map-pin', '#6d28d9', 'Ubicaciones anatómicas', 'Revestimiento de cavidades\nSuperficie externa e interna\nParénquima de glándulas'),
          layout: { base: { span: 8 } },
        },
      );
      return createPlacedBlock(section);
    },
  },
  {
    id: 'histology-stains',
    name: 'Tinciones y colorimetría',
    category: 'Laboratorio',
    description: 'Muestras de color (H&E, PAS, Tricrómico) con micrografía y nota interpretativa.',
    build: () => {
      const title = createHeadingBlock({ level: 2, text: 'Tinciones histológicas y colorimetría' });
      const swatch1 = createBadgeBlock({ text: 'Hematoxilina: núcleos morados', variant: 'swatch', color: '#6d28d9' });
      const swatch2 = createBadgeBlock({ text: 'Eosina: citoplasma y colágeno rosa', variant: 'swatch', color: '#ec4899' });
      const swatch3 = createBadgeBlock({ text: 'PAS: glucógeno y mucinas magenta', variant: 'swatch', color: '#be185d' });
      const swatch4 = createBadgeBlock({ text: 'Masson: fibras de colágeno azul', variant: 'swatch', color: '#0284c7' });

      const note = createCalloutBlock({
        tone: 'info',
        title: 'Clave de colorimetría',
        text: 'Relaciona siempre el color dominante con la afinidad química (basofilia vs. acidofilia) de cada estructura.',
      });

      const section = createNestedCanvasNode({ gap: 'md' });
      section.props.style = {
        background: { type: 'solid', color: '#ffffff' },
        border: { width: 1, style: 'solid', color: '#ddd6fe', sides: 'all' },
        radius: { mode: 'uniform', value: 18 },
        padding: { mode: 'uniform', value: 22 },
        shadow: 'soft',
      };
      section.slots.children.push(
        createLeafPlacedBlock(title, 24),
        createLeafPlacedBlock(swatch1, 12),
        createLeafPlacedBlock(swatch2, 12),
        createLeafPlacedBlock(swatch3, 12),
        createLeafPlacedBlock(swatch4, 12),
        createLeafPlacedBlock(note, 24),
      );
      return createPlacedBlock(section);
    },
  },
  {
    id: 'histology-table',
    name: 'Tabla comparativa médica',
    category: 'Fundamentos',
    description: 'Encabezado con insignia y tabla comparativa estilizada (cebra + bordes).',
    build: () => {
      const badge = createBadgeBlock({ text: 'Cuadro comparativo', variant: 'soft', color: '#0369a1', icon: 'layers' });
      const title = createHeadingBlock({ level: 2, text: 'Diagnóstico diferencial' });
      const table = createTableBlock({
        headers: ['Tejido / Estructura', 'Rasgo distintivo', 'Tinción recomendada'],
        rows: [
          ['Epitelio simple plano', 'Núcleos aplanados en una sola capa', 'H&E'],
          ['Epitelio cilíndrico simple', 'Células altas con núcleos basales', 'H&E / PAS'],
          ['Epitelio pseudoestratificado', 'Núcleos a distintas alturas, cilios apicales', 'H&E'],
        ],
        accentColor: '#e0f2fe',
      });
      table.props.striped = true;
      table.props.bordered = true;

      const section: NestedCanvasNode = {
        ...createNestedCanvasNode({ gap: 'sm' }),
        slots: { children: [] },
      };
      section.slots.children.push(
        createLeafPlacedBlock(badge, 24),
        createLeafPlacedBlock(title, 24),
        createLeafPlacedBlock(table, 24),
      );
      return createPlacedBlock(section);
    },
  },
  {
    id: 'clinical-correlation',
    name: 'Correlación clínica / Dato extra',
    category: 'Laboratorio',
    description: 'Ficha clínica con borde lateral de acento, icono médico y micrografía.',
    build: () => {
      const icon = createIconBlock({ name: 'stethoscope', size: 28, color: '#0f766e', frame: 'circle' });
      const title = createHeadingBlock({ level: 3, text: 'Correlación clínica' });
      const body = createTextBlock({
        text: 'Explica aquí cómo la alteración histológica de este tejido se manifiesta en una patología o hallazgo diagnóstico.',
      });
      const img = createImageBlock({
        alt: 'Referencia clínica',
        caption: 'Ejemplo histopatológico',
        fit: 'cover',
        zoom: true,
      });
      img.props.media = { aspect: '4/3', radius: 12 };

      const textBox = createBoxBlock({
        gap: 'sm',
        style: { background: { type: 'none' }, padding: { mode: 'uniform', value: 4 } },
        children: [
          createLeafPlacedBlock(icon, 24),
          createLeafPlacedBlock(title, 24),
          createLeafPlacedBlock(body, 24),
        ],
      });

      const section = createNestedCanvasNode({ gap: 'md' });
      section.props.style = {
        background: { type: 'solid', color: '#f0fdfa' },
        border: { width: 5, style: 'solid', color: '#0f766e', sides: 'left' },
        radius: { mode: 'uniform', value: 14 },
        padding: { mode: 'uniform', value: 20 },
      };
      section.slots.children.push(
        { block: textBox, layout: { base: { span: 15, verticalAlign: 'center' } } },
        { block: img, layout: { base: { span: 9, verticalAlign: 'center' } } },
      );
      return createPlacedBlock(section);
    },
  },
  {
    id: 'weekly-fact-reveal',
    name: 'Dato histológico con pista',
    category: 'Laboratorio',
    description: 'Tarjeta interactiva de dato curioso con pista revelable al clic (modo Revelar pista).',
    build: () => {
      const badge = createBadgeBlock({ text: 'Dato histológico', variant: 'soft', color: '#b45309', icon: 'lightbulb' });
      const title = createHeadingBlock({ level: 3, text: '¿Sabías esto sobre este tejido?' });
      const text = createTextBlock({
        text: 'Escribe aquí un dato sorprendente o pregunta breve para despertar curiosidad antes de revelar la explicación.',
      });

      const answerSection = createNestedCanvasNode({
        children: [
          createLeafPlacedBlock(
            createTextBlock({
              text: 'Aquí aparece la pista o respuesta histológica detallada cuando el estudiante hace clic.',
            }),
            24,
          ),
        ],
      });
      const reveal = createAccordionBlock({
        items: [
          {
            title: 'Ver pista y explicación',
            openByDefault: false,
            children: [
              {
                block: answerSection,
                layout: { base: { span: 24 } },
              },
            ],
          },
        ],
        accentColor: '#b45309',
      });
      reveal.props.mode = 'reveal';

      const section: NestedCanvasNode = {
        ...createNestedCanvasNode({ gap: 'sm' }),
        slots: { children: [] },
      };
      section.props.style = {
        background: { type: 'solid', color: '#fffbeb' },
        border: { width: 1, style: 'solid', color: '#fde68a', sides: 'all' },
        radius: { mode: 'uniform', value: 18 },
        padding: { mode: 'uniform', value: 20 },
        shadow: 'soft',
      };
      section.slots.children.push(
        createLeafPlacedBlock(badge, 24),
        createLeafPlacedBlock(title, 24),
        createLeafPlacedBlock(text, 24),
        { block: reveal, layout: { base: { span: 24 } } },
      );
      return createPlacedBlock(section);
    },
  },
];
