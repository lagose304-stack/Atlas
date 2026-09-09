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
import { HistologyRichField } from './HistologyRichField';

interface BaseHistologyEditorProps {
  blockId?: string;
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
  color: '#000000',
  background: '#ffffff',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
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
  blockId,
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
          <HistologyRichField
            label="📝 Párrafo introductorio (Soporta múltiples párrafos, negritas y colores)"
            editorId={blockId ? `${blockId}:intro_text` : undefined}
            value={content.intro_text ?? ''}
            onChange={val => onUpdate({ intro_text: val })}
            placeholder="Escribe la descripción general del tejido (ej: Consiste en una sola capa de células con escaso citoplasma...)"
            minHeight="100px"
          />
          <HistologyRichField
            label="💡 Tarjeta 'Idea clave' (Columna lateral derecha)"
            editorId={blockId ? `${blockId}:key_idea` : undefined}
            value={content.key_idea ?? ''}
            onChange={val => onUpdate({ key_idea: val })}
            placeholder="Ej: Su estructura delgada y aplanada permite procesos de intercambio rápido y difusión eficiente."
            minHeight="65px"
          />
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
                <HistologyRichField
                  label="Detalle del pilar"
                  editorId={blockId ? `${blockId}:point_${num}_desc` : undefined}
                  value={content[`point_${num}_desc`] ?? ''}
                  onChange={val => onUpdate({ [`point_${num}_desc`]: val })}
                  placeholder={`Detalle del pilar ${num}...`}
                  minHeight="55px"
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

      <HistologyRichField
        label="💡 Tip o Clave de Laboratorio (Callout destacado opcional)"
        editorId={blockId ? `${blockId}:lab_tip` : undefined}
        value={content.lab_tip ?? ''}
        onChange={val => onUpdate({ lab_tip: val })}
        placeholder="Regla de oro en el microscopio..."
        minHeight="60px"
      />
    </div>
  );
};

