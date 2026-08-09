import React, { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import SpanishEditorShortcuts from './SpanishEditorShortcuts';

interface CompactRichTextFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

/** Editor enriquecido compacto para los campos de contenido del panel lateral. */
const CompactRichTextField: React.FC<CompactRichTextFieldProps> = ({
  label,
  value,
  placeholder,
  onChange,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      SpanishEditorShortcuts,
      Placeholder.configure({ placeholder: placeholder ?? 'Escribe aquí…' }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'visual-properties-rich-text-input',
        spellcheck: 'true',
        lang: 'es',
        autocorrect: 'on',
        autocapitalize: 'sentences',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        'aria-keyshortcuts': 'Control+N Meta+N Control+K Meta+K Control+S Meta+S Control+B Meta+B Control+I Meta+I Control+U Meta+U',
      },
    },
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming || '<p></p>', { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <label className="visual-properties-field">
      <span>{label}</span>
      <EditorContent editor={editor} className="visual-properties-rich-text" />
    </label>
  );
};

export default CompactRichTextField;
