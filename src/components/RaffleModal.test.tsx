import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RaffleModal from './RaffleModal';

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

  it('muestra la animación de la carita triste al hacer clic en el botón superior (X) y luego se cierra', () => {
    const handleClose = vi.fn();
    render(<RaffleModal onClose={handleClose} />);

    const closeBtn = screen.getByLabelText(/Cerrar ventana emergente/i);
    fireEvent.click(closeBtn);

    // Debe mostrar la carita triste y el mensaje de despedida
    expect(screen.getByText(/¡Esperamos verte en la rifa!/i)).toBeInTheDocument();

    // Avanza la animación completa (1850ms de carita triste + 220ms de fade-out)
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('muestra la carita triste al pulsar la tecla Escape y luego se cierra', () => {
    const handleClose = vi.fn();
    render(<RaffleModal onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByText(/¡Esperamos verte en la rifa!/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('se cierra al hacer clic en el fondo (backdrop) pero no al hacer clic dentro del contenedor', () => {
    const handleClose = vi.fn();
    render(<RaffleModal onClose={handleClose} />);

    const img = screen.getByRole('img', { name: /Gran Rifa de Histología/i });
    fireEvent.click(img);

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    // Sigue abierto porque se hizo clic adentro
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    expect(document.body.style.overflow).toBe('hidden');

    // Clic en el backdrop overlay
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);

    expect(screen.getByText(/¡Esperamos verte en la rifa!/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe('');
  });
});
