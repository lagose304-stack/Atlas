import React, { type CSSProperties, type ReactNode } from 'react';
import { z } from 'zod';
import { hexColorSchema } from './styleSchema';

export const richTextV1Schema = z.strictObject({
  format: z.literal('plain'),
  value: z.string(),
});

export const textRunSchema = z.strictObject({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  color: hexColorSchema.optional(),
  highlight: hexColorSchema.optional(),
  href: z.string().max(500).optional(),
  newTab: z.boolean().optional(),
  sub: z.boolean().optional(),
  sup: z.boolean().optional(),
});

export const richTextV2Schema = z.strictObject({
  format: z.literal('rich'),
  runs: z.array(textRunSchema),
});

export const richTextSchema = z.union([richTextV1Schema, richTextV2Schema]);

export type RichTextV1 = z.infer<typeof richTextV1Schema>;
export type TextRun = z.infer<typeof textRunSchema>;
export type RichTextV2 = z.infer<typeof richTextV2Schema>;
export type RichTextValue = z.infer<typeof richTextSchema>;

export function isRichTextV2(value: unknown): value is RichTextV2 {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { format?: unknown }).format === 'rich' &&
      Array.isArray((value as { runs?: unknown }).runs),
  );
}

export function richTextToPlain(value: RichTextValue | string | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value.format === 'plain') return value.value;
  return value.runs.map((run) => run.text).join('');
}

export function sanitizeSafeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:') {
      return trimmed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function sameMarks(a: TextRun, b: TextRun): boolean {
  return (
    Boolean(a.bold) === Boolean(b.bold) &&
    Boolean(a.italic) === Boolean(b.italic) &&
    Boolean(a.underline) === Boolean(b.underline) &&
    Boolean(a.strike) === Boolean(b.strike) &&
    (a.color ?? '') === (b.color ?? '') &&
    (a.highlight ?? '') === (b.highlight ?? '') &&
    (a.href ?? '') === (b.href ?? '') &&
    Boolean(a.newTab) === Boolean(b.newTab) &&
    Boolean(a.sub) === Boolean(b.sub) &&
    Boolean(a.sup) === Boolean(b.sup)
  );
}

