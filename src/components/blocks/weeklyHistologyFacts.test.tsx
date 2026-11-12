import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WeeklyHistologyFacts from '../WeeklyHistologyFacts';
import WeeklyHistologyFactsEditor from '../page-editor/WeeklyHistologyFactsEditor';
import { includeHomeWeeklyFacts, LEGACY_HOME_FACTS_ID, readWeeklyFacts, WEEKLY_FACTS_CONTENT } from './weeklyHistologyFactsData';
import type { ContentBlock } from '../../types/contentBlocks';
import { normalizeBlockContent } from './blockRegistry';

describe('Datos histológicos editables', () => {
  it('usa el nombre del tema y actualiza las etiquetas anteriores sin cambiar etiquetas personalizadas', () => {
    const content = normalizeBlockContent('weekly_histology_facts', { fact_1_topic: 'Tema 04 · Tercer parcial', fact_2_topic: 'Tema 03 · Tercer parcial' });
    expect(content.fact_1_topic).toBe('Tema 04 · Sistema Urinario');
    expect(content.fact_2_topic).toBe('Tema 03 · Glándulas Anexas');
    expect(normalizeBlockContent('weekly_histology_facts', { fact_1_topic: 'Mi tema' }).fact_1_topic).toBe('Mi tema');
  });
  it('conserva los dos datos y sus ilustraciones originales por defecto', () => {
    render(<WeeklyHistologyFacts facts={readWeeklyFacts(WEEKLY_FACTS_CONTENT)} />);
    expect(screen.getByRole('heading', { name: 'Datos histológicos de la semana' })).toBeInTheDocument();
    expect(screen.getByText('Tres formas de ver el hígado')).toBeInTheDocument();
    expect(screen.getByText('Asas de Henle largas para ahorrar agua')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('incorpora el bloque existente en la versión del inicio sin duplicarlo ni modificar el original', () => {
    const blocks: ContentBlock[] = [{ id: 'weekly', block_type: 'weekly_publication', entity_type: 'home_page', entity_id: 0, sort_order: 0, content: {} }];
    const result = includeHomeWeeklyFacts(blocks, 'home_page', 0);
    expect(result.map(block => block.id)).toEqual(['weekly', LEGACY_HOME_FACTS_ID]);
    expect(blocks).toHaveLength(1);
    expect(includeHomeWeeklyFacts(result, 'home_page', 0)).toEqual(result);
    result[1].content.facts_visible = 'false';
    expect(includeHomeWeeklyFacts(result, 'home_page', 0)[1].content.facts_visible).toBe('false');
    expect(includeHomeWeeklyFacts(blocks, 'placas_page', 1)).toBe(blocks);
  });

  it('envía texto, selección de imagen, restauración e intercambio al editor', () => {
    const onChange = vi.fn();
    const onPickImage = vi.fn();
    const content: Record<string, string> = { ...WEEKLY_FACTS_CONTENT, fact_1_image_url: 'https://example.com/ref.gif' };
    render(<WeeklyHistologyFactsEditor content={content} onChange={onChange} onPickImage={onPickImage} />);
    fireEvent.change(screen.getByLabelText('Título del componente'), { target: { value: 'Mis datos' } });
    expect(onChange).toHaveBeenLastCalledWith({ title: 'Mis datos' });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar imagen de referencia' }));
    expect(onPickImage).toHaveBeenCalledWith('fact_1_image_url');
    fireEvent.click(screen.getAllByRole('button', { name: 'Restaurar ilustración original' })[0]);
    expect(onChange).toHaveBeenLastCalledWith({ fact_1_image_url: '', fact_1_illustration: 'liver' });
    fireEvent.click(screen.getByRole('button', { name: 'Intercambiar datos' }));
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toMatchObject({ fact_2_image_url: content.fact_1_image_url, fact_1_title: content.fact_2_title });
  });
});
