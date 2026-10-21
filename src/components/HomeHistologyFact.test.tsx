import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HomeHistologyFact from './HomeHistologyFact';

describe('HomeHistologyFact Component (Eje hipotálamo-hipófisis)', () => {
  it('renderiza el dato semanal sobre el eje hipotálamo-hipófisis', () => {
    render(<HomeHistologyFact />);
    expect(screen.getByText(/Dato histológico de la semana/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /eje hipotálamo-hipófisis/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /esquema del eje hipotálamo, hipófisis, glándula y órgano diana/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pausar animación/i })).toBeInTheDocument();
    expect(screen.getByText(/eje tiroideo/i)).toBeInTheDocument();
    expect(screen.getByText(/eje suprarrenal/i)).toBeInTheDocument();
    expect(screen.getByText(/eje gonadal/i)).toBeInTheDocument();
  });

  it('muestra controles, slider, inyección hormonal y las cuatro etapas con sus tabs', () => {
    render(<HomeHistologyFact />);
    expect(screen.getByLabelText(/progreso de la animación del eje hipotálamo-hipófisis/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subir nivel de t3 \/ t4/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /etapa 1: hipotálamo/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /etapa 2: hipófisis/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /etapa 3: glándula y órgano/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /etapa 4: retroalimentación/i })).toBeInTheDocument();
  });

  it('permite personalizar la etiqueta del badge', () => {
    render(<HomeHistologyFact badgeLabel="Dato histológico especial" />);
    expect(screen.getByText(/Dato histológico especial/i)).toBeInTheDocument();
  });
});
