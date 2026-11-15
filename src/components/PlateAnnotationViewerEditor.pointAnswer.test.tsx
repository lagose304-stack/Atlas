import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlateAnnotationViewerEditor from './PlateAnnotationViewerEditor';
beforeEach(() => { vi.stubGlobal('DOMMatrixReadOnly', class { a = 1; b = 0; c = 0; d = 1; }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('Editor reducido de respuesta señalada', () => {
  it('ofrece un punto, navegación y borrado sin herramientas múltiples ni inspector', () => {
    const save = vi.fn();
    render(<PlateAnnotationViewerEditor imageSrc="https://example.test/test.webp" singlePickerMode answerPointMode initialLocation={{ x: .3, y: .5 }} onSaveSingle={save} onCancel={vi.fn()} pointInstructions="Señala el núcleo" />);
    fireEvent.load(screen.getByAltText('Placa histológica de alta calidad'));
    expect(screen.getByRole('dialog', { name: 'Responder con un señalado' })).toBeInTheDocument();
    expect(screen.getByText('Señala el núcleo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Borde' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Múltiples' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Panel del editor de señalados')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Colocar o mover señalado' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar señalado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar respuesta' }));
    expect(save).toHaveBeenCalledWith(null, undefined);
  });
});
