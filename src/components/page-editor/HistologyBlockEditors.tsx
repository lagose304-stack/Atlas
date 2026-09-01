import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  Microscope,
  MapPin,
  Image as ImageIcon,
  Trash2,
  Plus,
} from 'lucide-react';
import { getCloudinaryImageUrl } from '../../services/cloudinaryImages';
import { MedicalIcon } from '../common/MedicalIcon';
import { MedicalIconPickerModal } from '../common/MedicalIconPickerModal';

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

// ─── 1. GENERALIDADES DEL TEJIDO ────────────────────────────────────────────
export const HistologyGeneralitiesInlineEditor: React.FC<BaseHistologyEditorProps> = ({
  content,
  onUpdate,
  onPickImage,
}) => {
  const pointsCount = Math.max(0, Number(content.points_count) || (content.point_4_title || content.point_4_desc ? 4 : content.point_3_title || content.point_3_desc ? 3 : content.point_2_title || content.point_2_desc ? 2 : content.point_1_title ? 1 : 0));
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
    if (pointsCount <= 0) return;
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
            placeholder="Ej: Fundamentos"
          />
        </label>
        <label style={labelStyle}>
          <span>📖 Título de la Sección</span>
          <input
            style={inputStyle}
            value={content.title ?? ''}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="Ej: 1. Generalidades del Tejido"
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(240px, 0.8fr)', gap: '16px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={labelStyle}>
            <span>📝 Párrafo introductorio (Soporta múltiples párrafos y **negritas**)</span>
            <textarea
              style={{ ...textareaStyle, minHeight: '110px' }}
              value={content.intro_text ?? ''}
              onChange={e => onUpdate({ intro_text: e.target.value })}
              placeholder="Escribe la descripción general del tejido (ej: Consiste en una sola capa de células con escaso citoplasma...)"
            />
          </label>
          <label style={labelStyle}>
            <span>💡 Tarjeta "Idea clave" (Columna lateral derecha)</span>
            <textarea
              style={{ ...textareaStyle, minHeight: '75px', borderLeft: '4px solid #6366f1', background: '#faf5ff' }}
              value={content.key_idea ?? ''}
              onChange={e => onUpdate({ key_idea: e.target.value })}
              placeholder="Ej: Su estructura delgada y aplanada permite procesos de intercambio rápido y difusión eficiente."
            />
          </label>
        </div>

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
              Sin imagen asignada (opcional)
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

      {/* Pilares Teóricos Opcionales */}
      <div>
        <label style={{ ...labelStyle, marginBottom: '10px' }}>
          <span>✨ Título de la subsección de pilares (Opcional)</span>
          <input
            style={inputStyle}
            value={content.points_title ?? ''}
            onChange={e => onUpdate({ points_title: e.target.value })}
            placeholder="Ej: Pilares Teóricos y Embriología del Tejido"
          />
        </label>

        {pointsCount > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginBottom: '8px' }}>
            {indices.map(num => (
              <div key={num} style={cardItemStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: '#6366f1' }}>
                    <Sparkles size={13} /> Pilar {num}
                  </div>
                  <button
                    type="button"
                    style={removeBtnStyle}
                    onClick={() => handleRemovePoint(num)}
                    title={`Eliminar pilar ${num}`}
                  >
                    <Trash2 size={11} /> Eliminar
                  </button>
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
        )}

        <button
          type="button"
          style={addButtonStyle}
          onClick={handleAddPoint}
          title="Añadir un pilar teórico opcional"
        >
          <Plus size={15} /> Añadir Pilar Teórico (+1)
        </button>
      </div>

      <label style={labelStyle}>
        <span>💡 Tip o Clave de Laboratorio (Callout destacado opcional)</span>
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

