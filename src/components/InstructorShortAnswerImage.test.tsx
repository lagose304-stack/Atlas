import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InstructorShortAnswerImage from './InstructorShortAnswerImage';

vi.mock('../styles/comparador.css', () => ({}));
vi.mock('./PlateAnnotationViewerEditor', () => ({ default: ({ initialSenalados, onSaveAll, onCancel }: {
  initialSenalados: string[]; onSaveAll: (labels: string[], positions: { x: number; y: number }[]) => void; onCancel: () => void;
}) => <div role="dialog" aria-label="Editor de señalados del inciso"><span>{initialSenalados.join(',')}</span>
  <button onClick={() => onSaveAll(['Nombre privado'], [{ x: .4, y: .6 }])}>Aplicar marcas locales</button>
  <button onClick={onCancel}>Cancelar marcas</button></div> }));
vi.mock('./comparador/PlatePickerModal', () => ({ default: ({ onSelectPlate }: { onSelectPlate: (plate: unknown) => void }) =>
  <button onClick={() => onSelectPlate({ id: 12, photo_url: 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/site/plate.webp' })}>Seleccionar placa de ejemplo</button> }));

describe('Imagen opcional de respuesta breve', () => {
  it('guarda señalados solo en la referencia del inciso y los retira al elegir otra imagen', async () => {
    const original = Object.freeze({ url: 'https://example.test/photo.webp', source: 'catalog' as const, plate_id: 7 });
    const change = vi.fn();
    render(<InstructorShortAnswerImage image={original} onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Añadir señalado' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar marcas locales' }));
    expect(change).toHaveBeenCalledWith({ ...original, annotations: [{ label: 'Nombre privado', x: .4, y: .6 }] });
    expect(original).not.toHaveProperty('annotations');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir del sitio' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Seleccionar placa de ejemplo' }));
    expect(change.mock.calls[change.mock.calls.length - 1][0]).not.toHaveProperty('annotations');
  });

  it('reabre las marcas propias y cancelar no modifica el inciso', async () => {
    const change = vi.fn();
    render(<InstructorShortAnswerImage image={{ url: 'https://example.test/photo.webp', source: 'upload', annotations: [{ label: 'Mi marca', x: .2, y: .3 }] }} onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar señalados (1)' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Mi marca');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar marcas' }));
    expect(change).not.toHaveBeenCalled();
  });
  it('reutiliza una placa sin subir archivos', async () => {
    const change = vi.fn(); const upload = vi.fn();
    render(<InstructorShortAnswerImage onChange={change} onSelectFile={upload} />);
    fireEvent.click(screen.getByRole('button', { name: 'Elegir del sitio' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Seleccionar placa de ejemplo' }));
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ source: 'catalog', plate_id: 12, url: expect.stringContaining('/site/plate.webp') }));
    expect(upload).not.toHaveBeenCalled();
  });

  it('valida el archivo antes de prepararlo y permite quitar una referencia existente', () => {
    const change = vi.fn(); const upload = vi.fn();
    render(<InstructorShortAnswerImage image={{ url: 'https://example.test/image.webp', source: 'upload' }} onChange={change} onSelectFile={upload} />);
    const input = screen.getByLabelText('Archivo de imagen de respuesta breve');
    fireEvent.change(input, { target: { files: [new File(['test'], 'test.svg', { type: 'image/svg+xml' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('PNG, JPEG o WebP');
    expect(upload).not.toHaveBeenCalled();
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(upload).toHaveBeenCalledWith(file);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar imagen' }));
    expect(change).toHaveBeenCalledWith(undefined);
  });
});
