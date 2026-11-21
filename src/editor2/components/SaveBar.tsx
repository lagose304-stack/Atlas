import React, { useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Eye,
  History,
  Layers,
  Palette,
  PenLine,
  Redo2,
  Rocket,
  RotateCcw,
  Save,
  Undo2,
} from 'lucide-react';
import { useEditor2Store } from '../store/editor2Store';

export type SaveBarProps = {
  preview: boolean;
  onTogglePreview: () => void;
  onSave?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onOpenHistory?: () => void;
  onOpenTheme?: () => void;
  onOpenTemplates?: () => void;
  publicViewPath?: string;
  publicSitePath?: string;
};

const SaveBar: React.FC<SaveBarProps> = ({
  preview,
  onTogglePreview,
  onSave,
  onPublish,
  onUnpublish,
  onOpenHistory,
  onOpenTheme,
  onOpenTemplates,
  publicViewPath,
  publicSitePath,
}) => {
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const dirty = useEditor2Store((state) => state.dirty);
  const saveState = useEditor2Store((state) => state.saveState);
  const publishing = useEditor2Store((state) => state.publishing);
  const publication = useEditor2Store((state) => state.publication);
  const lastError = useEditor2Store((state) => state.lastError);
  const canUndo = useEditor2Store((state) => state.history.length > 0);
  const canRedo = useEditor2Store((state) => state.future.length > 0);
  const undo = useEditor2Store((state) => state.undo);
  const redo = useEditor2Store((state) => state.redo);

  const statusText =
    saveState === 'saving'
      ? 'Guardando borrador…'
      : saveState === 'error'
        ? 'Error al guardar'
        : dirty
          ? 'Cambios sin guardar'
          : saveState === 'saved'
            ? 'Borrador guardado'
            : 'Borrador al día';

  return (
    <div className="e2-save-bar">
      <div className="e2-save-bar__main">
        <div className="e2-save-bar__left">
          <div className="e2-save-bar__history" role="group" aria-label="Historial de cambios">
            <button
              type="button"
              className="e2-icon-button"
              onClick={undo}
              disabled={!canUndo}
              aria-label="Deshacer"
              title="Deshacer"
            >
              <Undo2 size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="e2-icon-button"
              onClick={redo}
              disabled={!canRedo}
              aria-label="Rehacer"
              title="Rehacer"
            >
              <Redo2 size={15} aria-hidden="true" />
            </button>
          </div>

          <p className="e2-save-bar__status" role="status">
            <span
              className={`e2-save-bar__dot${dirty ? ' e2-save-bar__dot--dirty' : ''}`}
              aria-hidden="true"
            />
            <span>{statusText}</span>
            <span className="e2-save-bar__note">
              {publication ? `En vivo v2 · v${publication.versionNumber}` : 'Sin publicar (v1)'}
            </span>
          </p>
        </div>

        <div className="e2-save-bar__actions">
          {onOpenTemplates && (
            <button
              type="button"
              className="e2-button e2-button--quiet"
              onClick={onOpenTemplates}
            >
              <Layers size={14} aria-hidden="true" />
              <span>Plantillas</span>
            </button>
          )}

          {onOpenTheme && (
            <button
              type="button"
              className="e2-button e2-button--quiet"
              onClick={onOpenTheme}
            >
              <Palette size={14} aria-hidden="true" />
              <span>Tema</span>
            </button>
          )}

          {onOpenHistory && (
            <button
              type="button"
              className="e2-button e2-button--quiet"
              onClick={onOpenHistory}
            >
              <History size={14} aria-hidden="true" />
              <span>Historial</span>
            </button>
          )}

          {publication && (publicSitePath || publicViewPath) && (
            <a
              href={publicSitePath || publicViewPath}
              target="_blank"
              rel="noopener noreferrer"
              className="e2-button e2-button--quiet"
              title="Abrir página publicada en el sitio"
            >
              <span>{publicSitePath ? 'Ver en sitio' : 'Vista pública'}</span>
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}

          {publication && onUnpublish && (
            confirmUnpublish ? (
              <span className="e2-save-bar__confirm" role="group" aria-label="Confirmar vuelta a v1">
                <button
                  type="button"
                  className="e2-button e2-button--danger"
                  disabled={publishing}
                  onClick={() => {
                    setConfirmUnpublish(false);
                    onUnpublish();
                  }}
                >
                  Confirmar v1
                </button>
                <button
                  type="button"
                  className="e2-button e2-button--quiet"
                  onClick={() => setConfirmUnpublish(false)}
                >
                  Cancelar
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="e2-button e2-button--quiet"
                disabled={publishing}
                title="Retira la publicación v2 y vuelve al contenido v1 sin borrar tu borrador"
                onClick={() => setConfirmUnpublish(true)}
              >
                <RotateCcw size={13} aria-hidden="true" />
                <span>Volver a v1</span>
              </button>
            )
          )}

          <button
            type="button"
            className={`e2-button e2-save-bar__preview${preview ? ' is-active' : ' e2-button--quiet'}`}
            onClick={onTogglePreview}
            aria-pressed={preview}
          >
            {preview ? <PenLine size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
            {preview ? 'Volver a editar' : 'Vista previa'}
          </button>

          {onSave && (
            <button
              type="button"
              className="e2-button e2-button--quiet"
              onClick={onSave}
              disabled={saveState === 'saving'}
            >
              <Save size={14} aria-hidden="true" />
              <span>{saveState === 'saving' ? 'Guardando…' : 'Guardar'}</span>
            </button>
          )}

          {onPublish && (
            <button
              type="button"
              className="e2-button"
              onClick={onPublish}
              disabled={publishing || saveState === 'saving'}
            >
              <Rocket size={14} aria-hidden="true" />
              <span>{publishing ? 'Publicando…' : 'Publicar'}</span>
            </button>
          )}
        </div>
      </div>

      {lastError && (
        <div className="e2-save-bar__error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{lastError}</span>
        </div>
      )}
    </div>
  );
};

export default SaveBar;
