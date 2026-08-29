import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlateAnnotationViewerEditor from './PlateAnnotationViewerEditor';

describe('PlateAnnotationViewerEditor', () => {
  it('inicia con la herramienta Mano (Paneo) por defecto con el formulario de creación oculto', () => {
    render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        initialSenalados={[]}
        initialSenaladosPos={[]}
        onCancel={vi.fn()}
      />
    );

    // Default tool is Mano / Paneo (Creation card is hidden until a tool is chosen)
    expect(screen.getByRole('button', { name: /Mano/i })).toBeInTheDocument();
    expect(screen.queryByText(/Nuevo Señalado Individual/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nuevos Señalados Múltiples/i)).not.toBeInTheDocument();
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
        { x: 0.3, y: 0.4, startX: null, startY: null, regionPoints: null, regionHoles: null, regionColor: '#22c55e', regionOpacity: 0.28 },
        { x: 0.6, y: 0.7, startX: null, startY: null, regionPoints: [0.5, 0.5, 0.6, 0.5, 0.6, 0.6, 0.5, 0.6], regionHoles: null, regionColor: '#22c55e', regionOpacity: 0.3 },
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
    expect(screen.getByText(/✍️ Nuevo Borde Individual/i)).toBeInTheDocument();
    expect(screen.getByText(/Color de región:/i)).toBeInTheDocument();
    expect(screen.getByText(/Opacidad de relleno:/i)).toBeInTheDocument();

    const batchBorderToolBtn = screen.getByRole('button', { name: /Bordes Múlt/i });
    fireEvent.click(batchBorderToolBtn);
    expect(screen.getByText(/✍️✍️ Nuevos Bordes Múltiples/i)).toBeInTheDocument();
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

  it('gestiona la sesión de creación: guarda, pasa a Mano y resetea el formulario al cambiar de herramienta', () => {
    const { container } = render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        initialSenalados={[]}
        initialSenaladosPos={[]}
        onCancel={vi.fn()}
      />
    );

    // 1. Seleccionar herramienta Múltiples
    const batchBtn = screen.getByRole('button', { name: /^Múltiples$/i });
    fireEvent.click(batchBtn);

    // Formulario visible con título correcto
    expect(screen.getByText(/📍📍 Nuevos Señalados Múltiples/i)).toBeInTheDocument();

    // El campo contenteditable del formulario existe
    const editableDiv = container.ownerDocument.querySelector('div[contenteditable="true"]') as HTMLDivElement;
    expect(editableDiv).not.toBeNull();
    expect(editableDiv.textContent).toBe('');

    // Escribir nombre en el campo editable
    editableDiv.innerHTML = 'Folículos tiroideos';
    fireEvent.input(editableDiv);

    // 2. Dar click a "Guardar grupo y pasar a Mano"
    const saveGroupBtn = screen.getByRole('button', { name: /Guardar grupo y pasar a Mano/i });
    fireEvent.click(saveGroupBtn);

    // El formulario de creación se oculta al volver a Mano
    expect(screen.queryByText(/📍📍 Nuevos Señalados Múltiples/i)).not.toBeInTheDocument();

    // 3. Al dar clic a otra herramienta (ej. Individual), el formulario aparece limpio y vacío
    const pointerBtn = screen.getByRole('button', { name: /Individual/i });
    fireEvent.click(pointerBtn);

    expect(screen.getByText(/📍 Nuevo Señalado Individual/i)).toBeInTheDocument();
    const freshEditableDiv = container.ownerDocument.querySelector('div[contenteditable="true"]') as HTMLDivElement;
    expect(freshEditableDiv.textContent).toBe('');
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

  it('renderiza la estructura interna/encerrada encima de la envolvente para que sea seleccionable', () => {
    render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        initialSenalados={['Célula Envolvente Grande', 'Núcleo Interno Pequeño']}
        initialSenaladosPos={[
          // Grande (envolvente)
          { x: 0.5, y: 0.5, regionPoints: [0.1, 0.1, 0.9, 0.1, 0.9, 0.9, 0.1, 0.9], regionColor: '#22c55e', regionOpacity: 0.3 },
          // Pequeño (encerrado dentro)
          { x: 0.5, y: 0.5, regionPoints: [0.4, 0.4, 0.6, 0.4, 0.6, 0.6, 0.4, 0.6], regionColor: '#ef4444', regionOpacity: 0.5 },
        ]}
        onCancel={vi.fn()}
      />
    );

    // Simular que la imagen cargó con dimensiones
    const img = screen.getByAltText(/Placa histológica de alta calidad/i);
    Object.defineProperty(img, 'naturalWidth', { value: 1000 });
    Object.defineProperty(img, 'naturalHeight', { value: 800 });
    Object.defineProperty(img, 'clientWidth', { value: 1000 });
    Object.defineProperty(img, 'clientHeight', { value: 800 });
    Object.defineProperty(img, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 }),
    });
    fireEvent.load(img);

    // Los polígonos deben estar en el SVG como paths: el más grande primero (al fondo) y el pequeño después (encima)
    const paths = document.querySelectorAll('path[fill-rule="evenodd"]');
    expect(paths.length).toBeGreaterThanOrEqual(2);

    // Hacer clic en el polígono pequeño (el que está encima / último en el SVG DOM)
    const smallerPath = paths[paths.length - 1];
    fireEvent.click(smallerPath);

    // Al estar seleccionado, se muestra "Señalado Seleccionado (1 de 2)"
    expect(screen.getByText(/Señalado Seleccionado \(1 de 2\)/i)).toBeInTheDocument();
  });

  it('permite recortar y crear zonas de exclusión (donas) dentro de una región seleccionada', () => {
    render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        initialSenalados={['Folículo Tiroideo (Dona)']}
        initialSenaladosPos={[
          {
            x: 0.5,
            y: 0.5,
            regionPoints: [0.1, 0.1, 0.9, 0.1, 0.9, 0.9, 0.1, 0.9],
            regionHoles: [[0.3, 0.3, 0.7, 0.3, 0.7, 0.7, 0.3, 0.7]],
            regionColor: '#3b82f6',
            regionOpacity: 0.35,
          },
        ]}
        onCancel={vi.fn()}
      />
    );

    // Simular carga de imagen
    const img = screen.getByAltText(/Placa histológica de alta calidad/i);
    Object.defineProperty(img, 'naturalWidth', { value: 1000 });
    Object.defineProperty(img, 'naturalHeight', { value: 800 });
    Object.defineProperty(img, 'clientWidth', { value: 1000 });
    Object.defineProperty(img, 'clientHeight', { value: 800 });
    Object.defineProperty(img, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 }),
    });
    fireEvent.load(img);

    // La región dona se renderiza con su path compuesto conteniendo 'Z M' (anillo exterior + hueco)
    const donaPath = document.querySelector('path[fill-rule="evenodd"]');
    expect(donaPath).not.toBeNull();
    const dAttribute = donaPath?.getAttribute('d') || '';
    expect(dAttribute).toContain('M');
    expect(dAttribute).toContain('Z');

    // Seleccionar la dona
    fireEvent.click(donaPath!);

    // En el inspector se muestra la sección de zonas de exclusión
    expect(screen.getByText(/Zonas de exclusión \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Hueco interior #1/i)).toBeInTheDocument();
  });

  it('permite seleccionar una zona de exclusión y eliminarla individualmente', () => {
    render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        initialSenalados={['Folículo Multi-Hueco']}
        initialSenaladosPos={[
          {
            x: 0.5,
            y: 0.5,
            regionPoints: [0.1, 0.1, 0.9, 0.1, 0.9, 0.9, 0.1, 0.9],
            regionHoles: [
              [0.2, 0.2, 0.4, 0.2, 0.4, 0.4, 0.2, 0.4],
              [0.6, 0.6, 0.8, 0.6, 0.8, 0.8, 0.6, 0.8],
            ],
            regionColor: '#3b82f6',
            regionOpacity: 0.35,
          },
        ]}
        onCancel={vi.fn()}
      />
    );

    // Simular carga de imagen
    const img = screen.getByAltText(/Placa histológica de alta calidad/i);
    Object.defineProperty(img, 'naturalWidth', { value: 1000 });
    Object.defineProperty(img, 'naturalHeight', { value: 800 });
    Object.defineProperty(img, 'clientWidth', { value: 1000 });
    Object.defineProperty(img, 'clientHeight', { value: 800 });
    Object.defineProperty(img, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 }),
    });
    fireEvent.load(img);

    // Seleccionar la región
    const regionPath = document.querySelector('path[fill-rule="evenodd"]');
    fireEvent.click(regionPath!);

    // Debe mostrar 2 zonas de exclusión
    expect(screen.getByText(/Zonas de exclusión \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Hueco interior #1/i)).toBeInTheDocument();
    expect(screen.getByText(/Hueco interior #2/i)).toBeInTheDocument();

    // Seleccionar el Hueco #1 desde la lista
    fireEvent.click(screen.getByText(/Hueco interior #1/i));
    expect(screen.getByText(/Seleccionada/i)).toBeInTheDocument();

    // En el SVG aparece el botón interactivo de "Quitar"
    const canvasDeleteBadge = screen.getByText(/🗑️ Quitar/i);
    expect(canvasDeleteBadge).toBeInTheDocument();

    // Eliminar el Hueco #1 haciendo clic en el botón de borrar
    const deleteButtons = screen.getAllByTitle(/Eliminar este hueco de exclusión/i);
    fireEvent.click(deleteButtons[0]);

    // Ahora sólo queda 1 zona de exclusión (Hueco #2 pasó a ser #1)
    expect(screen.getByText(/Zonas de exclusión \(1\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Hueco interior #2/i)).not.toBeInTheDocument();
  });

  it('oculta en el canvas los señalados ajenos al seleccionar uno, manteniendo visibles los del mismo grupo múltiple', () => {
    render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        initialSenalados={[
          'Célula Parietal',
          'Célula Parietal',
          'Célula Principal',
        ]}
        initialSenaladosPos={[
          { x: 0.2, y: 0.3, startX: 0, startY: 0.3 },
          { x: 0.4, y: 0.5, startX: 0, startY: 0.5 },
          { x: 0.8, y: 0.8, startX: 1, startY: 0.8 },
        ]}
        onCancel={vi.fn()}
      />
    );

    // Simular carga de imagen
    const img = screen.getByAltText(/Placa histológica de alta calidad/i);
    Object.defineProperty(img, 'naturalWidth', { value: 1000 });
    Object.defineProperty(img, 'naturalHeight', { value: 800 });
    Object.defineProperty(img, 'clientWidth', { value: 1000 });
    Object.defineProperty(img, 'clientHeight', { value: 800 });
    Object.defineProperty(img, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 }),
    });
    fireEvent.load(img);

    // Inicialmente los 3 señalados están en la vista del SVG
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);

    // Seleccionar el señalado #1 ("Célula Parietal")
    const marker1 = screen.getAllByText('1')[0];
    fireEvent.click(marker1);

    // En el canvas solo deben estar visibles los señalados 1 y 2 (Célula Parietal), el 3 (Célula Principal) se oculta
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('3')).toBeNull();

    // El encabezado indica "Grupo Seleccionado (2 de 3)" y el botón "Ver todos (3)"
    expect(screen.getByText(/Grupo Seleccionado \(2 de 3\)/i)).toBeInTheDocument();
    const verTodosBtn = screen.getByRole('button', { name: /Ver todos \(3\)/i });
    expect(verTodosBtn).toBeInTheDocument();

    // Al hacer clic en "Ver todos", vuelve a mostrarse el señalado 3
    fireEvent.click(verTodosBtn);
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
  });

  it('permite dibujar inmediatamente una zona de exclusión al seleccionar una región sin cambiar de herramienta', () => {
    render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        initialSenalados={['Célula Foveolar']}
        initialSenaladosPos={[
          {
            x: 0.5,
            y: 0.5,
            regionPoints: [0.1, 0.1, 0.9, 0.1, 0.9, 0.9, 0.1, 0.9],
            regionColor: '#22c55e',
            regionOpacity: 0.35,
          },
        ]}
        onCancel={vi.fn()}
      />
    );

    // Simular carga de imagen
    const img = screen.getByAltText(/Placa histológica de alta calidad/i);
    Object.defineProperty(img, 'naturalWidth', { value: 1000 });
    Object.defineProperty(img, 'naturalHeight', { value: 800 });
    Object.defineProperty(img, 'clientWidth', { value: 1000 });
    Object.defineProperty(img, 'clientHeight', { value: 800 });
    Object.defineProperty(img, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 }),
    });
    fireEvent.load(img);

    // Seleccionar la región
    const regionPath = document.querySelector('path[fill-rule="evenodd"]');
    fireEvent.click(regionPath!);
    expect(screen.getByText(/Detalle del Señalado/i)).toBeInTheDocument();

    // No hay zonas de exclusión inicialmente
    expect(screen.queryByText(/Hueco interior/i)).toBeNull();

    // Dibujar directamente una zona de exclusión dentro de la región seleccionada (mouseDown, mouseMove, mouseUp)
    const container = img.parentElement!.parentElement!;
    fireEvent.mouseDown(container, { clientX: 400, clientY: 400, button: 0 });
    fireEvent.mouseMove(container, { clientX: 450, clientY: 400 });
    fireEvent.mouseMove(container, { clientX: 450, clientY: 450 });

    // Durante el trazo en tiempo real se debe mostrar el indicador de exclusión
    expect(screen.getByText(/✂️ Excluyendo/i)).toBeInTheDocument();

    fireEvent.mouseMove(container, { clientX: 400, clientY: 450 });
    fireEvent.mouseUp(container, { clientX: 400, clientY: 400 });

    // La zona de exclusión debe crearse inmediatamente al soltar el trazo
    expect(screen.getByText(/Hueco interior #1/i)).toBeInTheDocument();
  });

  it('bloquea la creación accidental de señalados o regiones al hacer zoom/paneo con dos dedos (multi-touch)', () => {
    render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        initialSenalados={[]}
        initialSenaladosPos={[]}
        onCancel={vi.fn()}
      />
    );

    // Simular carga de imagen
    const img = screen.getByAltText(/Placa histológica de alta calidad/i);
    Object.defineProperty(img, 'naturalWidth', { value: 1000 });
    Object.defineProperty(img, 'naturalHeight', { value: 800 });
    Object.defineProperty(img, 'clientWidth', { value: 1000 });
    Object.defineProperty(img, 'clientHeight', { value: 800 });
    Object.defineProperty(img, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 }),
    });
    fireEvent.load(img);

    // Activar herramienta de Borde
    const borderBtn = screen.getByRole('button', { name: /^Borde$/i });
    fireEvent.click(borderBtn);

    const container = img.parentElement!.parentElement!;

    // Simular gesto de pellizco con 2 dedos (touchStart, touchMove, touchEnd)
    fireEvent.touchStart(container, {
      touches: [
        { clientX: 300, clientY: 300 },
        { clientX: 600, clientY: 600 },
      ],
    });

    fireEvent.touchMove(container, {
      touches: [
        { clientX: 250, clientY: 250 },
        { clientX: 650, clientY: 650 },
      ],
    });

    // Simular que el navegador envió eventos pointer mientras ocurría el gesto táctil
    fireEvent.pointerDown(container, { clientX: 250, clientY: 250, button: 0 });
    fireEvent.pointerMove(container, { clientX: 350, clientY: 350 });

    // No debe haber iniciado ningún trazo de región ni indicador de dibujo
    expect(screen.queryByText(/✂️ Excluyendo/i)).toBeNull();

    fireEvent.touchEnd(container, { touches: [] });
    fireEvent.pointerUp(container, { clientX: 350, clientY: 350 });
    fireEvent.click(container, { clientX: 350, clientY: 350 });

    // No debe haberse creado ningún señalado o polígono
    expect(screen.queryByText(/Región 1/i)).toBeNull();
    expect(screen.queryByText(/Señalado 1/i)).toBeNull();
    expect(screen.getByText(/No hay señalados creados aún/i)).toBeInTheDocument();
  });

  it('permite escribir espacios en el campo del nombre de señalado sin activar atajo de paneo', () => {
    const { container } = render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        initialSenalados={[]}
        initialSenaladosPos={[]}
        onCancel={vi.fn()}
      />
    );

    // Activar herramienta Individual
    const pointerBtn = screen.getByRole('button', { name: /Individual/i });
    fireEvent.click(pointerBtn);

    const editableDiv = container.ownerDocument.querySelector('div[contenteditable="true"]') as HTMLDivElement;
    expect(editableDiv).not.toBeNull();

    // Enfocar el campo editable
    editableDiv.focus();

    // Disparar evento keydown con tecla Space sobre el campo editable
    const spaceKeyDown = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    });
    editableDiv.dispatchEvent(spaceKeyDown);

    // No debe haber cancelado el evento (preventDefault) para permitir escribir espacios
    expect(spaceKeyDown.defaultPrevented).toBe(false);

    // Escribir texto con espacios
    editableDiv.innerHTML = 'Núcleo de célula parietal';
    fireEvent.input(editableDiv);

    expect(editableDiv.textContent).toBe('Núcleo de célula parietal');
  });

  it('preserva las zonas de exclusión (regionHoles) al guardar señalados recién creados', () => {
    const handleSaveAll = vi.fn();

    render(
      <PlateAnnotationViewerEditor
        imageSrc="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        initialSenalados={['Vaso sanguíneo']}
        initialSenaladosPos={[
          {
            x: 0.5,
            y: 0.5,
            startX: null,
            startY: null,
            regionPoints: [0.2, 0.2, 0.8, 0.2, 0.8, 0.8, 0.2, 0.8],
            regionHoles: [[0.4, 0.4, 0.6, 0.4, 0.6, 0.6, 0.4, 0.6]],
            regionColor: '#22c55e',
            regionOpacity: 0.28,
          },
        ]}
        onSaveAll={handleSaveAll}
        onCancel={vi.fn()}
      />
    );

    // Guardar señalados
    const saveButton = screen.getByRole('button', { name: /Guardar señalados/i });
    fireEvent.click(saveButton);

    expect(handleSaveAll).toHaveBeenCalledTimes(1);
    const savedPos = handleSaveAll.mock.calls[0][1];
    expect(savedPos[0].regionHoles).toEqual([
      [0.4, 0.4, 0.6, 0.4, 0.6, 0.6, 0.4, 0.6],
    ]);
  });
});
