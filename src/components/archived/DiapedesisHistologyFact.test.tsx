import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DiapedesisHistologyFact from './DiapedesisHistologyFact';

describe('DiapedesisHistologyFact Component', () => {
  it('renderiza el dato sobre la diapédesis', () => {
    render(<DiapedesisHistologyFact />);
    expect(screen.getByText(/Dato histológico de la semana/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /diapédesis/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /esquema animado de la diapédesis/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pausar animación/i })).toBeInTheDocument();
    expect(screen.getAllByText(/selectinas/i).length).toBeGreaterThan(0);
  });

  it('muestra controles y las cuatro etapas del proceso', () => {
    render(<DiapedesisHistologyFact />);
    expect(screen.getByLabelText(/progreso de la animación/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rodamiento/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /adhesión firme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /diapédesis/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /migración/i })).toBeInTheDocument();
  });

  it('permite personalizar la etiqueta del badge al integrarse en páginas de subtemas', () => {
    render(<DiapedesisHistologyFact badgeLabel="Dato histológico · Diapédesis" />);
    expect(screen.getByText(/Dato histológico · Diapédesis/i)).toBeInTheDocument();
  });
});
