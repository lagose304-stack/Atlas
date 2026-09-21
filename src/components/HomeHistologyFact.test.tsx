import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HomeHistologyFact from './HomeHistologyFact';

describe('HomeHistologyFact Component', () => {
  it('renderiza el dato semanal sobre la diapédesis', () => {
    render(<HomeHistologyFact />);
    expect(screen.getByText(/Dato histológico de la semana/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /diapédesis/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /esquema animado de la diapédesis/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pausar animación/i })).toBeInTheDocument();
    expect(screen.getAllByText(/selectinas/i).length).toBeGreaterThan(0);
  });

  it('muestra controles y las cuatro etapas del proceso', () => {
    render(<HomeHistologyFact />);
    expect(screen.getByLabelText(/progreso de la animación/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rodamiento/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /adhesión firme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /diapédesis/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /migración/i })).toBeInTheDocument();
  });
});
