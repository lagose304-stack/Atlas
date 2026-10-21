import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EpidermisHistologyFact from './EpidermisHistologyFact';

describe('EpidermisHistologyFact Component', () => {
  it('renderiza el dato semanal sobre la epidermis', () => {
    render(<EpidermisHistologyFact />);
    expect(screen.getByText(/Dato histológico de la semana/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /^epidermis$/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /corte de la epidermis con sus estratos y poblaciones celulares/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pausar animación/i })).toBeInTheDocument();
    expect(screen.getAllByText(/queratinocito/i).length).toBeGreaterThan(0);
  });

  it('muestra controles, slider y las cuatro etapas con sus tabs', () => {
    render(<EpidermisHistologyFact />);
    expect(screen.getByLabelText(/progreso de la animación de epidermis/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /estratos de la epidermis/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /queratinocitos/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /melanocitos y células de merkel/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /células de langerhans/i })).toBeInTheDocument();
  });

  it('permite personalizar la etiqueta del badge', () => {
    render(<EpidermisHistologyFact badgeLabel="Dato histológico especial" />);
    expect(screen.getByText(/Dato histológico especial/i)).toBeInTheDocument();
  });
});
