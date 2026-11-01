import type { CSSProperties } from 'react';
import histologyTree from '../assets/imagenes/arbol-histologia.svg';

export const ChristmasSleigh = () => (
  <svg className="atlas-christmas-sleigh" viewBox="0 0 108 82" fill="none" aria-hidden="true" focusable="false">
    <g className="atlas-christmas-sleigh-flight">
      <path d="m9 47 13 2M4 55h14M11 63h12" stroke="#d3efff" strokeOpacity=".65" strokeWidth="2" strokeLinecap="round" />
      <path d="m28 56 5 13h45l9-11M24 72h60q12 0 13-10" stroke="#ebcb83" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 43h35q10 0 15 8l7-13h15l-8 20q-2 5-9 5H39q-12-1-15-20Z" fill="#b92f46" stroke="#f0bf85" strokeWidth="1.5" />
      <path d="M34 55h34" stroke="#f6da95" strokeWidth="2" strokeLinecap="round" />
      <path d="m37 43-6-16 9-6 10 8 4 15" fill="#426e57" stroke="#a3c7a2" />
      <path d="m31 29 14-5M40 23l5 19" stroke="#e7c47b" strokeWidth="2" />
      <path d="M54 43q-4-18 10-19 17 2 17 25H54Z" fill="#dc4552" />
      <path d="M57 38q8 5 18 2" stroke="#f7f4e9" strokeWidth="4" />
      <circle cx="65" cy="21" r="10" fill="#f4ceaa" />
      <path d="M56 22q-1 18 10 18 13-3 9-18-3 8-10 7-6-1-9-7Z" fill="#fff9ee" />
      <path d="M54 17q0-15 18-14l10 10-10-2-3 6Z" fill="#dc4552" />
      <path d="m54 17 18-1" stroke="#fff7e7" strokeWidth="4" strokeLinecap="round" />
      <circle cx="83" cy="13" r="4" fill="#fff7e7" />
      <circle cx="62" cy="21" r="1" fill="#403544" />
      <circle cx="69" cy="21" r="1" fill="#403544" />
      <path d="M77 36q10-4 13 0" stroke="#f4ceaa" strokeWidth="4" strokeLinecap="round" />
      <path d="M89 37q10 0 15-10" stroke="#e6cb91" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  </svg>
);

export const ChristmasTree = () => (
  <img className="atlas-christmas-tree" src={histologyTree} alt="" aria-hidden="true" />
);

export const ChristmasHeaderSnow = () => (
  <div className="atlas-christmas-snow" aria-hidden="true">
    {Array.from({ length: 38 }, (_, index) => (
      <span key={index} style={{
        left: `${1 + index * 2.55}%`,
        '--snow-size': `${3 + index % 4}px`,
        '--snow-drift': `${index % 2 ? -26 : 32}px`,
        animationDuration: `${7 + index % 6}s`,
        animationDelay: `${-(index * 3.7)}s`,
      } as CSSProperties} />
    ))}
  </div>
);

export const ChristmasHeaderDecor = () => (
  <div className="atlas-christmas-decor" aria-hidden="true">
    <span className="atlas-christmas-ornament atlas-christmas-ornament-left" />
    <span className="atlas-christmas-ornament atlas-christmas-ornament-right" />
    <span className="atlas-christmas-spark atlas-christmas-spark-left">✧</span>
    <span className="atlas-christmas-spark atlas-christmas-spark-right">✧</span>
  </div>
);

export const ChristmasHeaderLights = () => (
  <div className="atlas-christmas-lights" aria-hidden="true">
    <svg viewBox="0 0 1200 40" preserveAspectRatio="none" fill="none">
      <path d="M0 6Q200 42 400 6Q600 42 800 6Q1000 42 1200 6" stroke="currentColor" strokeWidth="1.3" />
    </svg>
    {Array.from({ length: 25 }, (_, index) => (
      <span key={index} style={{
        '--light-index': index,
        '--light-drop': `${6 + 18 * (1 - ((index % 8 - 4) / 4) ** 2)}px`,
      } as CSSProperties} />
    ))}
  </div>
);
