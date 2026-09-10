import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import BackButton from '../components/BackButton';
import { IMAGE_VIEWER_VISIBILITY_EVENT } from '../constants/uiEvents';

describe('BackButton component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.scrollY = 0;
  });

  it('renders anchor with zero layout footprint and button is hidden at top of page', () => {
    const handleClick = vi.fn();
    const { container } = render(<BackButton onClick={handleClick} />);

    // Check anchor element exists with zero dimensions
    const anchor = container.querySelector('span[aria-hidden="true"]');
    expect(anchor).toBeTruthy();
    expect(anchor).toHaveStyle({ position: 'absolute', width: '0px', height: '0px' });

    // Floating button exists but is hidden initially (top of page is clean)
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    expect(button).toHaveStyle({ position: 'fixed', opacity: '0', pointerEvents: 'none' });

    // It contains only the arrow icon, no textual label inside the button body
    expect(button?.textContent?.trim()).toBe('←');
    expect(button).toHaveAttribute('aria-label', 'Regresar');
  });

  it('shows floating icon button when compact bar is active and handles clicks', () => {
    // Simulate compact bar in DOM
    const compactBar = document.createElement('div');
    compactBar.className = 'atlas-compact-bar';
    compactBar.style.visibility = 'visible';
    compactBar.style.opacity = '1';
    document.body.appendChild(compactBar);

    const handleClick = vi.fn();
    render(<BackButton onClick={handleClick} label="Volver al temario" />);

    // Trigger scroll update
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    const button = screen.getByRole('button', { name: /Volver al temario/i });
    expect(button).toBeTruthy();
    expect(button).toHaveStyle({ opacity: '1', pointerEvents: 'auto' });
    expect(button).toHaveAttribute('title', 'Volver al temario');

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);

    document.body.removeChild(compactBar);
  });

  it('hides when image viewer visibility event is triggered while floating', () => {
    const compactBar = document.createElement('div');
    compactBar.className = 'atlas-compact-bar';
    compactBar.style.visibility = 'visible';
    compactBar.style.opacity = '1';
    document.body.appendChild(compactBar);

    const { container } = render(<BackButton onClick={vi.fn()} />);

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    const button = container.querySelector('button');
    expect(button).toHaveStyle({ opacity: '1', pointerEvents: 'auto' });

    act(() => {
      window.dispatchEvent(
        new CustomEvent(IMAGE_VIEWER_VISIBILITY_EVENT, {
          detail: { delta: 1 },
        })
      );
    });

    expect(button).toHaveStyle({ opacity: '0', pointerEvents: 'none' });

    act(() => {
      window.dispatchEvent(
        new CustomEvent(IMAGE_VIEWER_VISIBILITY_EVENT, {
          detail: { delta: -1 },
        })
      );
    });

    expect(button).toHaveStyle({ opacity: '1', pointerEvents: 'auto' });

    document.body.removeChild(compactBar);
  });
});

