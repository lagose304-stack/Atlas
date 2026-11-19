import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, History, Plus, Rocket, Trash2, X } from 'lucide-react';
import { useEditor2Store } from '../store/editor2Store';

export type VersionDrawerProps = {
  open: boolean;
  pageKey: string;
  onClose: () => void;
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

const VersionDrawer: React.FC<VersionDrawerProps> = ({ open, pageKey, onClose }) => {
  const versions = useEditor2Store((state) => state.versions);
  const publication = useEditor2Store((state) => state.publication);
  const publishing = useEditor2Store((state) => state.publishing);
  const createVersionNow = useEditor2Store((state) => state.createVersionNow);
  const publishVersionNow = useEditor2Store((state) => state.publishVersionNow);
  const deleteVersionNow = useEditor2Store((state) => state.deleteVersionNow);
  const [label, setLabel] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  const publicUrl = `/vista-v2/${encodeURIComponent(pageKey)}`;

  const handleCreateVersion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    const created = await createVersionNow(label.trim());
    setCreating(false);
    if (created) setLabel('');
  };

  return (
    <div className="e2-drawer-backdrop" onClick={onClose}>
      <aside
        className="e2-version-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Historial de versiones"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="e2-version-drawer__head">
          <div className="e2-version-drawer__title">
            <History size={16} aria-hidden="true" />
            <h2>Historial de versiones</h2>
          </div>
          <button
            type="button"
            className="e2-icon-button"
            aria-label="Cerrar historial"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="e2-version-drawer__pub">
          {publication ? (
            <>
              <span className="e2-version-pill-live">
                <CheckCircle2 size={13} aria-hidden="true" />
                Publicada · v{publication.versionNumber}
              </span>
              <a
                href={publicUrl}
                target="_blank" rel="noopener noreferrer"
                className="e2-button e2-button--quiet"
              >
                <span>Ver vista v2</span>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            </>
          ) : (
            <span className="e2-version-drawer__empty-pub">
              Sin versión publicada aún. Guardar borrador nunca afecta la vista pública.
            </span>
          )}
        </div>

        <form className="e2-version-drawer__create" onSubmit={handleCreateVersion}>
          <input
            type="text"
            aria-label="Etiqueta de nueva versión"
            placeholder="Etiqueta opcional (ej. Revisión de epitelios)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={120}
          />
          <button type="submit" className="e2-button" disabled={creating}>
            <Plus size={14} aria-hidden="true" />
            <span>{creating ? 'Creando…' : 'Crear versión'}</span>
          </button>
        </form>

        <div className="e2-version-drawer__list">
          {versions.length === 0 ? (
            <p className="e2-version-drawer__empty">
              Todavía no hay versiones guardadas para esta página.
            </p>
          ) : (
            <ul>
              {versions.map((ver) => {
                const isBusy = busyId === ver.id;
                return (
                  <li key={ver.id} className={`e2-version-item${ver.isPublished ? ' is-published' : ''}`}>
                    <div className="e2-version-item__meta">
                      <div className="e2-version-item__top">
                        <strong>v{ver.versionNumber}</strong>
                        {ver.isPublished && <span className="e2-version-item__badge">Publicada</span>}
                      </div>
                      {ver.label && <p className="e2-version-item__label">{ver.label}</p>}
                      <small>{formatDate(ver.createdAt)}</small>
                    </div>
                    <div className="e2-version-item__actions">
                      {!ver.isPublished && (
                        <>
                          <button
                            type="button"
                            className="e2-button e2-button--quiet"
                            disabled={publishing || isBusy}
                            onClick={async () => {
                              setBusyId(ver.id);
                              await publishVersionNow(ver.id);
                              setBusyId(null);
                            }}
                          >
                            <Rocket size={13} aria-hidden="true" />
                            <span>Publicar</span>
                          </button>
                          <button
                            type="button"
                            className="e2-button e2-button--quiet e2-button--danger"
                            aria-label={`Eliminar versión ${ver.versionNumber}`}
                            disabled={isBusy}
                            onClick={async () => {
                              setBusyId(ver.id);
                              await deleteVersionNow(ver.id);
                              setBusyId(null);
                            }}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
};

export default VersionDrawer;
