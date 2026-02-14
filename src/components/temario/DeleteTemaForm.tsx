import React from 'react';

interface TemaOption {
  id: number;
  nombre: string;
}

interface DeleteTemaFormProps {
  styles: { [key: string]: React.CSSProperties };
  temas: TemaOption[];
  deletingTemaId: string;
  onChangeDeletingTemaId: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

const DeleteTemaForm: React.FC<DeleteTemaFormProps> = ({
  styles,
  temas,
  deletingTemaId,
  onChangeDeletingTemaId,
  onSubmit,
  onCancel,
}) => (
  <form onSubmit={onSubmit} style={styles.form}>
    <div style={styles.formGroup}>
      <label style={styles.label}>Seleccionar Tema a Borrar:</label>
      <select
        style={styles.select}
        value={deletingTemaId}
        onChange={(e) => onChangeDeletingTemaId(e.target.value)}
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

    <div style={styles.actionButtons}>
      <button type="submit" style={styles.cancelButton}>
        Borrar Tema
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{ ...styles.primaryButton, backgroundColor: '#6c757d' }}
      >
        Cancelar
      </button>
    </div>
  </form>
);

export default DeleteTemaForm;