// ─── 2. TRÍADA DE FUNDAMENTOS (FUNCIÓN + CRITERIOS + UBICACIONES) ───────────────
export const HistologyPillarsInlineEditor: React.FC<BaseHistologyEditorProps> = ({
  blockId,
  content,
  onUpdate,
  onPickImage,
}) => {
  const [activeTab, setActiveTab] = useState<'function' | 'criteria' | 'locations'>('function');
  const [iconPickerTarget, setIconPickerTarget] = useState<{
    fieldKey: string;
    currentIcon?: string;
    title: string;
  } | null>(null);

  // Funciones asociadas
  const assocCount = Math.max(
    0,
    Number(content.assoc_count) ||
      (content.assoc_8_label || content.assoc_8_desc ? 8 :
       content.assoc_7_label || content.assoc_7_desc ? 7 :
       content.assoc_6_label || content.assoc_6_desc ? 6 :
       content.assoc_5_label || content.assoc_5_desc ? 5 :
       content.assoc_4_label || content.assoc_4_desc ? 4 :
       content.assoc_3_label || content.assoc_3_desc ? 3 :
       content.assoc_2_label || content.assoc_2_desc ? 2 :
       content.assoc_1_label || content.assoc_1_desc ? 1 : 0)
  );
  const assocIndices = Array.from({ length: assocCount }, (_, i) => i + 1);

  const handleAddAssoc = () => {
    const next = assocCount + 1;
    onUpdate({
      assoc_count: String(next),
      [`assoc_${next}_label`]: '',
      [`assoc_${next}_desc`]: '',
      [`assoc_${next}_icon`]: 'sparkles',
    });
  };

  const handleRemoveAssoc = (delIdx: number) => {
    if (assocCount <= 0) return;
    const updates: Record<string, string> = { assoc_count: String(assocCount - 1) };
    for (let i = delIdx; i < assocCount; i++) {
      updates[`assoc_${i}_label`] = content[`assoc_${i + 1}_label`] ?? '';
      updates[`assoc_${i}_desc`] = content[`assoc_${i + 1}_desc`] ?? '';
      updates[`assoc_${i}_icon`] = content[`assoc_${i + 1}_icon`] ?? '';
    }
    updates[`assoc_${assocCount}_label`] = '';
    updates[`assoc_${assocCount}_desc`] = '';
    updates[`assoc_${assocCount}_icon`] = '';
    onUpdate(updates);
  };

  const setAssocQuickCount = (count: number) => {
    const updates: Record<string, string> = { assoc_count: String(count) };
    if (count < assocCount) {
      for (let i = count + 1; i <= assocCount; i++) {
        updates[`assoc_${i}_label`] = '';
        updates[`assoc_${i}_desc`] = '';
        updates[`assoc_${i}_icon`] = '';
      }
    }
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

  const showFunctionCard = content.show_function_card !== 'false';
  const showCriteriaCard = content.show_criteria_card !== 'false';
  const showLocationsCard = content.show_locations_card !== 'false';

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
            background: activeTab === 'function' ? '#10b981' : (showFunctionCard ? '#f1f5f9' : '#fef2f2'),
            color: activeTab === 'function' ? '#ffffff' : (showFunctionCard ? '#475569' : '#991b1b'),
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            opacity: showFunctionCard ? 1 : 0.75,
            textDecoration: showFunctionCard ? 'none' : 'line-through',
          }}
        >
          <Zap size={15} /> 1. Función {!showFunctionCard ? '(Oculta)' : `(${assocCount})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('criteria')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'criteria' ? '#3b82f6' : (showCriteriaCard ? '#f1f5f9' : '#fef2f2'),
            color: activeTab === 'criteria' ? '#ffffff' : (showCriteriaCard ? '#475569' : '#991b1b'),
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            opacity: showCriteriaCard ? 1 : 0.75,
            textDecoration: showCriteriaCard ? 'none' : 'line-through',
          }}
        >
          <Microscope size={15} /> 2. Criterios {!showCriteriaCard ? '(Oculta)' : `(${critCount})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('locations')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'locations' ? '#f97316' : (showLocationsCard ? '#f1f5f9' : '#fef2f2'),
            color: activeTab === 'locations' ? '#ffffff' : (showLocationsCard ? '#475569' : '#991b1b'),
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            opacity: showLocationsCard ? 1 : 0.75,
            textDecoration: showLocationsCard ? 'none' : 'line-through',
          }}
        >
          <MapPin size={15} /> 3. Ubicaciones {!showLocationsCard ? '(Oculta)' : `(${locCount})`}
        </button>
      </div>

      {/* ─── TAB 1: FUNCIÓN PRINCIPAL ─── */}
      {activeTab === 'function' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Interruptor de Visibilidad de Tarjeta 1 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '12px',
              background: showFunctionCard ? '#f0fdf4' : '#f8fafc',
              border: `1.5px solid ${showFunctionCard ? '#86efac' : '#e2e8f0'}`,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} color={showFunctionCard ? '#16a34a' : '#94a3b8'} />
              <div>
                <strong style={{ fontSize: '0.82rem', color: showFunctionCard ? '#166534' : '#64748b' }}>
                  {showFunctionCard ? 'Tarjeta Visible en la Página' : 'Tarjeta Oculta (No se mostrará)'}
                </strong>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                  {showFunctionCard ? 'Esta tarjeta se muestra en la tríada' : 'La cuadrícula se adaptará para las demás tarjetas'}
                </p>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 800, color: showFunctionCard ? '#15803d' : '#64748b' }}>
              <input
                type="checkbox"
                checked={showFunctionCard}
                onChange={e => onUpdate({ show_function_card: e.target.checked ? 'true' : 'false' })}
                style={{ width: '16px', height: '16px', accentColor: '#16a34a', cursor: 'pointer' }}
              />
              <span>{showFunctionCard ? 'Activa' : 'Oculta'}</span>
            </label>
          </div>

          <label style={labelStyle}>
            <span>⚡ Título de la tarjeta</span>
            <input
              style={inputStyle}
              value={content.function_title ?? ''}
              onChange={e => onUpdate({ function_title: e.target.value })}
              placeholder="Texto..."
            />
          </label>

          {/* Banner informativo de modo standalone */}
          {!showCriteriaCard && !showLocationsCard && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 12px',
                background: '#eff6ff',
                borderRadius: '10px',
                border: '1.2px solid #bfdbfe',
                fontSize: '0.78rem',
                color: '#1e40af',
                fontWeight: 650,
              }}
            >
              <span>ℹ️</span>
              <span>
                <strong>Modo Expandido Activo:</strong> Como Criterios y Ubicaciones están ocultas, esta tarjeta se mostrará en formato completo de lista numerada (1..N) con títulos y descripciones.
              </span>
            </div>
          )}

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
                placeholder="Texto..."
              />
            </label>

            <HistologyRichField
              label="Explicación del mecanismo (Soporta colores, negrita y estilos)"
              editorId={blockId ? `${blockId}:main_function_desc` : undefined}
              value={content.main_function_desc ?? ''}
              onChange={val => onUpdate({ main_function_desc: val })}
              placeholder="Texto..."
              minHeight="70px"
            />
          </div>

          {/* Imagen de Referencia / Esquema Funcional Opcional */}
          <div style={{ ...cardItemStyle, background: '#f8fafc', border: '1.5px solid #e2e8f0', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.82rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ImageIcon size={14} /> Imagen de Referencia / Esquema (Opcional)
              </strong>
              {content.function_image_url && (
                <button
                  type="button"
                  onClick={() => onUpdate({ function_image_url: '', function_image_caption: '' })}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Trash2 size={12} /> Quitar imagen
                </button>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b', lineHeight: 1.35 }}>
              Añade una micrografía o esquema funcional para ilustrar el mecanismo y equilibrar la altura de la tarjeta.
            </p>

            {content.function_image_url ? (
              <div style={{ width: '100%', height: '75px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', position: 'relative' }}>
                <img
                  src={getCloudinaryImageUrl(content.function_image_url, 'cardWideSmall')}
                  alt="Referencia de función"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.78rem' }}>
                Sin imagen asignada (opcional)
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => onPickImage('function_image_url')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ImageIcon size={13} />
                {content.function_image_url ? 'Cambiar Imagen del Sitio' : 'Elegir Imagen del Sitio'}
              </button>
            </div>

            {content.function_image_url && (
              <label style={{ ...labelStyle, fontSize: '0.75rem' }}>
                <span>Pie de foto / Descripción corta de la imagen</span>
                <input
                  style={{ ...inputStyle, padding: '5px 8px', fontSize: '0.78rem' }}
                  value={content.function_image_caption ?? ''}
                  onChange={e => onUpdate({ function_image_caption: e.target.value })}
                  placeholder="Texto..."
                />
              </label>
            )}
          </div>

          {/* Funciones Asociadas Dinámicas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <strong style={{ fontSize: '0.82rem', color: '#166534' }}>
                🌿 Lista de Funciones ({assocCount})
              </strong>

              {/* Botones de selección rápida de cantidad */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[3, 4, 5, 6, 8].map(qty => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setAssocQuickCount(qty)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid #a7f3d0',
                      background: assocCount === qty ? '#10b981' : '#ecfdf5',
                      color: assocCount === qty ? '#ffffff' : '#047857',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {qty} func.
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {assocIndices.map(num => {
                const iconKey = `assoc_${num}_icon`;
                const labelKey = `assoc_${num}_label`;
                const descKey = `assoc_${num}_desc`;
                const currentIcon = content[iconKey] || 'sparkles';

                return (
                  <div key={num} style={{ ...cardItemStyle, padding: '12px', background: '#ffffff', border: '1.2px solid #d1fae5', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#0284c7',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 850,
                          }}
                        >
                          {num}
                        </span>
                        <strong style={{ fontSize: '0.82rem', color: '#166534' }}>Función {num}</strong>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {/* Selector de ícono */}
                        <button
                          type="button"
                          onClick={() => setIconPickerTarget({
                            fieldKey: iconKey,
                            currentIcon,
                            title: `Elegir Ícono para Función #${num}`,
                          })}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 7px',
                            borderRadius: '6px',
                            border: '1px solid #bbf7d0',
                            background: '#f0fdf4',
                            color: '#166534',
                            fontSize: '0.70rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          title="Cambiar ícono médico"
                        >
                          <MedicalIcon name={currentIcon} size={14} color="#166534" />
                          <span>Ícono</span>
                        </button>

                        <button
                          type="button"
                          style={removeBtnStyle}
                          onClick={() => handleRemoveAssoc(num)}
                          title="Eliminar función"
                        >
                          <Trash2 size={11} /> Quitar
                        </button>
                      </div>
                    </div>

                    <label style={{ ...labelStyle, fontSize: '0.75rem' }}>
                      <span>Título / Nombre de la función</span>
                      <input
                        style={{ ...inputStyle, padding: '6px 10px', fontSize: '0.82rem', fontWeight: 700 }}
                        value={content[labelKey] ?? ''}
                        onChange={e => onUpdate({ [labelKey]: e.target.value })}
                        placeholder="Texto..."
                      />
                    </label>

                    <HistologyRichField
                      label="Descripción / Detalle de la función"
                      editorId={blockId ? `${blockId}:${descKey}` : undefined}
                      value={content[descKey] ?? ''}
                      onChange={val => onUpdate({ [descKey]: val })}
                      placeholder="Texto..."
                      minHeight="50px"
                    />
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              style={addButtonStyle}
              onClick={handleAddAssoc}
              title="Añadir función"
            >
              <Plus size={14} /> Añadir Función (+1)
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB 2: CRITERIOS MORFOLÓGICOS ─── */}
      {activeTab === 'criteria' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Interruptor de Visibilidad de Tarjeta 2 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '12px',
              background: showCriteriaCard ? '#eff6ff' : '#f8fafc',
              border: `1.5px solid ${showCriteriaCard ? '#93c5fd' : '#e2e8f0'}`,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Microscope size={16} color={showCriteriaCard ? '#2563eb' : '#94a3b8'} />
              <div>
                <strong style={{ fontSize: '0.82rem', color: showCriteriaCard ? '#1e40af' : '#64748b' }}>
                  {showCriteriaCard ? 'Tarjeta Visible en la Página' : 'Tarjeta Oculta (No se mostrará)'}
                </strong>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                  {showCriteriaCard ? 'Esta tarjeta se muestra en la tríada' : 'La cuadrícula se adaptará para las demás tarjetas'}
                </p>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 800, color: showCriteriaCard ? '#1d4ed8' : '#64748b' }}>
              <input
                type="checkbox"
                checked={showCriteriaCard}
                onChange={e => onUpdate({ show_criteria_card: e.target.checked ? 'true' : 'false' })}
                style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
              />
              <span>{showCriteriaCard ? 'Activa' : 'Oculta'}</span>
            </label>
          </div>

          <label style={labelStyle}>
            <span>🔬 Título de la tarjeta</span>
            <input
              style={inputStyle}
              value={content.criteria_title ?? ''}
              onChange={e => onUpdate({ criteria_title: e.target.value })}
              placeholder="Texto..."
            />
          </label>

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
                    placeholder="Texto..."
                  />
                  <HistologyRichField
                    label="Detalle observable al microscopio"
                    editorId={blockId ? `${blockId}:crit_${num}_desc` : undefined}
                    value={content[`crit_${num}_desc`] ?? ''}
                    onChange={val => onUpdate({ [`crit_${num}_desc`]: val })}
                    placeholder="Texto..."
                    minHeight="45px"
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
          {/* Interruptor de Visibilidad de Tarjeta 3 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '12px',
              background: showLocationsCard ? '#fff7ed' : '#f8fafc',
              border: `1.5px solid ${showLocationsCard ? '#fdba74' : '#e2e8f0'}`,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={16} color={showLocationsCard ? '#ea580c' : '#94a3b8'} />
              <div>
                <strong style={{ fontSize: '0.82rem', color: showLocationsCard ? '#c2410c' : '#64748b' }}>
                  {showLocationsCard ? 'Tarjeta Visible en la Página' : 'Tarjeta Oculta (No se mostrará)'}
                </strong>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                  {showLocationsCard ? 'Esta tarjeta se muestra en la tríada' : 'La cuadrícula se adaptará para las demás tarjetas'}
                </p>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 800, color: showLocationsCard ? '#c2410c' : '#64748b' }}>
              <input
                type="checkbox"
                checked={showLocationsCard}
                onChange={e => onUpdate({ show_locations_card: e.target.checked ? 'true' : 'false' })}
                style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
              />
              <span>{showLocationsCard ? 'Activa' : 'Oculta'}</span>
            </label>
          </div>

          <label style={labelStyle}>
            <span>📍 Título de la tarjeta</span>
            <input
              style={inputStyle}
              value={content.locations_title ?? ''}
              onChange={e => onUpdate({ locations_title: e.target.value })}
              placeholder="Texto..."
            />
          </label>

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
                      placeholder="Texto..."
                    />
                    <HistologyRichField
                      label="Detalle anatómico"
                      editorId={blockId ? `${blockId}:loc_${num}_desc` : undefined}
                      value={content[`loc_${num}_desc`] ?? ''}
                      onChange={val => onUpdate({ [`loc_${num}_desc`]: val })}
                      placeholder="Texto..."
                      minHeight="45px"
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
  blockId,
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

      <HistologyRichField
        label="📝 Introducción de colorimetría (Opcional)"
        editorId={blockId ? `${blockId}:intro_text` : undefined}
        value={content.intro_text ?? ''}
        onChange={val => onUpdate({ intro_text: val })}
        placeholder="Descripción general de colorimetría o afinidades tintoriales..."
        minHeight="60px"
      />

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

                  <HistologyRichField
                    label="Estructuras resaltadas"
                    editorId={blockId ? `${blockId}:item_${num}_highlights` : undefined}
                    value={content[`item_${num}_highlights`] ?? ''}
                    onChange={val => onUpdate({ [`item_${num}_highlights`]: val })}
                    placeholder="Resalta (ej: Carbohidratos y mucinas)"
                    minHeight="40px"
                  />

                  <HistologyRichField
                    label="Utilidad diagnóstica"
                    editorId={blockId ? `${blockId}:item_${num}_utility` : undefined}
                    value={content[`item_${num}_utility`] ?? ''}
                    onChange={val => onUpdate({ [`item_${num}_utility`]: val })}
                    placeholder="Utilidad diagnóstica"
                    minHeight="40px"
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

      <HistologyRichField
        label="🧪 Clave de Laboratorio para Tinciones (Callout opcional)"
        editorId={blockId ? `${blockId}:color_tip` : undefined}
        value={content.color_tip ?? ''}
        onChange={val => onUpdate({ color_tip: val })}
        placeholder="Regla de oro de colorimetría para identificar estructuras teñidas..."
        minHeight="55px"
      />
    </div>
  );
};

// ─── 4. TEXTO CON TARJETAS CLAVE (PÁRRAFOS + TARJETAS DE DATOS) ─────────────
export const HistologyTextCardsInlineEditor: React.FC<BaseHistologyEditorProps> = ({
  blockId,
  content,
  onUpdate,
}) => {
  const cardsCount = Math.max(
    0,
    Number(content.cards_count) ||
      (content.card_5_title || content.card_5_desc
        ? 5
        : content.card_4_title || content.card_4_desc
        ? 4
        : content.card_3_title || content.card_3_desc
        ? 3
        : content.card_2_title || content.card_2_desc
        ? 2
        : content.card_1_title || content.card_1_desc
        ? 1
        : 0)
  );

  const cardIndices = Array.from({ length: cardsCount }, (_, i) => i + 1);

  const handleAddCard = () => {
    const nextCount = cardsCount + 1;
    onUpdate({
      cards_count: String(nextCount),
      [`card_${nextCount}_title`]: '',
      [`card_${nextCount}_desc`]: '',
    });
  };

  const handleSetQuickCards = (targetCount: number) => {
    const updates: Record<string, string> = { cards_count: String(targetCount) };
    for (let i = 1; i <= targetCount; i++) {
      if (content[`card_${i}_title`] === undefined) {
        updates[`card_${i}_title`] = '';
      }
      if (content[`card_${i}_desc`] === undefined) {
        updates[`card_${i}_desc`] = '';
      }
    }
    onUpdate(updates);
  };

  const handleRemoveCard = (delIdx: number) => {
    if (cardsCount <= 0) return;
    const updates: Record<string, string> = { cards_count: String(cardsCount - 1) };
    for (let i = delIdx; i < cardsCount; i++) {
      updates[`card_${i}_title`] = content[`card_${i + 1}_title`] ?? '';
      updates[`card_${i}_desc`] = content[`card_${i + 1}_desc`] ?? '';
    }
    updates[`card_${cardsCount}_title`] = '';
    updates[`card_${cardsCount}_desc`] = '';
    onUpdate(updates);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
      {/* 0. Cabecera opcional (Badge y Título) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)', gap: '12px' }}>
        <label style={labelStyle}>
          <span>🏷️ Etiqueta superior / Badge (Opcional)</span>
          <input
            style={inputStyle}
            value={content.badge_text ?? ''}
            onChange={e => onUpdate({ badge_text: e.target.value })}
            placeholder="Texto..."
          />
        </label>
        <label style={labelStyle}>
          <span>📖 Título de la Sección (Opcional)</span>
          <input
            style={inputStyle}
            value={content.title ?? ''}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="Texto..."
          />
        </label>
      </div>

      {/* 1. Párrafos de texto explicativo */}
      <HistologyRichField
        label="📄 Párrafos de Texto Explicativo"
        editorId={blockId ? `${blockId}:text` : undefined}
        value={content.text ?? ''}
        onChange={val => onUpdate({ text: val })}
        placeholder="Texto..."
        minHeight="85px"
      />

      {/* 2. Sección de Tarjetas de Datos / Conceptos */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '14px',
          borderRadius: '12px',
          border: '1px solid #bae6fd',
          background: '#f0f9ff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0369a1' }}>
              📊 Tarjetas Clave Destacadas ({cardsCount})
            </span>
          </div>

          {/* Accesos rápidos de conteo y alineación */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.74rem', color: '#0369a1', fontWeight: 600 }}>Alineación:</span>
              <button
                type="button"
                onClick={() => onUpdate({ cards_align: 'center' })}
                style={{
                  padding: '2px 7px',
                  borderRadius: '5px',
                  border: (content.cards_align || 'center') === 'center' ? '1.5px solid #0284c7' : '1px solid #7dd3fc',
                  background: (content.cards_align || 'center') === 'center' ? '#0284c7' : '#e0f2fe',
                  color: (content.cards_align || 'center') === 'center' ? '#ffffff' : '#0369a1',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Centrar tarjetas en la pantalla"
              >
                Centradas
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ cards_align: 'left' })}
                style={{
                  padding: '2px 7px',
                  borderRadius: '5px',
                  border: content.cards_align === 'left' ? '1.5px solid #0284c7' : '1px solid #7dd3fc',
                  background: content.cards_align === 'left' ? '#0284c7' : '#e0f2fe',
                  color: content.cards_align === 'left' ? '#ffffff' : '#0369a1',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Alinear tarjetas a la izquierda"
              >
                Izquierda
              </button>
            </div>

            <span style={{ fontSize: '0.74rem', color: '#0284c7', fontWeight: 600 }}>Crear rápido:</span>
            {[2, 3, 4].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleSetQuickCards(num)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid #7dd3fc',
                  background: '#e0f2fe',
                  color: '#0369a1',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title={`Configurar ${num} tarjetas`}
              >
                {num} tarjetas
              </button>
            ))}
          </div>
        </div>

        {cardsCount === 0 ? (
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              border: '1px dashed #7dd3fc',
              background: '#ffffff',
              textAlign: 'center',
              fontSize: '0.80rem',
              color: '#64748b',
            }}
          >
            No hay tarjetas añadidas. Pulsa el botón de abajo para añadir una o elige una cantidad rápida arriba.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {cardIndices.map(idx => {
              const titleVal = content[`card_${idx}_title`] ?? '';
              const descVal = content[`card_${idx}_desc`] ?? '';
              const badgeVal = content[`card_${idx}_badge`] ?? '';

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1.2px solid #cbd5e1',
                    background: '#ffffff',
                    position: 'relative',
                    borderLeft: '4px solid #0284c7',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7' }}>
                        Tarjeta #{idx}
                      </span>
                      <input
                        style={{
                          ...inputStyle,
                          width: 'auto',
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          height: '24px',
                        }}
                        value={badgeVal}
                        onChange={e => onUpdate({ [`card_${idx}_badge`]: e.target.value })}
                        placeholder="Texto..."
                      />
                    </div>
                    <button
                      type="button"
                      style={removeBtnStyle}
                      onClick={() => handleRemoveCard(idx)}
                      title={`Eliminar tarjeta #${idx}`}
                    >
                      <Trash2 size={12} /> Quitar
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 2fr)', gap: '10px' }}>
                    <label style={labelStyle}>
                      <span>Título / Dato clave</span>
                      <input
                        style={inputStyle}
                        value={titleVal}
                        onChange={e => onUpdate({ [`card_${idx}_title`]: e.target.value })}
                        placeholder="Texto..."
                      />
                    </label>

                    <label style={labelStyle}>
                      <span>Explicación / Detalle</span>
                      <input
                        style={inputStyle}
                        value={descVal}
                        onChange={e => onUpdate({ [`card_${idx}_desc`]: e.target.value })}
                        placeholder="Texto..."
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          style={{
            ...addButtonStyle,
            background: '#e0f2fe',
            color: '#0284c7',
            borderColor: '#7dd3fc',
          }}
          onClick={handleAddCard}
          title="Añadir una nueva tarjeta"
        >
          <Plus size={15} /> Añadir Tarjeta (+1)
        </button>
      </div>
    </div>
  );
};

// ─── 5. TEXTO CON TABLA MÉDICA (PÁRRAFOS + TABLA CLÍNICA) ──────────────────
export const HistologyTextTableInlineEditor: React.FC<BaseHistologyEditorProps> = ({
  blockId,
  content,
  onUpdate,
}) => {
  const colsCount = Math.max(0, Number(content.cols_count) || (content.col_4_header ? 4 : content.col_3_header ? 3 : content.col_2_header ? 2 : content.col_1_header ? 1 : 0));
  const rowsCount = Math.max(0, Number(content.rows_count) || (content.cell_4_1 ? 4 : content.cell_3_1 ? 3 : content.cell_2_1 ? 2 : content.cell_1_1 ? 1 : 0));

  const colIndices = Array.from({ length: colsCount }, (_, i) => i + 1);
  const rowIndices = Array.from({ length: rowsCount }, (_, i) => i + 1);

  const handleSetDimensions = (c: number, r: number) => {
    const updates: Record<string, string> = {
      cols_count: String(c),
      rows_count: String(r),
    };
    for (let ci = 1; ci <= c; ci++) {
      if (content[`col_${ci}_header`] === undefined) {
        updates[`col_${ci}_header`] = '';
      }
    }
    for (let ri = 1; ri <= r; ri++) {
      for (let ci = 1; ci <= c; ci++) {
        if (content[`cell_${ri}_${ci}`] === undefined) {
          updates[`cell_${ri}_${ci}`] = '';
        }
      }
    }
    onUpdate(updates);
  };

  const handleAddCol = () => {
    const nextCols = colsCount + 1;
    const updates: Record<string, string> = {
      cols_count: String(nextCols),
      [`col_${nextCols}_header`]: '',
    };
    for (let ri = 1; ri <= rowsCount; ri++) {
      updates[`cell_${ri}_${nextCols}`] = '';
    }
    onUpdate(updates);
  };

  const handleRemoveCol = (delCol: number) => {
    if (colsCount <= 1) {
      onUpdate({ cols_count: '0' });
      return;
    }
    const nextCols = colsCount - 1;
    const updates: Record<string, string> = { cols_count: String(nextCols) };
    for (let ci = delCol; ci < colsCount; ci++) {
      updates[`col_${ci}_header`] = content[`col_${ci + 1}_header`] ?? '';
    }
    updates[`col_${colsCount}_header`] = '';

    for (let ri = 1; ri <= rowsCount; ri++) {
      for (let ci = delCol; ci < colsCount; ci++) {
        updates[`cell_${ri}_${ci}`] = content[`cell_${ri}_${ci + 1}`] ?? '';
        updates[`cell_${ri}_${ci}_pill`] = content[`cell_${ri}_${ci + 1}_pill`] ?? '';
      }
      updates[`cell_${ri}_${colsCount}`] = '';
      updates[`cell_${ri}_${colsCount}_pill`] = '';
    }
    onUpdate(updates);
  };

  const handleAddRow = () => {
    const effectiveCols = colsCount > 0 ? colsCount : 3;
    const nextRows = rowsCount + 1;
    const updates: Record<string, string> = {
      rows_count: String(nextRows),
      cols_count: String(effectiveCols),
    };
    for (let ci = 1; ci <= effectiveCols; ci++) {
      updates[`cell_${nextRows}_${ci}`] = '';
    }
    onUpdate(updates);
  };

  const handleRemoveRow = (delRow: number) => {
    if (rowsCount <= 1) {
      onUpdate({ rows_count: '0' });
      return;
    }
    const nextRows = rowsCount - 1;
    const updates: Record<string, string> = { rows_count: String(nextRows) };
    for (let ri = delRow; ri < rowsCount; ri++) {
      for (let ci = 1; ci <= colsCount; ci++) {
        updates[`cell_${ri}_${ci}`] = content[`cell_${ri + 1}_${ci}`] ?? '';
        updates[`cell_${ri}_${ci}_pill`] = content[`cell_${ri + 1}_${ci}_pill`] ?? '';
      }
    }
    for (let ci = 1; ci <= colsCount; ci++) {
      updates[`cell_${rowsCount}_${ci}`] = '';
      updates[`cell_${rowsCount}_${ci}_pill`] = '';
    }
    onUpdate(updates);
  };

  const handleSetCellPill = (r: number, c: number, pillColor: string) => {
    const current = content[`cell_${r}_${c}_pill`] || '';
    const newPill = current === pillColor ? '' : pillColor;
    const currentText = content[`cell_${r}_${c}`] ?? '';
    // Si tenía formato anterior [color:texto], limpiamos los corchetes
    const cleanedText = currentText.replace(/^\[(blue|azul|amber|ambar|yellow|green|verde|purple|morado|tag|badge):([\s\S]*?)\]$/i, '$2');
    onUpdate({
      [`cell_${r}_${c}_pill`]: newPill,
      [`cell_${r}_${c}`]: cleanedText,
    });
  };

  const handleSetColPill = (c: number, pillColor: string) => {
    const updates: Record<string, string> = {};
    for (let ri = 1; ri <= rowsCount; ri++) {
      updates[`cell_${ri}_${c}_pill`] = pillColor;
      const currentText = content[`cell_${ri}_${c}`] ?? '';
      const cleaned = currentText.replace(/^\[(blue|azul|amber|ambar|yellow|green|verde|purple|morado|tag|badge):([\s\S]*?)\]$/i, '$2');
      if (cleaned !== currentText) {
        updates[`cell_${ri}_${c}`] = cleaned;
      }
    }
    onUpdate(updates);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
      {/* 1. Cabecera de Sección (Badge y Título) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)', gap: '12px' }}>
        <label style={labelStyle}>
          <span>🏷️ Etiqueta superior / Badge (Opcional)</span>
          <input
            style={inputStyle}
            value={content.badge_text ?? ''}
            onChange={e => onUpdate({ badge_text: e.target.value })}
            placeholder="Texto..."
          />
        </label>
        <label style={labelStyle}>
          <span>📖 Subtítulo / Título de la Sección</span>
          <input
            style={inputStyle}
            value={content.title ?? ''}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="Texto..."
          />
        </label>
      </div>

      {/* 2. Párrafos de texto explicativo */}
      <HistologyRichField
        label="📄 Párrafos Explicativos"
        editorId={blockId ? `${blockId}:text` : undefined}
        value={content.text ?? ''}
        onChange={val => onUpdate({ text: val })}
        placeholder="Texto..."
        minHeight="80px"
      />

      {/* 3. Editor de Tabla Clínica */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px',
          borderRadius: '14px',
          border: '1.2px solid #bae6fd',
          background: '#f8fbfe',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0369a1' }}>
              📊 Tabla Clínica ({colsCount} columnas × {rowsCount} filas)
            </span>
          </div>

          {/* Plantillas / Tamaños Rápidos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', color: '#0284c7', fontWeight: 600 }}>Plantillas de tamaño:</span>
            {[
              { label: '3×3', c: 3, r: 3 },
              { label: '4×3', c: 4, r: 3 },
              { label: '4×4', c: 4, r: 4 },
              { label: '5×4', c: 5, r: 4 },
            ].map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleSetDimensions(preset.c, preset.r)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid #7dd3fc',
                  background: '#e0f2fe',
                  color: '#0369a1',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title={`Crear tabla de ${preset.c} columnas por ${preset.r} filas`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Barra de acción para columnas y filas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleAddCol}
            style={{
              padding: '5px 12px',
              borderRadius: '7px',
              border: '1px solid #93c5fd',
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Plus size={13} /> Añadir Columna ({colsCount + 1})
          </button>

          {colsCount > 1 && (
            <button
              type="button"
              onClick={() => handleRemoveCol(colsCount)}
              style={{
                padding: '5px 10px',
                borderRadius: '7px',
                border: '1px solid #fecaca',
                background: '#fff1f2',
                color: '#e11d48',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Quitar última columna"
            >
              ✕ Quitar Columna
            </button>
          )}

          <button
            type="button"
            onClick={handleAddRow}
            style={{
              padding: '5px 12px',
              borderRadius: '7px',
              border: '1px solid #93c5fd',
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Plus size={13} /> Añadir Fila ({rowsCount + 1})
          </button>
        </div>

        {colsCount === 0 || rowsCount === 0 ? (
          <div
            style={{
              padding: '24px',
              borderRadius: '10px',
              border: '1.5px dashed #7dd3fc',
              background: '#ffffff',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.84rem',
            }}
          >
            La tabla está vacía. Selecciona un tamaño rápido arriba o pulsa <strong>Añadir Columna</strong> y <strong>Añadir Fila</strong>.
          </div>
        ) : (
          <div
            style={{
              overflowX: 'auto',
              borderRadius: '10px',
              border: '1.2px solid #cbd5e1',
              background: '#ffffff',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              {/* Encabezados de Columna (Primera Fila) */}
              <thead>
                <tr style={{ background: '#f0f7ff', borderBottom: '2px solid #bae6fd' }}>
                  <th style={{ padding: '8px 10px', fontSize: '0.72rem', color: '#0369a1', width: '45px', textAlign: 'center' }}>
                    #
                  </th>
                  {colIndices.map(ci => (
                    <th key={ci} style={{ padding: '8px 10px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0369a1' }}>
                            Columna {ci} {ci === 1 ? '(Principal)' : ''}
                          </span>
                          {colsCount > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCol(ci)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                fontSize: '0.70rem',
                                padding: '1px 4px',
                              }}
                              title={`Eliminar columna ${ci}`}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <input
                          style={{
                            ...inputStyle,
                            fontWeight: 750,
                            color: '#0369a1',
                            background: '#ffffff',
                            border: '1px solid #7dd3fc',
                            fontSize: '0.82rem',
                          }}
                          value={content[`col_${ci}_header`] ?? ''}
                          onChange={e => onUpdate({ [`col_${ci}_header`]: e.target.value })}
                          placeholder="Texto..."
                        />
                        {/* Atajo para aplicar píldora a toda la columna */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.62rem', color: '#0369a1', fontWeight: 600 }}>Toda la col:</span>
                          <button
                            type="button"
                            onClick={() => handleSetColPill(ci, '')}
                            style={{ padding: '1px 4px', fontSize: '0.60rem', borderRadius: '3px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}
                            title="Desactivar píldora en toda la columna"
                          >
                            Norm
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetColPill(ci, 'blue')}
                            style={{ padding: '1px 4px', fontSize: '0.60rem', borderRadius: '3px', border: '1px solid #bae6fd', background: '#e0f2fe', color: '#0284c7', fontWeight: 700, cursor: 'pointer' }}
                            title="Activar píldora azul en toda la columna"
                          >
                            Azul
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetColPill(ci, 'amber')}
                            style={{ padding: '1px 4px', fontSize: '0.60rem', borderRadius: '3px', border: '1px solid #fde68a', background: '#fef3c7', color: '#b45309', fontWeight: 700, cursor: 'pointer' }}
                            title="Activar píldora ámbar en toda la columna"
                          >
                            Ámbar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetColPill(ci, 'green')}
                            style={{ padding: '1px 4px', fontSize: '0.60rem', borderRadius: '3px', border: '1px solid #bbf7d0', background: '#dcfce7', color: '#15803d', fontWeight: 700, cursor: 'pointer' }}
                            title="Activar píldora verde en toda la columna"
                          >
                            Verde
                          </button>
                        </div>
                      </div>
                    </th>
                  ))}
                  <th style={{ width: '50px' }} />
                </tr>
              </thead>

              {/* Filas de la Tabla */}
              <tbody>
                {rowIndices.map(ri => (
                  <tr key={ri} style={{ borderBottom: '1px solid #f1f5f9', background: ri % 2 === 0 ? '#fafcff' : '#ffffff' }}>
                    <td style={{ padding: '8px', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textAlign: 'center', verticalAlign: 'top' }}>
                      F{ri}
                    </td>

                    {colIndices.map(ci => {
                      const rawVal = content[`cell_${ri}_${ci}`] ?? '';
                      // Limpieza visual si contenía corchetes anteriores tipo [blue:texto]
                      const val = rawVal.replace(/^\[(blue|azul|amber|ambar|yellow|green|verde|purple|morado|tag|badge):([\s\S]*?)\]$/i, '$2');
                      const pillVal = content[`cell_${ri}_${ci}_pill`] || '';
                      const isFirstCol = ci === 1;

                      // Estilos visuales del textarea según la píldora activa
                      let pillBg = '#ffffff';
                      let pillBorder = '#cbd5e1';
                      let pillColor = isFirstCol ? '#0f172a' : '#334155';
                      let pillWeight = isFirstCol ? 750 : 500;

                      if (pillVal === 'blue') {
                        pillBg = '#f0f9ff';
                        pillBorder = '#7dd3fc';
                        pillColor = '#0369a1';
                        pillWeight = 700;
                      } else if (pillVal === 'amber') {
                        pillBg = '#fefce8';
                        pillBorder = '#fde047';
                        pillColor = '#a16207';
                        pillWeight = 700;
                      } else if (pillVal === 'green') {
                        pillBg = '#f0fdf4';
                        pillBorder = '#86efac';
                        pillColor = '#15803d';
                        pillWeight = 700;
                      } else if (pillVal === 'purple') {
                        pillBg = '#faf5ff';
                        pillBorder = '#d8b4fe';
                        pillColor = '#7e22ce';
                        pillWeight = 700;
                      }

                      return (
                        <td key={ci} style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <textarea
                              rows={isFirstCol ? 2 : 3}
                              style={{
                                ...inputStyle,
                                fontWeight: pillWeight,
                                color: pillColor,
                                background: pillBg,
                                borderColor: pillBorder,
                                resize: 'vertical',
                                minHeight: isFirstCol ? '44px' : '55px',
                                fontSize: '0.82rem',
                                transition: 'all 0.15s ease',
                              }}
                              value={val}
                              onChange={e => onUpdate({ [`cell_${ri}_${ci}`]: e.target.value })}
                              placeholder="Texto..."
                            />

                            {/* Selector de Píldora directa para toda la casilla */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600 }}>Casilla:</span>
                              <button
                                type="button"
                                onClick={() => handleSetCellPill(ri, ci, '')}
                                style={{
                                  padding: '1px 5px',
                                  fontSize: '0.62rem',
                                  borderRadius: '4px',
                                  border: !pillVal ? '1.2px solid #94a3b8' : '1px solid #e2e8f0',
                                  background: !pillVal ? '#e2e8f0' : '#ffffff',
                                  color: !pillVal ? '#0f172a' : '#64748b',
                                  fontWeight: !pillVal ? 800 : 500,
                                  cursor: 'pointer',
                                }}
                                title="Texto normal"
                              >
                                Normal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetCellPill(ri, ci, 'blue')}
                                style={{
                                  padding: '1px 5px',
                                  fontSize: '0.62rem',
                                  borderRadius: '4px',
                                  border: pillVal === 'blue' ? '1.5px solid #0284c7' : '1px solid #bae6fd',
                                  background: pillVal === 'blue' ? '#0284c7' : '#e0f2fe',
                                  color: pillVal === 'blue' ? '#ffffff' : '#0284c7',
                                  fontWeight: 750,
                                  cursor: 'pointer',
                                }}
                                title="Habilitar píldora azul para toda la casilla"
                              >
                                Azul
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetCellPill(ri, ci, 'amber')}
                                style={{
                                  padding: '1px 5px',
                                  fontSize: '0.62rem',
                                  borderRadius: '4px',
                                  border: pillVal === 'amber' ? '1.5px solid #b45309' : '1px solid #fde68a',
                                  background: pillVal === 'amber' ? '#b45309' : '#fef3c7',
                                  color: pillVal === 'amber' ? '#ffffff' : '#b45309',
                                  fontWeight: 750,
                                  cursor: 'pointer',
                                }}
                                title="Habilitar píldora ámbar para toda la casilla"
                              >
                                Ámbar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetCellPill(ri, ci, 'green')}
                                style={{
                                  padding: '1px 5px',
                                  fontSize: '0.62rem',
                                  borderRadius: '4px',
                                  border: pillVal === 'green' ? '1.5px solid #15803d' : '1px solid #bbf7d0',
                                  background: pillVal === 'green' ? '#15803d' : '#dcfce7',
                                  color: pillVal === 'green' ? '#ffffff' : '#15803d',
                                  fontWeight: 750,
                                  cursor: 'pointer',
                                }}
                                title="Habilitar píldora verde para toda la casilla"
                              >
                                Verde
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetCellPill(ri, ci, 'purple')}
                                style={{
                                  padding: '1px 5px',
                                  fontSize: '0.62rem',
                                  borderRadius: '4px',
                                  border: pillVal === 'purple' ? '1.5px solid #7e22ce' : '1px solid #e9d5ff',
                                  background: pillVal === 'purple' ? '#7e22ce' : '#f3e8ff',
                                  color: pillVal === 'purple' ? '#ffffff' : '#7e22ce',
                                  fontWeight: 750,
                                  cursor: 'pointer',
                                }}
                                title="Habilitar píldora morada para toda la casilla"
                              >
                                Morado
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    })}

                    <td style={{ padding: '8px', verticalAlign: 'top', textAlign: 'center' }}>
                      {rowsCount > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(ri)}
                          style={{
                            ...removeBtnStyle,
                            padding: '3px 6px',
                            fontSize: '0.68rem',
                          }}
                          title={`Eliminar fila ${ri}`}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            style={{
              ...addButtonStyle,
              background: '#e0f2fe',
              color: '#0369a1',
              borderColor: '#7dd3fc',
              flex: 1,
            }}
            onClick={handleAddRow}
            title="Añadir una nueva fila al final"
          >
            <Plus size={15} /> Añadir Fila (+1)
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── 6. TEXTO CON TARJETAS SIMPLES (SUBTÍTULO + PÁRRAFOS + TARJETAS DE SOLO TEXTO) ───
export const HistologyTextSimpleCardsInlineEditor: React.FC<BaseHistologyEditorProps> = ({
  blockId,
  content,
  onUpdate,
}) => {
  const cardsCount = Math.max(0, Number(content.cards_count) || (
    content.card_6 ? 6 :
    content.card_5 ? 5 :
    content.card_4 ? 4 :
    content.card_3 ? 3 :
    content.card_2 ? 2 :
    content.card_1 ? 1 : 0
  ));

  const columns = content.columns || '3';
  const cardIndices = Array.from({ length: cardsCount }, (_, i) => i + 1);

  const handleAddCard = () => {
    const next = cardsCount + 1;
    onUpdate({
      cards_count: String(next),
      [`card_${next}`]: '',
    });
  };

  const handleRemoveCard = (delIdx: number) => {
    if (cardsCount <= 0) return;
    const next = cardsCount - 1;
    const updates: Record<string, string> = {
      cards_count: String(next),
    };
    for (let i = delIdx; i < cardsCount; i++) {
      updates[`card_${i}`] = content[`card_${i + 1}`] ?? '';
    }
    updates[`card_${cardsCount}`] = '';
    onUpdate(updates);
  };

  const handleSetQuickCards = (targetCount: number) => {
    const updates: Record<string, string> = {
      cards_count: String(targetCount),
    };
    for (let i = 1; i <= targetCount; i++) {
      if (content[`card_${i}`] === undefined) {
        updates[`card_${i}`] = '';
      }
    }
    onUpdate(updates);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
      {/* 1. Cabecera de Sección (Badge y Título) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)', gap: '12px' }}>
        <label style={labelStyle}>
          <span>🏷️ Etiqueta superior / Badge (Opcional)</span>
          <input
            style={inputStyle}
            value={content.badge_text ?? ''}
            onChange={e => onUpdate({ badge_text: e.target.value })}
            placeholder="Texto..."
          />
        </label>
        <label style={labelStyle}>
          <span>📖 Subtítulo / Título de la Sección</span>
          <input
            style={inputStyle}
            value={content.title ?? ''}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="Texto..."
          />
        </label>
      </div>

      {/* 2. Párrafos de texto explicativo */}
      <HistologyRichField
        label="📄 Párrafos Explicativos"
        editorId={blockId ? `${blockId}:text` : undefined}
        value={content.text ?? ''}
        onChange={val => onUpdate({ text: val })}
        placeholder="Texto..."
        minHeight="85px"
      />

      {/* 3. Sección de Tarjetas Simples de Texto */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '14px',
          borderRadius: '12px',
          border: '1px solid #bae6fd',
          background: '#f0f9ff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0369a1' }}>
              🗂️ Tarjetas Simples de Texto ({cardsCount})
            </span>
          </div>

          {/* Selector de columnas y conteo rápido */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.74rem', color: '#0369a1', fontWeight: 600 }}>Columnas:</span>
              {(['2', '3', '4'] as const).map(col => (
                <button
                  key={col}
                  type="button"
                  onClick={() => onUpdate({ columns: col })}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '5px',
                    border: columns === col ? '1.5px solid #0284c7' : '1px solid #7dd3fc',
                    background: columns === col ? '#0284c7' : '#e0f2fe',
                    color: columns === col ? '#ffffff' : '#0369a1',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {col}
                </button>
              ))}
            </div>

            {/* Selector de alineación */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.74rem', color: '#0369a1', fontWeight: 600 }}>Alineación:</span>
              <button
                type="button"
                onClick={() => onUpdate({ cards_align: 'center' })}
                style={{
                  padding: '2px 7px',
                  borderRadius: '5px',
                  border: (content.cards_align || 'center') === 'center' ? '1.5px solid #0284c7' : '1px solid #7dd3fc',
                  background: (content.cards_align || 'center') === 'center' ? '#0284c7' : '#e0f2fe',
                  color: (content.cards_align || 'center') === 'center' ? '#ffffff' : '#0369a1',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Centrar tarjetas en la pantalla"
              >
                Centradas
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ cards_align: 'left' })}
                style={{
                  padding: '2px 7px',
                  borderRadius: '5px',
                  border: content.cards_align === 'left' ? '1.5px solid #0284c7' : '1px solid #7dd3fc',
                  background: content.cards_align === 'left' ? '#0284c7' : '#e0f2fe',
                  color: content.cards_align === 'left' ? '#ffffff' : '#0369a1',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Alinear tarjetas a la izquierda"
              >
                Izquierda
              </button>
            </div>

            <span style={{ fontSize: '0.74rem', color: '#0284c7', fontWeight: 600 }}>Cantidad rápida:</span>
            {[3, 4, 5, 6].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleSetQuickCards(num)}
                style={{
                  padding: '2px 7px',
                  borderRadius: '5px',
                  border: '1px solid #7dd3fc',
                  background: '#e0f2fe',
                  color: '#0369a1',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title={`Configurar ${num} tarjetas`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {cardsCount === 0 ? (
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              border: '1px dashed #7dd3fc',
              background: '#ffffff',
              textAlign: 'center',
              fontSize: '0.80rem',
              color: '#64748b',
            }}
          >
            No hay tarjetas añadidas. Pulsa el botón de abajo para añadir una o elige una cantidad arriba.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(240px, 1fr))`,
              gap: '10px',
            }}
          >
            {cardIndices.map(idx => {
              const cardVal = content[`card_${idx}`] ?? '';

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.2px solid #cbd5e1',
                    background: '#ffffff',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0284c7' }}>
                      Tarjeta #{idx}
                    </span>
                    <button
                      type="button"
                      style={removeBtnStyle}
                      onClick={() => handleRemoveCard(idx)}
                      title={`Eliminar tarjeta #${idx}`}
                    >
                      <Trash2 size={12} /> Quitar
                    </button>
                  </div>

                  <input
                    style={{
                      ...inputStyle,
                      fontWeight: 700,
                      color: '#0f172a',
                      fontSize: '0.85rem',
                    }}
                    value={cardVal}
                    onChange={e => onUpdate({ [`card_${idx}`]: e.target.value })}
                    placeholder="Texto..."
                  />
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          style={{
            ...addButtonStyle,
            background: '#e0f2fe',
            color: '#0284c7',
            borderColor: '#7dd3fc',
          }}
          onClick={handleAddCard}
          title="Añadir una nueva tarjeta simple"
        >
          <Plus size={15} /> Añadir Tarjeta (+1)
        </button>
      </div>
    </div>
  );
};

// ─── 7. DATO EXTRA / CORRELACIÓN MÉDICA ───────────────────────────────────────
export const HistologyExtraDataInlineEditor: React.FC<BaseHistologyEditorProps> = ({
  blockId,
  content,
  onUpdate,
  onPickImage,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '12px 0' }}>
      <label style={labelStyle}>
        <span>📌 Título del Dato Extra</span>
        <input
          style={{
            ...inputStyle,
            fontWeight: 800,
            color: '#1e3a8a',
            fontSize: '0.90rem',
          }}
          value={content.title ?? ''}
          onChange={e => onUpdate({ title: e.target.value })}
          placeholder="Texto..."
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(240px, 0.8fr)', gap: '16px', alignItems: 'start' }}>
        <HistologyRichField
          label="Contenido / Explicación del dato extra"
          editorId={blockId ? `${blockId}:text` : undefined}
          value={content.text ?? ''}
          onChange={val => onUpdate({ text: val })}
          placeholder="Texto..."
          minHeight="140px"
        />

        {/* Panel de Imagen Opcional (Del sitio o subida) */}
        <div style={imagePickerBoxStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ImageIcon size={15} /> Imagen Ilustrativa (Opcional)
            </span>
            {content.image_url && (
              <button
                type="button"
                onClick={() => onUpdate({ image_url: '', image_caption: '' })}
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
                alt="Imagen del dato extra"
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

          {content.image_url && (
            <label style={{ ...labelStyle, fontSize: '0.75rem' }}>
              <span>Pie de foto de la imagen</span>
              <input
                style={{ ...inputStyle, padding: '5px 8px', fontSize: '0.8rem' }}
                value={content.image_caption ?? ''}
                onChange={e => onUpdate({ image_caption: e.target.value })}
                placeholder="Texto..."
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
};



