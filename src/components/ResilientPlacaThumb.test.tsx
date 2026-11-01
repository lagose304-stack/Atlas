import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResilientPlacaThumb } from './ResilientPlacaThumb';

describe('Lectura de miniaturas tras la migración', () => {
  it('agota las alternativas de R2 sin volver al proveedor anterior', () => {
    render(<ResilientPlacaThumb photoUrl="https://res.cloudinary.com/legacy/image/upload/v123/placas/corte.jpg" />);
    for (let i = 0; i < 3; i++) {
      const image = screen.getByRole('img');
      expect(image.getAttribute('src')).toMatch(/^https:\/\/r2\.atlas-tests\.invalid\//);
      fireEvent.error(image);
    }
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Histología')).toBeInTheDocument();
  });
});
