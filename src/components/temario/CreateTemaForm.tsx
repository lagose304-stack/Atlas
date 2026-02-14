import React, { useRef } from 'react';

interface CreateTemaFormProps {
  styles: { [key: string]: React.CSSProperties };
  temaNombre: string;
  temaLogoUrl: string;
  isUploadingLogo: boolean;
  onUploadLogo: (file: File) => void;
  onRemoveLogo: () => void;
  temaParcial: 'primer' | 'segundo' | 'tercer' | '';
  onChangeParcial: (value: 'primer' | 'segundo' | 'tercer' | '') => void;
  subtemas: string[];
  onChangeTemaNombre: (value: string) => void;
  onAddSubtema: () => void;
  onSubtemaChange: (index: number, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

const CreateTemaForm: React.FC<CreateTemaFormProps> = ({
  styles,
  temaNombre,
  temaLogoUrl,
  isUploadingLogo,
  onUploadLogo,
  onRemoveLogo,
  temaParcial,
  onChangeParcial,
  subtemas,
  onChangeTemaNombre,
  onAddSubtema,
  onSubtemaChange,
  onSubmit,
  onCancel,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isSubmitDisabled = isUploadingLogo || !temaLogoUrl || !temaParcial;
  const parcialOptions: Array<{ value: 'primer' | 'segundo' | 'tercer'; label: string }> = [
    { value: 'primer', label: 'Primer parcial' },
    { value: 'segundo', label: 'Segundo parcial' },
    { value: 'tercer', label: 'Tercer parcial' },
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onUploadLogo(file);
    event.target.value = '';
  };

  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <div style={styles.formGroup}>
        <label style={styles.label}>Nombre del Tema:</label>
        <input
          style={styles.input}
          type="text"
          value={temaNombre}
          onChange={(e) => onChangeTemaNombre(e.target.value)}
          required
        />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Logo del Tema (requerido):</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {!temaLogoUrl && (
            <button
              type="button"
              style={{
                ...styles.secondaryButton,
                border: '1px dashed #0ea5e9',
                backgroundColor: 'rgba(14,165,233,0.08)',
                color: '#0ea5e9',
                fontWeight: 700,
                padding: '12px 18px',
                boxShadow: '0 10px 25px rgba(14,165,233,0.15)',
              }}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingLogo}
            >
              {isUploadingLogo ? '⏳ Subiendo logo...' : 'Subir logo'}
            </button>
          )}
          {temaLogoUrl && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={temaLogoUrl}
                alt="Logo del tema"
                style={{ maxHeight: '72px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 8px 18px rgba(15,23,42,0.12)' }}
              />
              <button
                type="button"
                onClick={onRemoveLogo}
                style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  height: '28px',
                  width: '28px',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#fff',
                  color: '#0f172a',
                  cursor: 'pointer',
                  boxShadow: '0 6px 12px rgba(15,23,42,0.15)',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
                aria-label="Quitar logo"
              >
                ×
              </button>
            </div>
          )}
        </div>
        {!temaLogoUrl && (
          <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600 }}>Sube un logo para continuar.</span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Parcial (requerido):</label>
        <select
          value={temaParcial}
          onChange={(e) => onChangeParcial(e.target.value as 'primer' | 'segundo' | 'tercer' | '')}
          style={{
            ...styles.input,
            fontWeight: 600,
            color: temaParcial ? '#0f172a' : '#94a3b8',
          }}
        >
          <option value="" disabled>
            Selecciona parcial
          </option>
          {parcialOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {!temaParcial && (
          <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600 }}>Selecciona un parcial para continuar.</span>
        )}
      </div>

      {subtemas.map((subtema, index) => (
        <div style={styles.formGroup} key={index}>
          <label style={styles.label}>Subtema {index + 1}:</label>
          <input
            style={styles.input}
            type="text"
            value={subtema}
            onChange={(e) => onSubtemaChange(index, e.target.value)}
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
            opacity: isSubmitDisabled ? 0.7 : 1,
            cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
            boxShadow: isSubmitDisabled ? 'none' : styles.primaryButton.boxShadow,
          }}
          disabled={isSubmitDisabled}
        >
          {isUploadingLogo ? '⏳ Subiendo logo...' : 'Confirmar'}
        </button>
        <button type="button" onClick={onCancel} style={styles.cancelButton}>
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default CreateTemaForm;
