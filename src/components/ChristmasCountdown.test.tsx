import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ChristmasCountdown from './ChristmasCountdown';

describe('ChristmasCountdown Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renderiza la cuenta regresiva con sus etiquetas y dígitos principales', () => {
    // Fijar fecha en 23 de octubre
    vi.setSystemTime(new Date(2026, 9, 23, 12, 0, 0));

    render(<ChristmasCountdown />);

    expect(screen.getByText(/Cuenta Regresiva Navideña/i)).toBeInTheDocument();
    expect(screen.getByText(/para Navidad/i)).toBeInTheDocument();
    expect(screen.getByTestId('countdown-days')).toBeInTheDocument();
    expect(screen.getByTestId('countdown-hours')).toBeInTheDocument();
    expect(screen.getByTestId('countdown-minutes')).toBeInTheDocument();
    expect(screen.getByTestId('countdown-seconds')).toBeInTheDocument();
    expect(screen.getByText(/25 de diciembre de 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/En vivo/i)).toBeInTheDocument();
  });

  it('permite personalizar la etiqueta del badge', () => {
    vi.setSystemTime(new Date(2026, 9, 23, 12, 0, 0));
    render(<ChristmasCountdown badgeLabel="Temporada Navideña Atlas" />);
    expect(screen.getByText(/Temporada Navideña Atlas/i)).toBeInTheDocument();
  });

  it('actualiza el contador automáticamente al avanzar el tiempo', () => {
    vi.setSystemTime(new Date(2026, 11, 24, 23, 59, 50)); // 10 segundos antes de Navidad
    render(<ChristmasCountdown />);

    const secondsEl = screen.getByTestId('countdown-seconds');
    expect(secondsEl.textContent).toBe('10');

    act(() => {
      vi.advanceTimersByTime(2000); // Avanzar 2 segundos
    });

    expect(secondsEl.textContent).toBe('08');
  });

  it('muestra el mensaje de celebración cuando es 25 de diciembre', () => {
    vi.setSystemTime(new Date(2026, 11, 25, 10, 30, 0)); // Día de Navidad
    render(<ChristmasCountdown />);

    expect(screen.getByText(/¡Feliz Navidad! 🎄✨/i)).toBeInTheDocument();
    expect(screen.getByText(/¡Llegó el día tan esperado!/i)).toBeInTheDocument();
  });
});
