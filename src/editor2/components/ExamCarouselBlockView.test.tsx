import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fromPuckData, toPuckData } from '../adapters/puck';
import {
  createEmptyCanvasDoc,
  createExamCarouselBlock,
  createLeafPlacedBlock,
  createNestedCanvasNode,
  createPlacedBlock,
} from '../domain/defaults';
import { canvasDocSchema } from '../domain/schema';
import ExamCarouselBlockView from './ExamCarouselBlockView';

describe('ExamCarouselBlockView y esquema examCarousel (Fase 3 — Parte 3)', () => {
  it('valida examCarousel en canvasDocSchema y sobrevive ida y vuelta con Puck', () => {
    const block = createExamCarouselBlock({
      parcial: 'segundo',
      title: 'Pruebas del 2.º parcial',
      accentColor: '#0284c7',
      maxItems: 6,
    });
    const section = createNestedCanvasNode({
      children: [createLeafPlacedBlock(block, 24)],
    });
    const doc = createEmptyCanvasDoc('home');
    doc.root.slots.children = [createPlacedBlock(section)];

    expect(() => canvasDocSchema.parse(doc)).not.toThrow();

    const puckData = toPuckData(doc);
    const roundTrip = fromPuckData(puckData);
    expect(() => canvasDocSchema.parse(roundTrip)).not.toThrow();

    const firstSection = roundTrip.root.slots.children[0].block;
    if (firstSection.type !== 'canvas') throw new Error('Se esperaba canvas');
    const leaf = firstSection.slots.children[0].block;
    expect(leaf.type).toBe('examCarousel');
    if (leaf.type === 'examCarousel') {
      expect(leaf.props.parcial).toBe('segundo');
      expect(leaf.props.title).toBe('Pruebas del 2.º parcial');
      expect(leaf.props.accentColor).toBe('#0284c7');
      expect(leaf.props.maxItems).toBe(6);
    }
  });

  it('renderiza pruebas publicadas en vivo con enlaces a /evaluaciones/ejecutar/:id', async () => {
    const loader = vi.fn().mockResolvedValue([
      {
        id: 'test-101',
        nombre: 'Repaso de Epitelios',
        parcialKey: 'primer',
        thumbnailUrl: null,
        temaNombre: 'Tejido Epitelial',
      },
      {
        id: 'test-102',
        nombre: 'Repaso de Tejido Conjuntivo',
        parcialKey: 'primer',
        thumbnailUrl: null,
        temaNombre: 'Tejido Conjuntivo',
      },
    ]);

    render(
      <ExamCarouselBlockView
        layout={{ base: { span: 24 } }}
        parcial="primer"
        title="Evaluaciones activas"
        loadTests={loader}
      />,
    );

    expect(await screen.findByText('Repaso de Epitelios')).toBeInTheDocument();
    expect(screen.getByText('Repaso de Tejido Conjuntivo')).toBeInTheDocument();
    expect(screen.getByText('2 pruebas')).toBeInTheDocument();

    const links = screen.getAllByRole('link', { name: /Iniciar prueba/i });
    expect(links[0]).toHaveAttribute('href', '/evaluaciones/ejecutar/test-101');
    expect(links[1]).toHaveAttribute('href', '/evaluaciones/ejecutar/test-102');
  });

  it('muestra estado vacío claro cuando no hay pruebas publicadas para el parcial', async () => {
    const loader = vi.fn().mockResolvedValue([]);

    render(
      <ExamCarouselBlockView
        layout={{ base: { span: 24 } }}
        parcial="tercer"
        loadTests={loader}
      />,
    );

    expect(await screen.findByText(/No hay pruebas publicadas para/i)).toBeInTheDocument();
    expect(screen.getByText('0 pruebas')).toBeInTheDocument();
  });
});
