import React from 'react';
import {
  Zap,
  Microscope,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { renderBoldText } from '../BoldField';
import { MedicalIcon } from '../common/MedicalIcon';

export interface AssociatedFunctionItem {
  id?: string;
  label: string;
  icon?: string;
}

export interface MorphologyCriterionItem {
  id?: string;
  number?: string;
  title: string;
  detail: string;
}

export interface AnatomicalLocationItem {
  id?: string;
  organ: string;
  detail: string;
  icon?: string;
}

export interface HistologyPillarsProps {
  // Tarjeta 1: Función
  functionBadge?: string;
  functionTitle?: string;
  mainFunctionName?: string;
  mainFunctionDesc?: string;
  mainFunctionIcon?: string;
  associatedFunctions?: AssociatedFunctionItem[];

  // Tarjeta 2: Criterios Morfológicos
  criteriaBadge?: string;
  criteriaTitle?: string;
  criteria?: MorphologyCriterionItem[];

  // Tarjeta 3: Ubicaciones Anatómicas
  locationsBadge?: string;
  locationsTitle?: string;
  locations?: AnatomicalLocationItem[];
}

export const HistologyPillarsBlock: React.FC<HistologyPillarsProps> = ({
  functionBadge = 'Función',
  functionTitle = '2. Función Principal',
  mainFunctionName,
  mainFunctionDesc,
  mainFunctionIcon = 'exchange',
  associatedFunctions = [],

  criteriaBadge = 'Criterios Morfológicos',
  criteriaTitle = '3. Criterios Morfológicos',
  criteria = [],

  locationsBadge = 'Ubicaciones Anatómicas',
  locationsTitle = '4. Ubicaciones Anatómicas',
  locations = [],
}) => {
  const validAssocFunctions = associatedFunctions.filter(f => f.label && f.label.trim() !== '');
  const validCriteria = criteria.filter(c => (c.title && c.title.trim() !== '') || (c.detail && c.detail.trim() !== ''));
  const validLocations = locations.filter(l => (l.organ && l.organ.trim() !== '') || (l.detail && l.detail.trim() !== ''));

  return (
    <div
      className="histology-pillars-block"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
        gap: 'clamp(16px, 2vw, 24px)',
        alignItems: 'stretch',
        fontFamily: '"Montserrat", "Segoe UI", sans-serif',
      }}
    >
      {/* ─── TARJETA 1: FUNCIÓN PRINCIPAL ─── */}
      <div
        style={{
          borderRadius: '24px',
          background: 'linear-gradient(180deg, #ffffff 0%, #fbfdfc 100%)',
          border: '1.5px solid #d1fae5',
          padding: 'clamp(20px, 2.5vw, 28px)',
          boxShadow: '0 10px 30px rgba(16, 185, 129, 0.04), inset 0 1px 0 #ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        {/* Encabezado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {functionBadge && functionBadge.trim() !== '' && (
            <div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.70rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#059669',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  padding: '3px 10px',
                  borderRadius: '999px',
                }}
              >
                <Zap size={12} />
                <span>{functionBadge}</span>
              </span>
            </div>
          )}

          {functionTitle && functionTitle.trim() !== '' && (
            <h3
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 850,
                color: '#064e3b',
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
              }}
            >
              {functionTitle}
            </h3>
          )}
        </div>

        {/* Bloque Destacado de Función Rectoral */}
        {(mainFunctionName || mainFunctionDesc) && (
          <div
            style={{
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
              border: '1.5px solid #bbf7d0',
              padding: '18px',
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#ffffff',
                border: '1.5px solid #a7f3d0',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#059669',
              }}
            >
              <MedicalIcon name={mainFunctionIcon || 'exchange'} size={26} color="#059669" fallback={<Zap size={24} color="#059669" />} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {mainFunctionName && (
                <strong
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 900,
                    color: '#047857',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {mainFunctionName}
                </strong>
              )}
              {mainFunctionDesc && (
                <div
                  style={{
                    fontSize: '0.82rem',
                    lineHeight: 1.55,
                    color: '#000000',
                    fontWeight: 500,
                  }}
                >
                  {renderBoldText(mainFunctionDesc)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subsección: Funciones Asociadas */}
        {validAssocFunctions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto', paddingTop: '4px' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#065f46',
                letterSpacing: '0.02em',
              }}
            >
              Funciones asociadas
            </span>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {validAssocFunctions.map((item, i) => (
                <span
                  key={item.id ?? i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '10px',
                    background: '#ffffff',
                    border: '1.2px solid #d1fae5',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.04)',
                    color: '#047857',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  <MedicalIcon name={item.icon || 'sparkles'} size={14} color="#059669" fallback={<Sparkles size={13} color="#059669" />} />
                  <span>{item.label}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── TARJETA 2: CRITERIOS MORFOLÓGICOS ─── */}
      <div
        style={{
          borderRadius: '24px',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafd 100%)',
          border: '1.5px solid #bfdbfe',
          padding: 'clamp(20px, 2.5vw, 28px)',
          boxShadow: '0 10px 30px rgba(59, 130, 246, 0.04), inset 0 1px 0 #ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        {/* Encabezado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {criteriaBadge && criteriaBadge.trim() !== '' && (
            <div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.70rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#2563eb',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  padding: '3px 10px',
                  borderRadius: '999px',
                }}
              >
                <Microscope size={12} />
                <span>{criteriaBadge}</span>
              </span>
            </div>
          )}

          {criteriaTitle && criteriaTitle.trim() !== '' && (
            <h3
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 850,
                color: '#1e3a8a',
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
              }}
            >
              {criteriaTitle}
            </h3>
          )}
        </div>

        {/* Listado Vertical Numerado */}
        {validCriteria.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {validCriteria.map((item, index) => {
              const numStr = item.number || String(index + 1).padStart(2, '0');
              return (
                <div
                  key={item.id ?? index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                      boxShadow: '0 2px 5px rgba(29, 78, 216, 0.1)',
                    }}
                  >
                    {numStr}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {item.title && (
                      <strong
                        style={{
                          fontSize: '0.86rem',
                          fontWeight: 800,
                          color: '#0f172a',
                        }}
                      >
                        {renderBoldText(item.title)}
                      </strong>
                    )}
                    {item.detail && (
                      <div
                        style={{
                          fontSize: '0.80rem',
                          lineHeight: 1.45,
                          color: '#000000',
                          fontWeight: 500,
                        }}
                      >
                        {renderBoldText(item.detail)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── TARJETA 3: UBICACIONES ANATÓMICAS ─── */}
      <div
        style={{
          borderRadius: '24px',
          background: 'linear-gradient(180deg, #ffffff 0%, #fffbf8 100%)',
          border: '1.5px solid #fed7aa',
          padding: 'clamp(20px, 2.5vw, 28px)',
          boxShadow: '0 10px 30px rgba(234, 88, 12, 0.04), inset 0 1px 0 #ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        {/* Encabezado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {locationsBadge && locationsBadge.trim() !== '' && (
            <div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.70rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#c2410c',
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  padding: '3px 10px',
                  borderRadius: '999px',
                }}
              >
                <MapPin size={12} />
                <span>{locationsBadge}</span>
              </span>
            </div>
          )}

          {locationsTitle && locationsTitle.trim() !== '' && (
            <h3
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 850,
                color: '#7c2d12',
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
              }}
            >
              {locationsTitle}
            </h3>
          )}
        </div>

        {/* Listado Vertical con Pines / Íconos Anatómicos */}
        {validLocations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {validLocations.map((item, index) => {
              const isLast = index === validLocations.length - 1;
              return (
                <div
                  key={item.id ?? index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    paddingTop: index === 0 ? '0' : '10px',
                    paddingBottom: isLast ? '0' : '10px',
                    borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                  }}
                >
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: '#ffedd5',
                      color: '#ea580c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    <MedicalIcon name={item.icon || 'map_pin'} size={14} color="#ea580c" fallback={<MapPin size={13} color="#ea580c" />} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {item.organ && (
                      <strong
                        style={{
                          fontSize: '0.86rem',
                          fontWeight: 800,
                          color: '#0f172a',
                        }}
                      >
                        {renderBoldText(item.organ)}
                      </strong>
                    )}
                    {item.detail && (
                      <div
                        style={{
                          fontSize: '0.80rem',
                          lineHeight: 1.45,
                          color: '#000000',
                          fontWeight: 500,
                        }}
                      >
                        {renderBoldText(item.detail)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistologyPillarsBlock;
