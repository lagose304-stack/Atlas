import React, { useEffect, useState } from 'react';
import { EditorContent, useEditor, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { Bold, Italic, Underline, Palette, Highlighter, RemoveFormatting, Type } from 'lucide-react';
import SpanishEditorShortcuts from './SpanishEditorShortcuts';
import { TextStyleCustomAttributes } from './TextStyleExtensions';

export interface HistologyRichFieldProps {
  label?: string;
  value: string;
  placeholder?: string;
  editorId?: string;
  minHeight?: string;
  showToolbar?: boolean;
  onChange: (value: string) => void;
}

export const HistologyRichField: React.FC<HistologyRichFieldProps> = ({
  label,
  value,
  placeholder,
  editorId,
  minHeight = '65px',
  showToolbar = true,
  onChange,
}) => {
  const [isFocused, setIsFocused] = useState(false);

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
        class: 'tiptap-editor-content histology-rich-field-content',
        spellcheck: 'true',
        lang: 'es',
        autocorrect: 'on',
        autocapitalize: 'sentences',
        style: 'color: #000000 !important; font-weight: 500; outline: none;',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label || placeholder || 'Editor de texto',
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
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
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

  const applyColor = (color: string) => {
    if (!editor) return;
    editor.chain().focus().setColor(color).run();
  };

  const applyHighlight = (color: string) => {
    if (!editor) return;
    editor.chain().focus().setHighlight({ color }).run();
  };

  const applyFontSize = (sizePx: string) => {
    if (!editor) return;
    if (!sizePx) {
      editor.chain().focus().setMark('textStyle', { fontSize: null }).run();
      return;
    }
    editor.chain().focus().setMark('textStyle', { fontSize: `${sizePx}px` }).run();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      {label && (
        <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#334155' }}>
          {label}
        </span>
      )}

      <div
        style={{
          border: isFocused ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
          borderRadius: '8px',
          background: '#ffffff',
          overflow: 'hidden',
          boxShadow: isFocused ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {/* Barra Rápida de Formato Inline */}
        {showToolbar && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '4px',
              padding: '4px 8px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              fontSize: '0.75rem',
            }}
          >
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              style={{
                background: editor?.isActive('bold') ? '#e2e8f0' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 6px',
                cursor: 'pointer',
                color: '#1e293b',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              title="Negrita"
            >
              <Bold size={13} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              style={{
                background: editor?.isActive('italic') ? '#e2e8f0' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 6px',
                cursor: 'pointer',
                color: '#1e293b',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              title="Cursiva"
            >
              <Italic size={13} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              style={{
                background: editor?.isActive('underline') ? '#e2e8f0' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 6px',
                cursor: 'pointer',
                color: '#1e293b',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              title="Subrayado"
            >
              <Underline size={13} />
            </button>

            <span style={{ width: '1px', height: '14px', background: '#cbd5e1', margin: '0 2px' }} />

            {/* Selector de Color de Texto */}
            <label
              title="Color del texto seleccionado"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                cursor: 'pointer',
                padding: '2px 5px',
                borderRadius: '4px',
                background: '#f1f5f9',
              }}
            >
              <Palette size={12} color="#0284c7" />
              <input
                type="color"
                defaultValue="#000000"
                onChange={e => applyColor(e.target.value)}
                style={{
                  width: '18px',
                  height: '18px',
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                }}
              />
            </label>

            {/* Selector de Resaltador */}
            <label
              title="Resaltar texto seleccionado"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                cursor: 'pointer',
                padding: '2px 5px',
                borderRadius: '4px',
                background: '#f1f5f9',
              }}
            >
              <Highlighter size={12} color="#d97706" />
              <input
                type="color"
                defaultValue="#fef08a"
                onChange={e => applyHighlight(e.target.value)}
                style={{
                  width: '18px',
                  height: '18px',
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                }}
              />
            </label>

            {/* Selector de Tamaño de Fuente */}
            <label
              title="Tamaño del texto seleccionado"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '1px 4px',
                borderRadius: '4px',
                background: '#f1f5f9',
              }}
            >
              <Type size={12} color="#475569" />
              <select
                defaultValue=""
                onChange={e => {
                  applyFontSize(e.target.value);
                  e.target.value = '';
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  color: '#334155',
                  outline: 'none',
                }}
              >
                <option value="">Tamaño...</option>
                <option value="12">12 px</option>
                <option value="14">14 px</option>
                <option value="16">16 px</option>
                <option value="18">18 px</option>
                <option value="22">22 px</option>
                <option value="28">28 px</option>
              </select>
            </label>

            <span style={{ width: '1px', height: '14px', background: '#cbd5e1', margin: '0 2px' }} />

            {/* Limpiar formato de selección */}
            <button
              type="button"
              onClick={() => editor?.chain().focus().unsetAllMarks().run()}
              style={{
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 6px',
                cursor: 'pointer',
                color: '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '0.70rem',
              }}
              title="Quitar formato a la selección"
            >
              <RemoveFormatting size={12} />
              <span>Limpiar</span>
            </button>
          </div>
        )}

        {/* Lienzo editable */}
        <div style={{ padding: '8px 12px', minHeight }}>
          <EditorContent
            editor={editor}
            style={{
              outline: 'none',
              fontSize: '0.88rem',
              color: '#000000',
              lineHeight: 1.55,
              minHeight,
            }}
          />
        </div>
      </div>
    </div>
  );
};
