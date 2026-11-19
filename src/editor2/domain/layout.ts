import { LAYOUT_BREAKPOINTS, type Breakpoint, type LayoutIntent, type SpanIntent } from './types';

export function spanClass(breakpoint: Breakpoint, span: number): string {
  return `e2-span-${breakpoint}-${span}`;
}

export function startClass(breakpoint: Breakpoint, start: number): string {
  return `e2-start-${breakpoint}-${start}`;
}

export function gridColumnValue(intent: SpanIntent): string {
  return intent.start === undefined ? `span ${intent.span}` : `${intent.start} / span ${intent.span}`;
}

export function layoutClassList(layout: LayoutIntent): string[] {
  const classes: string[] = [];

  for (const breakpoint of LAYOUT_BREAKPOINTS) {
    const intent = layout[breakpoint];
    if (!intent) continue;

    classes.push(spanClass(breakpoint, intent.span));
    if (intent.start !== undefined) {
      classes.push(startClass(breakpoint, intent.start));
    }
  }

  return classes;
}

export function layoutClasses(layout: LayoutIntent): string {
  return layoutClassList(layout).join(' ');
}
