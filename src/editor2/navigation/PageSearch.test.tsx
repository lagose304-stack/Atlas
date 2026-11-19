import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Editor2CatalogSnapshot } from '../services/catalogIndex';
import {
  loadPageIndex,
  type Editor2PageSummary,
} from '../services/pageIndex';
import { PageSearch } from './PageSearch';

const catalog: Editor2CatalogSnapshot = {
  temas: [
    { id: 7, nombre: 'Tejido epitelial', parcial: 'Primer parcial', sort_order: 1 },
    { id: 12, nombre: 'Tejido conectivo', parcial: 'Segundo parcial', sort_order: 2 },
  ],
  subtemas: [
    { id: 30, nombre: 'Epitelio simple', tema_id: 7, sort_order: 1 },
    { id: 31, nombre: 'Epitelio estratificado', tema_id: 7, sort_order: 2 },
    { id: 44, nombre: 'Colágeno', tema_id: 12, sort_order: 1 },
  ],
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const searchbox = () => screen.getByRole('searchbox', { name: 'Buscar páginas' });

describe('PageSearch', () => {
  let basePages: Editor2PageSummary[] = [];
  let fullPages: Editor2PageSummary[] = [];

  beforeAll(async () => {
    basePages = (await loadPageIndex(async () => ({ temas: [], subtemas: [] }))).pages;
    fullPages = (await loadPageIndex(async () => catalog)).pages;
  });

  const renderSearch = (
    props: Partial<ComponentProps<typeof PageSearch>> = {},
    searchPages = basePages,
  ) => render(
    <MemoryRouter initialEntries={['/editor-paginas-v2']}>
      <PageSearch pages={searchPages} {...props} />
      <LocationProbe />
    </MemoryRouter>,
  );

  it('muestra el explorador y filtra sin acentos', () => {
    renderSearch();

    expect(screen.getByRole('heading', { name: 'Editor de páginas 2.0' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Temario' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Inicio/ }).length).toBeGreaterThan(0);

    fireEvent.change(searchbox(), { target: { value: 'creditos' } });

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('Créditos');
    expect(screen.queryByRole('option', { name: /Inicio/ })).not.toBeInTheDocument();
  });

  it('filtra por sección y ofrece un estado vacío recuperable', () => {
    renderSearch();

    fireEvent.change(searchbox(), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Inicio' }));
    expect(screen.getAllByRole('option')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Créditos' }));
    fireEvent.change(searchbox(), { target: { value: 'temario' } });

    expect(screen.getByText('No hay páginas que coincidan con esa búsqueda y sección.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getAllByRole('link', { name: /Inicio/ }).length).toBeGreaterThan(0);
  });

  it('enfoca el buscador con Ctrl+K y limpia con Escape', () => {
    renderSearch();
    const input = searchbox();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: 'temario' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
  });

  it('abre el resultado activo con flechas y Enter', () => {
    renderSearch({}, fullPages);
    const input = searchbox();

    fireEvent.change(input, { target: { value: 'tejido' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('location')).toHaveTextContent('/editor-paginas-v2/p/subtema-30');
  });

  it('respeta la sección inicial y enfoca al montar cuando se solicita', () => {
    renderSearch({ initialSection: 'Créditos', focusOnMount: true });

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(searchbox()).toHaveFocus();
  });

  it('muestra los subtemas del tema activo al explorar el catálogo', () => {
    renderSearch({}, fullPages);

    expect(screen.getByRole('heading', { name: 'Tejido epitelial' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tejido epitelial/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: /Epitelio simple/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Epitelio estratificado/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tejido conectivo/ }));

    expect(screen.getByRole('heading', { name: 'Tejido conectivo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Colágeno/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Epitelio simple/ })).not.toBeInTheDocument();
  });

  it('mantiene el tema padre al buscar un subtema y navega por la jerarquía', () => {
    renderSearch({}, fullPages);
    const input = searchbox();

    fireEvent.change(input, { target: { value: 'colageno' } });
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /^Tejido conectivo/ })).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('location')).toHaveTextContent('/editor-paginas-v2/p/tema-12');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('location')).toHaveTextContent('/editor-paginas-v2/p/subtema-44');
  });

  it('recorre los temas con las flechas en modo exploración', () => {
    renderSearch({}, fullPages);
    const input = searchbox();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('heading', { name: 'Tejido conectivo' })).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('location')).toHaveTextContent('/editor-paginas-v2/p/tema-12');
  });
});
