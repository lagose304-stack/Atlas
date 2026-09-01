import React from 'react';
import {
  Zap,
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
  // Visibilidad individual de tarjetas
  showFunctionCard?: boolean;
  showCriteriaCard?: boolean;
  showLocationsCard?: boolean;

  // Tarjeta 1: Función
  functionBadge?: string;
  functionTitle?: string;
  mainFunctionName?: string;
  mainFunctionDesc?: string;
  mainFunctionIcon?: string;
  functionImageUrl?: string;
  functionImageCaption?: string;
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
  showFunctionCard = true,
  showCriteriaCard = true,
  showLocationsCard = true,

  functionBadge: _functionBadge,
  functionTitle = '2. Función Principal',
  mainFunctionName,
  mainFunctionDesc,
  mainFunctionIcon = 'exchange',
  functionImageUrl,
  functionImageCaption,
  associatedFunctions = [],

  criteriaBadge: _criteriaBadge,
  criteriaTitle = '3. Criterios Morfológicos',
  criteria = [],

  locationsBadge: _locationsBadge,
  locationsTitle = '4. Ubicaciones Anatómicas',
  locations = [],
}) => {
  const validAssocFunctions = associatedFunctions.filter(f => f.label && f.label.trim() !== '');
  const validCriteria = criteria.filter(c => (c.title && c.title.trim() !== '') || (c.detail && c.detail.trim() !== ''));
  const validLocations = locations.filter(l => (l.organ && l.organ.trim() !== '') || (l.detail && l.detail.trim() !== ''));

  const visibleCardsCount = (showFunctionCard ? 1 : 0) + (showCriteriaCard ? 1 : 0) + (showLocationsCard ? 1 : 0);
  if (visibleCardsCount === 0) {
    return null;
  }

  const gridCols =
    visibleCardsCount === 1
      ? '1fr'
      : visibleCardsCount === 2
      ? 'repeat(auto-fit, minmax(320px, 1fr))'
      : 'repeat(auto-fit, minmax(290px, 1fr))';

  return (
    <div
      className="histology-pillars-block"
      style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        gap: 'clamp(14px, 1.8vw, 22px)',
        alignItems: 'stretch',
        fontFamily: '"Montserrat", "Segoe UI", sans-serif',
      }}
    >
      {/* ─── TARJETA 1: FUNCIÓN PRINCIPAL (Esmeralda / Menta Médico) ─── */}
      {showFunctionCard && (
        <div
        style={{
          borderRadius: '22px',
          background: 'linear-gradient(180deg, #ffffff 0%, #fbfdfc 60%, #f4fdf8 100%)',
          border: '1.5px solid #a7f3d0',
          boxShadow: '0 10px 30px -4px rgba(16, 185, 129, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.03), inset 0 1px 0 #ffffff',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Barra superior de acento esmeralda */}
        <div style={{ height: '4px', width: '100%', background: 'linear-gradient(90deg, #059669 0%, #10b981 50%, #34d399 100%)', flexShrink: 0 }} />

        <div style={{ padding: 'clamp(16px, 2vw, 22px)', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1, minHeight: 0 }}>
          {/* Encabezado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
            {functionTitle && functionTitle.trim() !== '' && (
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.16rem',
                  fontWeight: 850,
                  color: '#064e3b',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
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
                borderRadius: '16px',
                background: 'linear-gradient(145deg, #f0fdf4 0%, #ecfdf5 60%, #e6fcf0 100%)',
                border: '1.5px solid #86efac',
                padding: '12px 14px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.07), inset 0 1px 0 #ffffff',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)',
                  border: '2px solid #34d399',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#059669',
                }}
              >
                <MedicalIcon name={mainFunctionIcon || 'exchange'} size={20} color="#059669" fallback={<Zap size={18} color="#059669" />} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {mainFunctionName && (
                  <strong
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 900,
                      color: '#047857',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      lineHeight: 1.2,
                    }}
                  >
                    {mainFunctionName}
                  </strong>
                )}
                {mainFunctionDesc && (
                  <div
                    className="histology-pillars-desc"
                    style={{
                      fontSize: '0.80rem',
                      lineHeight: 1.4,
                      color: '#000000',
                      fontWeight: 500,
                      marginTop: '1px',
                    }}
                  >
                    {renderBoldText(mainFunctionDesc)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Imagen de Referencia / Esquema Funcional (Auto-adaptable sin forzar altura) */}
          {functionImageUrl && (
            <div
              style={{
                position: 'relative',
                borderRadius: '14px',
                border: '1.5px solid #86efac',
                overflow: 'hidden',
                background: '#f8fafc',
                minHeight: '60px',
                maxHeight: '165px',
                flex: '1 1 0px',
                boxShadow: '0 3px 10px rgba(16, 185, 129, 0.08)',
              }}
            >
              <img
                src={functionImageUrl}
                alt={functionImageCaption || 'Esquema funcional'}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
                loading="lazy"
              />
              {functionImageCaption && functionImageCaption.trim() !== '' && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '5px',
                    left: '6px',
                    right: '6px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'rgba(6, 78, 59, 0.88)',
                    backdropFilter: 'blur(4px)',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    zIndex: 2,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}
                >
                  <span>🔬</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{functionImageCaption}</span>
                </div>
              )}
            </div>
          )}

          {/* Subsección: Otras Funciones Asociadas */}
          {validAssocFunctions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: functionImageUrl ? '0' : 'auto', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                <span
                  style={{
                    fontSize: '0.73rem',
                    fontWeight: 800,
                    color: '#065f46',
                    letterSpacing: '0.02em',
                  }}
                >
                  Otras funciones asociadas
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {validAssocFunctions.map((item, i) => (
                  <span
                    key={item.id ?? i}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
                      border: '1.2px solid #a7f3d0',
                      boxShadow: '0 2px 6px rgba(5, 150, 105, 0.05)',
                      color: '#047857',
                      fontSize: '0.74rem',
                      fontWeight: 750,
                    }}
                  >
                    <MedicalIcon name={item.icon || 'sparkles'} size={13} color="#059669" fallback={<Sparkles size={12} color="#059669" />} />
                    <span>{item.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ─── TARJETA 2: CRITERIOS MORFOLÓGICOS (Azul Cobalto / Zafiro Clínico) ─── */}
      {showCriteriaCard && (
      <div
        style={{
          borderRadius: '22px',
          background: 'linear-gradient(180deg, #ffffff 0%, #fbfdfd 60%, #f5f9ff 100%)',
          border: '1.5px solid #bfdbfe',
          boxShadow: '0 10px 30px -4px rgba(59, 130, 246, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.03), inset 0 1px 0 #ffffff',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Barra superior de acento zafiro */}
        <div style={{ height: '4px', width: '100%', background: 'linear-gradient(90deg, #1d4ed8 0%, #3b82f6 50%, #60a5fa 100%)', flexShrink: 0 }} />

        <div style={{ padding: 'clamp(16px, 2vw, 22px)', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
          {/* Encabezado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {criteriaTitle && criteriaTitle.trim() !== '' && (
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.16rem',
                  fontWeight: 850,
                  color: '#1e3a8a',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                {criteriaTitle}
              </h3>
            )}
          </div>

          {/* Listado Vertical Numerado con Badges Gradientes */}
          {validCriteria.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {validCriteria.map((item, index) => {
                const numStr = item.number || String(index + 1).padStart(2, '0');
                const isLast = index === validCriteria.length - 1;
                return (
                  <div
                    key={item.id ?? index}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      paddingBottom: isLast ? '0' : '6px',
                      borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                    }}
                  >
                    <div
                      style={{
                        width: '23px',
                        height: '23px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        color: '#ffffff',
                        fontSize: '0.67rem',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '1px',
                        boxShadow: '0 2px 6px rgba(29, 78, 216, 0.28)',
                      }}
                    >
                      {numStr}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                      {item.title && (
                        <strong
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: 800,
                            color: '#0f172a',
                            lineHeight: 1.25,
                          }}
                        >
                          {renderBoldText(item.title)}
                        </strong>
                      )}
                      {item.detail && (
                        <div
                          className="histology-pillars-desc"
                          style={{
                            fontSize: '0.79rem',
                            lineHeight: 1.38,
                            color: '#000000',
                            fontWeight: 500,
                            marginTop: '1px',
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
      )}

      {/* ─── TARJETA 3: UBICACIONES ANATÓMICAS (Ámbar / Coral Anatómico) ─── */}
      {showLocationsCard && (
      <div
        style={{
          borderRadius: '22px',
          background: 'linear-gradient(180deg, #ffffff 0%, #fcfbfb 60%, #fff9f4 100%)',
          border: '1.5px solid #fed7aa',
          boxShadow: '0 10px 30px -4px rgba(234, 88, 12, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.03), inset 0 1px 0 #ffffff',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Barra superior de acento ámbar */}
        <div style={{ height: '4px', width: '100%', background: 'linear-gradient(90deg, #c2410c 0%, #ea580c 50%, #fb923c 100%)', flexShrink: 0 }} />

        <div style={{ padding: 'clamp(16px, 2vw, 22px)', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
          {/* Encabezado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {locationsTitle && locationsTitle.trim() !== '' && (
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.16rem',
                  fontWeight: 850,
                  color: '#7c2d12',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                {locationsTitle}
              </h3>
            )}
          </div>

          {/* Listado Vertical con Pines Gradientes */}
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
                      gap: '10px',
                      paddingTop: index === 0 ? '0' : '6px',
                      paddingBottom: isLast ? '0' : '6px',
                      borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                    }}
                  >
                    <div
                      style={{
                        width: '23px',
                        height: '23px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '1px',
                        boxShadow: '0 2px 6px rgba(234, 88, 12, 0.28)',
                      }}
                    >
                      <MedicalIcon name={item.icon || 'map_pin'} size={12} color="#ffffff" fallback={<MapPin size={11} color="#ffffff" />} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                      {item.organ && (
                        <strong
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: 800,
                            color: '#0f172a',
                            lineHeight: 1.25,
                          }}
                        >
                          {renderBoldText(item.organ)}
                        </strong>
                      )}
                      {item.detail && (
                        <div
                          className="histology-pillars-desc"
                          style={{
                            fontSize: '0.79rem',
                            lineHeight: 1.38,
                            color: '#000000',
                            fontWeight: 500,
                            marginTop: '1px',
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
      )}
    </div>
  );
};

export default HistologyPillarsBlock;
