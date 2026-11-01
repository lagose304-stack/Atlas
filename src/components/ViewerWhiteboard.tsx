import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Check, ChevronRight, Circle, Copy, Download, Eraser, Hand, Highlighter, Minus, MousePointer2, Pencil, Redo2, SlidersHorizontal, Square, Trash2, Type, Undo2, X, Zap } from 'lucide-react';
import { isEditableTarget } from '../utils/editableTarget';
import { constrainedEnd, isVisibleMark, markBounds, moveMark, strokePath, type BoardMark as Mark, type BoardPoint as Point, type WhiteboardTool } from './viewerWhiteboardGeometry';
import WhiteboardText, { textBounds } from './WhiteboardText';
import { captureWhiteboardScene, createWhiteboardPNG, downloadWhiteboard, whiteboardFileName, type ExportArea, type WhiteboardExportContext } from './whiteboardExport';
import { useWhiteboardProjection } from './useWhiteboardProjection';
import './viewerWhiteboard.css';
export type { WhiteboardTool } from './viewerWhiteboardGeometry';

const tools = [
  { id: 'select', label: 'Seleccionar y mover', key: 'V', icon: MousePointer2, hint: 'Arrastra un apunte para moverlo. Doble clic en texto para editar.' },
  { id: 'hand', label: 'Mover placa', key: 'H', icon: Hand, hint: 'Arrastra para explorar la placa.' },
  { id: 'laser', label: 'Puntero láser', key: 'K', icon: Zap, hint: 'Señala con un rastro de luz que se desvanece.' },
  { id: 'pen', label: 'Lápiz', key: 'P', icon: Pencil, hint: 'Escribe a mano o dibuja libremente.' },
  { id: 'highlight', label: 'Resaltador', key: 'M', icon: Highlighter, hint: 'Resalta sin ocultar el tejido. Shift para trazar recto.' },
  { id: 'arrow', label: 'Flecha', key: 'A', icon: ArrowUpRight, hint: 'Arrastra hacia la estructura que quieres señalar. Shift: ángulos de 45°.' },
  { id: 'line', label: 'Línea', key: 'L', icon: Minus, hint: 'Une dos puntos. Shift: ángulos de 45°.' },
  { id: 'ellipse', label: 'Círculo / elipse', key: 'O', icon: Circle, hint: 'Rodea una estructura. Shift: círculo exacto.' },
  { id: 'rectangle', label: 'Rectángulo', key: 'R', icon: Square, hint: 'Delimita una zona. Shift: cuadrado exacto.' },
  { id: 'text', label: 'Texto', key: 'T', icon: Type, hint: 'Toca la placa y escribe. Ctrl + Enter para añadir.' },
  { id: 'eraser', label: 'Borrador', key: 'E', icon: Eraser, hint: 'Pasa sobre los apuntes para borrar trazos completos.' },
] as const;
const shapes: WhiteboardTool[] = ['arrow', 'line', 'ellipse', 'rectangle'];
const colors = ['#ef4444', '#facc15', '#22c55e', '#38bdf8', '#a78bfa', '#ffffff', '#111827'];
type Style = { color: string; width: number; opacity: number; fontSize: number; background: boolean };
const defaultStyle = (tool: WhiteboardTool): Style => ({ color: tool === 'pen' ? '#111827' : tool === 'highlight' ? '#facc15' : tool === 'text' ? '#ffffff' : '#ef4444', width: tool === 'highlight' ? 16 : 3, opacity: tool === 'highlight' ? 0.3 : 1, fontSize: 22, background: true });
type History = { marks: Mark[]; past: Mark[][]; future: Mark[][] };
type Gesture = { pointer: number; kind: 'draw' | 'move' | 'resize' | 'erase'; handle?: number; pointerType?: string; lastClient?: Point; bounds?: ReturnType<typeof markBounds>; start: Point; original: Mark[]; item: Mark | null; erased: Set<number>; moved: boolean };
interface Props {
  active: boolean;
  tool: WhiteboardTool | null;
  onToggle: () => void;
  onTool: (tool: WhiteboardTool) => void;
  imageLayer: HTMLDivElement | null;
  launcherContainer: HTMLDivElement | null;
  size: { width: number; height: number } | null;
  zoom: number;
  viewTransform?: string;
  exportContext?: WhiteboardExportContext;
  navigating: boolean;
  disabled: boolean;
  onWheel: (event: WheelEvent) => void;
  onPinchStart?: (event: TouchEvent) => void;
  onPinchMove?: (event: TouchEvent) => void;
  onPinchEnd?: (event: TouchEvent) => void;
}

