import React from 'react';
import { Sparkles, Zap, Microscope, MapPin, Palette, Image as ImageIcon, Trash2, Plus } from 'lucide-react';
import { getCloudinaryImageUrl } from '../../services/cloudinaryImages';

interface BaseHistologyEditorProps {
  content: Record<string, string>;
  onUpdate: (updates: Record<string, string>) => void;
  onPickImage: (fieldKey: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '0.88rem',
  color: '#1e293b',
  background: '#ffffff',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: '65px',
  resize: 'vertical',
  lineHeight: 1.5,
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  fontSize: '0.8rem',
  fontWeight: 700,
  color: '#334155',
};

const cardItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
  position: 'relative',
};

const imagePickerBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '12px',
  borderRadius: '12px',
  border: '1.5px dashed #93c5fd',
  background: '#f0f7ff',
};

const addButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '8px 16px',
  borderRadius: '8px',
  background: '#eff6ff',
  color: '#1d4ed8',
  border: '1px dashed #93c5fd',
  fontWeight: 750,
  fontSize: '0.82rem',
  cursor: 'pointer',
  marginTop: '4px',
  width: '100%',
  transition: 'all 0.2s',
};

const removeBtnStyle: React.CSSProperties = {
  background: '#fee2e2',
  border: 'none',
  borderRadius: '6px',
  color: '#dc2626',
  cursor: 'pointer',
  padding: '4px 8px',
  fontSize: '0.72rem',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
};

