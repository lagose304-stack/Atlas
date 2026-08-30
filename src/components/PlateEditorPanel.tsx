import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, Camera, RotateCcw } from 'lucide-react';
import BoldField from './BoldField';
import TincionAccordionSelector from './TincionAccordionSelector';
import AllSenaladosMoverModal from './AllSenaladosMoverModal';
import PlateAnnotationViewerEditor from './PlateAnnotationViewerEditor';
import ResilientPlacaThumb from './ResilientPlacaThumb';
import { acquireAtlasScrollLock, releaseAtlasScrollLock } from '../constants/scrollLock';
import { useAuth } from '../contexts/AuthContext';

export interface MarkerLocation {
  x: number;
  y: number;
  startX?: number | null;
  startY?: number | null;
  regionPoints?: number[] | null;
  regionHoles?: number[][] | null;
  regionColor?: string | null;
  regionOpacity?: number | null;
}

interface PlateEditorPanelProps {
  title?: string;
  imageSrc?: string;
  imageAlt?: string;
  highResImageSrc?: string;
  pendingImageFile?: File | null;
  pendingImagePreviewUrl?: string | null;
  onSelectImageFile?: (file: File) => void;
  onClearPendingImage?: () => void;
  primaryActionLabel?: string;
  primaryActionDisabled?: boolean;
  primaryActionLoading?: boolean;
  onPrimaryAction?: () => void;
  primaryActionFeedback?: string;
  primaryActionFeedbackTone?: 'success' | 'error' | 'info';
  aumento: string;
  onAumentoChange: (value: string) => void;
  showTincion: boolean;
  onShowTincion: () => void;
  tincion: string;
  onTincionChange: (value: string) => void;
  senalados: string[];
  senaladosPos: Array<MarkerLocation | null>;
  onSenaladosPosChange?: (newPos: Array<MarkerLocation | null>) => void;
  onSaveAllSenalados?: (labels: string[], newPos: Array<MarkerLocation | null>) => void;
  onSenaladoChange?: (index: number, value: string) => void;
  onRemoveSenalado?: (index: number) => void;
  onOpenSenaladoLocation?: (index: number) => void;
  onAddSenalado?: () => void;
  onAddMultipleSenalado?: () => void;
  onAddBorderSenalado?: () => void;
  showComentario: boolean;
  onShowComentario: () => void;
  comentario: string;
  onComentarioChange: (value: string) => void;
  onClearComentario?: () => void;
  onRequestClose?: () => void;
  hasChanges?: boolean;
  labels?: {
    aumento?: string;
    tincion?: string;
    senalados?: string;
    comentario?: string;
    addTincion?: string;
    addComentario?: string;
    editComentario?: string;
    removeComentario?: string;
    addSenalado?: string;
    addMultipleSenalado?: string;
    addBorderSenalado?: string;
    editLocation?: string;
    placeLocation?: string;
  };
  styles?: {
    section?: React.CSSProperties;
    label?: React.CSSProperties;
    addBtn?: React.CSSProperties;
    addComentarioBtn?: React.CSSProperties;
    clearBtn?: React.CSSProperties;
    senalRow?: React.CSSProperties;
    senalNum?: React.CSSProperties;
    senalInput?: React.CSSProperties;
    removeBtn?: React.CSSProperties;
    aumentoGroup?: React.CSSProperties;
    aumentoBtn?: React.CSSProperties;
    aumentoBtnActive?: React.CSSProperties;
    comentarioField?: React.CSSProperties;
  };
}