// Solo memoria de esta placa. Nunca escribe en servicios ni almacenamiento del navegador.
export default function ViewerWhiteboard({ active, tool, onToggle, onTool, imageLayer, launcherContainer, size, zoom, viewTransform = '', exportContext, navigating, disabled, onWheel, onPinchStart, onPinchMove, onPinchEnd }: Props) {
  const [history, setHistory] = useState<History>({ marks: [], past: [], future: [] });
  const { marks, past, future } = history;
  const [draft, setDraft] = useState<Mark | null>(null);
  const draftRef = useRef<Mark | null>(null);
  const frame = useRef<number | null>(null);
  const [selectionBounds, setSelectionBounds] = useState<ReturnType<typeof markBounds> | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [erased, setErased] = useState<Set<number>>(new Set());
  const [textAt, setTextAt] = useState<Point | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [textStyle, setTextStyle] = useState<Style | null>(null);
  const [preferences, setPreferences] = useState<Partial<Record<WhiteboardTool, Style>>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shapesOpen, setShapesOpen] = useState(false);
  const [lastShape, setLastShape] = useState<WhiteboardTool>('arrow');
  const [regularTools, setRegularTools] = useState<Partial<Record<WhiteboardTool, boolean>>>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ error: boolean; message: string } | null>(null);
  const exportAbort = useRef<AbortController | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const touchIds = useRef(new Set<number>());
  const pinch = useRef(false);
  const touchBlocked = useRef(false);
  const nextId = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const sceneRef = useRef<SVGGElement>(null);
  useWhiteboardProjection(svgRef, sceneRef, imageLayer, size, zoom, viewTransform);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const colorId = useId();
  const clipId = useId();
  const toolbarId = useId();
  const w = size?.width ?? 1, h = size?.height ?? 1;
  const currentTool = tool ?? 'pen';
  const definition = tools.find(item => item.id === currentTool)!;
  const ShapeIcon = tools.find(item => item.id === lastShape)!.icon;
  const selected = marks.find(mark => mark.id === selectedId) ?? null;
  const editing = marks.find(mark => mark.id === editingId) ?? null;
  const styleTool = selected?.tool ?? currentTool;
  const constrain = regularTools[styleTool] ?? false;
  const baseStyle: Style = selected ? { color: selected.color, width: Math.round(selected.width * w * zoom), opacity: selected.opacity, fontSize: Math.round((selected.fontSize ?? selected.width * 6) * w * zoom), background: selected.background ?? false } : preferences[styleTool] ?? defaultStyle(styleTool);
  const style = textAt && textStyle ? textStyle : baseStyle;
  const drawing = active && !disabled && !navigating && tool !== 'hand' && tool !== 'laser';
  const selectable = drawing && (tool === 'select' || tool === 'eraser');

  const publish = (mark: Mark | null, buffered = false) => {
    draftRef.current = mark;
    if (!buffered) { setDraft(mark); return; }
    if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; setDraft(draftRef.current); });
  };
  const cancelDraft = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null; gesture.current = null; draftRef.current = null;
    setDraft(null); setErased(new Set());
  };
  const commit = (next: Mark[]) => {
    setHistory(previous => ({ marks: next, past: [...previous.past.slice(-79), previous.marks], future: [] }));
    setConfirmClear(false);
  };
  const undo = () => {
    cancelDraft(); setSelectedId(null);
    setHistory(previous => previous.past.length ? { marks: previous.past[previous.past.length - 1], past: previous.past.slice(0, -1), future: [previous.marks, ...previous.future] } : previous);
  };
  const redo = () => {
    cancelDraft(); setSelectedId(null);
    setHistory(previous => previous.future.length ? { marks: previous.future[0], past: [...previous.past, previous.marks], future: previous.future.slice(1) } : previous);
  };
  const finish = (cancel = false) => {
    const g = gesture.current;
    if (!g) return;
    const item = draftRef.current;
    if (!cancel) {
      if (g.kind === 'erase' && g.erased.size) commit(g.original.filter(mark => !g.erased.has(mark.id)));
      else if (item && (g.kind === 'move' || g.kind === 'resize') && g.moved && (g.kind === 'move' || isVisibleMark(item, w, h, zoom))) commit(g.original.map(mark => mark.id === item.id ? item : mark));
      else if (item && g.kind === 'draw' && isVisibleMark(item, w, h, zoom)) commit([...g.original, item]);
    }
    cancelDraft();
  };
  const saveText = () => {
    let result = marks;
    if (textAt && text.trim()) {
      const item: Mark = { id: editingId ?? nextId.current++, tool: 'text', points: [textAt], color: style.color, width: style.width / (w * zoom), opacity: style.opacity, fontSize: style.fontSize / (w * zoom), background: style.background, text: text.trim() };
      const previewNode = svgRef.current?.querySelector<SVGTextElement>(`[data-whiteboard-mark="${editingId ?? -2}"] [data-whiteboard-text]`);
      const fitted = moveMark(item, 0, 0, w, h, textBounds(item, w, h, previewNode));
      result = editingId === null ? [...marks, fitted] : marks.map(mark => mark.id === editingId ? fitted : mark);
      commit(result);
    }
    setTextAt(null); setText(''); setEditingId(null); setTextStyle(null);
    return result;
  };
  const exportNotes = async (area: ExportArea) => {
    if (!exportContext || !size || exporting || disabled) return;
    const snapshot = textAt ? saveText() : marks;
    if (!snapshot.length) return;
    setExporting(true); setExportMenuOpen(false); setExportStatus(null);
    const controller = new AbortController(); exportAbort.current = controller;
    try {
      // Permitir que el texto pendiente se guarde y mida antes de congelar la imagen.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (controller.signal.aborted) return;
      const scene = sceneRef.current, svg = svgRef.current;
      const matrix = scene?.getScreenCTM();
      if (!scene || !svg || !matrix) throw new Error('La placa todavía no está lista.');
      const rect = svg.getBoundingClientRect();
      const annotations = captureWhiteboardScene(scene);
      const blob = await createWhiteboardPNG({
        context: exportContext, area, logical: size, annotations, signal: controller.signal,
        view: { width: rect.width, height: rect.height, matrix: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e - rect.left, f: matrix.f - rect.top } },
      });
      if (controller.signal.aborted) return;
      downloadWhiteboard(blob, whiteboardFileName(exportContext, area));
      setExportStatus({ error: false, message: 'Imagen descargada. Tus apuntes siguen aquí.' });
    } catch (error) {
      if (!controller.signal.aborted) setExportStatus({ error: true, message: error instanceof Error ? error.message : 'No se pudo descargar la imagen. Vuelve a intentarlo.' });
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  };
  useEffect(() => () => exportAbort.current?.abort(), []);
  const choose = (next: WhiteboardTool) => {
    if (textAt) saveText();
    cancelDraft(); setSelectedId(null); setShapesOpen(false); setConfirmClear(false); setExportMenuOpen(false);
    if (shapes.includes(next)) setLastShape(next);
    onTool(next);
  };
  const changeStyle = (patch: Partial<Style>) => {
    if (textAt) {
      setTextStyle({ ...style, ...patch });
      setPreferences(previous => ({ ...previous, text: { ...style, ...patch } }));
      return;
    }
    setPreferences(previous => ({ ...previous, [styleTool]: { ...style, ...patch } }));
    if (selected) commit(marks.map(mark => mark.id !== selected.id ? mark : { ...mark,
      ...(patch.color !== undefined && { color: patch.color }), ...(patch.opacity !== undefined && { opacity: patch.opacity }),
      ...(patch.width !== undefined && { width: patch.width / (w * zoom) }), ...(patch.fontSize !== undefined && { fontSize: patch.fontSize / (w * zoom) }),
      ...(patch.background !== undefined && { background: patch.background }),
    }));
  };
  const removeSelected = () => { if (selected) { commit(marks.filter(mark => mark.id !== selected.id)); setSelectedId(null); } };
  const boundsForMark = (mark: Mark) => mark.tool === 'text' ? textBounds(mark, w, h, svgRef.current?.querySelector<SVGTextElement>(`[data-whiteboard-mark="${mark.id}"] [data-whiteboard-text]`)) : markBounds(mark, w, h);
  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...moveMark(selected, 18 / (w * zoom), 18 / (h * zoom), w, h, boundsForMark(selected)), id: nextId.current++ };
    commit([...marks, copy]); setSelectedId(copy.id);
  };
  const editText = (mark: Mark) => {
    setSelectedId(mark.id); setEditingId(mark.id); setTextAt(mark.points[0]); setText(mark.text ?? '');
    setTextStyle({ color: mark.color, width: mark.width * w * zoom, opacity: mark.opacity, fontSize: Math.round((mark.fontSize ?? mark.width * 6) * w * zoom), background: mark.background ?? false });
    setSettingsOpen(false); setShapesOpen(false);
  };
  const point = (event: { clientX: number; clientY: number }): Point | null => {
    const matrix = sceneRef.current?.getScreenCTM();
    if (!matrix) return null;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: Math.max(0, Math.min(1, local.x / w)), y: Math.max(0, Math.min(1, local.y / h)) };
  };
  const hitAt = (x: number, y: number): Mark | null => {
    const hit = document.elementFromPoint(x, y)?.closest('[data-whiteboard-mark]');
    return hit && svgRef.current?.contains(hit) ? marks.find(mark => mark.id === Number(hit.getAttribute('data-whiteboard-mark'))) ?? null : null;
  };
  const eraseAt = (x: number, y: number) => {
    const hit = hitAt(x, y), g = gesture.current;
    if (hit && g && !g.erased.has(hit.id)) { g.erased.add(hit.id); setErased(new Set(g.erased)); }
  };
  const updateGesture = (event: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g || g.pointer !== event.pointerId || touchBlocked.current) return;
    event.preventDefault(); event.stopPropagation();
    if (g.kind === 'erase') {
      const from = g.lastClient ?? { x: event.clientX, y: event.clientY };
      const steps = Math.min(64, Math.max(1, Math.ceil(Math.hypot(event.clientX - from.x, event.clientY - from.y) / 6)));
      for (let i = 1; i <= steps; i++) eraseAt(from.x + (event.clientX - from.x) * i / steps, from.y + (event.clientY - from.y) * i / steps);
      g.lastClient = { x: event.clientX, y: event.clientY }; return;
    }
    const p = point(event); if (!p || !g.item) return;
    if (Math.hypot((p.x - g.start.x) * w * zoom, (p.y - g.start.y) * h * zoom) > 2) g.moved = true;
    if (g.kind === 'resize') {
      const points = [...g.item.points], index = g.handle ?? 1;
      points[index] = event.shiftKey || constrain ? constrainedEnd(points[index === 0 ? 1 : 0], p, g.item.tool, w, h) : p;
      publish({ ...g.item, points }, true); return;
    }
    if (g.kind === 'move') { publish(moveMark(g.item, p.x - g.start.x, p.y - g.start.y, w, h, g.bounds), true); return; }
    const regular = event.shiftKey || constrain;
    if (g.item.tool === 'pen' || (g.item.tool === 'highlight' && !regular)) {
      const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
      const points = [...(draftRef.current?.points ?? g.item.points)];
      for (const sample of samples.length ? [...samples, event] : [event]) {
        const next = point(sample), last = points[points.length - 1];
        if (next && Math.hypot((next.x - last.x) * w * zoom, (next.y - last.y) * h * zoom) >= 0.65) points.push(next);
      }
      publish({ ...g.item, points }, true);
    } else publish({ ...g.item, points: [g.start, regular ? constrainedEnd(g.start, p, g.item.tool, w, h) : p] }, true);
  };

  useEffect(() => {
    cancelDraft(); setTextAt(null); setText(''); setEditingId(null); setTextStyle(null); setSelectedId(null); setConfirmClear(false); setShapesOpen(false);
    if (!active) { setSettingsOpen(false); setExportMenuOpen(false); setExportStatus(null); }
  }, [active, tool, navigating, disabled]);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  useEffect(() => { if (textAt) editorRef.current?.focus(); }, [textAt]);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const start = (event: TouchEvent) => {
      event.stopPropagation(); if (event.cancelable) event.preventDefault();
      if (gesture.current?.pointerType === 'pen') return;
      if (event.touches.length >= 2) { pinch.current = true; touchBlocked.current = true; finish(true); onPinchStart?.(event); }
    };
    const move = (event: TouchEvent) => { event.stopPropagation(); if (event.cancelable) event.preventDefault(); if (pinch.current) onPinchMove?.(event); };
    const end = (event: TouchEvent) => {
      event.stopPropagation();
      if (pinch.current) onPinchEnd?.(event);
      if (!event.touches.length) { pinch.current = false; touchBlocked.current = false; touchIds.current.clear(); }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('touchstart', start, { passive: false });
    svg.addEventListener('touchmove', move, { passive: false });
    svg.addEventListener('touchend', end); svg.addEventListener('touchcancel', end);
    return () => {
      svg.removeEventListener('wheel', onWheel); svg.removeEventListener('touchstart', start);
      svg.removeEventListener('touchmove', move); svg.removeEventListener('touchend', end); svg.removeEventListener('touchcancel', end);
    };
  });
  useEffect(() => {
    if (!active || disabled) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      let handled = true;
      if (mod && key === 'z') { if (event.shiftKey) redo(); else undo(); }
      else if (mod && key === 'y') redo();
      else if (mod && key === 'd' && selected) duplicateSelected();
      else if (!mod && !event.altKey && (key === 'delete' || key === 'backspace') && selected) removeSelected();
      else if (key === 'escape' && (gesture.current || selected || shapesOpen || settingsOpen || confirmClear || exportMenuOpen)) {
        cancelDraft(); setSelectedId(null); setShapesOpen(false); setSettingsOpen(false); setConfirmClear(false); setExportMenuOpen(false);
      } else if (!mod && !event.altKey && !event.repeat && tools.some(item => item.key.toLowerCase() === key)) choose(tools.find(item => item.key.toLowerCase() === key)!.id);
      else handled = false;
      if (handled) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('keydown', handleKey, true);
    const blur = () => { finish(true); touchIds.current.clear(); touchBlocked.current = false; pinch.current = false; };
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', handleKey, true); window.removeEventListener('blur', blur); };
  });
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !controlsRef.current?.contains(event.target)) { setShapesOpen(false); setSettingsOpen(false); setConfirmClear(false); if (!(event.target instanceof Element) || !event.target.closest('.viewer-whiteboard-export')) setExportMenuOpen(false); }
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);

  const renderMark = (mark: Mark) => {
    const first = mark.points[0]; if (!first) return null;
    const last = mark.points[mark.points.length - 1];
    const x = first.x * w, y = first.y * h, x2 = last.x * w, y2 = last.y * h;
    const stroke = mark.width * w;
    const common = { stroke: mark.color, strokeWidth: stroke, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, pointerEvents: 'none' as const };
    if (mark.tool === 'text') return <g key={mark.id} data-whiteboard-mark={mark.id} opacity={mark.opacity}><WhiteboardText mark={mark} w={w} h={h} zoom={zoom} interactive={selectable} /></g>;
    let shape: React.ReactElement;
    if (mark.tool === 'rectangle') shape = <rect {...common} x={Math.min(x, x2)} y={Math.min(y, y2)} width={Math.abs(x2 - x)} height={Math.abs(y2 - y)} />;
    else if (mark.tool === 'ellipse') shape = <ellipse {...common} cx={(x + x2) / 2} cy={(y + y2) / 2} rx={Math.abs(x2 - x) / 2} ry={Math.abs(y2 - y) / 2} />;
    else if (mark.tool === 'arrow') {
      const angle = Math.atan2(y2 - y, x2 - x), head = Math.min(Math.hypot(x2 - x, y2 - y) * 0.45, stroke * 5);
      shape = <path {...common} d={`M${x},${y} L${x2},${y2} M${x2 - head * Math.cos(angle - 0.5)},${y2 - head * Math.sin(angle - 0.5)} L${x2},${y2} L${x2 - head * Math.cos(angle + 0.5)},${y2 - head * Math.sin(angle + 0.5)}`} />;
    } else if (mark.points.length === 1) shape = <circle cx={x} cy={y} r={stroke / 2} fill={mark.color} pointerEvents="none" />;
    else shape = <path {...common} d={mark.tool === 'line' ? `M${x},${y} L${x2},${y2}` : strokePath(mark.points, w, h)} />;
    return <g key={mark.id} data-whiteboard-mark={mark.id} opacity={mark.opacity}>
      {shape}
      {selectable && React.cloneElement(shape, { className: 'viewer-whiteboard__hit', stroke: 'transparent', strokeWidth: Math.max(stroke, 16 / zoom), fill: tool === 'select' && (shapes.includes(mark.tool) || mark.points.length === 1) ? 'transparent' : 'none', pointerEvents: tool === 'select' && (shapes.includes(mark.tool) || mark.points.length === 1) ? 'all' : 'stroke' })}
    </g>;
  };
  const renderedMarks = useMemo(() => marks.map(mark => ({ id: mark.id, node: renderMark(mark) })), [marks, w, h, zoom, selectable, tool]);
  const shownSelected = draft?.id === selected?.id ? draft : selected;
  useLayoutEffect(() => {
    const next = shownSelected ? boundsForMark(shownSelected) : null;
    setSelectionBounds(previous => previous?.x === next?.x && previous?.y === next?.y && previous?.width === next?.width && previous?.height === next?.height ? previous : next);
  }, [shownSelected, w, h]);
  const bounds = selectionBounds;
  const preview: Mark | null = textAt && text ? { id: editingId ?? -2, tool: 'text', points: [textAt], color: style.color, width: style.width / (w * zoom), opacity: style.opacity, fontSize: style.fontSize / (w * zoom), background: style.background, text } : null;
  const textControls = styleTool === 'text';
  const styleControls = !['hand', 'laser', 'eraser', 'select'].includes(styleTool);

  return <>
    {launcherContainer && createPortal(<>
      <span className="viewer-whiteboard-launcher-divider" aria-hidden="true" />
      <button type="button" className="viewer-whiteboard-launcher" title={active ? 'Cerrar pizarra' : 'Abrir pizarra'} aria-label={active ? 'Cerrar pizarra' : 'Abrir pizarra'} aria-expanded={active} aria-controls={toolbarId} onClick={() => { if (textAt) saveText(); onToggle(); }} disabled={disabled}><Pencil size={16} strokeWidth={2.4} /></button>
    </>, launcherContainer)}
    <div ref={controlsRef} className={`viewer-whiteboard-controls${selected && !textAt ? ' has-selection' : ''}`} onMouseDown={event => event.stopPropagation()}>
      <div hidden={!active} id={toolbarId} className={`viewer-whiteboard ${active ? 'is-active' : ''}`} role="toolbar" aria-label="Pizarra temporal" aria-orientation="vertical">
        <button type="button" title="Cerrar herramientas de pizarra" aria-label="Cerrar herramientas de pizarra" aria-pressed={active} onClick={() => { if (textAt) saveText(); onToggle(); }} disabled={disabled}><X size={18} /></button>
        {active && <>
          <div className="viewer-whiteboard__tools">
            {tools.filter(item => !shapes.includes(item.id)).map(item => <React.Fragment key={item.id}>
              {item.id === 'text' && <button type="button" aria-label="Formas" aria-expanded={shapesOpen} aria-pressed={shapes.includes(currentTool)} title="Formas: flecha, línea, círculo y rectángulo" onClick={() => { setShapesOpen(value => !value); setSettingsOpen(false); }}><ShapeIcon size={19} /><ChevronRight className="viewer-whiteboard__chevron" size={9} /></button>}
              <button type="button" title={`${item.label} (${item.key})`} aria-label={item.label} aria-pressed={tool === item.id} onClick={() => choose(item.id)}><item.icon size={19} /></button>
            </React.Fragment>)}
          </div>
          <div className="viewer-whiteboard__actions">
            <button type="button" title="Ajustes, colores y limpieza" aria-label="Ajustes de pizarra" aria-expanded={settingsOpen || !!textAt} onClick={() => { if (textAt) editorRef.current?.focus(); else setSettingsOpen(value => !value); setShapesOpen(false); }}><SlidersHorizontal size={18} /><i style={{ background: style.color }} /></button>
            <button type="button" title="Deshacer (Ctrl + Z)" aria-label="Deshacer apunte" disabled={!past.length || !!textAt} onClick={undo}><Undo2 size={18} /></button>
            <button type="button" title="Rehacer (Ctrl + Shift + Z)" aria-label="Rehacer apunte" disabled={!future.length || !!textAt} onClick={redo}><Redo2 size={18} /></button>
          </div>
        </>}
      </div>
      {active && <>
        <div className="viewer-whiteboard__context" role="status" aria-live="polite">
          <strong>{selected ? 'Apunte seleccionado' : definition.label}</strong><span className="viewer-whiteboard__shortcut">{selected ? 'Supr: borrar' : definition.key}</span>
          <small>{selected ? shapes.includes(selected.tool) ? 'Arrastra para mover · Puntos para ajustar · Shift: proporciones fijas' : 'Arrastra para mover · Ajustes para cambiar su estilo' : definition.hint}</small>
          {selected && !textAt && <div className="viewer-whiteboard__selection-actions">
            {selected.tool === 'text' && <button type="button" aria-label="Editar texto seleccionado" onClick={() => editText(selected)}><Type size={15} />Editar</button>}
            <button type="button" aria-label="Duplicar apunte" title="Duplicar (Ctrl + D)" onClick={duplicateSelected}><Copy size={15} />Duplicar</button>
            <button type="button" aria-label="Eliminar apunte seleccionado" onClick={removeSelected}><Trash2 size={15} />Borrar</button>
          </div>}
        </div>
        {shapesOpen && <div className="viewer-whiteboard__panel viewer-whiteboard__shapes" role="group" aria-label="Elegir forma">{tools.filter(item => shapes.includes(item.id)).map(item => <button key={item.id} type="button" aria-label={item.label} aria-pressed={tool === item.id} onClick={() => choose(item.id)}><item.icon size={20} /><span>{item.label}</span><kbd>{item.key}</kbd></button>)}</div>}
        {settingsOpen && !textAt && <div className="viewer-whiteboard__panel" role="group" aria-label="Opciones de la herramienta">
          <div className="viewer-whiteboard__panel-heading"><strong>{selected ? 'Estilo del apunte' : definition.label}</strong><button type="button" aria-label="Cerrar ajustes" onClick={() => setSettingsOpen(false)}><X size={16} /></button></div>
          {styleControls && <>
            <span className="viewer-whiteboard__field-label">Color</span>
            <div className="viewer-whiteboard__swatches">{colors.map(color => <button key={color} type="button" aria-label={`Color ${color}`} aria-pressed={style.color === color} style={{ background: color }} onClick={() => changeStyle({ color })}>{style.color === color && <Check size={15} color={color === '#ffffff' || color === '#facc15' ? '#0f172a' : '#fff'} />}</button>)}<label title="Color personalizado"><input id={colorId} aria-label="Color de los apuntes" type="color" value={style.color} onChange={event => changeStyle({ color: event.target.value })} /></label></div>
            {textControls ? <><label className="viewer-whiteboard__field-label" htmlFor={`${colorId}-font`}>Tamaño de letra</label><select id={`${colorId}-font`} aria-label="Tamaño de letra" value={style.fontSize} onChange={event => changeStyle({ fontSize: Number(event.target.value) })}>{[...new Set([16, 22, 30, 40, style.fontSize])].sort((a, b) => a - b).map(value => <option key={value} value={value}>{value} px</option>)}</select><label className="viewer-whiteboard__check"><input type="checkbox" checked={style.background} onChange={event => changeStyle({ background: event.target.checked })} />Fondo para leer sobre el tejido</label></> : <><span className="viewer-whiteboard__field-label">Grosor del trazo</span><div className="viewer-whiteboard__sizes">{(styleTool === 'highlight' ? [10, 16, 24] : [2, 3, 5]).map((value, index) => <button type="button" key={value} aria-label={`Grosor ${['fino', 'medio', 'grueso'][index]}`} aria-pressed={Math.abs(style.width - value) < 1} onClick={() => changeStyle({ width: value })}><span style={{ height: Math.min(value, 12) }} />{['Fino', 'Medio', 'Grueso'][index]}</button>)}</div></>}
            <label className="viewer-whiteboard__field-label" htmlFor={`${colorId}-opacity`}>Opacidad</label><select id={`${colorId}-opacity`} aria-label="Opacidad" value={style.opacity} onChange={event => changeStyle({ opacity: Number(event.target.value) })}>{[0.15, 0.3, 0.5, 0.75, 1].map(value => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}</select>
            {(shapes.includes(styleTool) || styleTool === 'highlight') && <label className="viewer-whiteboard__check"><input type="checkbox" checked={constrain} onChange={event => setRegularTools(previous => ({ ...previous, [styleTool]: event.target.checked }))} />{styleTool === 'ellipse' ? 'Círculo exacto' : styleTool === 'rectangle' ? 'Cuadrado exacto' : 'Trazo recto · ángulos de 45°'}</label>}
          </>}
          {!styleControls && <p>{definition.hint}</p>}
          <div className="viewer-whiteboard__tips">Espacio: mover · Dos dedos: zoom<br />V: seleccionar · Ctrl + Z: deshacer</div>
          <button className="viewer-whiteboard__danger" type="button" aria-label="Borrar todos los apuntes" disabled={!marks.length} onClick={() => setConfirmClear(value => !value)}><Trash2 size={15} />Borrar todos los apuntes</button>
          {confirmClear && <div className="viewer-whiteboard__confirm" role="group" aria-label="Confirmar borrado"><span>¿Borrar los {marks.length} apuntes? Puedes deshacerlo.</span><button type="button" onClick={() => { commit([]); setSelectedId(null); }}>Borrar</button><button type="button" onClick={() => setConfirmClear(false)}>Cancelar</button></div>}
        </div>}
        {textAt && <form className="viewer-whiteboard__panel viewer-whiteboard__text-editor" onSubmit={event => { event.preventDefault(); saveText(); }}>
          <strong>{editing ? 'Editar texto' : 'Añadir texto a la placa'}</strong>
          <div className="viewer-whiteboard__text-format">
            <label>Color<input aria-label="Color del texto" type="color" value={style.color} onChange={event => changeStyle({ color: event.target.value })} /></label>
            <label>Tamaño<select aria-label="Tamaño del texto" value={style.fontSize} onChange={event => changeStyle({ fontSize: Number(event.target.value) })}>{[...new Set([16, 22, 30, 40, style.fontSize])].sort((a, b) => a - b).map(value => <option key={value} value={value}>{value} px</option>)}</select></label>
          </div>
          <textarea ref={editorRef} aria-label="Texto del apunte" value={text} maxLength={500} rows={3} placeholder="Escribe tu apunte…" onChange={event => setText(event.target.value)} onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setTextAt(null); setText(''); setEditingId(null); setTextStyle(null); }
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); saveText(); }
          }} />
          <label className="viewer-whiteboard__check"><input type="checkbox" checked={style.background} onChange={event => changeStyle({ background: event.target.checked })} />Fondo para leer sobre el tejido</label>
          <small>Enter: nueva línea · Ctrl + Enter: guardar</small><div className="viewer-whiteboard__text-actions"><button type="submit" disabled={!text.trim()}><Check size={15} />{editing ? 'Guardar' : 'Añadir'}</button><button type="button" onClick={() => { setTextAt(null); setText(''); setEditingId(null); setTextStyle(null); }}>Cancelar</button></div>
        </form>}
      </>}
    </div>
    {active && exportContext && <div className="viewer-whiteboard-export">
      {exportMenuOpen && <div className="viewer-whiteboard-export__menu" role="group" aria-label="Descargar apuntes como imagen">
        <strong>Guardar apuntes en PNG</strong>
        <button type="button" onClick={() => void exportNotes('view')}><span>Vista actual</span><small>Conserva el zoom y encuadre que estás viendo.</small></button>
        <button type="button" onClick={() => void exportNotes('plate')}><span>Placa completa</span><small>Incluye todos tus apuntes, también fuera del encuadre.</small></button>
        <button type="button" onClick={() => setExportMenuOpen(false)}>Cancelar</button>
      </div>}
      {exportStatus && <div className={`viewer-whiteboard-export__status${exportStatus.error ? ' is-error' : ''}`} role={exportStatus.error ? 'alert' : 'status'}>{exportStatus.message}</div>}
      <button className="viewer-whiteboard-export__button" type="button" aria-label="Guardar apuntes" aria-expanded={exportMenuOpen} disabled={disabled || exporting || (!marks.length && !text.trim())} onClick={() => { setExportMenuOpen(value => !value); setExportStatus(null); }}><Download size={18} /><span>{exporting ? 'Preparando imagen…' : 'Guardar apuntes'}</span></button>
    </div>}
    {active && <div className="viewer-whiteboard__notice">Solo en este dispositivo · Guarda la imagen antes de salir</div>}
    {imageLayer?.parentElement && size && createPortal(<svg ref={svgRef} className={`viewer-whiteboard__canvas tool-${currentTool}`} aria-label="Apuntes temporales sobre la placa" style={{ pointerEvents: 'none' }}
      onMouseDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()} onTouchMove={event => event.stopPropagation()}
      onPointerDown={event => {
        if (!drawing || event.button !== 0) return;
        event.preventDefault(); event.stopPropagation();
        if (event.pointerType === 'touch' && gesture.current?.pointerType === 'pen') return;
        event.currentTarget.setPointerCapture(event.pointerId);
        if (event.pointerType === 'touch') {
          touchIds.current.add(event.pointerId);
          if (touchIds.current.size > 1) { touchBlocked.current = true; finish(true); return; }
          if (touchBlocked.current) return;
        }
        if (gesture.current) { finish(true); return; }
        if (textAt) { editorRef.current?.focus(); return; }
        const p = point(event); if (!p) return;
        setSettingsOpen(false); setShapesOpen(false); setExportMenuOpen(false);
        if (tool === 'select') {
          const handle = event.target instanceof Element ? event.target.closest('[data-whiteboard-handle]') : null;
          if (handle && selected) {
            gesture.current = { pointer: event.pointerId, pointerType: event.pointerType, lastClient: { x: event.clientX, y: event.clientY }, kind: 'resize', handle: Number(handle.getAttribute('data-whiteboard-handle')), start: p, original: marks, item: selected, erased: new Set(), moved: false };
            return;
          }
          const hit = hitAt(event.clientX, event.clientY); setSelectedId(hit?.id ?? null);
          if (hit) gesture.current = { pointer: event.pointerId, pointerType: event.pointerType, lastClient: { x: event.clientX, y: event.clientY }, kind: 'move', bounds: boundsForMark(hit), start: p, original: marks, item: hit, erased: new Set(), moved: false };
          return;
        }
        setSelectedId(null);
        if (tool === 'text') { setTextAt(p); setEditingId(null); setTextStyle(preferences.text ?? defaultStyle('text')); return; }
        gesture.current = { pointer: event.pointerId, pointerType: event.pointerType, lastClient: { x: event.clientX, y: event.clientY }, kind: tool === 'eraser' ? 'erase' : 'draw', start: p, original: marks, item: null, erased: new Set(), moved: false };
        if (tool === 'eraser') eraseAt(event.clientX, event.clientY);
        else {
          const item = { id: nextId.current++, tool: currentTool, points: [p], color: style.color, width: style.width / (w * zoom), opacity: style.opacity };
          gesture.current.item = item; publish(item);
        }
      }}
      onPointerMove={updateGesture}
      onPointerUp={event => {
        touchIds.current.delete(event.pointerId);
        if (gesture.current?.pointer === event.pointerId) finish();
        if (!touchIds.current.size && !pinch.current) touchBlocked.current = false;
      }}
      onPointerCancel={event => { touchIds.current.delete(event.pointerId); if (gesture.current?.pointer === event.pointerId) finish(true); }}
      onLostPointerCapture={event => { if (gesture.current?.pointer === event.pointerId) finish(true); }}
      onDoubleClick={event => { if (tool === 'select') { const hit = hitAt(event.clientX, event.clientY); if (hit?.tool === 'text') editText(hit); } }}>
      <defs><clipPath id={clipId}><rect width={w} height={h} /></clipPath></defs>
      <g ref={sceneRef} data-whiteboard-scene transform="matrix(1 0 0 1 0 0)" clipPath={`url(#${clipId})`}>
      <rect data-whiteboard-surface width={w} height={h} fill="transparent" style={{ pointerEvents: drawing ? 'all' : 'none' }} />
      {renderedMarks.filter(mark => !erased.has(mark.id) && mark.id !== draft?.id && mark.id !== editingId).map(mark => mark.node)}
      {draft && renderMark(draft)}{preview && renderMark(preview)}
      {bounds && !textAt && <rect className="viewer-whiteboard__selection" x={bounds.x - 5 / zoom} y={bounds.y - 5 / zoom} width={bounds.width + 10 / zoom} height={bounds.height + 10 / zoom} rx={4 / zoom} strokeWidth={1.5 / zoom} strokeDasharray={`${5 / zoom} ${3 / zoom}`} pointerEvents="none" />}
      {shownSelected && shapes.includes(shownSelected.tool) && !textAt && drawing && shownSelected.points.map((p, index) => <g key={index} data-whiteboard-handle={index} style={{ cursor: 'nwse-resize' }}>
        <circle cx={p.x * w} cy={p.y * h} r={11 / zoom} fill="transparent" pointerEvents="all" />
        <circle cx={p.x * w} cy={p.y * h} r={4.5 / zoom} fill="white" stroke="#0284c7" strokeWidth={1.5 / zoom} pointerEvents="none" />
      </g>)}
      </g>
    </svg>, imageLayer.parentElement)}
  </>;
}
