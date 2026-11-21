import { LAYOUT_BREAKPOINTS, type Breakpoint, type LayoutIntent, type SpanIntent } from './types';
import { toGridLine, toGridSpan } from './gridResolution';

export function spanClass(breakpoint: Breakpoint, span: number): string {
  return `e2-span-${breakpoint}-${span}`;
}

export function startClass(breakpoint: Breakpoint, start: number): string {
  return `e2-start-${breakpoint}-${start}`;
}

export function gridColumnValue(intent: SpanIntent): string {
  const start = intent.start === undefined ? 'auto' : toGridLine(intent.start);
  return `${start} / span ${toGridSpan(intent.span)}`;
}

export function layoutClassList(layout: LayoutIntent): string[] {
  const classes: string[] = layout.base.flexSize ? [`e2-flex-${layout.base.flexSize}`] : [];

  if (layout.base.minWidthPx) classes.push('e2-flex-min');
  if (layout.base.maxWidthPx) classes.push('e2-flex-max');
  if (layout.base.anchor) classes.push(`e2-anchor-${layout.base.anchor}`);

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
