import React, { useRef } from 'react';

interface TemaOption {
  id: number;
  nombre: string;
}

export interface SubtemaInput {
  nombre: string;
  logoUrl: string;
  logoFile: File | null;
}

interface CreateSubtemaFormProps {
  styles: { [key: string]: React.CSSProperties };
  temas: TemaOption[];
  selectedTemaId: string;
  subtemas: SubtemaInput[];
  isUploadingLogo: boolean;
  onChangeSelectedTema: (value: string) => void;
  onAddSubtema: () => void;
  onSubtemaChange: (index: number, value: string) => void;
  onSubtemaLogoUpload: (index: number, file: File) => void;
  onSubtemaRemoveLogo: (index: number) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

const CreateSubtemaForm: React.FC<CreateSubtemaFormProps> = ({
  styles,
  temas,
  selectedTemaId,
  subtemas,
  isUploadingLogo,
  onChangeSelectedTema,
  onAddSubtema,
  onSubtemaChange,
  onSubtemaLogoUpload,
  onSubtemaRemoveLogo,
  onSubmit,
  onCancel,
}) => {
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFileChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onSubtemaLogoUpload(index, file);
    event.target.value = '';
  };

  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <div style={styles.formGroup}>
        <label style={styles.label}>Seleccionar Tema:</label>
        <select
          style={styles.select}
          value={selectedTemaId}
          onChange={(e) => onChangeSelectedTema(e.target.value)}
          required
        >
          <option value="" disabled>
            Selecciona un tema
          </option>
          {temas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
        {selectedTemaId && (
          <span style={{ color: '#0f172a', fontWeight: 600, fontSize: '14px' }}>
            Tema seleccionado: {temas.find((t) => t.id.toString() === selectedTemaId)?.nombre || ''}
          </span>
        )}
      </div>

      {subtemas.map((subtema, index) => (
        <div
          key={index}
          style={{
            ...styles.formGroup,
            background: '#f8fafc',
            border: '1px solid #e0f2fe',
            borderRadius: '10px',
            padding: '14px',
            gap: '10px',
          }}
        >
          <label style={styles.label}>Subtema {index + 1}:</label>
          <input
            type="text"
            style={styles.input}
            value={subtema.nombre}
            onChange={e => onSubtemaChange(index, e.target.value)}
            placeholder="Nombre del subtema"
            spellCheck
            lang="es"
          />

          <label style={{ ...styles.label, marginTop: '4px' }}>Foto del subtema (opcional):</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {!subtema.logoUrl && (
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
                onClick={() => fileInputRefs.current[index]?.click()}
                disabled={isUploadingLogo}
              >
                {isUploadingLogo ? '⏳ Subiendo...' : '📷 Subir foto'}
              </button>
            )}
            {subtema.logoUrl && (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={subtema.logoUrl}
                  alt={`Logo subtema ${index + 1}`}
                  style={{
                    maxHeight: '60px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 10px rgba(15,23,42,0.1)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => onSubtemaRemoveLogo(index)}
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
                  aria-label="Quitar foto"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <input
            ref={(el) => { fileInputRefs.current[index] = el; }}
            type="file"
            accept="image/*,.heic,.heif,.tif,.tiff,.bmp,.avif,.webp"
            style={{ display: 'none' }}
            onChange={(e) => handleFileChange(index, e)}
          />
        </div>
      ))}

      <button type="button" onClick={onAddSubtema} style={styles.secondaryButton}>
        {subtemas.length === 0 ? 'Crear Subtema' : 'Agregar otro Subtema'}
      </button>

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
          {isUploadingLogo ? '⏳ Guardando...' : 'Confirmar'}
        </button>
        <button type="button" onClick={onCancel} style={styles.cancelButton}>
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default CreateSubtemaForm;
