import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlateAnnotationViewerEditor from './PlateAnnotationViewerEditor';

describe('PlateAnnotationViewerEditor', () => {
  it('inicia con la herramienta Mano (Paneo) por defecto', () => {
    render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        initialSenalados={[]}
        initialSenaladosPos={[]}
        onCancel={vi.fn()}
      />
    );

    // Default tool is Mano / Paneo
    expect(screen.getByText(/Herramienta en uso: ✋ Paneo/i)).toBeInTheDocument();
  });

  it('renderiza herramientas principales del visor y lista de señalados', () => {
    const handleSaveAll = vi.fn();
    const handleCancel = vi.fn();

    render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        aumento="x40"
        tincion="H&E"
        initialSenalados={['Núcleo celular', 'Citoplasma']}
        initialSenaladosPos={[
          { x: 0.3, y: 0.4 },
          { x: 0.6, y: 0.7, regionPoints: [0.5, 0.5, 0.6, 0.5, 0.6, 0.6, 0.5, 0.6], regionColor: '#22c55e', regionOpacity: 0.3 },
        ]}
        onSaveAll={handleSaveAll}
        onCancel={handleCancel}
      />
    );

    // Tools in toolbar
    expect(screen.getByRole('button', { name: /Individual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Múltiples$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Borde$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bordes Múlt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mano/i })).toBeInTheDocument();

    // Initial markers rendered in sidebar / inspector
    expect(screen.getAllByText('Núcleo celular').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Citoplasma')).toBeInTheDocument();

    // Click Guardar señalados
    const saveButton = screen.getByRole('button', { name: /Guardar señalados/i });
    fireEvent.click(saveButton);

    expect(handleSaveAll).toHaveBeenCalledTimes(1);
    expect(handleSaveAll).toHaveBeenCalledWith(
      ['Núcleo celular', 'Citoplasma'],
      [
        { x: 0.3, y: 0.4, startX: null, startY: null, regionPoints: null, regionColor: '#22c55e', regionOpacity: 0.28 },
        { x: 0.6, y: 0.7, startX: null, startY: null, regionPoints: [0.5, 0.5, 0.6, 0.5, 0.6, 0.6, 0.5, 0.6], regionColor: '#22c55e', regionOpacity: 0.3 },
      ]
    );
  });

  it('permite cambiar a Borde y a Bordes Múltiples mostrando sus controles', () => {
    render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        initialSenalados={[]}
        initialSenaladosPos={[]}
        onCancel={vi.fn()}
      />
    );

    const borderToolBtn = screen.getByRole('button', { name: /^Borde$/i });
    fireEvent.click(borderToolBtn);

    // Inspector card updates to show border instructions
    expect(screen.getByText(/Herramienta en uso: ✍️ Borde Individual/i)).toBeInTheDocument();
    expect(screen.getByText(/Color de región:/i)).toBeInTheDocument();
    expect(screen.getByText(/Opacidad de relleno:/i)).toBeInTheDocument();

    const batchBorderToolBtn = screen.getByRole('button', { name: /Bordes Múlt/i });
    fireEvent.click(batchBorderToolBtn);
    expect(screen.getByText(/Herramienta en uso: ✍️✍️ Bordes Múltiples/i)).toBeInTheDocument();
  });

  it('permite guardar correctamente en singlePickerMode y muestra Cancelar / Salir', () => {
    const handleSaveSingle = vi.fn();
    const handleCancel = vi.fn();

    render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        targetLabel="Glomérulo"
        singlePickerMode
        initialLocation={null}
        onSaveSingle={handleSaveSingle}
        onCancel={handleCancel}
      />
    );

    // Cancelar / Salir button exists
    const cancelBtn = screen.getByRole('button', { name: /Cancelar \/ Salir/i });
    expect(cancelBtn).toBeInTheDocument();

    // Select pointer tool
    const pointerBtn = screen.getByRole('button', { name: /Individual/i });
    fireEvent.click(pointerBtn);

    // Save button triggers handleSaveSingle
    const saveBtn = screen.getByRole('button', { name: /Guardar señalados/i });
    fireEvent.click(saveBtn);

    expect(handleSaveSingle).toHaveBeenCalledTimes(1);
  });

  it('deselecciona el señalado al hacer doble clic en el lienzo', () => {
    render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        initialSenalados={['Célula A', 'Célula B']}
        initialSenaladosPos={[{ x: 0.2, y: 0.3 }, { x: 0.7, y: 0.8 }]}
        onCancel={vi.fn()}
      />
    );

    // Initial state: both markers in list
    expect(screen.getByText('Célula A')).toBeInTheDocument();
    expect(screen.getByText('Célula B')).toBeInTheDocument();

    // Click on Celula A card in list to select it
    const markerACard = screen.getByText('Célula A');
    fireEvent.click(markerACard);

    // Only Celula A is visible in the list now
    expect(screen.getAllByText('Célula A').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Célula B')).not.toBeInTheDocument();

    // Double-click on the image/canvas area to deselect
    const image = screen.getByAltText(/Placa histológica de alta calidad/i);
    fireEvent.doubleClick(image.parentElement!);

    // Now both markers are visible again
    expect(screen.getAllByText('Célula A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Célula B')).toBeInTheDocument();
  });
});
