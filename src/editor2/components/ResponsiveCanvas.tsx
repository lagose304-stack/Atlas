import { createContext, useContext, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react';
import type { PageTheme } from '../domain/styleSchema';
import { pageThemeToCssVars } from '../domain/styleToCss';
import { screenForWidth, type ScreenSize } from '../domain/responsive';

export const ShowCanvasBackground = createContext(true);
export const CanvasScreen = createContext<ScreenSize>('desktop');
export const ReportCanvasScreen = createContext<((screen: ScreenSize) => void) | undefined>(undefined);

export function ResponsiveCanvas({ children, theme, style, ...props }: ComponentPropsWithoutRef<'div'> & { theme?: PageTheme }) {
  const root = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<ScreenSize>('desktop');
  const report = useContext(ReportCanvasScreen);
  const showBackground = useContext(ShowCanvasBackground);

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      if (!width) return;
      const next = screenForWidth(width);
      setScreen(next);
      report?.(next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [report]);

  return (
    <div {...props} style={{ ...pageThemeToCssVars(theme, showBackground), ...style }} ref={root} data-e2-screen={screen}>
      <CanvasScreen.Provider value={screen}>{children}</CanvasScreen.Provider>
    </div>
  );
}
