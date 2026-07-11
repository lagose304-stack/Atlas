import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PageNavigator from './PageNavigator';

const temas = [{ id: 1, nombre: 'Tejido epitelial', parcial: 'primer' }];
const subtemas = [{ id: 10, nombre: 'Epitelio simple', tema_id: 1 }];

describe('navegador del editor visual', () => {
  it('permite elegir una página individual sin conocer su ruta', () => {
    const onSelect = vi.fn();
    render(
      <PageNavigator
        selection={{ kind: 'home', label: 'Inicio' }}
        temas={temas}
        subtemas={subtemas}
        loading={false}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Epitelio simple' }));
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'subtema', id: 10, temaId: 1, label: 'Epitelio simple', parentLabel: 'Tejido epitelial',
    });
  });

  it('filtra temas y subtemas desde una sola búsqueda', () => {
    render(
      <PageNavigator
        selection={{ kind: 'home', label: 'Inicio' }}
        temas={temas}
        subtemas={subtemas}
        loading={false}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'simple' } });
    expect(screen.getByRole('button', { name: 'Epitelio simple' })).toBeInTheDocument();
  });
});
