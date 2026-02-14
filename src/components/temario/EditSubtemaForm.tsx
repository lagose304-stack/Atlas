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

interface EditSubtemaFormProps {
  styles: { [key: string]: React.CSSProperties };
  temas: TemaOption[];
  selectedTemaId: string;
  subtemasOfSelectedTema: SubtemaOption[];
  editingSubtemaId: string;
  editingSubtemaNombre: string;
  onChangeSelectedTema: (value: string) => void;
  onChangeEditingSubtemaId: (value: string) => void;
  onChangeEditingSubtemaNombre: (value: string) => void;
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
  onChangeSelectedTema,
  onChangeEditingSubtemaId,
  onChangeEditingSubtemaNombre,
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

    {selectedTemaId && subtemasOfSelectedTema.length > 0 && (
      <>
        <div style={styles.formGroup}>
          <label style={styles.label}>Seleccionar Subtema:</label>
          <select
            style={styles.select}
            value={editingSubtemaId}
            onChange={(e) => onChangeEditingSubtemaId(e.target.value)}
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

        {editingSubtemaId && (
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
        )}
      </>
    )}

    {selectedTemaId && subtemasOfSelectedTema.length === 0 && (
      <p>Este tema no tiene subtemas.</p>
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

export default EditSubtemaForm;
