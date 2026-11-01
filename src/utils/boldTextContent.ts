/** Texto legible para canvas, ayudas y anuncios sin marcas de negrita. */
export const boldTextContent = (value: string): string => value.replace(/\*\*([\s\S]*?)\*\*/g, '$1');
