import React, { useRef } from 'react';

interface TemaOption {
  id: number;
  nombre: string;
}

interface SubtemaOption {
  id: number;
  nombre: string;
  tema_id: number;
  logo_url?: string;
}

interface EditSubtemaFormProps {
  styles: { [key: string]: React.CSSProperties };
  temas: TemaOption[];
  selectedTemaId: string;
  subtemasOfSelectedTema: SubtemaOption[];
  editingSubtemaId: string;
  editingSubtemaNombre: string;
  editingSubtemaCurrentLogoUrl: string;
  editingSubtemaNewLogoPreviewUrl: string;
  isUploadingLogo: boolean;
  onChangeSelectedTema: (value: string) => void;
  onChangeEditingSubtemaId: (value: string) => void;
  onChangeEditingSubtemaNombre: (value: string) => void;
  onUploadNewLogo: (file: File) => void;
  onRemoveNewLogo: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

const EditSubtemaForm: React.FC<EditSubtemaFormProps> = ({
  styles,
  temas,
  selectedTemaId,
  subtemasOfSelectedTema,
  editingSubtemaId,
  editingSubtemaNombre,
  editingSubtemaCurrentLogoUrl,
  editingSubtemaNewLogoPreviewUrl,
  isUploadingLogo,
  onChangeSelectedTema,
  onChangeEditingSubtemaId,
  onChangeEditingSubtemaNombre,
  onUploadNewLogo,
  onRemoveNewLogo,
  onSubmit,
  onCancel,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadNewLogo(file);
    e.target.value = '';
  };

  return (
    <form onSubmit={onSubmit} style={styles.form}>
      {/* Seleccionar tema */}
      <div style={styles.formGroup}>
        <label style={styles.label}>Seleccionar Tema:</label>
        <select
          style={styles.select}
          value={selectedTemaId}
          onChange={(e) => onChangeSelectedTema(e.target.value)}
          required
        >
          <option value="" disabled>Selecciona un tema</option>
          {temas.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
        {selectedTemaId && (
          <span style={{ color: '#0f172a', fontWeight: 600, fontSize: '14px' }}>
            Tema seleccionado: {temas.find((t) => t.id.toString() === selectedTemaId)?.nombre || ''}
          </span>
        )}
      </div>

      {selectedTemaId && subtemasOfSelectedTema.length > 0 && (
        <>
          {/* Seleccionar subtema */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Seleccionar Subtema:</label>
            <select
              style={styles.select}
              value={editingSubtemaId}
              onChange={(e) => onChangeEditingSubtemaId(e.target.value)}
              required
            >
              <option value="" disabled>Selecciona un subtema</option>
              {subtemasOfSelectedTema.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>

          {editingSubtemaId && (
            <>
              {/* Editar nombre */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Nuevo nombre del Subtema:</label>
                <input
                  style={styles.input}
                  type="text"
                  value={editingSubtemaNombre}
                  onChange={(e) => onChangeEditingSubtemaNombre(e.target.value)}
                  required
                />
              </div>

              {/* Editar imagen */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Imagen del Subtema:</label>
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e0f2fe',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  {/* Imagen actual */}
                  {editingSubtemaCurrentLogoUrl && !editingSubtemaNewLogoPreviewUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Imagen actual:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <img
                          src={editingSubtemaCurrentLogoUrl}
                          alt="Imagen actual"
                          style={{
                            maxHeight: '64px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 10px rgba(15,23,42,0.1)',
                          }}
                        />
                        <button
                          type="button"
                          style={{
                            ...styles.secondaryButton,
                            border: '1px dashed #0ea5e9',
                            backgroundColor: 'rgba(14,165,233,0.08)',
                            color: '#0ea5e9',
                            fontWeight: 700,
                            padding: '8px 14px',
                            fontSize: '0.9em',
                          }}
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingLogo}
                        >
                          🔄 Cambiar imagen
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Nueva imagen */}
                  {editingSubtemaNewLogoPreviewUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>Nueva imagen (pendiente de guardar):</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img
                            src={editingSubtemaNewLogoPreviewUrl}
                            alt="Nueva imagen"
                            style={{
                              maxHeight: '64px',
                              borderRadius: '8px',
                              border: '2px solid #86efac',
                              boxShadow: '0 4px 10px rgba(22,163,74,0.15)',
                            }}
                          />
                          <button
                            type="button"
                            onClick={onRemoveNewLogo}
                            style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              height: '24px',
                              width: '24px',
                              borderRadius: '12px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#fff',
                              color: '#0f172a',
                              cursor: 'pointer',
                              boxShadow: '0 4px 8px rgba(15,23,42,0.12)',
                              fontWeight: 700,
                              lineHeight: 1,
                              fontSize: '14px',
                            }}
                            aria-label="Quitar nueva imagen"
                          >
                            ×
                          </button>
                        </div>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>La imagen anterior será reemplazada al guardar.</span>
                      </div>
                    </div>
                  )}

                  {/* Sin imagen */}
                  {!editingSubtemaCurrentLogoUrl && !editingSubtemaNewLogoPreviewUrl && (
                    <button
                      type="button"
                      style={{
                        ...styles.secondaryButton,
                        border: '1px dashed #0ea5e9',
                        backgroundColor: 'rgba(14,165,233,0.08)',
                        color: '#0ea5e9',
                        fontWeight: 700,
                        padding: '8px 14px',
                        fontSize: '0.9em',
                        alignSelf: 'flex-start',
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingLogo}
                    >
                      📷 Subir imagen
                    </button>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {selectedTemaId && subtemasOfSelectedTema.length === 0 && (
        <p>Este tema no tiene subtemas.</p>
      )}

      <div style={styles.actionButtons}>
        <button
          type="submit"
          style={{
            ...styles.primaryButton,
            opacity: isUploadingLogo ? 0.7 : 1,
            cursor: isUploadingLogo ? 'not-allowed' : 'pointer',
          }}
          disabled={isUploadingLogo}
        >
          {isUploadingLogo ? '⏳ Guardando...' : 'Guardar Cambios'}
        </button>
        <button type="button" onClick={onCancel} style={styles.cancelButton}>
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default EditSubtemaForm;
