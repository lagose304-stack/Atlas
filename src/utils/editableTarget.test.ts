import { describe, expect, it } from 'vitest';
import { isEditableTarget } from './editableTarget';

describe('isEditableTarget', () => {
  it.each(['true', '', 'plaintext-only'])('reconoce descendientes de contenteditable=%s', value => {
    const parent = document.createElement('div');
    parent.setAttribute('contenteditable', value);
    const child = parent.appendChild(document.createElement('strong'));
    expect(isEditableTarget(child)).toBe(true);
  });
  it('distingue campos nativos y zonas no editables', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      expect(isEditableTarget(document.createElement(tag))).toBe(true);
    }
    const div = document.createElement('div');
    div.contentEditable = 'false';
    expect(isEditableTarget(div)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
  });
});
