import { ArrowRight, ChevronLeft, ChevronRight, ClipboardList, MoveHorizontal } from 'lucide-react';
import type { CSSProperties } from 'react';
import micrograph from '../../assets/imagenes/placa_817_cerebelo_miniatura.webp';
import { COMPONENT_TEMPLATE_FAMILIES, type IconTemplate, type TableTemplate } from '../domain/componentTemplates';
import { createLayoutIntent, EDITOR2_DEFAULT_IMAGE_SRC } from '../domain/defaults';
import type { BlockStyle, MediaAppearance } from '../domain/styleSchema';
import { weeklyButtonDestination } from '../domain/weeklyButtonDestination';
import { blockStyleToCss, buttonStyleToCss, mediaImageStyle, mediaStageStyle } from '../domain/styleToCss';
import BlockTemplateGallery from './BlockTemplateGallery';
import { CalloutBlockView, DividerBlockView, IconBlockView, TableBlockView } from './Editor2Blocks';
import { renderAtlasIcon } from './IconPickerModal';
import WeeklyButtonContent from './WeeklyButtonContent';

const labels = {
  icon: 'Plantillas de icono',
  callout: 'Plantillas de nota / aviso',
  table: 'Plantillas de tabla',
  button: 'Plantillas de botón',
  divider: 'Plantillas de separador',
  examCarousel: 'Plantillas de pruebas por parcial',
  image: 'Plantillas de imagen',
  carousel: 'Plantillas de carrusel',
  compare: 'Plantillas de comparador',
};

export type ContentTemplateType = keyof typeof labels;
const previewLayout = createLayoutIntent();

type Props = {
  type: ContentTemplateType;
  properties: Record<string, unknown>;
  style: BlockStyle;
  onApply: (style: BlockStyle, patch: Record<string, unknown>) => void;
  onRequestWeeklyButton?: () => void;
};

