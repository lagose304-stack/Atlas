import React, { useEffect } from 'react';
import { EditorContent, useEditor, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import SpanishEditorShortcuts from './SpanishEditorShortcuts';
import { TextStyleCustomAttributes } from './TextStyleExtensions';

interface CompactRichTextFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  editorId?: string;
  onChange: (value: string) => void;
}

/** Editor enriquecido compacto para los campos de contenido del panel lateral. */
const CompactRichTextField: React.FC<CompactRichTextFieldProps> = ({
  label,
  value,
  placeholder,
  editorId,
  onChange,
}) => {
  const emitTextState = (currentEditor: Editor) => {
    if (!editorId) return;
    window.dispatchEvent(
      new CustomEvent('atlas-rich-text-state', {
        detail: {
          editorId,
          attrs: currentEditor.getAttributes('textStyle'),
          align: currentEditor.getAttributes('paragraph').textAlign || 'left',
          bold: currentEditor.isActive('bold'),
          italic: currentEditor.isActive('italic'),
          underline: currentEditor.isActive('underline'),
          strike: currentEditor.isActive('strike'),
          bulletList: currentEditor.isActive('bulletList'),
          orderedList: currentEditor.isActive('orderedList'),
          link: currentEditor.isActive('link'),
          highlight: currentEditor.getAttributes('highlight').color || '',
        },
      })
    );
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? 'Escribe aquí…' }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      TextStyleCustomAttributes,
      Color,
      Highlight.configure({ multicolor: true }),
      SpanishEditorShortcuts,
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'visual-properties-rich-text-input',
        style: 'color: #000000 !important; font-weight: 500; outline: none;',
        spellcheck: 'true',
        lang: 'es',
        autocorrect: 'on',
        autocapitalize: 'sentences',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        'aria-keyshortcuts':
          'Control+N Meta+N Control+K Meta+K Control+S Meta+S Control+B Meta+B Control+I Meta+I Control+U Meta+U',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
      emitTextState(currentEditor);
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      emitTextState(currentEditor);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming || '<p></p>', { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editorId || !editor) return;
    const handleCommand = (event: Event) => {
      const detail = (event as CustomEvent<{ editorId: string; command: string; value?: string }>).detail;
      if (!detail || detail.editorId !== editorId) return;
      const chain = editor.chain().focus();
      switch (detail.command) {
        case 'bold':
          chain.toggleBold().run();
          break;
        case 'underline':
          chain.toggleUnderline().run();
          break;
        case 'italic':
          chain.toggleItalic().run();
          break;
        case 'strike':
          chain.toggleStrike().run();
          break;
        case 'bulletList':
          chain.toggleBulletList().run();
          break;
        case 'orderedList':
          chain.toggleOrderedList().run();
          break;
        case 'align':
          chain.setTextAlign(detail.value || 'left').run();
          break;
        case 'textColor':
          detail.value ? chain.setColor(detail.value).run() : chain.unsetColor().run();
          break;
        case 'highlight':
          detail.value ? chain.setHighlight({ color: detail.value }).run() : chain.unsetHighlight().run();
          break;
        case 'fontSize':
          if (detail.value) {
            const safe = Number(detail.value);
            if (Number.isFinite(safe) && safe >= 10 && safe <= 72) {
              chain.setMark('textStyle', { fontSize: `${Math.round(safe)}px` }).run();
            }
          } else {
            chain.setMark('textStyle', { fontSize: null }).run();
          }
          break;
        case 'fontFamily':
          chain.setMark('textStyle', { fontFamily: detail.value || null }).run();
          break;
        case 'fontWeight':
          chain.setMark('textStyle', { fontWeight: detail.value || null }).run();
          break;
        case 'lineHeight':
          chain.setMark('textStyle', { lineHeight: detail.value || null }).run();
          break;
        case 'letterSpacing':
          chain.setMark('textStyle', { letterSpacing: detail.value || null }).run();
          break;
        case 'textTransform':
          chain.setMark('textStyle', { textTransform: detail.value || null }).run();
          break;
        case 'textStrokeColor':
          chain.setMark('textStyle', { textStrokeColor: detail.value || null }).run();
          break;
        case 'textStrokeWidth':
          chain.setMark('textStyle', { textStrokeWidth: detail.value || null }).run();
          break;
        case 'clearTextStyle':
          chain.unsetAllMarks().run();
          break;
        case 'link': {
          const previousUrl = editor.getAttributes('link').href as string | undefined;
          const url = window.prompt('URL del enlace:', previousUrl ?? 'https://');
          if (url === null) return;
          if (url.trim() === '') {
            chain.unsetLink().run();
          } else {
            chain.setLink({ href: url.trim() }).run();
          }
          break;
        }
      }
    };

    window.addEventListener('atlas-rich-text-command', handleCommand);
    return () => window.removeEventListener('atlas-rich-text-command', handleCommand);
  }, [editor, editorId]);

  return (
    <label className="visual-properties-field">
      <span>{label}</span>
      <EditorContent editor={editor} className="visual-properties-rich-text" />
    </label>
  );
};

export default CompactRichTextField;
