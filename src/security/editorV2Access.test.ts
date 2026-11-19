import { describe, expect, it } from 'vitest';
import { canSeeEditor2Card } from './editorV2Access';

describe('canSeeEditor2Card', () => {
  it('permite la cuenta autorizada sin importar mayúsculas ni espacios', () => {
    expect(canSeeEditor2Card({ username: 'elamlagos3@gmail.com' })).toBe(true);
    expect(canSeeEditor2Card({ username: '  ELAMLAGOS3@GMAIL.COM  ' })).toBe(true);
  });

  it('niega otras cuentas', () => {
    expect(canSeeEditor2Card({ username: 'otra.cuenta@gmail.com' })).toBe(false);
    expect(canSeeEditor2Card({ username: 'elamlagos3@gmail.com.mx' })).toBe(false);
  });

  it('niega ausencia de usuario o de username', () => {
    expect(canSeeEditor2Card(null)).toBe(false);
    expect(canSeeEditor2Card(undefined)).toBe(false);
    expect(canSeeEditor2Card({})).toBe(false);
    expect(canSeeEditor2Card({ username: null })).toBe(false);
  });
});
