import React from 'react';
import { Microscope, Sparkles } from 'lucide-react';
import CajalHistoryComparator from '../CajalHistoryComparator';

/**
 * Componente archivado: "Dato histológico de la semana"
 * Guardado para su reutilización futura.
 */
export const HomeHistologyFact: React.FC = () => {
  return (
    <section className="home-histology-fact home-reveal" aria-labelledby="home-histology-fact-title">
      {/* Elementos decorativos de fondo */}
      <span className="home-fact-shine" aria-hidden="true" />
      <span className="home-fact-glow home-fact-glow-cyan" aria-hidden="true" />
      <span className="home-fact-glow home-fact-glow-violet" aria-hidden="true" />
      <span className="home-fact-orbit home-fact-orbit-one" aria-hidden="true" />
      <span className="home-fact-orbit home-fact-orbit-two" aria-hidden="true" />
      <span className="home-histology-fact-mesh" aria-hidden="true" />
      <span className="home-fact-crosshair home-fact-crosshair-tl" aria-hidden="true" />
      <span className="home-fact-crosshair home-fact-crosshair-br" aria-hidden="true" />

      <div className="home-histology-fact-header">
        <div className="home-histology-fact-brand">
          <div className="home-histology-fact-icon" aria-hidden="true">
            <Microscope size={20} />
          </div>
          <span className="home-histology-fact-label">
            <Sparkles size={15} /> Dato histológico de la semana
          </span>
        </div>

        <div className="home-histology-fact-badges">
          <span className="home-histology-fact-chip">Tejido Nervioso · Hito Histórico</span>
        </div>
      </div>

      <div className="home-histology-fact-body home-fact-wrap-body">
        <div className="home-fact-top-row">
          {/* Lado izquierdo: Explicación del dato */}
          <div className="home-fact-intro-side">
            <div className="home-fact-quote-card home-fact-intro-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p id="home-histology-fact-title" style={{ margin: 0, fontSize: 'clamp(.88rem, .98vw, .98rem)', lineHeight: 1.45, color: '#0f2a43' }}>
                  <strong>¿Sabías que Santiago Ramón y Cajal demostró que el sistema nervioso no es una red continua, sino células individuales?</strong>
                </p>
                <p style={{ margin: 0, fontSize: 'clamp(.82rem, .92vw, .9rem)', lineHeight: 1.58, color: '#334155' }}>
                  En 1888, usando la técnica de <em>impregnación argéntica de Golgi</em>, Cajal postuló la <strong>Doctrina de la Neurona</strong>: las células nerviosas son unidades anatómicas independientes comunicadas por <strong>contigüidad</strong> (sinapsis) y no por continuidad física.
                </p>
              </div>

              <div className="home-fact-cajal-pills" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '9px 12px', borderRadius: '10px', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1px solid #fde68a', fontSize: '0.76rem', color: '#92400e', lineHeight: 1.45 }}>
                  <strong style={{ display: 'block', marginBottom: '2px', color: '#b45309' }}>✍️ El arte antes de la fotografía microscópica</strong>
                  Al carecer de cámaras en el ocular, Cajal dibujaba a mano alzada con tinta china y precisión milimétrica cada célula que observaba.
                </div>
              </div>
            </div>
          </div>

          {/* Lado derecho: Comparador interactivo (Dibujo vs Microscopía real) */}
          <div className="home-fact-diagram-side">
            <CajalHistoryComparator />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeHistologyFact;
