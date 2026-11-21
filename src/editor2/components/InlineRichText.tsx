import React, { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Mark } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { INLINE_EDIT_MODE } from './inlineEditMode';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Eraser,
  Highlighter,
  Italic,
  Link2,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline as UnderlineIcon,
  Unlink,
} from 'lucide-react';
import {
  hasRichMarks,
  renderRichTextContent,
  richTextToPlain,
  runsToTiptapDoc,
  sanitizeSafeHref,
  tiptapDocToRuns,
  type RichTextV2,
  type RichTextValue,
} from '../domain/richText';

const SubscriptMark = Mark.create({
  name: 'subscript',
  excludes: 'superscript',
  parseHTML() {
    return [{ tag: 'sub' }];
  },
  renderHTML() {
    return ['sub', 0];
  },
});

const SuperscriptMark = Mark.create({
  name: 'superscript',
  excludes: 'subscript',
  parseHTML() {
    return [{ tag: 'sup' }];
  },
  renderHTML() {
    return ['sup', 0];
  },
});

export type InlineRichTextProps = {
  value: RichTextValue | string;
  editing: boolean;
  onDemand?: boolean;
  placeholder?: string;
  singleLine?: boolean;
  className?: string;
  style?: CSSProperties;
  editableTag?: string;
  onChange: (nextPlain: string, nextRich: RichTextV2 | undefined, hostEl: HTMLElement | null) => void;
};