const defaultStyles: Required<PlateEditorPanelProps['styles']> = {
  section: { display: 'flex', flexDirection: 'column', gap: '12px' },
  label: { margin: 0, fontSize: '0.92em', fontWeight: 800, color: '#0f172a', letterSpacing: '0.01em' },
  addBtn: {
    border: '1px solid #bae6fd',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #eff6ff, #e0f2fe)',
    color: '#075985',
    fontFamily: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
    padding: '11px 14px',
    boxShadow: '0 1px 0 rgba(255,255,255,0.7) inset',
  },
  addComentarioBtn: {
    border: '1px solid #c7d2fe',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)',
    color: '#4338ca',
    fontFamily: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
    padding: '11px 14px',
  },
  clearBtn: {
    border: '1px solid #fecaca',
    borderRadius: '12px',
    background: '#fff1f2',
    color: '#be123c',
    fontFamily: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
    padding: '10px 12px',
  },
  senalRow: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto auto',
    gap: '8px',
    alignItems: 'center',
    padding: '10px',
    borderRadius: '14px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
  },
  senalNum: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    color: '#fff',
    fontWeight: 900,
    fontSize: '0.82em',
  },
  senalInput: {
    minWidth: 0,
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    padding: '11px 12px',
    fontFamily: 'inherit',
    fontWeight: 600,
    color: '#0f172a',
  },
  removeBtn: {
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#dc2626',
    borderRadius: '10px',
    padding: '8px 10px',
    fontFamily: 'inherit',
    fontWeight: 900,
    cursor: 'pointer',
  },
  aumentoGroup: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  aumentoBtn: {
    border: '1px solid #cbd5e1',
    background: '#fff',
    borderRadius: '999px',
    padding: '8px 14px',
    fontFamily: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
    color: '#334155',
  },
  aumentoBtnActive: {
    border: '1px solid transparent',
    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    color: '#fff',
    borderRadius: '999px',
    padding: '8px 14px',
    fontFamily: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
  },
  comentarioField: {
    width: '100%',
    minHeight: '110px',
    borderRadius: '14px',
    border: '1px solid #cbd5e1',
    padding: '12px 14px',
    fontFamily: 'inherit',
    color: '#0f172a',
    background: '#fff',
    resize: 'vertical',
  },
};

