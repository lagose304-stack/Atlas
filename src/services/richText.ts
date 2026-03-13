import DOMPurify from 'dompurify';

export const hasHtmlMarkup = (value: string) => /<[^>]+>/.test(value || '');

export const sanitizeRichText = (html: string): string => {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
  });
};

export const ensureLinkSafety = (html: string): string => {
  if (!html) return '';
  return html.replace(/<a\s/gi, '<a rel="noopener noreferrer" target="_blank" ');
};

export const toSafeHtml = (html: string): string => ensureLinkSafety(sanitizeRichText(html));
