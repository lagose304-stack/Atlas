import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it } from 'vitest';
import SpanishEditorShortcuts from './SpanishEditorShortcuts';

describe('SpanishEditorShortcuts', () => {
  let editor: Editor | null = null;

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  const createEditor = () => {
    editor = new Editor({
      extensions: [StarterKit, SpanishEditorShortcuts],
      content: '<p>texto</p>',
    });
    editor.commands.setTextSelection({ from: 1, to: 6 });
    return editor;
  };

  it.each([
    ['Mod-n', 'strong'],
    ['Mod-k', 'em'],
    ['Mod-s', 'u'],
  ])('aplica el formato de %s a la selección', (shortcut, tag) => {
    const currentEditor = createEditor();

    expect(currentEditor.commands.keyboardShortcut(shortcut)).toBe(true);
    expect(currentEditor.getHTML()).toContain(`<${tag}>texto</${tag}>`);
  });

  it('conserva los atajos universales de Tiptap', () => {
    const currentEditor = createEditor();

    expect(currentEditor.commands.keyboardShortcut('Mod-b')).toBe(true);
    expect(currentEditor.getHTML()).toContain('<strong>texto</strong>');
  });

  it('intercepta Ctrl+N antes de que lo procese el navegador', () => {
    const currentEditor = createEditor();
    const event = new KeyboardEvent('keydown', {
      key: 'n',
      code: 'KeyN',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    currentEditor.view.dom.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(currentEditor.getHTML()).toContain('<strong>texto</strong>');
  });
});