// ─── 1. GENERALIDADES ────────────────────────────────────────────────────────
export const HistologyGeneralitiesInlineEditor: React.FC<BaseHistologyEditorProps> = ({
  content,
  onUpdate,
  onPickImage,
}) => {
  const pointsCount = Math.max(1, Number(content.points_count) || (content.point_4_title || content.point_4_desc ? 4 : content.point_3_title || content.point_3_desc ? 3 : content.point_2_title || content.point_2_desc ? 2 : 4));
  const indices = Array.from({ length: pointsCount }, (_, i) => i + 1);

  const handleAddPoint = () => {
    const nextCount = pointsCount + 1;
    onUpdate({
      points_count: String(nextCount),
      [`point_${nextCount}_title`]: '',
      [`point_${nextCount}_desc`]: '',
    });
  };

  const handleRemovePoint = (delIdx: number) => {
    if (pointsCount <= 1) return;
    const updates: Record<string, string> = { points_count: String(pointsCount - 1) };
    for (let i = delIdx; i < pointsCount; i++) {
      updates[`point_${i}_title`] = content[`point_${i + 1}_title`] ?? '';
      updates[`point_${i}_desc`] = content[`point_${i + 1}_desc`] ?? '';
    }
    updates[`point_${pointsCount}_title`] = '';
    updates[`point_${pointsCount}_desc`] = '';
    onUpdate(updates);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
        <label style={labelStyle}>
          <span>🏷️ Etiqueta superior / Badge</span>
          <input
            style={inputStyle}
            value={content.badge_text ?? ''}
            onChange={e => onUpdate({ badge_text: e.target.value })}
            placeholder="Ej: Generalidades"
          />
        </label>
        <label style={labelStyle}>
          <span>📌 Título de la sección</span>
          <input
            style={inputStyle}
            value={content.title ?? ''}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="Ej: Generalidades del Epitelio Plano Simple"
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(240px, 0.8fr)', gap: '16px', alignItems: 'start' }}>
        <label style={labelStyle}>
          <span>📝 Párrafo introductorio</span>
          <textarea
            style={{ ...textareaStyle, minHeight: '120px' }}
            value={content.intro_text ?? ''}
            onChange={e => onUpdate({ intro_text: e.target.value })}
            placeholder="Escribe la descripción general del tejido (soporta **negritas**)..."
          />
        </label>

        <div style={imagePickerBoxStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ImageIcon size={15} /> Micrografía de Referencia
            </span>
            {content.image_url && (
              <button
                type="button"
                onClick={() => onUpdate({ image_url: '' })}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', fontWeight: 700 }}
              >
                <Trash2 size={13} /> Quitar
              </button>
            )}
          </div>

          {content.image_url ? (
            <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', height: '110px', border: '1px solid #bfdbfe' }}>
              <img
                src={getCloudinaryImageUrl(content.image_url, 'cardWideSmall')}
                alt="Referencia"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.8rem' }}>
              Sin imagen asignada (se usará esquema por defecto)
            </div>
          )}

          <button
            type="button"
            onClick={() => onPickImage('image_url')}
            style={{ padding: '7px 12px', borderRadius: '6px', background: '#0284c7', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            {content.image_url ? 'Cambiar Imagen' : 'Subir o Elegir Imagen'}
          </button>

          <label style={{ ...labelStyle, fontSize: '0.75rem' }}>
            <span>Etiqueta sobre la imagen</span>
            <input
              style={{ ...inputStyle, padding: '5px 8px', fontSize: '0.8rem' }}
              value={content.image_badge ?? ''}
              onChange={e => onUpdate({ image_badge: e.target.value })}
              placeholder="Ej: 🔬 Micrografía de Referencia · H&E"
            />
          </label>
        </div>
      </div>

      {/* Pilares Clave Dinámicos */}
      <div>
        <label style={{ ...labelStyle, marginBottom: '10px' }}>
          <span>✨ Título de la subsección de pilares</span>
          <input
            style={inputStyle}
            value={content.points_title ?? ''}
            onChange={e => onUpdate({ points_title: e.target.value })}
            placeholder="Ej: Pilares Teóricos y Embriología del Tejido"
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
            ✨ Pilares Clave del Tejido ({pointsCount})
          </strong>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
          {indices.map(num => (
            <div key={num} style={cardItemStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: '#6366f1' }}>
                  <Sparkles size={13} /> Pilar {num}
                </div>
                {pointsCount > 1 && (
                  <button
                    type="button"
                    style={removeBtnStyle}
                    onClick={() => handleRemovePoint(num)}
                    title={`Eliminar pilar ${num}`}
                  >
                    <Trash2 size={11} /> Eliminar
                  </button>
                )}
              </div>
              <input
                style={{ ...inputStyle, fontWeight: 700 }}
                value={content[`point_${num}_title`] ?? ''}
                onChange={e => onUpdate({ [`point_${num}_title`]: e.target.value })}
                placeholder={`Título del pilar ${num}`}
              />
              <textarea
                style={{ ...textareaStyle, minHeight: '60px' }}
                value={content[`point_${num}_desc`] ?? ''}
                onChange={e => onUpdate({ [`point_${num}_desc`]: e.target.value })}
                placeholder={`Detalle del pilar ${num}...`}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          style={addButtonStyle}
          onClick={handleAddPoint}
          title="Añadir un pilar adicional"
        >
          <Plus size={15} /> Añadir otro Pilar (+1)
        </button>
      </div>

      <label style={labelStyle}>
        <span>💡 Tip o Clave de Laboratorio (Callout destacado)</span>
        <textarea
          style={{ ...textareaStyle, borderLeft: '4px solid #6366f1', background: '#f5f3ff' }}
          value={content.lab_tip ?? ''}
          onChange={e => onUpdate({ lab_tip: e.target.value })}
          placeholder="Regla de oro en el microscopio..."
        />
      </label>
    </div>
  );
};

// ─── 2. FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────
export const HistologyFunctionInlineEditor: React.FC<BaseHistologyEditorProps> = ({
  content,
  onUpdate,
  onPickImage,
}) => {
  const featsCount = Math.max(1, Number(content.feats_count) || (content.feat_4_title || content.feat_4_desc ? 4 : content.feat_3_title || content.feat_3_desc ? 3 : content.feat_2_title || content.feat_2_desc ? 2 : 4));
  const indices = Array.from({ length: featsCount }, (_, i) => i + 1);

  const handleAddFeat = () => {
    const nextCount = featsCount + 1;
    onUpdate({
      feats_count: String(nextCount),
      [`feat_${nextCount}_title`]: '',
      [`feat_${nextCount}_desc`]: '',
    });
  };

  const handleRemoveFeat = (delIdx: number) => {
    if (featsCount <= 1) return;
    const updates: Record<string, string> = { feats_count: String(featsCount - 1) };
    for (let i = delIdx; i < featsCount; i++) {
      updates[`feat_${i}_title`] = content[`feat_${i + 1}_title`] ?? '';
      updates[`feat_${i}_desc`] = content[`feat_${i + 1}_desc`] ?? '';
    }
    updates[`feat_${featsCount}_title`] = '';
    updates[`feat_${featsCount}_desc`] = '';
    onUpdate(updates);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
        <label style={labelStyle}>
          <span>🏷️ Etiqueta superior / Badge</span>
          <input
            style={inputStyle}
            value={content.badge_text ?? ''}
            onChange={e => onUpdate({ badge_text: e.target.value })}
            placeholder="Ej: Función Principal del Tejido"
          />
        </label>
        <label style={labelStyle}>
          <span>⚡ Título de la Función</span>
          <input
            style={inputStyle}
            value={content.title ?? ''}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="Ej: Intercambio Rápido y Difusión de Sustancias"
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(240px, 0.8fr)', gap: '16px', alignItems: 'start' }}>
        <label style={labelStyle}>
          <span>📝 Descripción de la función fisiológica</span>
          <textarea
            style={{ ...textareaStyle, minHeight: '120px' }}
            value={content.description ?? ''}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="Explica el rol y mecanismo biológico del tejido..."
          />
        </label>

        <div style={imagePickerBoxStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ImageIcon size={15} /> Esquema / Imagen Funcional
            </span>
            {content.image_url && (
              <button
                type="button"
                onClick={() => onUpdate({ image_url: '' })}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', fontWeight: 700 }}
              >
                <Trash2 size={13} /> Quitar
              </button>
            )}
          </div>

          {content.image_url ? (
            <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', height: '110px', border: '1px solid #bfdbfe' }}>
              <img
                src={getCloudinaryImageUrl(content.image_url, 'cardWideSmall')}
                alt="Función"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.8rem' }}>
              Sin imagen asignada (se usará esquema por defecto)
            </div>
          )}

          <button
            type="button"
            onClick={() => onPickImage('image_url')}
            style={{ padding: '7px 12px', borderRadius: '6px', background: '#0284c7', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            {content.image_url ? 'Cambiar Imagen' : 'Subir o Elegir Imagen'}
          </button>

          <label style={{ ...labelStyle, fontSize: '0.75rem' }}>
            <span>Etiqueta sobre la imagen</span>
            <input
              style={{ ...inputStyle, padding: '5px 8px', fontSize: '0.8rem' }}
              value={content.image_badge ?? ''}
              onChange={e => onUpdate({ image_badge: e.target.value })}
              placeholder="Ej: ⚡ Esquema Funcional de Difusión"
            />
          </label>
        </div>
      </div>

      {/* Mecanismos Dinámicos */}
      <div>
        <label style={{ ...labelStyle, marginBottom: '10px' }}>
          <span>⚡ Título de la subsección de mecanismos</span>
          <input
            style={inputStyle}
            value={content.feats_title ?? ''}
            onChange={e => onUpdate({ feats_title: e.target.value })}
            placeholder="Ej: Mecanismos Clave del Intercambio y Transporte"
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
            ⚡ Mecanismos Fisiológicos Clave ({featsCount})
          </strong>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
          {indices.map(num => (
            <div key={num} style={cardItemStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: '#0284c7' }}>
                  <Zap size={13} /> Mecanismo {num}
                </div>
                {featsCount > 1 && (
                  <button
                    type="button"
                    style={removeBtnStyle}
                    onClick={() => handleRemoveFeat(num)}
                    title={`Eliminar mecanismo ${num}`}
                  >
                    <Trash2 size={11} /> Eliminar
                  </button>
                )}
              </div>
              <input
                style={{ ...inputStyle, fontWeight: 700 }}
                value={content[`feat_${num}_title`] ?? ''}
                onChange={e => onUpdate({ [`feat_${num}_title`]: e.target.value })}
                placeholder={`Nombre del mecanismo ${num}`}
              />
              <textarea
                style={{ ...textareaStyle, minHeight: '60px' }}
                value={content[`feat_${num}_desc`] ?? ''}
                onChange={e => onUpdate({ [`feat_${num}_desc`]: e.target.value })}
                placeholder={`Detalle del mecanismo ${num}...`}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          style={addButtonStyle}
          onClick={handleAddFeat}
          title="Añadir otro mecanismo funcional"
        >
          <Plus size={15} /> Añadir otro Mecanismo (+1)
        </button>
      </div>

      <label style={labelStyle}>
        <span>🩺 Relevancia Fisiológica / Nota Clínica (Callout)</span>
        <textarea
          style={{ ...textareaStyle, borderLeft: '4px solid #0284c7', background: '#f0f9ff' }}
          value={content.clinical_note ?? ''}
          onChange={e => onUpdate({ clinical_note: e.target.value })}
          placeholder="Importancia biológica y repercusión clínica..."
        />
      </label>
    </div>
  );
};

// ─── 3. MORFOLOGÍA ──────────────────────────────────────────────────────────
export const HistologyMorphologyInlineEditor: React.FC<BaseHistologyEditorProps> = ({
  content,
  onUpdate,
  onPickImage,
}) => {
  const itemsCount = Math.max(1, Number(content.items_count) || (content.item_5_title || content.item_5_desc ? 5 : content.item_4_title || content.item_4_desc ? 4 : content.item_3_title || content.item_3_desc ? 3 : 5));
  const indices = Array.from({ length: itemsCount }, (_, i) => i + 1);

  const handleAddItem = () => {
    const nextCount = itemsCount + 1;
    onUpdate({
      items_count: String(nextCount),
      [`item_${nextCount}_title`]: '',
      [`item_${nextCount}_desc`]: '',
    });
  };

  const handleRemoveItem = (delIdx: number) => {
    if (itemsCount <= 1) return;
    const updates: Record<string, string> = { items_count: String(itemsCount - 1) };
    for (let i = delIdx; i < itemsCount; i++) {
      updates[`item_${i}_title`] = content[`item_${i + 1}_title`] ?? '';
      updates[`item_${i}_desc`] = content[`item_${i + 1}_desc`] ?? '';
    }
    updates[`item_${itemsCount}_title`] = '';
    updates[`item_${itemsCount}_desc`] = '';
    onUpdate(updates);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
        <label style={labelStyle}>
          <span>🏷️ Etiqueta superior / Badge</span>
          <input
            style={inputStyle}
            value={content.badge_text ?? ''}
            onChange={e => onUpdate({ badge_text: e.target.value })}
            placeholder="Ej: Criterios Morfológicos de Identificación"
          />
        </label>
        <label style={labelStyle}>
          <span>🔬 Título de la Sección</span>
          <input
            style={inputStyle}
            value={content.title ?? ''}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="Ej: Reconocimiento Microscópico de Alta Certeza"
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(240px, 0.8fr)', gap: '16px', alignItems: 'start' }}>
        <label style={labelStyle}>
          <span>📝 Introducción diagnóstica</span>
          <textarea
            style={{ ...textareaStyle, minHeight: '120px' }}
            value={content.intro_text ?? ''}
            onChange={e => onUpdate({ intro_text: e.target.value })}
            placeholder="Indica las pautas para identificar este tejido en el microscopio..."
          />
        </label>

        <div style={imagePickerBoxStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ImageIcon size={15} /> Micrografía Morfológica
            </span>
            {content.image_url && (
              <button
                type="button"
                onClick={() => onUpdate({ image_url: '' })}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', fontWeight: 700 }}
              >
                <Trash2 size={13} /> Quitar
              </button>
            )}
          </div>

          {content.image_url ? (
            <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', height: '110px', border: '1px solid #bfdbfe' }}>
              <img
                src={getCloudinaryImageUrl(content.image_url, 'cardWideSmall')}
                alt="Morfología"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.8rem' }}>
              Sin imagen asignada (se usará esquema por defecto)
            </div>
          )}

          <button
            type="button"
            onClick={() => onPickImage('image_url')}
            style={{ padding: '7px 12px', borderRadius: '6px', background: '#0284c7', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            {content.image_url ? 'Cambiar Imagen' : 'Subir o Elegir Imagen'}
          </button>

          <label style={{ ...labelStyle, fontSize: '0.75rem' }}>
            <span>Etiqueta sobre la imagen</span>
            <input
              style={{ ...inputStyle, padding: '5px 8px', fontSize: '0.8rem' }}
              value={content.image_badge ?? ''}
              onChange={e => onUpdate({ image_badge: e.target.value })}
              placeholder="Ej: 🔬 Micrografía Morfológica · Criterios"
            />
          </label>
        </div>
      </div>

      {/* Criterios Diagnósticos Dinámicos */}
      <div>
        <label style={{ ...labelStyle, marginBottom: '10px' }}>
          <span>🔬 Título de la subsección de criterios</span>
          <input
            style={inputStyle}
            value={content.criteria_title ?? ''}
            onChange={e => onUpdate({ criteria_title: e.target.value })}
            placeholder="Ej: Criterios Diagnósticos al Microscopio"
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
            🔬 Criterios Diagnósticos ({itemsCount})
          </strong>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
          {indices.map(num => (
            <div key={num} style={cardItemStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: '#0f766e' }}>
                  <Microscope size={13} /> Criterio {String(num).padStart(2, '0')}
                </div>
                {itemsCount > 1 && (
                  <button
                    type="button"
                    style={removeBtnStyle}
                    onClick={() => handleRemoveItem(num)}
                    title={`Eliminar criterio ${num}`}
                  >
                    <Trash2 size={11} /> Eliminar
                  </button>
                )}
              </div>
              <input
                style={{ ...inputStyle, fontWeight: 700 }}
                value={content[`item_${num}_title`] ?? ''}
                onChange={e => onUpdate({ [`item_${num}_title`]: e.target.value })}
                placeholder={`Título del criterio ${num}`}
              />
              <textarea
                style={{ ...textareaStyle, minHeight: '60px' }}
                value={content[`item_${num}_desc`] ?? ''}
                onChange={e => onUpdate({ [`item_${num}_desc`]: e.target.value })}
                placeholder={`Descripción detallada del criterio ${num}...`}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          style={addButtonStyle}
          onClick={handleAddItem}
          title="Añadir otro criterio diagnóstico"
        >
          <Plus size={15} /> Añadir otro Criterio (+1)
        </button>
      </div>

      <label style={labelStyle}>
        <span>🎯 Tip de Examen Práctico (Callout)</span>
        <textarea
          style={{ ...textareaStyle, borderLeft: '4px solid #0f766e', background: '#f0fdf4' }}
          value={content.exam_tip ?? ''}
          onChange={e => onUpdate({ exam_tip: e.target.value })}
          placeholder="Clave rápida para identificar este tejido en el microscopio en exámenes..."
        />
      </label>
    </div>
  );
};

// ─── 4. UBICACIONES ANATÓMICAS ──────────────────────────────────────────────
export const HistologyLocationsInlineEditor: React.FC<BaseHistologyEditorProps> = ({
  content,
  onUpdate,
  onPickImage,
}) => {
  const itemsCount = Math.max(1, Number(content.items_count) || (content.item_5_organ || content.item_5_desc ? 5 : content.item_4_organ || content.item_4_desc ? 4 : content.item_3_organ || content.item_3_desc ? 3 : 5));
  const indices = Array.from({ length: itemsCount }, (_, i) => i + 1);

  const handleAddItem = () => {
    const nextCount = itemsCount + 1;
    onUpdate({
      items_count: String(nextCount),
      [`item_${nextCount}_organ`]: '',
      [`item_${nextCount}_system`]: '',
      [`item_${nextCount}_desc`]: '',
    });
  };

  const handleRemoveItem = (delIdx: number) => {
    if (itemsCount <= 1) return;
    const updates: Record<string, string> = { items_count: String(itemsCount - 1) };
    for (let i = delIdx; i < itemsCount; i++) {
      updates[`item_${i}_organ`] = content[`item_${i + 1}_organ`] ?? '';
      updates[`item_${i}_system`] = content[`item_${i + 1}_system`] ?? '';
      updates[`item_${i}_desc`] = content[`item_${i + 1}_desc`] ?? '';
    }
    updates[`item_${itemsCount}_organ`] = '';
    updates[`item_${itemsCount}_system`] = '';
    updates[`item_${itemsCount}_desc`] = '';
    onUpdate(updates);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
        <label style={labelStyle}>
          <span>🏷️ Etiqueta superior / Badge</span>
          <input
            style={inputStyle}
            value={content.badge_text ?? ''}
            onChange={e => onUpdate({ badge_text: e.target.value })}
            placeholder="Ej: Ubicaciones Anatómicas Clave"
          />
        </label>
        <label style={labelStyle}>
          <span>📍 Título de la Sección</span>
          <input
            style={inputStyle}
            value={content.title ?? ''}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="Ej: Distribución Tisular en el Cuerpo Humano"
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(240px, 0.8fr)', gap: '16px', alignItems: 'start' }}>
        <label style={labelStyle}>
          <span>📝 Introducción anatómica</span>
          <textarea
            style={{ ...textareaStyle, minHeight: '120px' }}
            value={content.intro_text ?? ''}
            onChange={e => onUpdate({ intro_text: e.target.value })}
            placeholder="Resumen de los órganos y sistemas donde predomina este tejido..."
          />
        </label>

        <div style={imagePickerBoxStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ImageIcon size={15} /> Esquema Anatómico
            </span>
            {content.image_url && (
              <button
                type="button"
                onClick={() => onUpdate({ image_url: '' })}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', fontWeight: 700 }}
              >
                <Trash2 size={13} /> Quitar
              </button>
            )}
          </div>

          {content.image_url ? (
            <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', height: '110px', border: '1px solid #bfdbfe' }}>
              <img
                src={getCloudinaryImageUrl(content.image_url, 'cardWideSmall')}
                alt="Ubicación"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.8rem' }}>
              Sin imagen asignada (se usará esquema por defecto)
            </div>
          )}

          <button
            type="button"
            onClick={() => onPickImage('image_url')}
            style={{ padding: '7px 12px', borderRadius: '6px', background: '#0284c7', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            {content.image_url ? 'Cambiar Imagen' : 'Subir o Elegir Imagen'}
          </button>

          <label style={{ ...labelStyle, fontSize: '0.75rem' }}>
            <span>Etiqueta sobre la imagen</span>
            <input
              style={{ ...inputStyle, padding: '5px 8px', fontSize: '0.8rem' }}
              value={content.image_badge ?? ''}
              onChange={e => onUpdate({ image_badge: e.target.value })}
              placeholder="Ej: 📍 Esquema Anatómico de Órganos"
            />
          </label>
        </div>
      </div>

      {/* Ubicaciones Dinámicas */}
      <div>
        <label style={{ ...labelStyle, marginBottom: '10px' }}>
          <span>📍 Título de la subsección de ubicaciones</span>
          <input
            style={inputStyle}
            value={content.locations_title ?? ''}
            onChange={e => onUpdate({ locations_title: e.target.value })}
            placeholder="Ej: Localizaciones Anatómicas Fundamentales"
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
            📍 Órganos y Localizaciones Anatómicas ({itemsCount})
          </strong>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
          {indices.map(num => (
            <div key={num} style={cardItemStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: '#0369a1' }}>
                  <MapPin size={13} /> Órgano {String(num).padStart(2, '0')}
                </div>
                {itemsCount > 1 && (
                  <button
                    type="button"
                    style={removeBtnStyle}
                    onClick={() => handleRemoveItem(num)}
                    title={`Eliminar ubicación ${num}`}
                  >
                    <Trash2 size={11} /> Eliminar
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px' }}>
                <input
                  style={{ ...inputStyle, fontWeight: 700 }}
                  value={content[`item_${num}_organ`] ?? ''}
                  onChange={e => onUpdate({ [`item_${num}_organ`]: e.target.value })}
                  placeholder={`Órgano / Estructura ${num}`}
                />
                <input
                  style={inputStyle}
                  value={content[`item_${num}_system`] ?? ''}
                  onChange={e => onUpdate({ [`item_${num}_system`]: e.target.value })}
                  placeholder="Sistema / Aparato"
                />
              </div>
              <textarea
                style={{ ...textareaStyle, minHeight: '55px' }}
                value={content[`item_${num}_desc`] ?? ''}
                onChange={e => onUpdate({ [`item_${num}_desc`]: e.target.value })}
                placeholder={`Detalle anatómico y función en esta ubicación ${num}...`}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          style={addButtonStyle}
          onClick={handleAddItem}
          title="Añadir otra ubicación anatómica"
        >
          <Plus size={15} /> Añadir otra Ubicación (+1)
        </button>
      </div>

      <label style={labelStyle}>
        <span>🧠 Regla Mnemotécnica (Callout)</span>
        <textarea
          style={{ ...textareaStyle, borderLeft: '4px solid #0369a1', background: '#f0f9ff' }}
          value={content.mnemotic_tip ?? ''}
          onChange={e => onUpdate({ mnemotic_tip: e.target.value })}
          placeholder="Mnemotecnia útil para recordar todas las ubicaciones..."
        />
      </label>
    </div>
  );
};

// ─── 5. TINCIONES HISTOLÓGICAS ──────────────────────────────────────────────
export const HistologyStainsInlineEditor: React.FC<BaseHistologyEditorProps> = ({
  content,
  onUpdate,
  onPickImage,
}) => {
  const itemsCount = Math.max(1, Number(content.items_count) || (content.item_5_name || content.item_5_result ? 5 : content.item_4_name || content.item_4_result ? 4 : content.item_3_name || content.item_3_result ? 3 : 5));
  const indices = Array.from({ length: itemsCount }, (_, i) => i + 1);

  const handleAddItem = () => {
    const nextCount = itemsCount + 1;
    onUpdate({
      items_count: String(nextCount),
      [`item_${nextCount}_name`]: '',
      [`item_${nextCount}_cat`]: '',
      [`item_${nextCount}_result`]: '',
    });
  };

  const handleRemoveItem = (delIdx: number) => {
    if (itemsCount <= 1) return;
    const updates: Record<string, string> = { items_count: String(itemsCount - 1) };
    for (let i = delIdx; i < itemsCount; i++) {
      updates[`item_${i}_name`] = content[`item_${i + 1}_name`] ?? '';
      updates[`item_${i}_cat`] = content[`item_${i + 1}_cat`] ?? '';
      updates[`item_${i}_result`] = content[`item_${i + 1}_result`] ?? '';
    }
    updates[`item_${itemsCount}_name`] = '';
    updates[`item_${itemsCount}_cat`] = '';
    updates[`item_${itemsCount}_result`] = '';
    onUpdate(updates);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
        <label style={labelStyle}>
          <span>🏷️ Etiqueta superior / Badge</span>
          <input
            style={inputStyle}
            value={content.badge_text ?? ''}
            onChange={e => onUpdate({ badge_text: e.target.value })}
            placeholder="Ej: Técnicas de Tinción Histológica"
          />
        </label>
        <label style={labelStyle}>
          <span>🎨 Título de la Sección</span>
          <input
            style={inputStyle}
            value={content.title ?? ''}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="Ej: Métodos de Colorimetría y Diagnóstico Óptico"
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(240px, 0.8fr)', gap: '16px', alignItems: 'start' }}>
        <label style={labelStyle}>
          <span>📝 Introducción de colorimetría</span>
          <textarea
            style={{ ...textareaStyle, minHeight: '120px' }}
            value={content.intro_text ?? ''}
            onChange={e => onUpdate({ intro_text: e.target.value })}
            placeholder="Explica la respuesta tintorial y afinidad colorimétrica de este tejido..."
          />
        </label>

        <div style={imagePickerBoxStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ImageIcon size={15} /> Muestra de Tinción
            </span>
            {content.image_url && (
              <button
                type="button"
                onClick={() => onUpdate({ image_url: '' })}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', fontWeight: 700 }}
              >
                <Trash2 size={13} /> Quitar
              </button>
            )}
          </div>

          {content.image_url ? (
            <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', height: '110px', border: '1px solid #bfdbfe' }}>
              <img
                src={getCloudinaryImageUrl(content.image_url, 'cardWideSmall')}
                alt="Tinción"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.8rem' }}>
              Sin imagen asignada (se usará esquema por defecto)
            </div>
          )}

          <button
            type="button"
            onClick={() => onPickImage('image_url')}
            style={{ padding: '7px 12px', borderRadius: '6px', background: '#0284c7', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            {content.image_url ? 'Cambiar Imagen' : 'Subir o Elegir Imagen'}
          </button>

          <label style={{ ...labelStyle, fontSize: '0.75rem' }}>
            <span>Etiqueta sobre la imagen</span>
            <input
              style={{ ...inputStyle, padding: '5px 8px', fontSize: '0.8rem' }}
              value={content.image_badge ?? ''}
              onChange={e => onUpdate({ image_badge: e.target.value })}
              placeholder="Ej: 🎨 Muestra de Tinción · Colorimetría"
            />
          </label>
        </div>
      </div>

      {/* Tinciones Dinámicas */}
      <div>
        <label style={{ ...labelStyle, marginBottom: '10px' }}>
          <span>🎨 Título de la subsección de tinciones</span>
          <input
            style={inputStyle}
            value={content.stains_title ?? ''}
            onChange={e => onUpdate({ stains_title: e.target.value })}
            placeholder="Ej: Tinciones de Referencia en el Laboratorio Histológico"
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
            🎨 Técnicas de Tinción Histológica ({itemsCount})
          </strong>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
          {indices.map(num => (
            <div key={num} style={cardItemStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: '#9333ea' }}>
                  <Palette size={13} /> Tinción {String(num).padStart(2, '0')}
                </div>
                {itemsCount > 1 && (
                  <button
                    type="button"
                    style={removeBtnStyle}
                    onClick={() => handleRemoveItem(num)}
                    title={`Eliminar tinción ${num}`}
                  >
                    <Trash2 size={11} /> Eliminar
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px' }}>
                <input
                  style={{ ...inputStyle, fontWeight: 700 }}
                  value={content[`item_${num}_name`] ?? ''}
                  onChange={e => onUpdate({ [`item_${num}_name`]: e.target.value })}
                  placeholder={`Nombre de la tinción ${num}`}
                />
                <input
                  style={inputStyle}
                  value={content[`item_${num}_cat`] ?? ''}
                  onChange={e => onUpdate({ [`item_${num}_cat`]: e.target.value })}
                  placeholder="Categoría / Tipo"
                />
              </div>
              <textarea
                style={{ ...textareaStyle, minHeight: '55px' }}
                value={content[`item_${num}_result`] ?? ''}
                onChange={e => onUpdate({ [`item_${num}_result`]: e.target.value })}
                placeholder={`Resultado cromático en el tejido (núcleos, citoplasma, fibras)...`}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          style={addButtonStyle}
          onClick={handleAddItem}
          title="Añadir otra técnica de tinción"
        >
          <Plus size={15} /> Añadir otra Tinción (+1)
        </button>
      </div>

      <label style={labelStyle}>
        <span>🧪 Clave de Laboratorio para Tinciones (Callout)</span>
        <textarea
          style={{ ...textareaStyle, borderLeft: '4px solid #9333ea', background: '#faf5ff' }}
          value={content.color_tip ?? ''}
          onChange={e => onUpdate({ color_tip: e.target.value })}
          placeholder="Regla de oro de colorimetría para identificar estructuras teñidas..."
        />
      </label>
    </div>
  );
};