// ─── 2. TRÍADA DE FUNDAMENTOS (FUNCIÓN + CRITERIOS + UBICACIONES) ───────────────
export const HistologyPillarsInlineEditor: React.FC<BaseHistologyEditorProps> = ({
  content,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<'function' | 'criteria' | 'locations'>('function');
  const [iconPickerTarget, setIconPickerTarget] = useState<{
    fieldKey: string;
    currentIcon?: string;
    title: string;
  } | null>(null);

  // Funciones asociadas
  const assocCount = Math.max(0, Number(content.assoc_count) || (content.assoc_3_label ? 3 : content.assoc_2_label ? 2 : content.assoc_1_label ? 1 : 0));
  const assocIndices = Array.from({ length: assocCount }, (_, i) => i + 1);

  const handleAddAssoc = () => {
    const next = assocCount + 1;
    onUpdate({
      assoc_count: String(next),
      [`assoc_${next}_label`]: '',
      [`assoc_${next}_icon`]: 'sparkles',
    });
  };

  const handleRemoveAssoc = (delIdx: number) => {
    if (assocCount <= 0) return;
    const updates: Record<string, string> = { assoc_count: String(assocCount - 1) };
    for (let i = delIdx; i < assocCount; i++) {
      updates[`assoc_${i}_label`] = content[`assoc_${i + 1}_label`] ?? '';
      updates[`assoc_${i}_icon`] = content[`assoc_${i + 1}_icon`] ?? '';
    }
    updates[`assoc_${assocCount}_label`] = '';
    updates[`assoc_${assocCount}_icon`] = '';
    onUpdate(updates);
  };

  // Criterios morfológicos
  const critCount = Math.max(0, Number(content.crit_count) || (content.crit_5_title || content.crit_5_desc ? 5 : content.crit_4_title || content.crit_4_desc ? 4 : content.crit_3_title || content.crit_3_desc ? 3 : content.crit_2_title ? 2 : content.crit_1_title ? 1 : 0));
  const critIndices = Array.from({ length: critCount }, (_, i) => i + 1);

  const handleAddCrit = () => {
    const next = critCount + 1;
    onUpdate({
      crit_count: String(next),
      [`crit_${next}_title`]: '',
      [`crit_${next}_desc`]: '',
    });
  };

  const handleRemoveCrit = (delIdx: number) => {
    if (critCount <= 0) return;
    const updates: Record<string, string> = { crit_count: String(critCount - 1) };
    for (let i = delIdx; i < critCount; i++) {
      updates[`crit_${i}_title`] = content[`crit_${i + 1}_title`] ?? '';
      updates[`crit_${i}_desc`] = content[`crit_${i + 1}_desc`] ?? '';
    }
    updates[`crit_${critCount}_title`] = '';
    updates[`crit_${critCount}_desc`] = '';
    onUpdate(updates);
  };

  // Ubicaciones anatómicas
  const locCount = Math.max(0, Number(content.loc_count) || (content.loc_5_organ || content.loc_5_desc ? 5 : content.loc_4_organ || content.loc_4_desc ? 4 : content.loc_3_organ || content.loc_3_desc ? 3 : content.loc_2_organ ? 2 : content.loc_1_organ ? 1 : 0));
  const locIndices = Array.from({ length: locCount }, (_, i) => i + 1);

  const handleAddLoc = () => {
    const next = locCount + 1;
    onUpdate({
      loc_count: String(next),
      [`loc_${next}_organ`]: '',
      [`loc_${next}_desc`]: '',
      [`loc_${next}_icon`]: 'map_pin',
    });
  };

  const handleRemoveLoc = (delIdx: number) => {
    if (locCount <= 0) return;
    const updates: Record<string, string> = { loc_count: String(locCount - 1) };
    for (let i = delIdx; i < locCount; i++) {
      updates[`loc_${i}_organ`] = content[`loc_${i + 1}_organ`] ?? '';
      updates[`loc_${i}_desc`] = content[`loc_${i + 1}_desc`] ?? '';
      updates[`loc_${i}_icon`] = content[`loc_${i + 1}_icon`] ?? '';
    }
    updates[`loc_${locCount}_organ`] = '';
    updates[`loc_${locCount}_desc`] = '';
    updates[`loc_${locCount}_icon`] = '';
    onUpdate(updates);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
      {/* Modal buscador de iconos médicos */}
      {iconPickerTarget && (
        <MedicalIconPickerModal
          isOpen={true}
          title={iconPickerTarget.title}
          selectedIconId={iconPickerTarget.currentIcon}
          onSelectIcon={iconId => {
            onUpdate({ [iconPickerTarget.fieldKey]: iconId });
            setIconPickerTarget(null);
          }}
          onClose={() => setIconPickerTarget(null)}
        />
      )}

      {/* Selector de pestañas para las 3 tarjetas de la tríada */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '8px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('function')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'function' ? '#10b981' : '#f1f5f9',
            color: activeTab === 'function' ? '#ffffff' : '#475569',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <Zap size={15} /> 1. Función ({assocCount} asociadas)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('criteria')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'criteria' ? '#3b82f6' : '#f1f5f9',
            color: activeTab === 'criteria' ? '#ffffff' : '#475569',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <Microscope size={15} /> 2. Criterios ({critCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('locations')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'locations' ? '#f97316' : '#f1f5f9',
            color: activeTab === 'locations' ? '#ffffff' : '#475569',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <MapPin size={15} /> 3. Ubicaciones ({locCount})
        </button>
      </div>

      {/* ─── TAB 1: FUNCIÓN PRINCIPAL ─── */}
      {activeTab === 'function' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
            <label style={labelStyle}>
              <span>🏷️ Badge de la tarjeta</span>
              <input
                style={inputStyle}
                value={content.function_badge ?? ''}
                onChange={e => onUpdate({ function_badge: e.target.value })}
                placeholder="Ej: Función"
              />
            </label>
            <label style={labelStyle}>
              <span>⚡ Título de la tarjeta</span>
              <input
                style={inputStyle}
                value={content.function_title ?? ''}
                onChange={e => onUpdate({ function_title: e.target.value })}
                placeholder="Ej: 2. Función Principal"
              />
            </label>
          </div>

          {/* Bloque Rector de Función */}
          <div style={{ ...cardItemStyle, background: '#f0fdf4', border: '1.5px solid #bbf7d0', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.84rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={14} /> Rol Fisiológico Rector
              </strong>

              {/* Botón selector de ícono médico para la función principal */}
              <button
                type="button"
                onClick={() => setIconPickerTarget({
                  fieldKey: 'main_function_icon',
                  currentIcon: content.main_function_icon || 'exchange',
                  title: 'Elegir Ícono para la Función Principal',
                })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 12px',
                  borderRadius: '999px',
                  border: '1.2px solid #86efac',
                  background: '#ffffff',
                  color: '#166534',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 5px rgba(22, 101, 52, 0.08)',
                }}
              >
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MedicalIcon name={content.main_function_icon || 'exchange'} size={14} color="#166534" />
                </div>
                <span>Cambiar Ícono ({content.main_function_icon || 'exchange'})</span>
              </button>
            </div>

            <label style={labelStyle}>
              <span>Nombre de la función rectora (en mayúsculas)</span>
              <input
                style={{ ...inputStyle, fontWeight: 900, color: '#166534' }}
                value={content.main_function_name ?? ''}
                onChange={e => onUpdate({ main_function_name: e.target.value })}
                placeholder="Ej: INTERCAMBIO / BARRERA / SECRECIÓN / ABSORCIÓN"
              />
            </label>

            <label style={labelStyle}>
              <span>Explicación del mecanismo</span>
              <textarea
                style={{ ...textareaStyle, minHeight: '70px' }}
                value={content.main_function_desc ?? ''}
                onChange={e => onUpdate({ main_function_desc: e.target.value })}
                placeholder="Ej: Su delgadez le permite facilitar el intercambio rápido de gases, nutrientes y desechos por difusión..."
              />
            </label>
          </div>

          {/* Funciones Asociadas Dinámicas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <strong style={{ fontSize: '0.82rem', color: '#166534' }}>
              🌿 Funciones Asociadas ({assocCount})
            </strong>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
              {assocIndices.map(num => {
                const iconKey = `assoc_${num}_icon`;
                const labelKey = `assoc_${num}_label`;
                const currentIcon = content[iconKey] || 'sparkles';

                return (
                  <div key={num} style={{ ...cardItemStyle, padding: '10px', background: '#ffffff', border: '1.2px solid #d1fae5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      {/* Botón de selección de icono interactivo */}
                      <button
                        type="button"
                        onClick={() => setIconPickerTarget({
                          fieldKey: iconKey,
                          currentIcon,
                          title: `Elegir Ícono para Función Asociada #${num}`,
                        })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          border: '1px solid #bbf7d0',
                          background: '#f0fdf4',
                          color: '#166534',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Cambiar ícono médico"
                      >
                        <MedicalIcon name={currentIcon} size={15} color="#166534" />
                        <span>Ícono</span>
                      </button>

                      <button
                        type="button"
                        style={removeBtnStyle}
                        onClick={() => handleRemoveAssoc(num)}
                        title="Eliminar función asociada"
                      >
                        <Trash2 size={10} /> Quitar
                      </button>
                    </div>

                    <input
                      style={{ ...inputStyle, padding: '6px 10px', fontSize: '0.82rem', fontWeight: 650 }}
                      value={content[labelKey] ?? ''}
                      onChange={e => onUpdate({ [labelKey]: e.target.value })}
                      placeholder={`Nombre (ej: Filtración / Difusión / Secreción)`}
                    />
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              style={addButtonStyle}
              onClick={handleAddAssoc}
              title="Añadir función asociada"
            >
              <Plus size={14} /> Añadir Función Asociada (+1)
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB 2: CRITERIOS MORFOLÓGICOS ─── */}
      {activeTab === 'criteria' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
            <label style={labelStyle}>
              <span>🏷️ Badge de la tarjeta</span>
              <input
                style={inputStyle}
                value={content.criteria_badge ?? ''}
                onChange={e => onUpdate({ criteria_badge: e.target.value })}
                placeholder="Ej: Criterios Morfológicos"
              />
            </label>
            <label style={labelStyle}>
              <span>🔬 Título de la tarjeta</span>
              <input
                style={inputStyle}
                value={content.criteria_title ?? ''}
                onChange={e => onUpdate({ criteria_title: e.target.value })}
                placeholder="Ej: 3. Criterios Morfológicos"
              />
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <strong style={{ fontSize: '0.82rem', color: '#1e40af' }}>
              🔬 Criterios Diagnósticos al Microscopio ({critCount})
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {critIndices.map(num => (
                <div key={num} style={{ ...cardItemStyle, background: '#ffffff', border: '1.2px solid #dbeafe' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#2563eb', background: '#dbeafe', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {String(num).padStart(2, '0')}
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e3a8a' }}>Criterio {num}</span>
                    </div>
                    <button
                      type="button"
                      style={removeBtnStyle}
                      onClick={() => handleRemoveCrit(num)}
                      title="Eliminar criterio"
                    >
                      <Trash2 size={10} /> Eliminar
                    </button>
                  </div>
                  <input
                    style={{ ...inputStyle, fontWeight: 700 }}
                    value={content[`crit_${num}_title`] ?? ''}
                    onChange={e => onUpdate({ [`crit_${num}_title`]: e.target.value })}
                    placeholder={`Estructura (ej: Número de capas / Forma celular / Núcleo)`}
                  />
                  <input
                    style={inputStyle}
                    value={content[`crit_${num}_desc`] ?? ''}
                    onChange={e => onUpdate({ [`crit_${num}_desc`]: e.target.value })}
                    placeholder={`Detalle observable (ej: Una sola capa de células / Aplanada)`}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              style={addButtonStyle}
              onClick={handleAddCrit}
              title="Añadir criterio morfológico"
            >
              <Plus size={14} /> Añadir Criterio (+1)
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB 3: UBICACIONES ANATÓMICAS ─── */}
      {activeTab === 'locations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
            <label style={labelStyle}>
              <span>🏷️ Badge de la tarjeta</span>
              <input
                style={inputStyle}
                value={content.locations_badge ?? ''}
                onChange={e => onUpdate({ locations_badge: e.target.value })}
                placeholder="Ej: Ubicaciones Anatómicas"
              />
            </label>
            <label style={labelStyle}>
              <span>📍 Título de la tarjeta</span>
              <input
                style={inputStyle}
                value={content.locations_title ?? ''}
                onChange={e => onUpdate({ locations_title: e.target.value })}
                placeholder="Ej: 4. Ubicaciones Anatómicas"
              />
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <strong style={{ fontSize: '0.82rem', color: '#c2410c' }}>
              📍 Lista de Ubicaciones en Órganos ({locCount})
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {locIndices.map(num => {
                const iconKey = `loc_${num}_icon`;
                const currentIcon = content[iconKey] || 'map_pin';

                return (
                  <div key={num} style={{ ...cardItemStyle, background: '#ffffff', border: '1.2px solid #ffedd5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {/* Selector de ícono de órgano */}
                        <button
                          type="button"
                          onClick={() => setIconPickerTarget({
                            fieldKey: iconKey,
                            currentIcon,
                            title: `Elegir Ícono de Órgano para Ubicación #${num}`,
                          })}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            border: '1px solid #fed7aa',
                            background: '#fff7ed',
                            color: '#c2410c',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          title="Cambiar ícono del órgano"
                        >
                          <MedicalIcon name={currentIcon} size={15} color="#c2410c" />
                          <span>Ícono</span>
                        </button>

                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ea580c' }}>Ubicación {num}</span>
                      </div>

                      <button
                        type="button"
                        style={removeBtnStyle}
                        onClick={() => handleRemoveLoc(num)}
                        title="Eliminar ubicación"
                      >
                        <Trash2 size={10} /> Eliminar
                      </button>
                    </div>

                    <input
                      style={{ ...inputStyle, fontWeight: 700 }}
                      value={content[`loc_${num}_organ`] ?? ''}
                      onChange={e => onUpdate({ [`loc_${num}_organ`]: e.target.value })}
                      placeholder={`Órgano / Estructura (ej: Alvéolos pulmonares / Endotelio vascular)`}
                    />
                    <input
                      style={inputStyle}
                      value={content[`loc_${num}_desc`] ?? ''}
                      onChange={e => onUpdate({ [`loc_${num}_desc`]: e.target.value })}
                      placeholder={`Detalle anatómico (ej: Revestimiento interno de vasos sanguíneos)`}
                    />
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              style={addButtonStyle}
              onClick={handleAddLoc}
              title="Añadir ubicación anatómica"
            >
              <Plus size={14} /> Añadir Ubicación (+1)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 3. TINCIONES HISTOLÓGICAS ──────────────────────────────────────────────
export const HistologyStainsInlineEditor: React.FC<BaseHistologyEditorProps> = ({
  content,
  onUpdate,
  onPickImage,
}) => {
  const [iconPickerTarget, setIconPickerTarget] = useState<{
    fieldKey: string;
    currentIcon?: string;
    title: string;
  } | null>(null);

  const itemsCount = Math.max(0, Number(content.items_count) || (content.item_5_name || content.item_5_result ? 5 : content.item_4_name || content.item_4_result ? 4 : content.item_3_name || content.item_3_result ? 3 : content.item_2_name ? 2 : content.item_1_name ? 1 : 0));
  const indices = Array.from({ length: itemsCount }, (_, i) => i + 1);

  const handleAddItem = () => {
    const nextCount = itemsCount + 1;
    onUpdate({
      items_count: String(nextCount),
      [`item_${nextCount}_name`]: '',
      [`item_${nextCount}_cat`]: '',
      [`item_${nextCount}_nucleus`]: '',
      [`item_${nextCount}_cytoplasm`]: '',
      [`item_${nextCount}_highlights`]: '',
      [`item_${nextCount}_utility`]: '',
      [`item_${nextCount}_result`]: '',
      [`item_${nextCount}_icon`]: 'flask',
      [`item_${nextCount}_image_url`]: '',
    });
  };

  const handleRemoveItem = (delIdx: number) => {
    if (itemsCount <= 0) return;
    const updates: Record<string, string> = { items_count: String(itemsCount - 1) };
    for (let i = delIdx; i < itemsCount; i++) {
      updates[`item_${i}_name`] = content[`item_${i + 1}_name`] ?? '';
      updates[`item_${i}_cat`] = content[`item_${i + 1}_cat`] ?? '';
      updates[`item_${i}_nucleus`] = content[`item_${i + 1}_nucleus`] ?? '';
      updates[`item_${i}_cytoplasm`] = content[`item_${i + 1}_cytoplasm`] ?? '';
      updates[`item_${i}_highlights`] = content[`item_${i + 1}_highlights`] ?? '';
      updates[`item_${i}_utility`] = content[`item_${i + 1}_utility`] ?? '';
      updates[`item_${i}_result`] = content[`item_${i + 1}_result`] ?? '';
      updates[`item_${i}_icon`] = content[`item_${i + 1}_icon`] ?? '';
      updates[`item_${i}_image_url`] = content[`item_${i + 1}_image_url`] ?? '';
    }
    updates[`item_${itemsCount}_name`] = '';
    updates[`item_${itemsCount}_cat`] = '';
    updates[`item_${itemsCount}_nucleus`] = '';
    updates[`item_${itemsCount}_cytoplasm`] = '';
    updates[`item_${itemsCount}_highlights`] = '';
    updates[`item_${itemsCount}_utility`] = '';
    updates[`item_${itemsCount}_result`] = '';
    updates[`item_${itemsCount}_icon`] = '';
    updates[`item_${itemsCount}_image_url`] = '';
    onUpdate(updates);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
      {/* Modal buscador de iconos médicos */}
      {iconPickerTarget && (
        <MedicalIconPickerModal
          isOpen={true}
          title={iconPickerTarget.title}
          selectedIconId={iconPickerTarget.currentIcon}
          onSelectIcon={iconId => {
            onUpdate({ [iconPickerTarget.fieldKey]: iconId });
            setIconPickerTarget(null);
          }}
          onClose={() => setIconPickerTarget(null)}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
        <label style={labelStyle}>
          <span>🏷️ Etiqueta superior / Badge</span>
          <input
            style={inputStyle}
            value={content.badge_text ?? ''}
            onChange={e => onUpdate({ badge_text: e.target.value })}
            placeholder="Ej: Tinciones Histológicas"
          />
        </label>
        <label style={labelStyle}>
          <span>🎨 Título de la Sección</span>
          <input
            style={inputStyle}
            value={content.title ?? ''}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="Ej: 5. Tinciones Histológicas"
          />
        </label>
      </div>

      <label style={labelStyle}>
        <span>📝 Introducción (Opcional)</span>
        <textarea
          style={{ ...textareaStyle, minHeight: '60px' }}
          value={content.intro_text ?? ''}
          onChange={e => onUpdate({ intro_text: e.target.value })}
          placeholder="Descripción general de colorimetría o afinidades tintoriales..."
        />
      </label>

      {/* Tinciones Dinámicas */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
            🎨 Técnicas de Tinción Histológica ({itemsCount})
          </strong>

          {/* Botones de Presets Rápidos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Cargar preset:</span>
            {[
              {
                label: 'H&E',
                name: 'Hematoxilina - Eosina (H&E)',
                cat: 'Rutina',
                nucleus: 'azul/violeta',
                cytoplasm: 'rosado',
                utility: 'Tinción general para evaluación morfológica',
                icon: 'flask',
              },
              {
                label: 'PAS',
                name: 'PAS (Ácido Periódico de Schiff)',
                cat: 'Especial',
                highlights: 'Carbohidratos y mucinas',
                utility: 'Identificación de glucoproteínas y glucógeno',
                icon: 'chemical_drop',
              },
              {
                label: 'Masson',
                name: 'Tricrómico de Masson',
                cat: 'Tricrómica',
                nucleus: 'azul/verde (colágeno)',
                cytoplasm: 'rojo',
                utility: 'Evaluación de tejido conjuntivo y fibrosis',
                icon: 'palette',
              },
              {
                label: 'Toluidina',
                name: 'Azul de Toluidina',
                cat: 'Metacromática',
                highlights: 'Sustancia ácida (ADN, ARN)',
                utility: 'Estructuras nucleares y mastocitos',
                icon: 'test_tube',
              },
            ].map((preset, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => {
                  const nextCount = itemsCount + 1;
                  onUpdate({
                    items_count: String(nextCount),
                    [`item_${nextCount}_name`]: preset.name,
                    [`item_${nextCount}_cat`]: preset.cat,
                    [`item_${nextCount}_nucleus`]: preset.nucleus || '',
                    [`item_${nextCount}_cytoplasm`]: preset.cytoplasm || '',
                    [`item_${nextCount}_highlights`]: preset.highlights || '',
                    [`item_${nextCount}_utility`]: preset.utility || '',
                    [`item_${nextCount}_icon`]: preset.icon || 'flask',
                    [`item_${nextCount}_image_url`]: '',
                  });
                }}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid #d8b4fe',
                  background: '#f5f3ff',
                  color: '#7e22ce',
                  fontSize: '0.70rem',
                  fontWeight: 750,
                  cursor: 'pointer',
                }}
              >
                + {preset.label}
              </button>
            ))}
          </div>
        </div>

        {itemsCount > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '12px', marginBottom: '8px' }}>
            {indices.map(num => {
              const stainImg = content[`item_${num}_image_url`];
              const iconKey = `item_${num}_icon`;
              const currentIcon = content[iconKey] || 'flask';

              return (
                <div key={num} style={{ ...cardItemStyle, background: '#ffffff', border: '1.2px solid #e9d5ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {/* Botón selector de icono para la tinción */}
                      <button
                        type="button"
                        onClick={() => setIconPickerTarget({
                          fieldKey: iconKey,
                          currentIcon,
                          title: `Elegir Ícono para Tinción #${num}`,
                        })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          border: '1px solid #d8b4fe',
                          background: '#faf5ff',
                          color: '#7e22ce',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Cambiar ícono de la tinción"
                      >
                        <MedicalIcon name={currentIcon} size={15} color="#9333ea" />
                        <span>Ícono</span>
                      </button>

                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#9333ea' }}>Tinción {String(num).padStart(2, '0')}</span>
                    </div>

                    <button
                      type="button"
                      style={removeBtnStyle}
                      onClick={() => handleRemoveItem(num)}
                      title={`Eliminar tinción ${num}`}
                    >
                      <Trash2 size={11} /> Eliminar
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '6px' }}>
                    <input
                      style={{ ...inputStyle, fontWeight: 700 }}
                      value={content[`item_${num}_name`] ?? ''}
                      onChange={e => onUpdate({ [`item_${num}_name`]: e.target.value })}
                      placeholder={`Nombre de la tinción`}
                    />
                    <input
                      style={inputStyle}
                      value={content[`item_${num}_cat`] ?? ''}
                      onChange={e => onUpdate({ [`item_${num}_cat`]: e.target.value })}
                      placeholder="Tipo (ej: Rutina / Especial)"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <input
                      style={inputStyle}
                      value={content[`item_${num}_nucleus`] ?? ''}
                      onChange={e => onUpdate({ [`item_${num}_nucleus`]: e.target.value })}
                      placeholder="Núcleo (ej: azul/violeta)"
                    />
                    <input
                      style={inputStyle}
                      value={content[`item_${num}_cytoplasm`] ?? ''}
                      onChange={e => onUpdate({ [`item_${num}_cytoplasm`]: e.target.value })}
                      placeholder="Citoplasma (ej: rosado)"
                    />
                  </div>

                  <input
                    style={inputStyle}
                    value={content[`item_${num}_highlights`] ?? ''}
                    onChange={e => onUpdate({ [`item_${num}_highlights`]: e.target.value })}
                    placeholder="Resalta (ej: Carbohidratos y mucinas)"
                  />

                  <input
                    style={inputStyle}
                    value={content[`item_${num}_utility`] ?? ''}
                    onChange={e => onUpdate({ [`item_${num}_utility`]: e.target.value })}
                    placeholder="Utilidad diagnóstica"
                  />

                  {/* Foto individual de muestra de la tinción */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px', borderTop: '1px dashed #f3e8ff' }}>
                    {stainImg ? (
                      <div style={{ position: 'relative', width: '42px', height: '42px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #d8b4fe', flexShrink: 0 }}>
                        <img
                          src={getCloudinaryImageUrl(stainImg, 'thumbSmall')}
                          alt="Muestra"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ) : (
                      <div style={{ width: '42px', height: '42px', borderRadius: '6px', background: '#faf5ff', border: '1px dashed #d8b4fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', flexShrink: 0 }}>
                        <ImageIcon size={16} />
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                      <button
                        type="button"
                        onClick={() => onPickImage(`item_${num}_image_url`)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: '#f3e8ff',
                          color: '#7e22ce',
                          border: '1px solid #d8b4fe',
                          fontSize: '0.72rem',
                          fontWeight: 750,
                          cursor: 'pointer',
                          alignSelf: 'flex-start',
                        }}
                      >
                        {stainImg ? 'Cambiar Foto' : 'Foto Muestra'}
                      </button>
                      {stainImg && (
                        <button
                          type="button"
                          onClick={() => onUpdate({ [`item_${num}_image_url`]: '' })}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.68rem', padding: 0, textAlign: 'left' }}
                        >
                          Quitar foto
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          style={addButtonStyle}
          onClick={handleAddItem}
          title="Añadir técnica de tinción"
        >
          <Plus size={15} /> Añadir Tinción (+1)
        </button>
      </div>

      <label style={labelStyle}>
        <span>🧪 Clave de Laboratorio para Tinciones (Callout opcional)</span>
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
