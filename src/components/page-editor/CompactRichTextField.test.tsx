import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CompactRichTextField from './CompactRichTextField';

describe('CompactRichTextField', () => {
  it('expone la corrección en español e intercepta Ctrl+N', () => {
    render(
      <CompactRichTextField
        label="Texto"
        value="<p>texto</p>"
        onChange={vi.fn()}
      />,
    );

    const editable = screen.getByRole('textbox', { name: 'Texto' });
    expect(editable).toHaveAttribute('spellcheck', 'true');
    expect(editable).toHaveAttribute('lang', 'es');

    const handled = fireEvent.keyDown(editable, {
      key: 'n',
      code: 'KeyN',
      ctrlKey: true,
    });
    expect(handled).toBe(false);
  });
});
