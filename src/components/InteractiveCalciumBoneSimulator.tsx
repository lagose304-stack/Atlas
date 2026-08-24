import React from 'react';
import '../styles/calcium-simulator.css';

export const InteractiveCalciumBoneSimulator: React.FC = () => {
  return (
    <div className="bone-diagram-container" role="figure" aria-label="Esquema molecular básico y grande del eje RANKL y OPG con borde festoneado animado">
      {/* Lienzo SVG con cajas amplias, tipografía grande y borde festoneado rotatorio/ondulante limpio */}
      <div className="bone-diagram-canvas-box">
        <svg
          viewBox="0 0 860 360"
          className="bone-diagram-svg"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Esquema animado de Osteoblasto, Osteoclasto, RANKL y OPG"
        >
          <defs>
            {/* Sombras suaves para badges y células */}
            <filter id="medShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.09" />
            </filter>
            <filter id="cellShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.12" />
            </filter>

            {/* Gradientes anatómicos de alta definición */}
            <linearGradient id="boneGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f5f0ea" />
              <stop offset="35%" stopColor="#ebdcd0" />
              <stop offset="100%" stopColor="#d8c1ad" />
            </linearGradient>

            <linearGradient id="obGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            <linearGradient id="ocGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>

            {/* Marcadores de flechas */}
            <marker id="arrBlue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
            </marker>
            <marker id="arrRed" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#dc2626" />
            </marker>
            <marker id="arrGreen" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#059669" />
            </marker>
            <marker id="arrPurple" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#7c3aed" />
            </marker>

            {/* ClipPath para el borde festoneado inferior sin afectar el interior */}
            <clipPath id="osteoclastClip">
              <path d="M -85 50 C -98 0, -85 -60, 0 -72 C 85 -60, 98 0, 85 50 Q 0 68, -85 50 Z" />
            </clipPath>
          </defs>

          {/* ══════════════════════════════════════════════════════════════════
              1. SUPERFICIE ÓSEA (HUESO) & OSTEOCITO (INFERIOR)
              ══════════════════════════════════════════════════════════════════ */}
          {/* Barra de Hueso con Laguna de Howship bajo el osteoclasto */}
          <path
            d="M 20 255 
               L 540 255 
               Q 635 305, 730 255 
               L 840 255 
               L 840 345 
               L 20 345 Z"
            fill="url(#boneGrad)"
            stroke="#c4ac98"
            strokeWidth="2.5"
          />

          {/* Resplandor sutil de microambiente ácido en la Laguna de Howship */}
          <g className="howship-acid-glow" aria-hidden="true">
            <ellipse cx="635" cy="272" rx="76" ry="18" fill="#fef3c7" opacity="0.45" />
            <path
              d="M 560 262 Q 635 295, 710 262"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1.5"
              strokeDasharray="3,3"
              opacity="0.75"
            />
          </g>

          {/* Vórtice / Remolino de polvo de matriz ósea y calcio girando en la laguna */}
          <g className="howship-vortex-center" aria-hidden="true">
            <circle cx="635" cy="270" r="3.2" fill="#c4ac98" stroke="#8c6f57" strokeWidth="0.6" className="vortex-dust-cw-1" />
            <circle cx="635" cy="270" r="2.5" fill="#d8c1ad" className="vortex-dust-cw-2" />
            <circle cx="635" cy="270" r="3" fill="#bfa38a" className="vortex-dust-cw-3" />

            <circle cx="635" cy="270" r="2.2" fill="#fbbf24" className="vortex-dust-ccw-1" />
            <circle cx="635" cy="270" r="2.6" fill="#c4ac98" className="vortex-dust-ccw-2" />
            <circle cx="635" cy="270" r="2.2" fill="#f59e0b" className="vortex-dust-ccw-3" />
          </g>

          {/* Partículas de corriente ascendente de resorción */}
          <g className="howship-dust-particles" aria-hidden="true">
            <circle cx="578" cy="270" r="3" fill="#c4ac98" stroke="#8c6f57" strokeWidth="0.6" className="bone-resorption-dust bone-dust-1" />
            <circle cx="602" cy="277" r="2.5" fill="#d8c1ad" className="bone-resorption-dust bone-dust-2" />
            <circle cx="622" cy="268" r="3.5" fill="#bfa38a" stroke="#78593f" strokeWidth="0.6" className="bone-resorption-dust bone-dust-3" />
            <circle cx="642" cy="280" r="2.8" fill="#ebdcd0" className="bone-resorption-dust bone-dust-4" />
            <circle cx="664" cy="270" r="3.2" fill="#c4ac98" className="bone-resorption-dust bone-dust-5" />
            <circle cx="688" cy="275" r="2.2" fill="#d8c1ad" className="bone-resorption-dust bone-dust-6" />

            {/* Destellos Ca²⁺ */}
            <circle cx="592" cy="264" r="2.2" fill="#fbbf24" className="bone-resorption-dust bone-dust-7" />
            <circle cx="652" cy="262" r="2.2" fill="#f59e0b" className="bone-resorption-dust bone-dust-8" />
          </g>

          {/* Texto Central HUESO */}
          <text x="350" y="302" textAnchor="middle" fontSize="15" fontWeight="900" fill="#78593f" letterSpacing="0.08em">
            MATRIZ ÓSEA (HUESO)
          </text>

          {/* Osteocito en su laguna con canalículos */}
          <g transform="translate(145, 285)">
            {/* Canalículos */}
            <path d="M -18 -4 Q -35 -18, -48 -25" stroke="#0284c7" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
            <path d="M 0 -10 Q 0 -24, 6 -32" stroke="#0284c7" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
            <path d="M 18 -4 Q 35 -18, 52 -25" stroke="#0284c7" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
            <path d="M -12 8 Q -28 18, -40 24" stroke="#0284c7" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
            <path d="M 12 8 Q 28 18, 40 24" stroke="#0284c7" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
            {/* Osteoplasto y Cuerpo */}
            <ellipse cx="0" cy="0" rx="20" ry="12" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1.6" />
            <ellipse cx="0" cy="0" rx="13" ry="8" fill="#0284c7" />
            <circle cx="-2" cy="-1" r="2" fill="#ffffff" />
            {/* Texto Osteocito centrado debajo */}
            <text x="0" y="32" textAnchor="middle" fontSize="11" fontWeight="900" fill="#0369a1">
              🔵 Osteocito
            </text>
          </g>

          {/* ══════════════════════════════════════════════════════════════════
              2. OSTEOBLASTO (LADO IZQUIERDO)
              ══════════════════════════════════════════════════════════════════ */}
          {/* Estímulo Hormonal PTH */}
          <g transform="translate(40, 14)">
            <rect x="0" y="0" width="170" height="30" rx="7" fill="#fff7ed" stroke="#fdba74" strokeWidth="1.5" filter="url(#medShadow)" />
            <text x="85" y="20" textAnchor="middle" fontSize="13" fontWeight="900" fill="#c2410c">
              ⚡ PTH (+) Estimula
            </text>
            <path d="M 85 30 L 85 48" stroke="#ea580c" strokeWidth="2.5" markerEnd="url(#arrRed)" />
          </g>

          {/* Tarjeta de Título del Osteoblasto */}
          <g transform="translate(40, 52)">
            <rect x="0" y="0" width="170" height="30" rx="7" fill="#f0f9ff" stroke="#0284c7" strokeWidth="2" filter="url(#medShadow)" />
            <text x="85" y="20.5" textAnchor="middle" fontSize="13.5" fontWeight="900" fill="#0369a1">
              🟦 OSTEOBLASTO
            </text>
          </g>

          {/* Cuerpo Celular Grande del Osteoblasto */}
          <g transform="translate(70, 94)">
            <rect x="0" y="0" width="110" height="100" rx="16" fill="url(#obGrad)" stroke="#0369a1" strokeWidth="2.5" filter="url(#cellShadow)" />
            {/* Núcleo Grande */}
            <circle cx="55" cy="42" r="22" fill="#0c4a6e" />
            <circle cx="49" cy="36" r="5.5" fill="#e0f2fe" />
            {/* Texto Interno con espacio holgado */}
            <text x="55" y="84" textAnchor="middle" fontSize="11" fontWeight="900" fill="#ffffff">
              Sintetiza Hueso
            </text>
          </g>

          {/* ══════════════════════════════════════════════════════════════════
              3. VÍA DE SEÑALIZACIÓN RANKL & OPG (CENTRO)
              ══════════════════════════════════════════════════════════════════ */}
          {/* Curva de emisión de RANKL hacia el Osteoclasto */}
          <path d="M 180 135 C 275 80, 420 80, 545 155" fill="none" stroke="#0284c7" strokeWidth="3.2" markerEnd="url(#arrBlue)" />
          
          {/* Tarjeta Amplia de RANKL (Ligando) - Centrada arriba */}
          <g transform="translate(370, 32)">
            <rect x="-90" y="0" width="180" height="32" rx="7" fill="#ffffff" stroke="#0284c7" strokeWidth="2" filter="url(#medShadow)" />
            {/* Triángulo Azul RANKL */}
            <polygon points="-70,11 -61,23 -79,23" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.8" />
            {/* Texto sin salirse del cuadro */}
            <text x="-50" y="21" textAnchor="start" fontSize="13.5" fontWeight="900" fill="#0284c7">
              RANKL (Ligando)
            </text>
          </g>

          {/* Flecha de secreción de OPG */}
          <path d="M 180 162 L 245 162" fill="none" stroke="#7c3aed" strokeWidth="2.5" markerEnd="url(#arrPurple)" />

          {/* Tarjeta Amplia de OPG (Señuelo) */}
          <g transform="translate(250, 146)">
            <rect x="0" y="0" width="170" height="32" rx="7" fill="#faf5ff" stroke="#a855f7" strokeWidth="2" filter="url(#medShadow)" />
            {/* Molécula Y Morada de OPG */}
            <path d="M 18 24 L 18 15 M 18 15 L 12 8 M 18 15 L 24 8" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" />
            {/* Texto con holgura dentro del cuadro */}
            <text x="34" y="21" textAnchor="start" fontSize="13.5" fontWeight="900" fill="#6b21a8">
              🛡️ OPG (Señuelo)
            </text>
          </g>

          {/* Barra Roja de Inhibición (-) con Cuadro Espacioso */}
          <g transform="translate(440, 105)">
            <line x1="0" y1="40" x2="0" y2="-25" stroke="#dc2626" strokeWidth="3.5" />
            <line x1="-14" y1="-25" x2="14" y2="-25" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
            <rect x="10" y="-8" width="95" height="24" rx="5" fill="#fef2f2" stroke="#fca5a5" strokeWidth="1.2" filter="url(#medShadow)" />
            <text x="57" y="9" textAnchor="middle" fontSize="12" fontWeight="900" fill="#dc2626">
              (-) Bloquea
            </text>
          </g>

          {/* ══════════════════════════════════════════════════════════════════
              4. OSTEOCLASTO ACTIVADO (LADO DERECHO)
              ══════════════════════════════════════════════════════════════════ */}
          {/* Freno Hormonal Calcitonina */}
          <g transform="translate(605, 14)">
            <rect x="0" y="0" width="195" height="30" rx="7" fill="#ecfdf5" stroke="#86efac" strokeWidth="1.5" filter="url(#medShadow)" />
            <text x="97" y="20" textAnchor="middle" fontSize="13" fontWeight="900" fill="#047857">
              🛡️ Calcitonina (-) Frena
            </text>
            <path d="M 97 30 L 97 48" stroke="#059669" strokeWidth="2.5" markerEnd="url(#arrGreen)" />
          </g>

          {/* Tarjeta de Título del Osteoclasto */}
          <g transform="translate(585, 52)">
            <rect x="0" y="0" width="235" height="30" rx="7" fill="#f0fdf4" stroke="#16a34a" strokeWidth="2" filter="url(#medShadow)" />
            <text x="117" y="20.5" textAnchor="middle" fontSize="13.5" fontWeight="900" fill="#15803d">
              🟩 OSTEOCLASTO ACTIVADO
            </text>
          </g>

          {/* Cuerpo Celular Gigante Multinucleado del Osteoclasto */}
          <g transform="translate(635, 195)">
            {/* Cuerpo Celular Completo con Sombra y base cerrada */}
            <path
              d="M -85 50 
                 C -98 0, -85 -60, 0 -72 
                 C 85 -60, 98 0, 85 50 
                 Q 0 65, -85 50 Z"
              fill="url(#ocGrad)"
              stroke="#15803d"
              strokeWidth="2.8"
              filter="url(#cellShadow)"
            />

            {/* Borde Festoneado Ondulante (Trazo ÚNICAMENTE inferior, sin trazo interno) */}
            <g clipPath="url(#osteoclastClip)">
              <g className="festoon-roller">
                {/* Relleno verde de fondo sin trazo superior */}
                <path
                  d="M -144 50 
                     Q -135 66, -126 50 Q -117 66, -108 50 Q -99 66, -90 50 Q -81 66, -72 50 
                     Q -63 66, -54 50 Q -45 66, -36 50 Q -27 66, -18 50 Q -9 66, 0 50 
                     Q 9 66, 18 50 Q 27 66, 36 50 Q 45 66, 54 50 Q 63 66, 72 50 
                     Q 81 66, 90 50 Q 99 66, 108 50 Q 117 66, 126 50 Q 135 66, 144 50
                     L 150 -10 L -150 -10 Z"
                  fill="url(#ocGrad)"
                  stroke="none"
                />
                {/* Trazo del borde festoneado inferior exclusivamente (línea abierta) */}
                <path
                  d="M -144 50 
                     Q -135 66, -126 50 Q -117 66, -108 50 Q -99 66, -90 50 Q -81 66, -72 50 
                     Q -63 66, -54 50 Q -45 66, -36 50 Q -27 66, -18 50 Q -9 66, 0 50 
                     Q 9 66, 18 50 Q 27 66, 36 50 Q 45 66, 54 50 Q 63 66, 72 50 
                     Q 81 66, 90 50 Q 99 66, 108 50 Q 117 66, 126 50 Q 135 66, 144 50"
                  fill="none"
                  stroke="#15803d"
                  strokeWidth="2.8"
                />
                {/* Pliegues internos de microvellosidades */}
                <path
                  d="M -144 52 
                     Q -135 60, -126 52 Q -117 60, -108 52 Q -99 60, -90 52 Q -81 60, -72 52 
                     Q -63 60, -54 52 Q -45 60, -36 52 Q -27 60, -18 52 Q -9 60, 0 52 
                     Q 9 60, 18 52 Q 27 60, 36 52 Q 45 60, 54 52 Q 63 60, 72 52 
                     Q 81 60, 90 52 Q 99 60, 108 52 Q 117 60, 126 52 Q 135 60, 144 52"
                  fill="none"
                  stroke="#86efac"
                  strokeWidth="1.2"
                  opacity="0.85"
                />
              </g>
            </g>

            {/* Receptor RANK en membrana con RANKL encajado */}
            <g transform="translate(-80, -22)">
              {/* Copa de Receptor RANK */}
              <path d="M -9 -9 C -9 6, 9 6, 9 -9" fill="none" stroke="#15803d" strokeWidth="3.2" strokeLinecap="round" />
              {/* Triángulo RANKL encajado */}
              <polygon points="0,-17 8,-4 -8,-4" fill="#38bdf8" stroke="#0284c7" strokeWidth="2" />
              
              {/* Etiqueta Amplia para Receptor RANK */}
              <rect x="-135" y="-12" width="116" height="24" rx="5" fill="#ffffff" stroke="#15803d" strokeWidth="1.5" filter="url(#medShadow)" />
              <text x="-77" y="4.5" textAnchor="middle" fontSize="11.5" fontWeight="900" fill="#15803d">
                Receptor RANK
              </text>
            </g>

            {/* 3 Grandes Núcleos */}
            <circle cx="-30" cy="6" r="13" fill="#14532d" /><circle cx="-33" cy="2" r="3.5" fill="#dcfce7" />
            <circle cx="0" cy="-20" r="14" fill="#14532d" /><circle cx="-3" cy="-24" r="3.5" fill="#dcfce7" />
            <circle cx="30" cy="6" r="13" fill="#14532d" /><circle cx="27" cy="2" r="3.5" fill="#dcfce7" />

            {/* Borde Festoneado Etiqueta */}
            <text x="0" y="38" textAnchor="middle" fontSize="11" fontWeight="900" fill="#ffffff">
              Borde Festoneado
            </text>
          </g>

          {/* Resultado: Resorción de Calcio */}
          <g transform="translate(595, 290)">
            <rect x="0" y="0" width="220" height="28" rx="6" fill="#fef2f2" stroke="#ef4444" strokeWidth="1.8" filter="url(#medShadow)" />
            <text x="110" y="19" textAnchor="middle" fontSize="13" fontWeight="900" fill="#b91c1c">
              💥 ↑ Resorción de Calcio (Ca²⁺)
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
};

export default InteractiveCalciumBoneSimulator;
