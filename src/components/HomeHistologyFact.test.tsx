import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HomeHistologyFact from './HomeHistologyFact';

describe('HomeHistologyFact Component (Vena adrenomedular)', () => {
  it('renderiza el dato semanal sobre la vena adrenomedular', () => {
    render(<HomeHistologyFact />);
    expect(screen.getByText(/Dato histológico de la semana/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /vena adrenomedular/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /comparación de la pared de una vena típica y de la vena adrenomedular/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pausar animación/i })).toBeInTheDocument();
    expect(screen.getAllByText(/haces longitudinales/i).length).toBeGreaterThan(0);
  });

  it('muestra controles, slider y las cuatro fases comparativas', () => {
    render(<HomeHistologyFact />);
    expect(screen.getByLabelText(/progreso de la animación comparativa/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /vena típica/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /vena adrenomedular/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /haces longitudinales/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /función reguladora/i })).toBeInTheDocument();
  });

  it('permite personalizar la etiqueta del badge', () => {
    render(<HomeHistologyFact badgeLabel="Dato histológico especial" />);
    expect(screen.getByText(/Dato histológico especial/i)).toBeInTheDocument();
  });
});
