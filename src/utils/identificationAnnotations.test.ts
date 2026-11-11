import { describe, expect, it } from 'vitest';
import { annotationDistractors, annotationQuestion, eligibleAnnotationPlates, generateAnnotationMatch, positionedAnnotations, type AnnotatedPlate } from './identificationAnnotations';

const plate: AnnotatedPlate = { id: 1, subtema_id: 10, senalados: ['**Núcleo**', 'Citoplasma', 'Etiqueta anterior'], senalados_meta: [{ label: '**Núcleo**', x: .2, y: .3 }, { label: 'Citoplasma', x: .4, y: .5 }] };

describe('Preguntas de señalados', () => {
  it('prefiere nombres diferentes entre las placas disponibles sin eliminar nombres compartidos', () => {
    const pool = [1, 2, 3].map(id => ({ id, subtema_id: 10, senalados_meta: ['Núcleo', 'Citoplasma', 'Membrana'].map(label => ({ label, x: .5, y: .5 })) }));
    const rounds = generateAnnotationMatch(pool, pool);
    const remaining = pool.flatMap(item => item.senalados_meta.map(marker => ({ id: item.id, name: marker.label })));
    for (let index = 0; index < rounds.length; index++) {
      const round = rounds[index];
      const previous = rounds[index - 1];
      if (previous) {
        const otherPlates = remaining.filter(item => item.id !== previous.id);
        const candidates = otherPlates.length ? otherPlates : remaining;
        if (candidates.some(item => item.name !== previous.challengeAnnotation.label)) {
          expect(round.challengeAnnotation.label).not.toBe(previous.challengeAnnotation.label);
        }
      }
      remaining.splice(remaining.findIndex(item => item.id === round.id && item.name === round.challengeAnnotation.label), 1);
    }
    expect(rounds.filter(round => round.challengeAnnotation.label === 'Núcleo')).toHaveLength(3);
  });

  it('permite nombres consecutivos si las placas restantes solo tienen ese señalado ubicado', () => {
    const pool = [1, 2, 3].map(id => ({ id, subtema_id: 10, senalados_meta: [{ label: 'Núcleo', x: .5, y: .5 }, { label: 'Citoplasma', x: null, y: null }] }));
    const rounds = generateAnnotationMatch(pool, pool);
    expect(rounds).toHaveLength(3);
    expect(rounds.every(round => round.challengeAnnotation.label === 'Núcleo')).toBe(true);
    expect(new Set(rounds.map(round => round.id)).size).toBe(3);
  });

  it('alterna placas y vuelve a ellas con un señalado diferente sin repetir preguntas', () => {
    const second = { ...plate, id: 2 };
    const rounds = generateAnnotationMatch([plate, second], [plate, second]);
    expect(rounds).toHaveLength(4);
    expect(new Set(rounds.map(round => `${round.id}:${round.challengeAnnotation.label}`)).size).toBe(4);
    expect(rounds.every((round, index) => index === 0 || round.id !== rounds[index - 1].id)).toBe(true);
  });

  it('permite una sola placa con varios señalados y termina cuando se agotan', () => {
    const rounds = generateAnnotationMatch([plate], [plate]);
    expect(rounds).toHaveLength(2);
    expect(rounds.map(round => round.id)).toEqual([1, 1]);
    expect(new Set(rounds.map(round => round.challengeAnnotation.label)).size).toBe(2);
  });

  it('limita la partida a 30 preguntas aunque existan más señalados', () => {
    const pool = [1, 2].map(id => ({ id, subtema_id: 10, senalados_meta: Array.from({ length: 20 }, (_, index) => ({ label: `Estructura ${index}`, x: .5, y: .5 })) }));
    const rounds = generateAnnotationMatch(pool, pool);
    expect(rounds).toHaveLength(30);
    expect(new Set(rounds.map(round => `${round.id}:${round.challengeAnnotation.label}`)).size).toBe(30);
    expect(rounds.every((round, index) => index === 0 || round.id !== rounds[index - 1].id)).toBe(true);
  });

  it('prioriza etiquetas de la misma placa y solo completa con el mismo subtema', () => {
    const pool: AnnotatedPlate[] = [plate,
      { id: 2, subtema_id: 10, senalados: ['núcleo', ' NUCLEO ', 'Membrana', 'Nucléolo'] },
      { id: 3, subtema_id: 99, senalados: ['Otra estructura', 'Otro subtema'] },
    ];
    const wrong = annotationDistractors(plate, 'Núcleo', pool);
    expect(wrong[0]).toBe('Citoplasma');
    expect(new Set(wrong)).toEqual(new Set(['Citoplasma', 'Membrana', 'Nucléolo']));
  });

  it('ofrece menos opciones antes que incluir etiquetas de otro subtema', () => {
    const question = annotationQuestion(plate, [plate, { id: 2, subtema_id: 99, senalados: ['Ajena'] }]);
    expect(question?.options).toHaveLength(2);
    expect(question?.options.filter(option => option.isCorrect)).toHaveLength(1);
    expect(question?.options.some(option => option.name === 'Ajena')).toBe(false);
  });

  it('excluye placas sin ubicación o sin alternativa diferente en el mismo subtema', () => {
    const noLocation = { id: 2, subtema_id: 20, senalados: ['Nombre sin posición', 'Otro'] };
    const alone = { id: 3, subtema_id: 30, senalados_meta: [{ label: 'Único', x: .5, y: .5 }] };
    const pool = [plate, noLocation, alone];
    expect(eligibleAnnotationPlates(pool).map(item => item.id)).toEqual([1]);
    expect(annotationQuestion(alone, pool)).toBeNull();
  });

  it('acepta puntos, agujas y regiones con exclusiones, y omite coordenadas inválidas', () => {
    const markers = positionedAnnotations({ id: 1, subtema_id: 10, senalados_meta: [
      { label: 'Punto', x: 0, y: 1 },
      { label: 'Aguja', x: .5, y: .5, startX: 0, startY: .5 },
      { label: 'Región', regionPoints: [0, 0, 1, 0, 1, 1], regionHoles: [[.1, .1, .2, .1, .2, .2]], regionSmooth: true },
      { label: 'Fuera', x: 2, y: .5 }, { label: 'Sin posición', x: null, y: null },
      { label: 'Malformada', regionPoints: [0, 1, 2] }, { label: '', x: .5, y: .5 }, null,
    ] });
    expect(markers.map(marker => marker.label)).toEqual(['Punto', 'Aguja', 'Región']);
    expect(markers[1].startX).toBe(0);
    expect(markers[2].regionHoles).toHaveLength(1);
  });
});