export default function ContentTemplateGallery({ type, properties, style, onApply, onRequestWeeklyButton }: Props) {
  return <BlockTemplateGallery label={labels[type]} variant={type}
    templates={COMPONENT_TEMPLATE_FAMILIES.map(family => {
      if (type === 'image' || type === 'carousel' || type === 'compare') {
        const { media: suggestedMedia, surface, wideAspect } = family.photo;
        const media = { ...suggestedMedia, aspect: type === 'image' ? suggestedMedia.aspect : wideAspect };
        const current = properties.media as MediaAppearance | undefined;
        const fit = properties.fit === 'cover' ? 'cover' : 'contain';
        const imageStyle = mediaImageStyle(fit, current);
        return {
          label: family.label,
          sample: (
            <span className="e2-photo-template" style={{ ...blockStyleToCss(surface), padding: surface.padding.value / 2 }}>
              <span className="e2-photo-template__stage" style={mediaStageStyle(media, type === 'carousel' ? '4/3' : undefined)}>
                <img src={micrograph} alt="" loading="lazy" draggable={false} style={imageStyle} />
                {type === 'carousel' && (
                  <>
                    <span className="e2-photo-template__controls"><ChevronLeft size={13} /><ChevronRight size={13} /></span>
                    <span className="e2-photo-template__dots"><i /><i /><i /></span>
                  </>
                )}
                {type === 'compare' && (
                  <>
                    <span className="e2-photo-template__detail">
                      <img src={micrograph} alt="" loading="lazy" draggable={false} style={imageStyle} />
                    </span>
                    <span className="e2-photo-template__split"><MoveHorizontal size={13} /></span>
                  </>
                )}
              </span>
              {media.showCaption && <span className="e2-photo-template__caption" style={{ textAlign: media.captionAlign }}>Cerebelo</span>}
            </span>
          ),
          active: (current?.aspect ?? 'auto') === media.aspect && (current?.radius ?? 0) === media.radius &&
            current?.stageBackground === media.stageBackground && current?.captionAlign === media.captionAlign &&
            (current?.showCaption ?? true) === media.showCaption && matchesSurface(style, surface),
          onSelect: () => onApply({ ...style, ...surface }, { media: { ...current, ...media } }),
        };
      }
      if (type === 'button') {
        const { variant, color, icon } = family.button;
        return {
          label: family.label,
          sample: <span className={`e2-cta-btn e2-cta-btn--${variant}`} style={buttonStyleToCss(variant, color)}>
            {variant === 'weekly' ? (
              <WeeklyButtonContent thumbnailSrc={EDITOR2_DEFAULT_IMAGE_SRC} icon={icon}>
                <span className="e2-weekly-button__label">Ver lámina</span>
              </WeeklyButtonContent>
            ) : <>{icon && renderAtlasIcon(icon, 13)} Ver lámina</>}
          </span>,
          active: (properties.variant ?? 'solid') === variant && properties.color === color && properties.icon === icon &&
            (variant !== 'weekly' || (typeof properties.href === 'string' && !!weeklyButtonDestination(properties.href))),
          onSelect: () => {
            if (variant === 'weekly') onRequestWeeklyButton?.();
            else onApply(style, { variant, color, icon });
          },
        };
      }
      if (type === 'divider') {
        const divider = family.divider;
        return {
          label: family.label,
          sample: <DividerBlockView layout={previewLayout} {...divider}
            orientation={properties.orientation === 'vertical' ? 'vertical' : 'horizontal'} />,
          active: (properties.lineStyle ?? 'solid') === divider.lineStyle && properties.color === divider.color &&
            (properties.thickness ?? 2) === divider.thickness && (properties.widthPercent ?? 100) === divider.widthPercent,
          onSelect: () => onApply(style, divider),
        };
      }
      if (type === 'examCarousel') {
        const { accentColor, surface } = family.examCarousel;
        return {
          label: family.label,
          sample: <span className="e2-exam-template-preview"
            style={{ ...blockStyleToCss(surface), padding: undefined, '--e2-exam-accent': accentColor } as CSSProperties}>
            <span className="e2-exam-template-preview__title">
              <span className="e2-exam-head__icon"><ClipboardList size={12} /></span> Evaluaciones
            </span>
            <span className="e2-exam-card">
              <span className="e2-exam-card__name">Epitelio</span>
              <span className="e2-exam-card__cta">Iniciar <ArrowRight size={10} /></span>
            </span>
          </span>,
          active: properties.accentColor === accentColor && matchesSurface(style, surface),
          onSelect: () => onApply({ ...style, ...surface }, { accentColor }),
        };
      }
      if (type === 'icon') {
        const icon: IconTemplate = family.icon;
        return {
          label: family.label,
          sample: <IconBlockView layout={previewLayout} {...icon} />,
          active: properties.name === icon.name && properties.size === icon.size && properties.color === icon.color &&
            properties.frame === icon.frame && properties.bgColor === icon.bgColor,
          onSelect: () => onApply(style, { ...icon, bgColor: icon.bgColor }),
        };
      }
      if (type === 'table') {
        const table: TableTemplate = family.table;
        return {
          label: family.label,
          sample: <TableBlockView layout={previewLayout} headers={['Tejido', 'Rasgo']}
            rows={ [['Epitelio', 'Capas'], ['Conectivo', 'Matriz']] } {...table} />,
          active: properties.accentColor === table.accentColor && Boolean(properties.striped) === table.striped &&
            Boolean(properties.compact) === table.compact && Boolean(properties.bordered) === table.bordered,
          onSelect: () => onApply(style, table),
        };
      }
      const { tone, surface } = family.note;
      return {
        label: family.label,
        sample: <CalloutBlockView layout={previewLayout} tone={tone} title="En la lámina" text="Observa el tejido."
          blockStyle={{ ...surface, padding: undefined }} />,
        active: (properties.tone ?? 'info') === tone && matchesSurface(style, surface),
        onSelect: () => onApply({ ...style, ...surface }, { tone }),
      };
    })} />;
}

function matchesSurface(style: BlockStyle, surface: BlockStyle): boolean {
  return JSON.stringify([style.background, style.border, style.radius, style.padding]) ===
    JSON.stringify([surface.background, surface.border, surface.radius, surface.padding]);
}
