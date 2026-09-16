import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HomeHistologyFact from './HomeHistologyFact';

describe('HomeHistologyFact Component', () => {
  it('renderiza la explicación breve de Antígeno, Inmunógeno y Hapteno', () => {
    render(<HomeHistologyFact />);

    expect(screen.getByText(/Dato histológico de la semana/i)).toBeInTheDocument();
    expect(screen.getByText(/Diferencia: Antígeno, Inmunógeno y Hapteno/i)).toBeInTheDocument();

    expect(screen.getAllByText(/Antígeno/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Solo garantiza unión/i)).toBeInTheDocument();

    expect(screen.getAllByText(/Inmunógeno/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Se une \+ Activa defensas/i)).toBeInTheDocument();

    expect(screen.getAllByText(/Hapteno/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Solo activa con Carrier/i)).toBeInTheDocument();

    expect(screen.getByText(/Todo inmunógeno es antígeno, pero no todo antígeno es inmunógeno/i)).toBeInTheDocument();

    // Comprobar que los textos removidos ya no existen
    expect(screen.queryByText(/Fuente confiable/i)).toBeNull();
    expect(screen.queryByText(/Microscopía en vivo/i)).toBeNull();
    expect(screen.queryByText(/Campo oscuro/i)).toBeNull();
    expect(screen.queryByText(/Inmunología & Tejido Linfoide/i)).toBeNull();
  });

  it('renderiza la imagen animada de la bacteria limpia sin textos superpuestos', () => {
    render(<HomeHistologyFact />);

    const bacteriaImg = screen.getByAltText(/bacteria/i);
    expect(bacteriaImg).toBeInTheDocument();

    expect(screen.queryByText(/Ejemplo de Inmunógeno Completo/i)).toBeNull();
    expect(screen.queryByText(/Alta Inmunogenicidad/i)).toBeNull();
    expect(screen.queryByText(/Múltiples epítopos/i)).toBeNull();
  });
});
