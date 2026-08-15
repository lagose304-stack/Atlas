import React, { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import SpanishEditorShortcuts from './page-editor/SpanishEditorShortcuts';

interface TestRichTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  ariaLabel: string;
  singleLine?: boolean;
}

const serializeInlineRichText = (html: string): string => html
  .replace(/<p(?:\s[^>]*)?>/gi, '')
  .replace(/<\/p>/gi, '<br>')
  .replace(/(?:<br>\s*)+$/gi, '');

/** Campo TipTap compacto para texto de pruebas, con los mismos atajos del editor de páginas. */
const TestRichTextField: React.FC<TestRichTextFieldProps> = ({
  value,
  onChange,
  placeholder,
  style,
  ariaLabel,
  singleLine = false,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: { HTMLAttributes: { style: 'margin: 0' } },
      }),
      SpanishEditorShortcuts,
      Placeholder.configure({ placeholder: placeholder ?? 'Escribe aquí…' }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: `test-rich-text-field__content${singleLine ? ' test-rich-text-field__content--single-line' : ''}`,
        spellcheck: 'true',
        lang: 'es-MX',
        autocorrect: 'on',
        autocapitalize: 'sentences',
        autocomplete: 'on',
        role: 'textbox',
        'aria-multiline': String(!singleLine),
        'aria-label': ariaLabel,
        'aria-keyshortcuts': 'Control+N Meta+N Control+K Meta+K Control+S Meta+S Control+B Meta+B Control+I Meta+I Control+U Meta+U',
      },
      handleKeyDown: (_view, event) => {
        if (singleLine && event.key === 'Enter') {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: currentEditor }) => onChange(serializeInlineRichText(currentEditor.getHTML())),
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (serializeInlineRichText(editor.getHTML()) !== incoming) {
      editor.commands.setContent(incoming || '<p></p>', { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <EditorContent
      editor={editor}
      className={`test-rich-text-field${singleLine ? ' test-rich-text-field--single-line' : ''}`}
      style={style}
    />
  );
};

export default TestRichTextField;
