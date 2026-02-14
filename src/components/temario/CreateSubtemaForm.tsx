import React from 'react';

interface TemaOption {
  id: number;
  nombre: string;
}

interface CreateSubtemaFormProps {
  styles: { [key: string]: React.CSSProperties };
  temas: TemaOption[];
  selectedTemaId: string;
  subtemas: string[];
  onChangeSelectedTema: (value: string) => void;
  onAddSubtema: () => void;
  onSubtemaChange: (index: number, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

const CreateSubtemaForm: React.FC<CreateSubtemaFormProps> = ({
  styles,
  temas,
  selectedTemaId,
  subtemas,
  onChangeSelectedTema,
  onAddSubtema,
  onSubtemaChange,
  onSubmit,
  onCancel,
}) => (
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
      <button type="submit" style={styles.primaryButton}>
        Confirmar
      </button>
      <button type="button" onClick={onCancel} style={styles.cancelButton}>
        Cancelar
      </button>
    </div>
  </form>
);

export default CreateSubtemaForm;
