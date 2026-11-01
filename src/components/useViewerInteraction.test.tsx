import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useViewerInteraction } from './useViewerInteraction';

function Harness() {
  const ref = useViewerInteraction();
  return <div ref={ref} data-testid="viewer"><div data-viewer-image-frame data-testid="surface" /><button>Control</button></div>;
}
function pointer(target: Window | Node, type: string, pointerId: number) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  fireEvent(target, event);
}
describe('Efectos visuales durante la interacción', () => {
  it('mantiene el modo ligero hasta levantar todos los contactos y lo restaura al cancelar o perder foco', () => {
    render(<Harness />);
    const root = screen.getByTestId('viewer'), surface = screen.getByTestId('surface');
    pointer(surface, 'pointerdown', 1); pointer(surface, 'pointerdown', 2);
    expect(root).toHaveAttribute('data-viewer-interacting');
    pointer(window, 'pointerup', 1);
    expect(root).toHaveAttribute('data-viewer-interacting');
    pointer(window, 'pointercancel', 2);
    expect(root).not.toHaveAttribute('data-viewer-interacting');
    pointer(surface, 'pointerdown', 3); fireEvent.blur(window);
    expect(root).not.toHaveAttribute('data-viewer-interacting');
  });
  it('deja los controles fuera y limpia el modo ligero al desmontar', () => {
    const { unmount } = render(<Harness />);
    const root = screen.getByTestId('viewer');
    pointer(screen.getByRole('button'), 'pointerdown', 1);
    expect(root).not.toHaveAttribute('data-viewer-interacting');
    fireEvent.touchStart(screen.getByTestId('surface'), { touches: [{ identifier: 1 }, { identifier: 2 }] });
    fireEvent.touchEnd(window, { touches: [{ identifier: 1 }] });
    expect(root).toHaveAttribute('data-viewer-interacting');
    unmount(); expect(root).not.toHaveAttribute('data-viewer-interacting');
  });
});
