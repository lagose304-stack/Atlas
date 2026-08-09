import { Extension } from '@tiptap/core';

/**
 * Atajos de formato usados habitualmente por aplicaciones en español.
 * StarterKit y Underline conservan además los atajos universales B, I y U.
 */
const SpanishEditorShortcuts = Extension.create({
  name: 'spanishEditorShortcuts',
  priority: 1_000,

  addKeyboardShortcuts() {
    return {
      'Mod-n': () => this.editor.commands.toggleBold(),
      'Mod-k': () => this.editor.commands.toggleItalic(),
      'Mod-s': () => this.editor.commands.toggleUnderline(),
    };
  },
});

export default SpanishEditorShortcuts;
