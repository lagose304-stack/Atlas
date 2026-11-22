import { COMPONENT_TEMPLATE_FAMILIES } from '../domain/componentTemplates';
import { patchResponsiveOverride } from '../domain/responsive';
import type { TextAppearance } from '../domain/schema';
import type { BlockStyle } from '../domain/styleSchema';
import { blockStyleToCss } from '../domain/styleToCss';
import BlockTemplateGallery from './BlockTemplateGallery';

type Props = {
  style: BlockStyle;
  appearance: TextAppearance;
  variant: 'heading' | 'paragraph';
  themeFont?: string;
  onApply: (style: BlockStyle, appearance: TextAppearance) => void;
};

export default function TextTemplateGallery({ style, appearance, variant, themeFont, onApply }: Props) {
  const { background, border, radius, padding, shadow, shadowColor, backdropBlur, textSize, responsive, ...otherStyle } = style;
  const { font, color, size, ...otherAppearance } = appearance;
  const automaticResponsive = patchResponsiveOverride(
    patchResponsiveOverride(responsive, 'mobile', 'textSize', undefined), 'tablet', 'textSize', undefined,
  );
  const currentSurface = blockStyleToCss({ background, border, radius, padding, shadow, shadowColor, backdropBlur });
  const hasFixedSize = typeof textSize === 'number' || typeof responsive?.mobile?.textSize === 'number' ||
    typeof responsive?.tablet?.textSize === 'number' || size !== undefined;
  const isHeading = variant === 'heading';
  const templates = COMPONENT_TEMPLATE_FAMILIES.map(({ label, surface: paragraphSurface, type, headingSurface }) => {
    const surface = isHeading ? headingSurface ?? {} : paragraphSurface;
    const preview = blockStyleToCss(surface);
    return {
      label,
      active: !hasFixedSize && font === type.font && color === type.color &&
        JSON.stringify(currentSurface) === JSON.stringify(preview),
      sample: isHeading ? 'Epitelio simple' : 'Observa la forma de las células.',
      sampleStyle: { ...preview, padding: undefined, color: type.color, fontFamily: type.font ?? themeFont },
      onSelect: () => onApply(
        { ...otherStyle, ...(automaticResponsive && { responsive: automaticResponsive }), ...surface },
        { ...otherAppearance, ...type },
      ),
    };
  });
  return <BlockTemplateGallery label={isHeading ? 'Plantillas de título' : 'Plantillas de párrafo'}
    variant={variant} templates={templates} />;
}
