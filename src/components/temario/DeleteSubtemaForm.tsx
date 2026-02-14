import React from 'react';

interface TemaOption {
  id: number;
  nombre: string;
}

interface SubtemaOption {
  id: number;
  nombre: string;
  tema_id: number;
}

interface DeleteSubtemaFormProps {
  styles: { [key: string]: React.CSSProperties };
  temas: TemaOption[];
  deletingTemaId: string;
  subtemasOfSelectedTema: SubtemaOption[];
  deletingSubtemaId: string;
  onChangeDeletingTemaId: (value: string) => void;
  onChangeDeletingSubtemaId: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

const DeleteSubtemaForm: React.FC<DeleteSubtemaFormProps> = ({
  styles,
  temas,
  deletingTemaId,
  subtemasOfSelectedTema,
  deletingSubtemaId,
  onChangeDeletingTemaId,
  onChangeDeletingSubtemaId,
  onSubmit,
  onCancel,
}) => (
  <form onSubmit={onSubmit} style={styles.form}>
    <div style={styles.formGroup}>
      <label style={styles.label}>Seleccionar Tema:</label>
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
      {deletingTemaId && (
        <span style={{ color: '#0f172a', fontWeight: 600, fontSize: '14px' }}>
          Tema seleccionado: {temas.find((t) => t.id.toString() === deletingTemaId)?.nombre || ''}
        </span>
      )}
    </div>

    {deletingTemaId && subtemasOfSelectedTema.length > 0 && (
      <div style={styles.formGroup}>
        <label style={styles.label}>Seleccionar Subtema a Borrar:</label>
        <select
          style={styles.select}
          value={deletingSubtemaId}
          onChange={(e) => onChangeDeletingSubtemaId(e.target.value)}
          required
        >
          <option value="" disabled>
            Selecciona un subtema
          </option>
          {subtemasOfSelectedTema.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>
    )}

    {deletingTemaId && subtemasOfSelectedTema.length === 0 && (
      <p>Este tema no tiene subtemas.</p>
    )}

    <div style={styles.actionButtons}>
      <button type="submit" style={styles.cancelButton}>
        Borrar Subtema
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

export default DeleteSubtemaForm;
