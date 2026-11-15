import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InstructorSectionsEditor from './InstructorSectionsEditor';
import type { InstructorContent } from '../services/instructorTests';
const mocks = vi.hoisted(() => ({ temas: vi.fn() }));
vi.mock('../services/catalogService', () => ({ getCachedTemas: mocks.temas }));
function Editor() {
  const [content, setContent] = useState<InstructorContent>({ nombre: 'Prueba', instrucciones: '', questions: [], groups: [{ id: 'g', titulo: '', item_ids: [] }] });
  return <><InstructorSectionsEditor content={content} onChange={setContent} /><output>{JSON.stringify(content)}</output></>;
}
describe('Secciones por tema del Atlas', () => {
  it('carga solo temas, agrega secciones y evita repetir el tema sin borrar preguntas', async () => {
    mocks.temas.mockResolvedValue([{ id: 1, nombre: 'Epitelial' }, { id: 2, nombre: 'Muscular' }]);
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => 'section-1' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Editor />);
    await screen.findByRole('option', { name: 'Epitelial' });
    fireEvent.change(screen.getByLabelText('Tema del Atlas'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar sección' }));
    expect(screen.queryByRole('option', { name: 'Epitelial' })).not.toBeInTheDocument();
    expect(screen.getByText('Epitelial')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar sección Epitelial' }));
    expect(await screen.findByRole('option', { name: 'Epitelial' })).toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toContain('"id":"g"');
  });
});
