import React from 'react';
import { Render } from '@puckeditor/core';
import { toPuckCompatibleData } from '../adapters/puck';
import { editor2PuckConfig } from '../components/Editor2Blocks';
import type { CanvasDoc } from '../domain/schema';
import '../styles/editor2.css';

export type Editor2RendererProps = {
  doc: CanvasDoc;
  variant?: 'preview' | 'public';
};

/**
 * Renderizador compartido de Editor 2.0. Usa el mismo config que el editor
 * para paridad 1:1, sin selección, arrastre ni inspector.
 * - `preview`: marco blanco con sombra dentro del espacio de trabajo.
 * - `public`: superficie limpia sin marco extra para integrarse en páginas públicas.
 */
const Editor2Renderer: React.FC<Editor2RendererProps> = ({ doc, variant = 'preview' }) => (
  <div className={variant === 'public' ? 'editor2-scope e2-public-surface' : 'e2-preview'}>
    <Render config={editor2PuckConfig} data={toPuckCompatibleData(doc)} />
  </div>
);

export default Editor2Renderer;
