import { useEffect, type RefObject } from 'react';
import { GRID_DOTTED_MARK, GRID_REFERENCE_MARKS } from '../domain/gridResolution';
import { gridGuideImage, gridLinePosition, readGridTracks } from './gridTracks';

type GridTracks = NonNullable<ReturnType<typeof readGridTracks>>;

function drawReferenceLabels(ruler: HTMLElement, { columns, rows }: GridTracks, numbered: boolean) {
  const labels = [];
  for (const [direction, axis] of [['column', columns], ['row', rows]] as const) {
    const dotted = gridLinePosition(axis, GRID_DOTTED_MARK);
    ruler.toggleAttribute(`data-${direction}-24`, dotted < axis.extent);
    ruler.style.setProperty(`--e2-guide-${direction}-24`, `${dotted}px`);
    if (!numbered) continue;
    for (const mark of GRID_REFERENCE_MARKS) {
      const position = gridLinePosition(axis, mark);
      if (position >= axis.extent) break;
      const label = document.createElement('span');
      label.dataset.axis = direction;
      label.dataset.mark = String(mark);
      label.textContent = String(mark);
      label.style.setProperty('--e2-guide-position', `${position}px`);
      labels.push(label);
    }
  }
  ruler.replaceChildren(...labels);
}

export function useGridGuides(host: RefObject<HTMLElement>) {
  useEffect(() => {
    const stage = host.current?.querySelector('.e2-canvas-stage--editing');
    if (!stage || typeof ResizeObserver === 'undefined') return;

    let frame = 0;
    let observed = new Set<Element>();
    const rulers = new Map<HTMLElement, HTMLElement>();
    const resize = new ResizeObserver(schedule);

    function draw() {
      frame = 0;
      const next = new Set<Element>();
      const grids = stage!.querySelectorAll<HTMLElement>('.e2-slot-grid');
      const updates = [];
      for (const grid of grids) {
        next.add(grid);
        for (const child of grid.children) if (!child.classList.contains('e2-grid-ruler')) next.add(child);
        const tracks = readGridTracks(grid);
        const guides = tracks ? gridGuideImage(tracks) : '';
        const numbered = Boolean(tracks && tracks.availableWidth >= 224);
        const ruler = rulers.get(grid);
        const guideMoved = tracks && (!ruler ||
          ruler.style.getPropertyValue('--e2-guide-column-24') !== `${gridLinePosition(tracks.columns, GRID_DOTTED_MARK)}px` ||
          ruler.style.getPropertyValue('--e2-guide-row-24') !== `${gridLinePosition(tracks.rows, GRID_DOTTED_MARK)}px`);
        if (grid.style.getPropertyValue('--e2-grid-guides') !== guides || guideMoved ||
            numbered !== grid.hasAttribute('data-e2-grid-numbered')) {
          updates.push({ grid, guides, tracks, numbered });
        }
      }
      for (const { grid, guides, tracks, numbered } of updates) {
        let ruler = rulers.get(grid);
        grid.toggleAttribute('data-e2-grid-numbered', numbered);
        if (!tracks) {
          grid.style.removeProperty('--e2-grid-guides');
          ruler?.remove();
          rulers.delete(grid);
          continue;
        }
        grid.style.setProperty('--e2-grid-guides', guides);
        if (!ruler) {
          ruler = document.createElement('div');
          ruler.className = 'e2-grid-ruler';
          ruler.setAttribute('aria-hidden', 'true');
          grid.prepend(ruler);
          rulers.set(grid, ruler);
        }
        drawReferenceLabels(ruler, tracks, numbered);
      }
      for (const [grid, ruler] of rulers) {
        if (next.has(grid)) continue;
        ruler.remove();
        rulers.delete(grid);
      }
      for (const target of observed) if (!next.has(target)) resize.unobserve(target);
      for (const target of next) if (!observed.has(target)) resize.observe(target);
      observed = next;
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(draw);
    }

    const mutation = new MutationObserver(records => {
      if (records.some(({ target, attributeName }) => target instanceof Element &&
        !target.closest('.e2-grid-ruler') && !(attributeName === 'style' && target.matches('.e2-slot-grid')))) {
        schedule();
      }
    });
    mutation.observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'data-flow', 'hidden'] });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      mutation.disconnect();
      resize.disconnect();
      for (const [grid, ruler] of rulers) {
        grid.removeAttribute('data-e2-grid-numbered');
        ruler.remove();
      }
    };
  }, [host]);
}
