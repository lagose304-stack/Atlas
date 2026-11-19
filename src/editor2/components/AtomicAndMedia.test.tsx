import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fromPuckData, toPuckData } from '../adapters/puck';
import {
  createBadgeBlock,
  createButtonBlock,
  createCarouselBlock,
  createEmptyCanvasDoc,
  createIconBlock,
  createImageBlock,
  createNestedCanvasNode,
  createPlacedBlock,
} from '../domain/defaults';
import { BadgeBlockView, IconBlockView } from './Editor2Blocks';
import Editor2Lightbox from './Editor2Lightbox';
import IconPickerModal from './IconPickerModal';

describe('Componentes atómicos, Lightbox y Multimedia (Fase 2 — Parte 5)', () => {
  it('renderiza Insignia en variante Muestra de color (colorimetría) e Icono', () => {
    const { container } = render(
      <>
        <BadgeBlockView
          layout={{ base: { span: 6 } }}
          text="Núcleos basófilos (H&E)"
          variant="swatch"
          color="#6d28d9"
        />
        <IconBlockView
          layout={{ base: { span: 4 } }}
          name="microscope"
          size={36}
          frame="circle"
          label="Microscopio óptico"
        />
      </>,
    );

    expect(screen.getByText('Núcleos basófilos (H&E)')).toBeInTheDocument();
    expect(container.querySelector('.e2-badge__swatch-dot')).toHaveStyle({ backgroundColor: '#6d28d9' });
    expect(screen.getByRole('img', { name: 'Microscopio óptico' })).toBeInTheDocument();
  });

  it('busca iconos en español sin distinguir acentos en IconPickerModal', () => {
    const onSelect = vi.fn();
    render(<IconPickerModal open onSelect={onSelect} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText('Buscar icono'), { target: { value: 'tincion' } });
    const match = screen.getByRole('button', { name: /Matraz \/ Tinción/i });
    fireEvent.click(match);
    expect(onSelect).toHaveBeenCalledWith('flask-conical');
  });

  it('permite hacer zoom y cerrar Editor2Lightbox con Escape', () => {
    const onClose = vi.fn();
    render(
      <Editor2Lightbox
        open
        src="https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/demo.webp"
        alt="Micrografía"
        caption="40×"
        onClose={onClose}
      />,
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(screen.getByText('150%')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('conserva badge, icon, botón con icono/evaluación y mediaAppearance en Puck roundtrip', () => {
    const badge = createBadgeBlock({ text: 'PAS positivo', variant: 'swatch', color: '#db2777', icon: 'droplet' });
    const icon = createIconBlock({ name: 'dna', size: 48, frame: 'circle', align: 'center' });
    const button = createButtonBlock({ label: 'Hacer prueba', href: '/evaluaciones/ejecutar/42' });
    button.props.variant = 'gradient';
    button.props.icon = 'graduation-cap';
    button.props.align = 'center';

    const image = createImageBlock({ alt: 'Epitelio' });
    image.props.media = {
      aspect: '4/3',
      objectPosition: 'top',
      filter: 'vivid',
      radius: 18,
      overlayBadge: 'H&E · 40×',
      overlayPosition: 'tr',
    };

    const carousel = createCarouselBlock();
    carousel.props.autoplay = true;
    carousel.props.intervalSec = 6;
    carousel.props.showArrows = true;
    carousel.props.showDots = false;

    const section = createNestedCanvasNode({
      children: [
        { block: badge, layout: { base: { span: 6 } } },
        { block: icon, layout: { base: { span: 4 } } },
        { block: button, layout: { base: { span: 8 } } },
        { block: image, layout: { base: { span: 12 } } },
        { block: carousel, layout: { base: { span: 12 } } },
      ],
    });
    const doc = createEmptyCanvasDoc('parte5-check', { children: [createPlacedBlock(section)] });

    const roundtrip = fromPuckData(toPuckData(doc));
    const rtSection = roundtrip.root.slots.children[0].block;
    expect(rtSection.type).toBe('canvas');
    if (rtSection.type !== 'canvas') return;

    const [rtBadge, rtIcon, rtBtn, rtImg, rtCar] = rtSection.slots.children.map((c) => c.block);
    expect(rtBadge.type === 'badge' && rtBadge.props.variant).toBe('swatch');
    expect(rtIcon.type === 'icon' && rtIcon.props.name).toBe('dna');
    expect(rtBtn.type === 'button' && rtBtn.props.variant).toBe('gradient');
    expect(rtBtn.type === 'button' && rtBtn.props.icon).toBe('graduation-cap');
    expect(rtImg.type === 'image' && rtImg.props.media?.overlayBadge).toBe('H&E · 40×');
    expect(rtCar.type === 'carousel' && rtCar.props.autoplay).toBe(true);
    expect(rtCar.type === 'carousel' && rtCar.props.intervalSec).toBe(6);
    expect(rtCar.type === 'carousel' && rtCar.props.showDots).toBe(false);
  });
});
