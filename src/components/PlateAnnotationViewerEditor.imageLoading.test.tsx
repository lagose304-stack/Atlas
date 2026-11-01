import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlateAnnotationViewerEditor from './PlateAnnotationViewerEditor';

const src = 'https://r2.atlas-tests.invalid/placas/test.webp';

describe('Carga de imagen en el editor de señalados', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('bloquea el guardado hasta cargar el original', () => {
    const onSaveAll = vi.fn();
    render(<PlateAnnotationViewerEditor imageSrc={src} onCancel={vi.fn()} onSaveAll={onSaveAll} />);
    const save = screen.getByRole('button', { name: 'Guardar señalados' });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(onSaveAll).not.toHaveBeenCalled();
    fireEvent.load(screen.getByAltText('Placa histológica de alta calidad'));
    expect(save).toBeEnabled();
  });

  it('explica el error, permite reintentar y conserva los señalados previos', () => {
    const onCancel = vi.fn(), onSaveAll = vi.fn();
    render(<PlateAnnotationViewerEditor imageSrc={src} onCancel={onCancel} onSaveAll={onSaveAll}
      initialSenalados={['Núcleo existente']} initialSenaladosPos={[{ x: 0.3, y: 0.4 }]} />);
    const failed = screen.getByAltText('Placa histológica de alta calidad');
    fireEvent.error(failed);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la imagen de la placa');
    expect(screen.getByRole('button', { name: 'Guardar señalados' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga de imagen' }));
    const retried = screen.getByAltText('Placa histológica de alta calidad');
    expect(retried.getAttribute('src')).not.toBe(src);
    expect(new URL(retried.getAttribute('src')!).searchParams.has('v')).toBe(true);
    fireEvent.load(retried);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar señalados' }));
    expect(onSaveAll).toHaveBeenCalledWith(['Núcleo existente'], [expect.objectContaining({ x: 0.3, y: 0.4 })]);
  });

  it('mantiene disponible la salida si la imagen no existe', () => {
    const onCancel = vi.fn();
    render(<PlateAnnotationViewerEditor imageSrc={src} onCancel={onCancel} />);
    fireEvent.error(screen.getByAltText('Placa histológica de alta calidad'));
    fireEvent.click(screen.getByRole('button', { name: 'Volver al editor' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('prueba las alternativas del original en R2 antes de mostrar el fallo', () => {
    render(<PlateAnnotationViewerEditor imageSrc="https://res.cloudinary.com/legacy/image/upload/v123/placas/test.jpg" onCancel={vi.fn()} />);
    fireEvent.error(screen.getByAltText('Placa histológica de alta calidad'));
    const fallback = screen.getByAltText('Placa histológica de alta calidad');
    expect(fallback.getAttribute('src')).toBe('https://r2.atlas-tests.invalid/placas/test.jpg');
    fireEvent.load(fallback);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar señalados' })).toBeEnabled();
  });

  it('no permanece cargando indefinidamente si el servidor no responde', () => {
    vi.useFakeTimers();
    render(<PlateAnnotationViewerEditor imageSrc={src} onCancel={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(15_001); });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar');
    expect(screen.getByRole('button', { name: 'Guardar señalados' })).toBeDisabled();
  });

  it('reinicia la carga al cambiar la imagen sin reutilizar el estado anterior', () => {
    const onCancel = vi.fn();
    const view = render(<PlateAnnotationViewerEditor imageSrc={src} onCancel={onCancel} />);
    fireEvent.load(screen.getByAltText('Placa histológica de alta calidad'));
    view.rerender(<PlateAnnotationViewerEditor imageSrc="https://r2.atlas-tests.invalid/placas/other.webp" onCancel={onCancel} />);
    expect(screen.getByRole('button', { name: 'Guardar señalados' })).toBeDisabled();
    expect(screen.getByAltText('Placa histológica de alta calidad')).toHaveAttribute('src', 'https://r2.atlas-tests.invalid/placas/other.webp');
  });
});