const InlineRichText: React.FC<InlineRichTextProps> = ({
  value,
  editing,
  onDemand = false,
  placeholder = 'Escribe aquí…',
  singleLine = false,
  className,
  style,
  editableTag = 'text',
  onChange,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const lastSerializedRef = useRef<string>('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: editing && !onDemand,
      extensions: [
        StarterKit.configure({
          heading: false,
          blockquote: false,
          codeBlock: false,
          horizontalRule: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          underline: false,
          link: false,
        }),
        Underline,
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        Link.configure({
          openOnClick: false,
          autolink: false,
          HTMLAttributes: { class: 'e2-rich-link', rel: 'noopener noreferrer' },
        }),
        SubscriptMark,
        SuperscriptMark,
      ],
      content: runsToTiptapDoc(value),
      editorProps: {
        attributes: {
          class: `e2-rich-editor${className ? ` ${className}` : ''}`,
          'data-e2-editable': editableTag,
          ...(onDemand ? { 'data-e2-rich-on-demand': '' } : {}),
          'data-puck-overlay-portal': 'true',
          'data-placeholder': placeholder,
        },
        handleKeyDown: (_view, event) => {
          event.stopPropagation();
          if (singleLine && event.key === 'Enter') {
            event.preventDefault();
            return true;
          }
          if (event.key === 'Escape') {
            setLinkOpen(false);
            setHasSelection(false);
            (document.activeElement as HTMLElement | null)?.blur();
            return true;
          }
          return false;
        },
      },
      onSelectionUpdate: ({ editor: ed }) => {
        const { from, to } = ed.state.selection;
        const selected = to > from;
        setHasSelection(selected);
        if (!selected) setLinkOpen(false);
      },
      onBlur: () => {
        window.setTimeout(() => {
          if (!hostRef.current?.contains(document.activeElement)) {
            setHasSelection(false);
            setLinkOpen(false);
          }
        }, 120);
      },
      onUpdate: ({ editor: ed }) => {
        const runs = tiptapDocToRuns(ed.getJSON() as Parameters<typeof tiptapDocToRuns>[0]);
        const plain = runs.map((r) => r.text).join('');
        const rich: RichTextV2 | undefined = hasRichMarks(runs) ? { format: 'rich', runs } : undefined;
        const sig = JSON.stringify({ plain, rich });
        if (sig === lastSerializedRef.current) return;
        lastSerializedRef.current = sig;
        onChangeRef.current(plain, rich, hostRef.current);
      },
    },
    [editing, onDemand],
  );

  useEffect(() => {
    if (!editor || !editing || !onDemand) return;
    const field = editor.view.dom;
    const changeMode = (event: Event) => {
      const active = (event as CustomEvent<boolean>).detail;
      editor.setEditable(active, false);
      if (!active) {
        setHasSelection(false);
        setLinkOpen(false);
      }
    };
    field.addEventListener(INLINE_EDIT_MODE, changeMode);
    return () => field.removeEventListener(INLINE_EDIT_MODE, changeMode);
  }, [editor, editing, onDemand]);

  useEffect(() => {
    if (!editor || !editing) return;
    if (editor.isFocused) return;
    const incomingPlain = richTextToPlain(value);
    const incomingRich = typeof value !== 'string' && value.format === 'rich' ? value : undefined;
    const sig = JSON.stringify({ plain: incomingPlain, rich: incomingRich });
    if (sig === lastSerializedRef.current) return;
    lastSerializedRef.current = sig;
    editor.commands.setContent(runsToTiptapDoc(value), { emitUpdate: false });
  }, [editor, editing, value]);

  if (!editing) {
    return (
      <div className={className} style={style}>
        {renderRichTextContent(value)}
      </div>
    );
  }

  const keepFocus = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  const applyLink = () => {
    if (!editor) return;
    const safe = sanitizeSafeHref(linkInput);
    if (!safe) {
      editor.chain().focus().unsetLink().run();
    } else {
      const external = safe.startsWith('http://') || safe.startsWith('https://');
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: safe, target: external ? '_blank' : null })
        .run();
    }
    setLinkOpen(false);
    setLinkInput('');
  };

  const toggleMark = (name: 'subscript' | 'superscript') => {
    if (!editor) return;
    if (editor.isActive(name)) {
      editor.chain().focus().unsetMark(name).run();
    } else {
      editor.chain().focus().setMark(name).run();
    }
  };

  const activeColor = (editor?.getAttributes('textStyle')?.color as string | undefined) ?? '#0b2545';
  const activeHighlight = (editor?.getAttributes('highlight')?.color as string | undefined) ?? '#fef08a';

  return (
    <div
      ref={hostRef}
      className="e2-rich-host"
      style={style}
      data-puck-overlay-portal="true"
      onClick={(e) => e.stopPropagation()}
    >
      {editor && hasSelection && (
        <div
          className="e2-rich-bubble"
          role="toolbar"
          aria-label="Formato del texto seleccionado"
          onMouseDown={keepFocus}
        >
          <button
            type="button"
            aria-label="Negrita"
            title="Negrita (Ctrl+B)"
            aria-pressed={editor.isActive('bold')}
            onMouseDown={keepFocus}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Cursiva"
            title="Cursiva (Ctrl+I)"
            aria-pressed={editor.isActive('italic')}
            onMouseDown={keepFocus}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Subrayado"
            title="Subrayado (Ctrl+U)"
            aria-pressed={editor.isActive('underline')}
            onMouseDown={keepFocus}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Tachado"
            title="Tachado"
            aria-pressed={editor.isActive('strike')}
            onMouseDown={keepFocus}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough size={13} aria-hidden="true" />
          </button>

          <span className="e2-rich-bubble__sep" aria-hidden="true" />

          <label className="e2-rich-bubble__color" title="Color de texto">
            <span aria-hidden="true">A</span>
            <input
              type="color"
              aria-label="Color de fragmento"
              value={/^#[0-9a-f]{6}$/i.test(activeColor) ? activeColor : '#0b2545'}
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            />
          </label>
          <label className="e2-rich-bubble__color" title="Resaltado de texto">
            <Highlighter size={12} aria-hidden="true" />
            <input
              type="color"
              aria-label="Color de resaltado"
              value={/^#[0-9a-f]{6}$/i.test(activeHighlight) ? activeHighlight : '#fef08a'}
              onChange={(e) => editor.chain().focus().setHighlight({ color: e.target.value }).run()}
            />
          </label>

          <span className="e2-rich-bubble__sep" aria-hidden="true" />

          <button
            type="button"
            aria-label="Subíndice"
            title="Subíndice (ej. H₂O)"
            aria-pressed={editor.isActive('subscript')}
            onMouseDown={keepFocus}
            onClick={() => toggleMark('subscript')}
          >
            <SubscriptIcon size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Superíndice"
            title="Superíndice (ej. 10×, mm²)"
            aria-pressed={editor.isActive('superscript')}
            onMouseDown={keepFocus}
            onClick={() => toggleMark('superscript')}
          >
            <SuperscriptIcon size={13} aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-label="Enlace"
            title="Añadir o editar enlace"
            aria-pressed={editor.isActive('link')}
            onMouseDown={keepFocus}
            onClick={() => {
              const prev = (editor.getAttributes('link')?.href as string | undefined) ?? '';
              setLinkInput(prev);
              setLinkOpen((open) => !open);
            }}
          >
            <Link2 size={13} aria-hidden="true" />
          </button>

          {editor.isActive('link') && (
            <button
              type="button"
              aria-label="Quitar enlace"
              title="Quitar enlace"
              onMouseDown={keepFocus}
              onClick={() => editor.chain().focus().unsetLink().run()}
            >
              <Unlink size={13} aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            aria-label="Limpiar formato"
            title="Limpiar formato del fragmento"
            onMouseDown={keepFocus}
            onClick={() => editor.chain().focus().unsetAllMarks().run()}
          >
            <Eraser size={13} aria-hidden="true" />
          </button>
        </div>
      )}

      {linkOpen && (
        <div className="e2-rich-link-pop" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            aria-label="URL del enlace"
            placeholder="/temario o https://..."
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              } else if (e.key === 'Escape') {
                setLinkOpen(false);
              }
            }}
          />
          <button type="button" className="e2-button e2-button--primary" onClick={applyLink}>
            Aplicar
          </button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
};

export default InlineRichText;
