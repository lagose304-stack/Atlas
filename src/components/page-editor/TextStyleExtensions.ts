import { Extension } from '@tiptap/core';

export const TextStyleCustomAttributes = Extension.create({
  name: 'textStyleCustomAttributes',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize || null,
            renderHTML: attributes => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
          fontFamily: {
            default: null,
            parseHTML: element => element.style.fontFamily || null,
            renderHTML: attributes => attributes.fontFamily ? { style: `font-family: ${attributes.fontFamily}` } : {},
          },
          fontWeight: {
            default: null,
            parseHTML: element => element.style.fontWeight || null,
            renderHTML: attributes => attributes.fontWeight ? { style: `font-weight: ${attributes.fontWeight}` } : {},
          },
          lineHeight: {
            default: null,
            parseHTML: element => element.style.lineHeight || null,
            renderHTML: attributes => attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
          },
          letterSpacing: {
            default: null,
            parseHTML: element => element.style.letterSpacing || null,
            renderHTML: attributes => attributes.letterSpacing ? { style: `letter-spacing: ${attributes.letterSpacing}` } : {},
          },
          textTransform: {
            default: null,
            parseHTML: element => element.style.textTransform || null,
            renderHTML: attributes => attributes.textTransform ? { style: `text-transform: ${attributes.textTransform}` } : {},
          },
          textStrokeColor: {
            default: null,
            parseHTML: element => element.style.webkitTextStrokeColor || null,
            renderHTML: attributes => attributes.textStrokeColor ? { style: `-webkit-text-stroke-color: ${attributes.textStrokeColor}` } : {},
          },
          textStrokeWidth: {
            default: null,
            parseHTML: element => element.style.webkitTextStrokeWidth || null,
            renderHTML: attributes => attributes.textStrokeWidth ? { style: `-webkit-text-stroke-width: ${attributes.textStrokeWidth}; paint-order: stroke fill` } : {},
          },
        },
      },
    ];
  },
});
