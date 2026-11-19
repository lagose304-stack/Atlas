import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EDITOR2_DEFAULT_IMAGE_SRC } from '../domain/defaults';
import {
  AccordionBlockView,
  ButtonBlockView,
  CalloutBlockView,
  CanvasBlockView,
  CarouselBlockView,
  CompareBlockView,
  DividerBlockView,
  GifBlockView,
  HeadingBlockView,
  ImageBlockView,
  TableBlockView,
  TabsBlockView,
  TextBlockView,
  VideoBlockView,
  editor2PuckConfig,
} from './Editor2Blocks';

const config = editor2PuckConfig as unknown as {
  components: Record<string, { inline: boolean; fields: Record<string, unknown>; defaultProps: unknown }>;
  root: {
    fields: Record<string, unknown>;
    render: (props: { gap?: string; children?: ReactNode }) => ReactElement;
  };
};

describe('vistas de bloques', () => {
  it('pinta títulos con nivel semántico y clases de distribución', () => {
    render(
      <HeadingBlockView
        layout={{ base: { span: 12 }, md: { span: 6, start: 2 } }}
        level={2}
        text="Tejido epitelial"
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Tejido epitelial' })).toBeInTheDocument();
    expect(screen.getByText('Tejido epitelial').closest('[data-e2-block]')).toHaveClass(
      'e2-block',
      'e2-block--heading',
      'e2-span-base-12',
      'e2-span-md-6',
      'e2-start-md-2',
    );
  });

  it('muestra un marcador de posición solo al editar un título vacío', () => {
    const { rerender } = render(
      <HeadingBlockView layout={{ base: { span: 12 } }} level={1} text="" editing />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('e2-block__placeholder');
    expect(screen.getByText('Escribe un título')).toBeInTheDocument();

    rerender(<HeadingBlockView layout={{ base: { span: 12 } }} level={1} text="" />);
    expect(screen.getByRole('heading', { level: 1 })).toBeEmptyDOMElement();
  });

  it('muestra tiradores de redimensionamiento en el lienzo solo en modo edición', () => {
    const { container, rerender } = render(
      <HeadingBlockView layout={{ base: { span: 8 } }} level={2} text="Subtítulo" editing />,
    );
    expect(container.querySelectorAll('[data-e2-resize]')).toHaveLength(7);

    rerender(<HeadingBlockView layout={{ base: { span: 8 } }} level={2} text="Subtítulo" />);
    expect(container.querySelectorAll('[data-e2-resize]')).toHaveLength(0);
  });

  it('permite editar el texto directamente en el bloque del lienzo y omite el campo texto en la barra', () => {
    const onTextChange = vi.fn();
    render(
      <HeadingBlockView
        layout={{ base: { span: 8 } }}
        level={2}
        text="Subtítulo"
        editing
        onTextChange={onTextChange}
      />,
    );

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveAttribute('contenteditable', 'true');
    fireEvent.focus(heading);
    heading.textContent = 'Epitelio cilíndrico';
    fireEvent.input(heading);

    expect(onTextChange).toHaveBeenCalledWith('Epitelio cilíndrico');
    expect(config.components.heading.fields.text).toBeUndefined();
    expect(config.components.text.fields.text).toBeUndefined();
  });

  it('permite volver a editar un párrafo tras salir y regresar, y usa color negro por defecto', () => {
    const onTextChange = vi.fn();
    const { rerender } = render(
      <TextBlockView
        layout={{ base: { span: 10 } }}
        text="Texto inicial"
        editing
        onTextChange={onTextChange}
      />,
    );

    const paragraph = screen.getByText('Texto inicial');
    expect(paragraph).toHaveStyle({ color: 'rgb(0, 0, 0)' });

    fireEvent.focus(paragraph);
    paragraph.textContent = 'Primera edición';
    fireEvent.input(paragraph);
    fireEvent.blur(paragraph);
    expect(onTextChange).toHaveBeenLastCalledWith('Primera edición');

    rerender(
      <TextBlockView
        layout={{ base: { span: 10 } }}
        text="Primera edición"
        editing
        onTextChange={onTextChange}
      />,
    );

    fireEvent.focus(paragraph);
    paragraph.textContent = 'Segunda edición tras regresar';
    fireEvent.input(paragraph);
    fireEvent.blur(paragraph);
    expect(onTextChange).toHaveBeenLastCalledWith('Segunda edición tras regresar');
  });

  it('pinta párrafos con saltos de línea conservados', () => {
    render(
      <TextBlockView layout={{ base: { span: 6 } }} text={'Primera línea\nSegunda línea'} />,
    );

    expect(screen.getByText(/Primera línea/).textContent).toBe('Primera línea\nSegunda línea');
    expect(screen.getByText(/Primera línea/).closest('[data-e2-block]')).toHaveClass(
      'e2-block--text',
      'e2-span-base-6',
    );
  });

  it('pinta imágenes con pie opcional', () => {
    const { rerender } = render(
      <ImageBlockView
        layout={{ base: { span: 4 } }}
        src="https://r2.atlas-tests.invalid/placa.webp"
        alt="Epitelio cúbico"
        caption="Cortesía de Atlas"
      />,
    );

    expect(screen.getByRole('img', { name: 'Epitelio cúbico' })).toHaveAttribute(
      'src',
      'https://r2.atlas-tests.invalid/placa.webp',
    );
    expect(screen.getByText('Cortesía de Atlas')).toBeInTheDocument();

    rerender(
      <ImageBlockView
        layout={{ base: { span: 4 } }}
        src="https://r2.atlas-tests.invalid/placa.webp"
        alt="Epitelio cúbico"
        caption=""
      />,
    );
    expect(screen.queryByText('Cortesía de Atlas')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('pinta un lienzo anidado con su slot y separación', () => {
    render(
      <CanvasBlockView gap="lg">
        <div className="e2-slot-grid" data-testid="slot">
          <span>Dentro</span>
        </div>
      </CanvasBlockView>,
    );

    const block = screen.getByTestId('slot').closest('[data-e2-block]');
    expect(block).toHaveClass('e2-block--canvas', 'e2-gap-lg');
    expect(screen.getByText('Dentro')).toBeInTheDocument();
  });

  it('pinta separador, botón, tabla, carrusel y pestañas con sus controles interactivos', () => {
    render(
      <>
        <DividerBlockView layout={{ base: { span: 12 } }} orientation="horizontal" lineStyle="dashed" />
        <ButtonBlockView layout={{ base: { span: 6 } }} label="Ir al temario" href="/temario" variant="solid" />
        <TableBlockView
          layout={{ base: { span: 12 } }}
          headers={['Tejido', 'Función']}
          rows={[['Epitelial', 'Revestimiento']]}
        />
        <CarouselBlockView
          layout={{ base: { span: 10 } }}
          items={[
            { src: 'https://r2.atlas-tests.invalid/1.webp', alt: 'Muestra 1', caption: 'Primera' },
            { src: 'https://r2.atlas-tests.invalid/2.webp', alt: 'Muestra 2', caption: 'Segunda' },
          ]}
        />
        <TabsBlockView
          layout={{ base: { span: 12 } }}
          items={[
            { title: 'Pestaña A', content: 'Contenido A' },
            { title: 'Pestaña B', content: 'Contenido B' },
          ]}
        />
      </>,
    );

    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al temario' })).toHaveAttribute('href', '/temario');
    expect(screen.getByRole('columnheader', { name: 'Tejido' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Revestimiento' })).toBeInTheDocument();

    expect(screen.getByText('Primera')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente imagen' }));
    expect(screen.getByText('Segunda')).toBeInTheDocument();

    expect(screen.getByText('Contenido A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Pestaña B' }));
    expect(screen.getByText('Contenido B')).toBeInTheDocument();
  });
  it('pinta gif, video, comparador, nota/aviso y acordeón con sus controles', () => {
    render(
      <>
        <GifBlockView
          layout={{ base: { span: 6 } }}
          src="https://r2.atlas-tests.invalid/mitosis.gif"
          alt="Animación de mitosis"
          caption="Ciclo celular"
        />
        <VideoBlockView
          layout={{ base: { span: 12 } }}
          url="https://youtu.be/dQw4w9WgXcQ"
          caption="Explicación en video"
        />
        <CompareBlockView
          layout={{ base: { span: 10 } }}
          leftSrc="https://r2.atlas-tests.invalid/10x.webp"
          leftLabel="10x"
          rightSrc="https://r2.atlas-tests.invalid/40x.webp"
          rightLabel="40x"
        />
        <CalloutBlockView
          layout={{ base: { span: 12 } }}
          tone="clinical"
          title="Correlación clínica"
          text="Metaplasia escamosa."
        />
        <AccordionBlockView
          items={[
            { title: 'Pregunta 1', openByDefault: true, content: 'Respuesta 1' },
            { title: 'Pregunta 2', openByDefault: false, content: 'Respuesta 2' },
          ]}
        />
      </>,
    );

    expect(screen.getByRole('img', { name: 'Animación de mitosis' })).toBeInTheDocument();
    expect(screen.getByTitle('Explicación en video')).toHaveAttribute(
      'src',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
    expect(screen.getByLabelText('Deslizador de comparación de imágenes')).toBeInTheDocument();
    expect(screen.getByText('Correlación clínica')).toBeInTheDocument();
    expect(screen.getByText('Respuesta 1')).toBeInTheDocument();
    expect(screen.queryByText('Respuesta 2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pregunta 2' }));
    expect(screen.getByText('Respuesta 2')).toBeInTheDocument();
  });
});

describe('configuración de Puck', () => {
  it('declara todos los primitivos en línea', () => {
    expect(Object.keys(config.components)).toEqual([
      'heading',
      'text',
      'image',
      'divider',
      'button',
      'table',
      'carousel',
      'gif',
      'video',
      'compare',
      'callout',
      'badge',
      'icon',
      'box',
      'tabs',
      'accordion',
      'examCarousel',
      'canvas',
    ]);
    for (const definition of Object.values(config.components)) {
      expect(definition.inline).toBe(true);
    }
  });

  it('limita el slot del lienzo y coloca Pestañas y Acordeón como estructura para anidar bloques de página', () => {
    expect(config.components.canvas.fields).toMatchObject({
      gap: { type: 'select' },
      content: {
        type: 'slot',
        allow: [
          'heading',
          'text',
          'image',
          'gif',
          'video',
          'compare',
          'callout',
          'divider',
          'button',
          'table',
          'carousel',
          'badge',
          'icon',
          'examCarousel',
          'box',
          'tabs',
          'accordion',
        ],
        disallow: ['canvas'],
      },
    });
    expect(config.components.tabs.fields).toMatchObject({
      items: {
        type: 'array',
        visible: false,
        arrayFields: {
          title: { type: 'text' },
          content: {
            type: 'slot',
            allow: ['canvas'],
          },
        },
      },
    });
    expect(config.components.accordion.fields).toMatchObject({
      items: {
        type: 'array',
        visible: false,
        arrayFields: {
          title: { type: 'text' },
          content: {
            type: 'slot',
            allow: ['canvas'],
          },
        },
      },
    });
  });

  it('usa una imagen real de R2 y tamaños compactos iniciales por componente', () => {
    expect(config.components.heading.defaultProps).toMatchObject({
      layout: { base: { span: 8, rowSpan: 1 } },
    });
    expect(config.components.text.defaultProps).toMatchObject({
      layout: { base: { span: 10, rowSpan: 2 } },
    });
    expect(config.components.image.defaultProps).toMatchObject({
      layout: { base: { span: 6, rowSpan: 4 } },
      src: EDITOR2_DEFAULT_IMAGE_SRC,
      alt: 'Placa histológica de Atlas',
    });
    expect(EDITOR2_DEFAULT_IMAGE_SRC).toMatch(/^https:\/\/.+\/placas\/.+\.webp$/);
  });

  it('permite editar la separación de la rejilla raíz', () => {
    expect(config.root.fields.gap).toMatchObject({ type: 'select' });
  });

  it('pinta la raíz como contenedor de consulta de la rejilla', () => {
    const element = config.root.render({
      gap: 'sm',
      children: <span>Contenido</span>,
    });
    const { container } = render(element);

    expect(container.querySelector('[data-e2-canvas-root]')).toHaveClass('e2-canvas-root', 'e2-gap-sm');
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it('cambia columnas y activa breakpoints desde el campo de distribución', () => {
    const onChange = vi.fn();
    const field = config.components.heading.fields.layout as {
      render: (props: Record<string, unknown>) => ReactElement;
    };
    const element = field.render({
      field,
      name: 'layout',
      id: 'layout-1',
      value: { base: { span: 6 } },
      onChange,
    });
    render(element);

    fireEvent.change(screen.getByLabelText('Columnas en base'), { target: { value: '4' } });
    expect(onChange).toHaveBeenLastCalledWith({ base: { span: 4 } });

    fireEvent.change(screen.getByLabelText('Pantalla'), { target: { value: 'md' } });
    fireEvent.click(screen.getByLabelText('Usar distribución mediano'));
    expect(onChange).toHaveBeenLastCalledWith({ base: { span: 6 }, md: { span: 6 } });
  });

  it('no permite un inicio que desborde las 24 columnas', () => {
    const onChange = vi.fn();
    const field = config.components.heading.fields.layout as {
      render: (props: Record<string, unknown>) => ReactElement;
    };
    render(
      field.render({
        field,
        name: 'layout',
        id: 'layout-2',
        value: { base: { span: 24 } },
        onChange,
      }),
    );

    const start = screen.getByLabelText('Columna inicial en base') as HTMLSelectElement;
    expect([...start.options].map((option) => option.value)).toEqual(['', '1']);
  });

  it('sincroniza breakpoints activos al editar la distribución en base', () => {
    const onChange = vi.fn();
    const field = config.components.heading.fields.layout as {
      render: (props: Record<string, unknown>) => ReactElement;
    };
    render(
      field.render({
        field,
        name: 'layout',
        id: 'layout-3',
        value: { base: { span: 24 }, lg: { span: 24, start: 1, row: 1 } },
        onChange,
      }),
    );

    fireEvent.change(screen.getByLabelText('Columnas en base'), { target: { value: '12' } });
    expect(onChange).toHaveBeenLastCalledWith({
      base: { span: 12, start: 1, row: 1 },
      lg: { span: 12, start: 1, row: 1 },
    });
  });
});