const PlateEditorPanel: React.FC<PlateEditorPanelProps> = ({
  title,
  imageSrc,
  imageAlt,
  highResImageSrc,
  pendingImageFile,
  pendingImagePreviewUrl,
  onSelectImageFile,
  onClearPendingImage,
  primaryActionLabel,
  primaryActionDisabled,
  primaryActionLoading,
  onPrimaryAction,
  primaryActionFeedback,
  primaryActionFeedbackTone,
  aumento,
  onAumentoChange,
  showTincion,
  onShowTincion,
  tincion,
  onTincionChange,
  senalados,
  senaladosPos,
  onSenaladosPosChange,
  onSaveAllSenalados,
  onSenaladoChange,
  showComentario,
  onShowComentario,
  comentario,
  onComentarioChange,
  onClearComentario,
  onRequestClose,
  hasChanges = false,
  labels,
  styles,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'Administrador';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayImageSrc = pendingImagePreviewUrl || imageSrc;

  const mergedStyles = {
    ...defaultStyles,
    ...styles,
  };
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showMoveAllModal, setShowMoveAllModal] = useState(false);
  const [showFullVisualEditor, setShowFullVisualEditor] = useState(false);

  useEffect(() => {
    acquireAtlasScrollLock();
    return () => {
      releaseAtlasScrollLock();
    };
  }, []);

  const handleRequestClose = () => {
    if (!onRequestClose) return;
    if (showFullVisualEditor || showMoveAllModal) return;
    if (hasChanges) {
      setShowCloseConfirm(true);
    } else {
      onRequestClose();
    }
  };

  const confirmClose = () => {
    setShowCloseConfirm(false);
    onRequestClose?.();
  };

  const texts = {
    aumento: labels?.aumento ?? '🔬 Aumento',
    tincion: labels?.tincion ?? '🧪 Tinción',
    senalados: labels?.senalados ?? '📌 Señalados',
    comentario: labels?.comentario ?? '💬 Comentario',
    addTincion: labels?.addTincion ?? '🧪 Añadir tinción',
    addComentario: labels?.addComentario ?? '💬 Añadir comentario',
    editComentario: labels?.editComentario ?? '💬 Añadir / editar comentario',
    removeComentario: labels?.removeComentario ?? '🗑️ Quitar comentario',
    addSenalado: labels?.addSenalado ?? '+ Añadir señalado',
    addMultipleSenalado: labels?.addMultipleSenalado ?? '+ Añadir señalado múltiples',
    addBorderSenalado: labels?.addBorderSenalado ?? '+ Añadir señalado con borde',
    editLocation: labels?.editLocation ?? '📍 Editar ubicación',
    placeLocation: labels?.placeLocation ?? '📍 Ubicar',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1600,
        background: 'rgba(15, 23, 42, 0.72)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: 'clamp(10px, 2vw, 24px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !showCloseConfirm && !showFullVisualEditor && !showMoveAllModal) {
          handleRequestClose();
        }
      }}
    >
      <div
        style={{
          width: 'min(1120px, 100%)',
          height: '100%',
          borderRadius: '22px',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          boxShadow: '0 28px 80px rgba(15, 23, 42, 0.38)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid rgba(191, 219, 254, 0.75)',
        }}
        onClick={event => event.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', padding: '18px 20px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, rgba(239,246,255,0.95), rgba(255,255,255,0.95))' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '1.02em', fontWeight: 900, color: '#0f172a' }}>{title ?? 'Editor de placa'}</div>
            <div style={{ fontSize: '0.88em', color: '#64748b' }}>Pantalla completa para editar sin perder el foco. Los cambios solo se guardan al pulsar el botón inferior.</div>
          </div>
          {onRequestClose && (
            <button
              type="button"
              onClick={handleRequestClose}
              style={{
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                borderRadius: '12px',
                padding: '8px 12px',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ✕ Cerrar
            </button>
          )}
        </div>

        {showCloseConfirm && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 20,
              background: 'rgba(15, 23, 42, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={event => {
              event.stopPropagation();
              setShowCloseConfirm(false);
            }}
          >
            <div
              style={{
                width: 'min(480px, 100%)',
                borderRadius: '24px',
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                border: '1px solid rgba(191, 219, 254, 0.95)',
                boxShadow: '0 24px 70px rgba(15, 23, 42, 0.35)',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
              onClick={event => event.stopPropagation()}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '1.08em', fontWeight: 900, color: '#0f172a' }}>¿Salir sin guardar?</div>
                <div style={{ fontSize: '0.92em', lineHeight: 1.5, color: '#64748b' }}>
                  Si cierras ahora, perderás los cambios que todavía no has guardado.
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowCloseConfirm(false)}
                  style={{
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#334155',
                    borderRadius: '14px',
                    padding: '10px 14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={confirmClose}
                  style={{
                    border: '1px solid #fca5a5',
                    background: 'linear-gradient(135deg, #ef4444, #f97316)',
                    color: '#fff',
                    borderRadius: '14px',
                    padding: '10px 14px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: '0 10px 24px rgba(239, 68, 68, 0.24)',
                  }}
                >
                  Salir sin guardar
                </button>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: imageSrc ? 'minmax(260px, 340px) minmax(0, 1fr)' : '1fr',
            gap: '20px',
            padding: '20px',
          }}
        >
          {imageSrc && (
            <aside
              style={{
                position: 'sticky',
                top: '20px',
                alignSelf: 'start',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minHeight: 0,
              }}
            >
              <div
                style={{
                  borderRadius: '22px',
                  border: '1px solid #dbeafe',
                  background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)',
                  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.12)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '0.88em', fontWeight: 900, color: '#1e293b' }}>Miniatura</div>
                  <div style={{ fontSize: '0.82em', color: '#64748b' }}>Placa que esta editando</div>
                </div>
                <div
                  style={{
                    borderRadius: '18px',
                    overflow: 'hidden',
                    background: '#0f172a',
                    border: pendingImagePreviewUrl
                      ? '2px solid #3b82f6'
                      : '1px solid rgba(148, 163, 184, 0.35)',
                    aspectRatio: '3 / 4',
                    minHeight: '340px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    boxShadow: pendingImagePreviewUrl ? '0 0 0 3px rgba(59, 130, 246, 0.25)' : 'none',
                  }}
                >
                  {pendingImagePreviewUrl ? (
                    <img
                      key={pendingImagePreviewUrl}
                      src={pendingImagePreviewUrl}
                      alt={imageAlt ?? 'Nueva imagen seleccionada'}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  ) : (
                    <ResilientPlacaThumb
                      photoUrl={imageSrc}
                      alt={imageAlt ?? 'Miniatura de la placa'}
                      profile="thumb"
                      style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                    />
                  )}
                  {pendingImagePreviewUrl && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        right: '10px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: 'rgba(30, 58, 138, 0.88)',
                        color: '#ffffff',
                        fontSize: '0.78em',
                        fontWeight: 700,
                        textAlign: 'center',
                        backdropFilter: 'blur(4px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      }}
                    >
                      ✨ Nueva foto seleccionada (sin guardar)
                    </div>
                  )}
                </div>

                {/* Botón de actualizar imagen: visible ÚNICAMENTE para usuarios con rol Administrador */}
                {isAdmin && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onSelectImageFile) {
                          onSelectImageFile(file);
                        }
                        // Limpiar para permitir seleccionar el mismo archivo si es necesario
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    />

                    <button
                      type="button"
                      id="btn-actualizar-imagen-placa"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: '1.5px solid #93c5fd',
                        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                        color: '#1d4ed8',
                        fontWeight: 800,
                        fontSize: '0.86em',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.12)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.borderColor = '#1d4ed8';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.25)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
                        e.currentTarget.style.color = '#1d4ed8';
                        e.currentTarget.style.borderColor = '#93c5fd';
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.12)';
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera size={16} strokeWidth={2.4} />
                      <span>{pendingImageFile ? 'Cambiar foto seleccionada' : 'Actualizar imagen'}</span>
                    </button>

                    {pendingImagePreviewUrl && onClearPendingImage && (
                      <button
                        type="button"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '7px 12px',
                          borderRadius: '10px',
                          border: '1px solid #fecaca',
                          background: '#fff1f2',
                          color: '#dc2626',
                          fontWeight: 700,
                          fontSize: '0.8em',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                        onClick={onClearPendingImage}
                      >
                        <RotateCcw size={13} />
                        <span>Deshacer y conservar original</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </aside>
          )}

          <div style={{ minHeight: 0, overflow: 'auto', paddingRight: imageSrc ? '4px' : 0, display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={mergedStyles.section}>
              <label style={mergedStyles.label}>{texts.aumento}</label>
              <div style={mergedStyles.aumentoGroup}>
                {['x4', 'x10', 'x40', 'x50', 'x100'].map(op => (
                  <button
                    key={op}
                    type="button"
                    style={aumento === op ? mergedStyles.aumentoBtnActive : mergedStyles.aumentoBtn}
                    onClick={() => onAumentoChange(aumento === op ? '' : op)}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>

            <div style={mergedStyles.section}>
              {!showTincion ? (
                <button type="button" style={mergedStyles.addBtn} onClick={onShowTincion}>
                  {texts.addTincion}
                </button>
              ) : (
                <>
                  <label style={{ ...mergedStyles.label, color: '#b45309' }}>{texts.tincion}</label>
                  <TincionAccordionSelector value={tincion} onChange={onTincionChange} />
                </>
              )}
            </div>

            <div style={mergedStyles.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <label style={mergedStyles.label}>{texts.senalados}</label>
                {senalados.length > 0 && (
                  <span
                    style={{
                      fontSize: '0.8em',
                      fontWeight: 800,
                      color: '#0369a1',
                      background: '#e0f2fe',
                      padding: '3px 10px',
                      borderRadius: '999px',
                    }}
                  >
                    {senalados.filter(s => s.trim()).length} señalado{senalados.filter(s => s.trim()).length === 1 ? '' : 's'} configurado{senalados.filter(s => s.trim()).length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              {imageSrc && (
                <button
                  type="button"
                  style={{
                    border: '1.5px solid #0ea5e9',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #4f46e5 100%)',
                    color: '#ffffff',
                    fontFamily: 'inherit',
                    fontWeight: 900,
                    fontSize: '0.95em',
                    cursor: 'pointer',
                    padding: '13px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 8px 20px rgba(14, 165, 233, 0.28)',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setShowFullVisualEditor(true)}
                  title="Abrir el editor interactivo de señalados en pantalla completa (estilo visor)"
                >
                  <Sparkles size={18} /> Abrir editor visual de señalados
                </button>
              )}
            </div>

            <div style={mergedStyles.section}>
              {!showComentario ? (
                <button type="button" style={mergedStyles.addComentarioBtn} onClick={onShowComentario}>
                  {texts.addComentario}
                </button>
              ) : (
                <>
                  <label style={{ ...mergedStyles.label, color: '#4f46e5' }}>{texts.comentario}</label>
                  <BoldField as="textarea" style={mergedStyles.comentarioField} value={comentario} placeholder="Escribe un comentario..." onChange={onComentarioChange} />
                  {comentario && onClearComentario && (
                    <button type="button" style={mergedStyles.clearBtn} onClick={onClearComentario}>
                      {texts.removeComentario}
                    </button>
                  )}
                </>
              )}
            </div>

            {onPrimaryAction && primaryActionLabel && (
              <div
                style={{
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 2,
                  marginTop: '8px',
                  paddingTop: '14px',
                  background: 'linear-gradient(180deg, rgba(248,250,252,0) 0%, rgba(248,250,252,0.92) 24%, rgba(248,250,252,1) 100%)',
                }}
              >
                {primaryActionFeedback && (
                  <div
                    style={{
                      borderRadius: '14px',
                      padding: '11px 14px',
                      marginBottom: '10px',
                      border: primaryActionFeedbackTone === 'error'
                        ? '1px solid #fecaca'
                        : primaryActionFeedbackTone === 'success'
                        ? '1px solid #bbf7d0'
                        : '1px solid #bfdbfe',
                      background: primaryActionFeedbackTone === 'error'
                        ? '#fff1f2'
                        : primaryActionFeedbackTone === 'success'
                        ? '#f0fdf4'
                        : '#eff6ff',
                      color: primaryActionFeedbackTone === 'error'
                        ? '#be123c'
                        : primaryActionFeedbackTone === 'success'
                        ? '#166534'
                        : '#1d4ed8',
                      fontWeight: 700,
                      fontSize: '0.92em',
                    }}
                  >
                    {primaryActionFeedback}
                  </div>
                )}
                <button
                  type="button"
                  onClick={onPrimaryAction}
                  disabled={primaryActionDisabled}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderRadius: '18px',
                    padding: '15px 18px',
                    background: primaryActionDisabled ? 'linear-gradient(135deg, #93c5fd, #a5b4fc)' : 'linear-gradient(135deg, #16a34a, #0ea5e9)',
                    color: '#fff',
                    fontFamily: 'inherit',
                    fontSize: '1em',
                    fontWeight: 900,
                    cursor: primaryActionDisabled ? 'not-allowed' : 'pointer',
                    boxShadow: '0 16px 30px rgba(14, 165, 233, 0.24)',
                  }}
                >
                  {primaryActionLoading ? 'Guardando...' : primaryActionLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {displayImageSrc && showMoveAllModal && (
        <AllSenaladosMoverModal
          isOpen={showMoveAllModal}
          imageSrc={displayImageSrc}
          imageAlt={imageAlt}
          senalados={senalados}
          senaladosPos={senaladosPos}
          onClose={() => setShowMoveAllModal(false)}
          onSave={(updatedPos) => {
            onSenaladosPosChange?.(updatedPos);
            setShowMoveAllModal(false);
          }}
        />
      )}

      {displayImageSrc && showFullVisualEditor && (
        <PlateAnnotationViewerEditor
          imageSrc={displayImageSrc}
          imageAlt={imageAlt}
          highResImageSrc={pendingImagePreviewUrl || highResImageSrc || imageSrc}
          aumento={aumento}
          tincion={tincion}
          comentario={comentario}
          initialSenalados={senalados}
          initialSenaladosPos={senaladosPos}
          onSaveAll={(newLabels, newPos) => {
            if (onSaveAllSenalados) {
              onSaveAllSenalados(newLabels, newPos);
            } else {
              if (onSenaladosPosChange) {
                onSenaladosPosChange(newPos);
              }
              if (onSenaladoChange) {
                newLabels.forEach((label, idx) => {
                  onSenaladoChange(idx, label);
                });
              }
            }
          }}
          onCancel={() => setShowFullVisualEditor(false)}
        />
      )}
    </div>
  );
};

export default PlateEditorPanel;
