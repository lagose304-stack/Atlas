import React from 'react';
import { Microscope, Sparkles, ShieldCheck, Tag, Puzzle } from 'lucide-react';
import bacteriaImg from '../assets/imagenes/bacteria_inmunogeno.jpg';
import '../styles/homeHistologyFact.css';

export const HomeHistologyFact: React.FC = () => {
  return (
    <section
      className="home-histology-fact home-reveal"
      aria-labelledby="home-histology-fact-title"
    >
      {/* Fondo y auras sutiles */}
      <span className="home-fact-shine" aria-hidden="true" />
      <span className="home-fact-glow home-fact-glow-cyan" aria-hidden="true" />
      <span className="home-fact-glow home-fact-glow-violet" aria-hidden="true" />
      <span className="home-fact-orbit home-fact-orbit-one" aria-hidden="true" />
      <span className="home-histology-fact-mesh" aria-hidden="true" />

      {/* Cuerpo principal en 2 columnas: Explicación breve + Bacteria animada */}
      <div className="home-histology-fact-body">
        <div className="home-immune-grid-compact">
          {/* ─── Lado Izquierdo: Explicación simple y directa ─── */}
          <div className="home-immune-left">
            <div className="home-histology-fact-brand">
              <div className="home-histology-fact-icon" aria-hidden="true">
                <Microscope size={18} />
              </div>
              <span className="home-histology-fact-label">
                <Sparkles size={13} /> Dato histológico de la semana
              </span>
            </div>

            <h2 id="home-histology-fact-title" className="home-immune-title-compact">
              Diferencia: Antígeno, Inmunógeno y Hapteno
            </h2>

            <div className="home-immune-list-compact">
              {/* 1. Antígeno */}
              <div className="home-immune-row row-ag">
                <div className="home-immune-row-head">
                  <span className="home-immune-tag tag-ag">
                    <Tag size={12} /> Antígeno
                  </span>
                  <span className="home-immune-motto">Solo garantiza unión</span>
                </div>
                <p>
                  Sustancia que se <strong>une específicamente</strong> al anticuerpo o receptor (BCR/TCR). Tiene <em>antigenicidad</em>, pero no siempre activa una respuesta por sí sola.
                </p>
              </div>

              {/* 2. Inmunógeno */}
              <div className="home-immune-row row-im">
                <div className="home-immune-row-head">
                  <span className="home-immune-tag tag-im">
                    <ShieldCheck size={12} /> Inmunógeno
                  </span>
                  <span className="home-immune-motto">Se une + Activa defensas</span>
                </div>
                <p>
                  Antígeno completo y complejo que <strong>desencadena activamente</strong> una respuesta inmunitaria adaptativa (producción de anticuerpos y células de memoria).
                </p>
              </div>

              {/* 3. Hapteno */}
              <div className="home-immune-row row-hp">
                <div className="home-immune-row-head">
                  <span className="home-immune-tag tag-hp">
                    <Puzzle size={12} /> Hapteno
                  </span>
                  <span className="home-immune-motto">Solo activa con Carrier</span>
                </div>
                <p>
                  Molécula pequeña (&lt; 5 kDa, ej. penicilina) que por sí sola <strong>es inerte</strong>. Solo activa al sistema inmune si se acopla a una <strong>proteína transportadora (Carrier)</strong>.
                </p>
              </div>
            </div>

            {/* Regla mnemotécnica */}
            <div className="home-immune-rule">
              <span aria-hidden="true">💡</span>
              <span>
                <strong>Regla de oro:</strong> Todo inmunógeno es antígeno, pero no todo antígeno es inmunógeno.
              </span>
            </div>
          </div>

          {/* ─── Lado Derecho: Visor de Microscopía Animado tipo GIF ─── */}
          <div className="home-bacteria-frame" role="img" aria-label="Microscopía animada de bacteria: ejemplo de inmunógeno completo">
            {/* Capa de imagen animada con nado / flotación fluida */}
            <div className="home-bacteria-media-wrap">
              <img
                src={bacteriaImg}
                alt="Bacteria flagelada en microscopía de alta resolución - Ejemplo de inmunógeno completo"
                className="home-bacteria-img"
              />
            </div>

            {/* Aura bioluminiscente pulsante */}
            <div className="home-bacteria-glow-pulse" aria-hidden="true" />

            {/* Partículas flotantes microscópicas */}
            <div className="home-bacteria-particles" aria-hidden="true">
              <span className="particle-dot dot-1" />
              <span className="particle-dot dot-2" />
              <span className="particle-dot dot-3" />
              <span className="particle-dot dot-4" />
            </div>

            {/* Línea de barrido luminoso óptico */}
            <div className="home-bacteria-scan-line" aria-hidden="true" />

          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeHistologyFact;