export function normalizeRichTextRuns(runs: TextRun[]): TextRun[] {
  const merged: TextRun[] = [];
  for (const raw of runs) {
    if (!raw.text) continue;
    const clean: TextRun = { text: raw.text };
    if (raw.bold) clean.bold = true;
    if (raw.italic) clean.italic = true;
    if (raw.underline) clean.underline = true;
    if (raw.strike) clean.strike = true;
    if (raw.color && /^#[0-9a-f]{6}$/i.test(raw.color)) clean.color = raw.color;
    if (raw.highlight && /^#[0-9a-f]{6}$/i.test(raw.highlight)) clean.highlight = raw.highlight;
    const safeHref = sanitizeSafeHref(raw.href);
    if (safeHref) {
      clean.href = safeHref;
      if (raw.newTab) clean.newTab = true;
    }
    if (raw.sub) clean.sub = true;
    else if (raw.sup) clean.sup = true;

    const prev = merged[merged.length - 1];
    if (prev && sameMarks(prev, clean)) {
      prev.text += clean.text;
    } else {
      merged.push(clean);
    }
  }
  return merged;
}

export function hasRichMarks(runs: TextRun[]): boolean {
  return runs.some(
    (run) =>
      run.bold ||
      run.italic ||
      run.underline ||
      run.strike ||
      run.color ||
      run.highlight ||
      run.href ||
      run.sub ||
      run.sup,
  );
}

export function sanitizeRichTextV2(value: unknown): RichTextV2 | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const parsed = richTextV2Schema.safeParse(value);
  if (!parsed.success) return undefined;
  const runs = normalizeRichTextRuns(parsed.data.runs);
  return { format: 'rich', runs };
}

type TiptapMarkJson = {
  type: string;
  attrs?: Record<string, unknown>;
};

type TiptapNodeJson = {
  type: string;
  text?: string;
  marks?: TiptapMarkJson[];
  content?: TiptapNodeJson[];
};

export function runsToTiptapDoc(value: RichTextValue | string): TiptapNodeJson {
  const runs: TextRun[] =
    typeof value === 'string'
      ? value
        ? [{ text: value }]
        : []
      : value.format === 'plain'
        ? value.value
          ? [{ text: value.value }]
          : []
        : value.runs;

  const paragraphs: TiptapNodeJson[] = [];
  let currentContent: TiptapNodeJson[] = [];

  for (const run of runs) {
    const marks: TiptapMarkJson[] = [];
    if (run.bold) marks.push({ type: 'bold' });
    if (run.italic) marks.push({ type: 'italic' });
    if (run.underline) marks.push({ type: 'underline' });
    if (run.strike) marks.push({ type: 'strike' });
    if (run.color) marks.push({ type: 'textStyle', attrs: { color: run.color } });
    if (run.highlight) marks.push({ type: 'highlight', attrs: { color: run.highlight } });
    if (run.href) {
      marks.push({
        type: 'link',
        attrs: { href: run.href, target: run.newTab ? '_blank' : null },
      });
    }
    if (run.sub) marks.push({ type: 'subscript' });
    if (run.sup) marks.push({ type: 'superscript' });

    const lines = run.text.split('\n');
    lines.forEach((line, idx) => {
      if (idx > 0) {
        paragraphs.push({
          type: 'paragraph',
          ...(currentContent.length > 0 ? { content: currentContent } : {}),
        });
        currentContent = [];
      }
      if (line.length > 0) {
        currentContent.push({
          type: 'text',
          text: line,
          ...(marks.length > 0 ? { marks } : {}),
        });
      }
    });
  }

  paragraphs.push({
    type: 'paragraph',
    ...(currentContent.length > 0 ? { content: currentContent } : {}),
  });

  return { type: 'doc', content: paragraphs };
}

export function tiptapDocToRuns(doc: TiptapNodeJson | null | undefined): TextRun[] {
  if (!doc || !Array.isArray(doc.content)) return [];
  const runs: TextRun[] = [];

  doc.content.forEach((node, pIdx) => {
    if (pIdx > 0) {
      runs.push({ text: '\n' });
    }
    if (!Array.isArray(node.content)) return;
    for (const child of node.content) {
      if (child.type === 'hardBreak') {
        runs.push({ text: '\n' });
        continue;
      }
      if (child.type !== 'text' || !child.text) continue;
      const run: TextRun = { text: child.text };
      for (const mark of child.marks ?? []) {
        if (mark.type === 'bold') run.bold = true;
        else if (mark.type === 'italic') run.italic = true;
        else if (mark.type === 'underline') run.underline = true;
        else if (mark.type === 'strike') run.strike = true;
        else if (mark.type === 'textStyle' && typeof mark.attrs?.color === 'string') {
          const hex = mark.attrs.color.trim();
          if (/^#[0-9a-f]{6}$/i.test(hex)) run.color = hex;
        } else if (mark.type === 'highlight' && typeof mark.attrs?.color === 'string') {
          const hex = mark.attrs.color.trim();
          if (/^#[0-9a-f]{6}$/i.test(hex)) run.highlight = hex;
        } else if (mark.type === 'link' && typeof mark.attrs?.href === 'string') {
          const safeHref = sanitizeSafeHref(mark.attrs.href);
          if (safeHref) {
            run.href = safeHref;
            if (mark.attrs.target === '_blank') run.newTab = true;
          }
        } else if (mark.type === 'subscript') run.sub = true;
        else if (mark.type === 'superscript') run.sup = true;
      }
      runs.push(run);
    }
  });

  return normalizeRichTextRuns(runs);
}

/**
 * Renderizador declarativo seguro (cero `dangerouslySetInnerHTML`) para mostrar
 * `RichTextV1` o `RichTextV2` tanto en vista previa como en `/vista-v2/:pageKey`.
 */
export function renderRichTextContent(value: RichTextValue | string | undefined): ReactNode {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value.format === 'plain') return value.value;
  if (value.runs.length === 0) return null;

  return value.runs.map((run, idx) => {
    const inlineStyle: CSSProperties = {};
    if (run.color) inlineStyle.color = run.color;
    if (run.highlight) {
      inlineStyle.backgroundColor = run.highlight;
      inlineStyle.padding = '0 3px';
      inlineStyle.borderRadius = '4px';
    }
    const decorations = [run.underline && 'underline', run.strike && 'line-through'].filter(Boolean);
    if (decorations.length > 0) inlineStyle.textDecorationLine = decorations.join(' ');
    if (run.bold) inlineStyle.fontWeight = 700;
    if (run.italic) inlineStyle.fontStyle = 'italic';

    let content: ReactNode = run.text;
    if (run.sub) content = React.createElement('sub', null, content);
    else if (run.sup) content = React.createElement('sup', null, content);

    const safeHref = sanitizeSafeHref(run.href);
    if (safeHref) {
      return React.createElement(
        'a',
        {
          key: idx,
          href: safeHref,
          target: run.newTab ? '_blank' : undefined,
          rel: run.newTab ? 'noopener noreferrer' : undefined,
          className: 'e2-rich-link',
          style: Object.keys(inlineStyle).length > 0 ? inlineStyle : undefined,
        },
        content,
      );
    }

    if (Object.keys(inlineStyle).length === 0 && !run.sub && !run.sup) {
      return React.createElement(React.Fragment, { key: idx }, content);
    }

    return React.createElement(
      'span',
      { key: idx, style: Object.keys(inlineStyle).length > 0 ? inlineStyle : undefined },
      content,
    );
  });
}
