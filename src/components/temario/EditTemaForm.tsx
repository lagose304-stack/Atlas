import React from 'react';

interface TemaOption {
  id: number;
  nombre: string;
}

interface EditTemaFormProps {
  styles: { [key: string]: React.CSSProperties };
  temas: TemaOption[];
  editingTemaId: string;
  editingTemaNombre: string;
  onChangeEditingTemaId: (value: string) => void;
  onChangeEditingTemaNombre: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

const EditTemaForm: React.FC<EditTemaFormProps> = ({
  styles,
  temas,
  editingTemaId,
  editingTemaNombre,
  onChangeEditingTemaId,
  onChangeEditingTemaNombre,
  onSubmit,
  onCancel,
}) => (
  <form onSubmit={onSubmit} style={styles.form}>
    <div style={styles.formGroup}>
      <label style={styles.label}>Seleccionar Tema:</label>
      <select
        style={styles.select}
        value={editingTemaId}
        onChange={(e) => onChangeEditingTemaId(e.target.value)}
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
    </div>

    {editingTemaId && (
      <div style={styles.formGroup}>
        <label style={styles.label}>Nuevo nombre del Tema:</label>
        <input
          style={styles.input}
          type="text"
          value={editingTemaNombre}
          onChange={(e) => onChangeEditingTemaNombre(e.target.value)}
          required
        />
      </div>
    )}

    <div style={styles.actionButtons}>
      <button type="submit" style={styles.primaryButton}>
        Guardar Cambios
      </button>
      <button type="button" onClick={onCancel} style={styles.cancelButton}>
        Cancelar
      </button>
    </div>
  </form>
);

export default EditTemaForm;
