import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RaffleModal, { CLOSE_ANIMATION_MS } from './RaffleModal';
import { acquireAtlasScrollLock, releaseAtlasScrollLock } from '../constants/scrollLock';

const ADVANCE_PAST_CLOSE = CLOSE_ANIMATION_MS + 20;

describe('RaffleModal Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('se muestra inicialmente con la imagen de la rifa, botón de cierre y botón hacia WhatsApp', () => {
    render(<RaffleModal />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Gran Rifa de Histología/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Cerrar ventana emergente/i)).toBeInTheDocument();

    const ctaLink = screen.getByRole('link', { name: /Quiero un boleto/i });
    expect(ctaLink).toBeInTheDocument();
    expect(ctaLink).toHaveAttribute(
      'href',
      'https://wa.me/50498742025?text=%C2%A1Hola!%20Vengo%20del%20Atlas%2C%20me%20gustar%C3%ADa%20comprar%20un%20boleto%20para%20la%20rifa.'
    );
    expect(ctaLink).toHaveAttribute('target', '_blank');
    expect(ctaLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('se cierra en cuanto termina la transición al pulsar la X, sin pantalla intermedia', () => {
    const handleClose = vi.fn();
    render(<RaffleModal onClose={handleClose} />);

    fireEvent.click(screen.getByLabelText(/Cerrar ventana emergente/i));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('home-raffle-overlay-closing');
    expect(dialog.querySelector('.home-raffle-card-closing')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(ADVANCE_PAST_CLOSE);
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe('');
  });

  it('se cierra al pulsar Escape con la misma rapidez', () => {
    const handleClose = vi.fn();
    render(<RaffleModal onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    act(() => {
      vi.advanceTimersByTime(ADVANCE_PAST_CLOSE);
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('atrapa el foco dentro del diálogo y lo devuelve al cerrar', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    render(<RaffleModal />);
    const dialog = screen.getByRole('dialog');
    const closeBtn = screen.getByLabelText(/Cerrar ventana emergente/i);
    const cta = screen.getByRole('link', { name: /Quiero un boleto/i });

    expect(closeBtn).toHaveFocus();

    cta.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(closeBtn).toHaveFocus();

    closeBtn.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(cta).toHaveFocus();

    trigger.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(closeBtn).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Escape' });
    act(() => {
      vi.advanceTimersByTime(ADVANCE_PAST_CLOSE);
    });

    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('respeta un bloqueo de scroll previo al liberar el suyo', () => {
    document.body.style.overflow = 'auto';
    acquireAtlasScrollLock();

    render(<RaffleModal />);
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(screen.getByLabelText(/Cerrar ventana emergente/i));
    act(() => {
      vi.advanceTimersByTime(ADVANCE_PAST_CLOSE);
    });

    expect(document.body.style.overflow).toBe('hidden');
    releaseAtlasScrollLock();
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });

  it('se cierra al hacer clic en el fondo pero no al hacer clic dentro del contenedor', () => {
    const handleClose = vi.fn();
    render(<RaffleModal onClose={handleClose} />);

    fireEvent.click(screen.getByRole('img', { name: /Gran Rifa de Histología/i }));
    act(() => {
      vi.advanceTimersByTime(ADVANCE_PAST_CLOSE);
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(screen.getByRole('dialog'));
    act(() => {
      vi.advanceTimersByTime(ADVANCE_PAST_CLOSE);
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe('');
  });
});
