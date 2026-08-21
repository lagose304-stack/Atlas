import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  CheckCircle2,
  Clock,
  User,
  AlertCircle,
  FileText,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { PageVersionRow } from '../../services/pageVersionsService';
import type { PageEntityType } from '../../types/contentBlocks';

interface PageVersionsHubProps {
  pageTitle: string;
  pageContext: string;
  publicUrl: string;
  entityType: PageEntityType;
  entityId: number;
  versions: PageVersionRow[];
  loading: boolean;
  onEditVersion: (version: PageVersionRow) => void;
  onPublishVersion: (version: PageVersionRow) => Promise<void>;
  onCreateVersion: (params: {
    versionName: string;
    description: string;
    fromVersionId?: number | null;
  }) => Promise<void>;
  onDeleteVersion: (version: PageVersionRow) => Promise<void>;
  onRefresh: () => void;
}

export const PageVersionsHub: React.FC<PageVersionsHubProps> = ({
  pageTitle,
  pageContext,
  publicUrl,
  versions,
  loading,
  onEditVersion,
  onPublishVersion,
  onCreateVersion,
  onDeleteVersion,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<'template' | 'blank'>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [versionNameInput, setVersionNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<number | null>(null);
  const [deleteConfirmVersion, setDeleteConfirmVersion] = useState<PageVersionRow | null>(null);

  const publishedVersion = versions.find(v => v.is_published);
  const draftVersions = versions.filter(v => !v.is_published);

  const handleOpenCreateModal = (defaultTemplateId?: number) => {
    const templateToUse = defaultTemplateId ?? publishedVersion?.id ?? (versions[0]?.id || null);
    setSelectedTemplateId(templateToUse);
    setCreationMode(templateToUse ? 'template' : 'blank');
    
    // Sugerir un nombre de versión no repetido
    let nextNum = versions.length + 1;
    let suggestedName = `Versión ${nextNum.toFixed(1)}`;
    while (versions.some(v => v.version_name.trim().toLowerCase() === suggestedName.toLowerCase())) {
      nextNum += 0.1;
      suggestedName = `Versión ${nextNum.toFixed(1)}`;
    }

    setVersionNameInput(suggestedName);
    setDescriptionInput('');
    setNameError(null);
    setIsCreateModalOpen(true);
  };

  const handleConfirmCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);

    const trimmedName = versionNameInput.trim();
    if (!trimmedName) {
      setNameError('El nombre de la versión es obligatorio.');
      return;
    }

    // Validación de seguridad: no permitir versiones con el mismo nombre en la misma página
    const nameExists = versions.some(
      v => v.version_name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (nameExists) {
      setNameError(`Ya existe una versión con el nombre "${trimmedName}". Elige un nombre diferente.`);
      return;
    }

    try {
      setSubmitting(true);
      await onCreateVersion({
        versionName: trimmedName,
        description: descriptionInput.trim(), // Opcional, puede ser cadena vacía
        fromVersionId: creationMode === 'template' ? selectedTemplateId : null,
      });
      setIsCreateModalOpen(false);
    } catch (err: unknown) {
      console.error('Error al crear versión:', err);
      const msg = err instanceof Error ? err.message : 'Ocurrió un error al crear la nueva versión.';
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('23505')) {
        setNameError(`Ya existe una versión con el nombre "${trimmedName}".`);
      } else {
        alert(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (version: PageVersionRow) => {
    if (!window.confirm(`¿Publicar "${version.version_name}" como la versión oficial activa para ${pageTitle}? Reemplazará la versión actualmente publicada en la web pública.`)) {
      return;
    }
    try {
      setActionInProgressId(version.id);
      await onPublishVersion(version);
    } catch (err) {
      console.error('Error al publicar versión:', err);
      alert('Error al publicar la versión.');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmVersion) return;
    try {
      setActionInProgressId(deleteConfirmVersion.id);
      await onDeleteVersion(deleteConfirmVersion);
      setDeleteConfirmVersion(null);
    } catch (err) {
      console.error('Error al eliminar versión:', err);
      alert('Error al eliminar la versión.');
    } finally {
      setActionInProgressId(null);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* ─── ENCABEZADO DEL HUB DE VERSIONES ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '16px',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        padding: '24px 28px',
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px -4px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6366f1', background: '#eef2ff', padding: '3px 10px', borderRadius: '999px' }}>
              {pageContext}
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              • Historial de Versiones
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            {pageTitle}
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
            Gestiona borradores, crea nuevas versiones a partir de plantillas y publica contenido de forma segura.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              borderRadius: '12px',
              background: '#f1f5f9',
              color: '#334155',
              fontSize: '0.84rem',
              fontWeight: 750,
              textDecoration: 'none',
              border: '1px solid #cbd5e1',
              transition: 'all 0.2s',
            }}
          >
            <ExternalLink size={15} />
            <span>Ver web pública</span>
          </a>

          <button
            type="button"
            onClick={() => handleOpenCreateModal()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              fontSize: '0.88rem',
              fontWeight: 800,
              border: 'none',
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Plus size={18} strokeWidth={2.6} />
            <span>Nueva Versión</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '0.95rem' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px auto' }} />
          Cargando versiones de la página...
        </div>
      ) : (
        <>
          {/* ─── 1. TARJETA DESTACADA: VERSIÓN PUBLICADA ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#059669" />
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                Versión Publicada Activa
              </h2>
            </div>

            {publishedVersion ? (
              <div style={{
                position: 'relative',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
                border: '2px solid #86efac',
                borderRadius: '18px',
                padding: '24px',
                boxShadow: '0 8px 30px -6px rgba(16,185,129,0.12)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '20px',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '280px', flex: '1 1 400px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: '#15803d',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      padding: '4px 10px',
                      borderRadius: '999px',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}>
                      <CheckCircle2 size={13} /> EN VIVO / PUBLICADA
                    </span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#14532d', margin: 0 }}>
                      {publishedVersion.version_name}
                    </h3>
                  </div>

                  {publishedVersion.description && (
                    <p style={{ fontSize: '0.88rem', color: '#334155', margin: 0, lineHeight: 1.5 }}>
                      {publishedVersion.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.78rem', color: '#64748b' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <Layers size={14} color="#059669" />
                      <strong>{publishedVersion.blocks_count}</strong> {publishedVersion.blocks_count === 1 ? 'bloque' : 'bloques'}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <User size={14} />
                      Creado por: <strong>{publishedVersion.created_by_name || 'Docente'}</strong>
                    </span>
                    {publishedVersion.updated_by_name && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Pencil size={12} />
                        Última edición: <strong>{publishedVersion.updated_by_name}</strong>
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <Clock size={14} />
                      Publicado: {formatDate(publishedVersion.published_at || publishedVersion.updated_at)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal(publishedVersion.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '9px 15px',
                      borderRadius: '10px',
                      background: '#ffffff',
                      color: '#15803d',
                      border: '1.5px solid #86efac',
                      fontSize: '0.82rem',
                      fontWeight: 750,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    }}
                    title="Crear una nueva versión copiando todos los bloques de esta"
                  >
                    <Copy size={14} />
                    <span>Usar como plantilla</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onEditVersion(publishedVersion)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 22px',
                      borderRadius: '12px',
                      background: '#15803d',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(21,128,61,0.25)',
                    }}
                  >
                    <Pencil size={15} />
                    <span>Editar Contenido</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                background: '#fffbeb',
                border: '1.5px dashed #fcd34d',
                borderRadius: '16px',
                padding: '20px',
                textAlign: 'center',
                color: '#92400e',
                fontSize: '0.88rem',
              }}>
                <AlertCircle size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                No hay ninguna versión publicada actualmente para esta página. Selecciona o crea una versión y pulsa <strong>Publicar</strong>.
              </div>
            )}
          </div>

          {/* ─── 2. LISTADO INFERIOR: HISTORIAL DE VERSIONES Y BORRADORES ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={17} color="#6366f1" />
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Historial de Versiones y Borradores ({draftVersions.length})
                </h2>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Ordenadas de la más reciente a la más antigua
              </span>
            </div>

            {draftVersions.length === 0 ? (
              <div style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '16px',
                padding: '36px 20px',
                textAlign: 'center',
                color: '#64748b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}>
                <FileText size={32} color="#94a3b8" />
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>
                  No tienes versiones borrador adicionales.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal()}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    fontSize: '0.82rem',
                    fontWeight: 750,
                    cursor: 'pointer',
                  }}
                >
                  + Crear un nuevo borrador
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {draftVersions.map(ver => (
                  <div
                    key={ver.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '18px 22px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '16px',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '260px', flex: '1 1 360px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                        }}>
                          BORRADOR
                        </span>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 850, color: '#1e293b', margin: 0 }}>
                          {ver.version_name}
                        </h4>
                      </div>

                      {ver.description && (
                        <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
                          {ver.description}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '0.75rem', color: '#64748b' }}>
                        <span>
                          <Layers size={13} style={{ display: 'inline', marginRight: '4px' }} />
                          <strong>{ver.blocks_count}</strong> {ver.blocks_count === 1 ? 'bloque' : 'bloques'}
                        </span>
                        <span>
                          <User size={13} style={{ display: 'inline', marginRight: '4px' }} />
                          Creado por: <strong>{ver.created_by_name || 'Docente'}</strong>
                        </span>
                        {ver.updated_by_name && (
                          <span>
                            <Pencil size={11} style={{ display: 'inline', marginRight: '4px' }} />
                            Editado por: <strong>{ver.updated_by_name}</strong>
                          </span>
                        )}
                        <span>
                          <Clock size={13} style={{ display: 'inline', marginRight: '4px' }} />
                          {formatDate(ver.updated_at)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* BOTÓN PUBLICAR */}
                      <button
                        type="button"
                        disabled={actionInProgressId === ver.id}
                        onClick={() => handlePublish(ver)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          background: '#ecfdf5',
                          color: '#059669',
                          border: '1px solid #a7f3d0',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        title="Publicar esta versión para que sea visible en la web pública"
                      >
                        <CheckCircle2 size={14} />
                        <span>Publicar</span>
                      </button>

                      {/* BOTÓN EDITAR */}
                      <button
                        type="button"
                        onClick={() => onEditVersion(ver)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          fontSize: '0.82rem',
                          fontWeight: 750,
                          cursor: 'pointer',
                        }}
                      >
                        <Pencil size={14} />
                        <span>Editar</span>
                      </button>

                      {/* BOTÓN DUPLICAR */}
                      <button
                        type="button"
                        onClick={() => handleOpenCreateModal(ver.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: '#f8fafc',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Duplicar esta versión"
                      >
                        <Copy size={13} />
                        <span>Copiar</span>
                      </button>

                      {/* BOTÓN BORRAR */}
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmVersion(ver)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Eliminar este borrador"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── MODAL: CREAR NUEVA VERSIÓN ─── */}
      {isCreateModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            maxWidth: '520px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  Nueva Versión de Página
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                  Página: <strong>{pageTitle}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Selector de modo de creación */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>
                  ¿Cómo deseas iniciar esta versión?
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: creationMode === 'template' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: creationMode === 'template' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="radio"
                        name="creationMode"
                        checked={creationMode === 'template'}
                        onChange={() => setCreationMode('template')}
                        disabled={versions.length === 0}
                      />
                      <strong style={{ fontSize: '0.84rem', color: '#1e293b' }}>Desde plantilla</strong>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Copia todos los bloques de una versión existente
                    </span>
                  </label>

                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: creationMode === 'blank' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: creationMode === 'blank' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="radio"
                        name="creationMode"
                        checked={creationMode === 'blank'}
                        onChange={() => setCreationMode('blank')}
                      />
                      <strong style={{ fontSize: '0.84rem', color: '#1e293b' }}>Desde cero</strong>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Comienza con un lienzo en blanco
                    </span>
                  </label>
                </div>
              </div>

              {/* Selector de versión base (si es desde plantilla) */}
              {creationMode === 'template' && versions.length > 0 && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 750, color: '#334155' }}>
                    Selecciona la versión a clonar:
                  </span>
                  <select
                    value={selectedTemplateId ?? ''}
                    onChange={e => setSelectedTemplateId(Number(e.target.value))}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      color: '#1e293b',
                      background: '#ffffff',
                    }}
                  >
                    {versions.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.is_published ? '⭐ [Publicada] ' : '• '} {v.version_name} ({v.blocks_count} bloques)
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Nombre de la versión */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 750, color: '#334155' }}>
                  Nombre de la versión *
                </span>
                <input
                  type="text"
                  required
                  value={versionNameInput}
                  onChange={e => {
                    setVersionNameInput(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  placeholder="Ej: Versión 2.0 - Actualización de Criterios"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: nameError ? '2px solid #ef4444' : '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    color: '#1e293b',
                    background: nameError ? '#fef2f2' : '#ffffff',
                  }}
                />
                {nameError && (
                  <span style={{ fontSize: '0.76rem', color: '#dc2626', fontWeight: 750, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={13} /> {nameError}
                  </span>
                )}
              </label>

              {/* Notas de cambio */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 750, color: '#334155' }}>
                    Descripción u objetivo del cambio
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                    (Opcional)
                  </span>
                </div>
                <textarea
                  value={descriptionInput}
                  onChange={e => setDescriptionInput(e.target.value)}
                  placeholder="Ej: Añadidos pilares de vascularización y nuevas micrografías diagnósticas..."
                  rows={2}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    color: '#1e293b',
                    resize: 'vertical',
                  }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !versionNameInput.trim()}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{submitting ? 'Creando...' : 'Crear Versión'}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL CONFIRMAR ELIMINACIÓN ─── */}
      {deleteConfirmVersion && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            maxWidth: '440px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#dc2626', margin: 0 }}>
              ¿Eliminar borrador?
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
              ¿Estás seguro de que deseas eliminar permanentemente la versión <strong>"{deleteConfirmVersion.version_name}"</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmVersion(null)}
                style={{
                  padding: '9px 15px',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PageVersionsHub;
